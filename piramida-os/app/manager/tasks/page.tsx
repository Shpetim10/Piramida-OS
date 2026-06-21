import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ScreenContainer, useMgrViewport } from "@/components/manager/ScreenContainer";
import {
  TASK_ROLES,
  TASK_COLUMNS,
  AVATAR_COLOR,
  LIME,
  avatarColor,
  type ManagerTask,
} from "@/lib/manager/data";
import { useTasksStore } from "@/lib/manager/tasks-store";

const A = LIME;
const COLUMN_IDS = TASK_COLUMNS.map((c) => c.id);
const ADD_ROLES = TASK_ROLES.filter((r) => r !== "all");
const ASSIGNEES = Object.keys(AVATAR_COLOR);

// "2026-07-15" -> "15 Jul". Empty input falls back to a neutral placeholder.
function formatDue(value: string): string {
  if (!value) return "TBD";
  const d = new Date(value + "T00:00:00");
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

type Draft = { t: string; ev: string; role: string; due: string; who: string };
const emptyDraft = (): Draft => ({ t: "", ev: "Summit", role: "Operations", due: "", who: "EK" });

export default function ManagerTasksPage() {
  const { isMobile, isNarrow } = useMgrViewport();
  const [taskRole, setTaskRole] = useState("all");
  // Shared, persisted board (also written by the organizer's plan confirmation).
  const board = useTasksStore((s) => s.board);
  const updateBoard = useTasksStore((s) => s.updateBoard);
  const genId = useTasksStore((s) => s.genId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const [composerCol, setComposerCol] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  // Rehydrate the persisted board after mount. The store skips hydration so the
  // server render and first client render both use the seed (no hydration
  // mismatch); this pulls in any saved/generated tasks on the client.
  useEffect(() => {
    void useTasksStore.persist.rehydrate();
  }, []);

  const taskCols = isNarrow ? "1fr" : isMobile ? "1fr 1fr" : "repeat(4,1fr)";

  const sensors = useSensors(
    // distance constraint so taps/clicks (header +, composer fields) still work
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const matchesRole = (t: ManagerTask) => taskRole === "all" || t.role === taskRole;

  const activeTask = useMemo(() => {
    if (!activeId) return null;
    for (const id of COLUMN_IDS) {
      const found = board[id].find((t) => t.id === activeId);
      if (found) return found;
    }
    return null;
  }, [activeId, board]);

  const columnOf = (id: string): string | null => {
    if (COLUMN_IDS.includes(id)) return id;
    return COLUMN_IDS.find((c) => board[c].some((t) => t.id === id)) ?? null;
  };

  // ---- Add ----------------------------------------------------------------
  // Store-backed add. To wire the real backend later, swap the updateBoard call
  // for `await createTask(...)` (lib/services/tasks.ts) mapping the demo `st` id
  // to the Prisma TaskStatus enum, then re-read the column — the shape stays here.
  function addTask(colId: string, keepOpen: boolean) {
    const title = draft.t.trim();
    if (!title) return;
    const task: ManagerTask = {
      id: genId(),
      t: title,
      ev: draft.ev.trim() || "Summit",
      role: draft.role || "Operations",
      due: formatDue(draft.due),
      st: colId,
      who: draft.who || "EK",
    };
    updateBoard((prev) => ({ ...prev, [colId]: [...prev[colId], task] }));
    if (keepOpen) setDraft((d) => ({ ...d, t: "" }));
    else closeComposer();
  }

  // Local-state delete. To persist later, swap for a server delete on lib/services.
  function deleteTask(colId: string, id: string) {
    updateBoard((prev) => ({ ...prev, [colId]: prev[colId].filter((t) => t.id !== id) }));
  }

  function openComposer(colId: string) {
    setComposerCol(colId);
    setDraft(emptyDraft());
  }
  function closeComposer() {
    setComposerCol(null);
    setDraft(emptyDraft());
  }

  // ---- Drag & drop --------------------------------------------------------
  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  // Trello-style live move: as the card hovers a different column, it moves
  // there immediately so the gap/placeholder lands where it will drop.
  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) {
      setOverColumn(null);
      return;
    }
    const activeCol = columnOf(String(active.id));
    const overCol = columnOf(String(over.id));
    setOverColumn(overCol);
    if (!activeCol || !overCol || activeCol === overCol) return;

    updateBoard((prev) => {
      const from = prev[activeCol];
      const to = prev[overCol];
      const moving = from.find((t) => t.id === active.id);
      if (!moving) return prev;
      const overIsColumn = COLUMN_IDS.includes(String(over.id));
      const overIndex = overIsColumn ? to.length : to.findIndex((t) => t.id === over.id);
      const insertAt = overIndex < 0 ? to.length : overIndex;
      return {
        ...prev,
        [activeCol]: from.filter((t) => t.id !== active.id),
        // status (st) changes to the target column — the only field a move edits
        [overCol]: [...to.slice(0, insertAt), { ...moving, st: overCol }, ...to.slice(insertAt)],
      };
    });
  }

  // Authoritative finalize: place the card in its resting column at the drop
  // index AND set its `st` to that column. handleDragOver gives the live
  // preview, but the final state is reconciled here so a move always sticks and
  // the card's accent (col.color) + status stay consistent — even on a fast
  // drop where onDragOver never ran. Swap for updateTaskStatus(...) (guarded by
  // TASK_TRANSITIONS) when persisting cross-column moves server-side.
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    setOverColumn(null);
    if (!over) return;

    const id = String(active.id);
    const overId = String(over.id);
    const fromCol = columnOf(id);
    const toCol = columnOf(overId);
    if (!fromCol || !toCol) return;
    const overIsColumn = COLUMN_IDS.includes(overId);

    updateBoard((prev) => {
      const from = [...prev[fromCol]];
      const fromIndex = from.findIndex((t) => t.id === id);
      if (fromIndex < 0) return prev;

      if (fromCol === toCol) {
        const newIndex = overIsColumn ? from.length - 1 : from.findIndex((t) => t.id === overId);
        if (newIndex < 0 || newIndex === fromIndex) {
          if (from[fromIndex].st === fromCol) return prev; // already consistent
          from[fromIndex] = { ...from[fromIndex], st: fromCol };
          return { ...prev, [fromCol]: from };
        }
        return { ...prev, [fromCol]: arrayMove(prev[fromCol], fromIndex, newIndex) };
      }

      // Cross-column: remove from source, insert into target with updated status.
      const to = [...prev[toCol]];
      const moving: ManagerTask = { ...from[fromIndex], st: toCol };
      from.splice(fromIndex, 1);
      const overIndex = overIsColumn ? to.length : to.findIndex((t) => t.id === overId);
      to.splice(overIndex < 0 ? to.length : overIndex, 0, moving);
      return { ...prev, [fromCol]: from, [toCol]: to };
    });
  }

  function handleDragCancel() {
    setActiveId(null);
    setOverColumn(null);
  }

  return (
    <ScreenContainer>
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 18 }}>
        <span style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginRight: 4 }}>FILTER</span>
        {TASK_ROLES.map((r) => {
          const active = taskRole === r;
          return (
            <button
              key={r}
              onClick={() => setTaskRole(r)}
              style={{
                padding: "8px 14px",
                borderRadius: 100,
                border: `1px solid ${active ? A : "rgba(255,255,255,.12)"}`,
                background: active ? A : "transparent",
                color: active ? "#0D0D12" : "#AEB5C2",
                font: "600 12px Inter, sans-serif",
                cursor: "pointer",
              }}
            >
              {r === "all" ? "All roles" : r}
            </button>
          );
        })}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div style={{ display: "grid", gridTemplateColumns: taskCols, gap: 14, alignItems: "start" }}>
          {TASK_COLUMNS.map((col) => {
            const visible = board[col.id].filter(matchesRole);
            return (
              <Column
                key={col.id}
                col={col}
                tasks={visible}
                count={visible.length}
                isOver={overColumn === col.id && activeId != null}
                composerOpen={composerCol === col.id}
                draft={draft}
                onOpenComposer={() => openComposer(col.id)}
                onCloseComposer={closeComposer}
                onDraftChange={setDraft}
                onSubmit={(keepOpen) => addTask(col.id, keepOpen)}
                onDelete={(id) => deleteTask(col.id, id)}
              />
            );
          })}
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(.18,.67,.6,1.22)" }}>
          {activeTask ? (
            <TaskCard task={activeTask} color={colColor(activeTask.st)} overlay />
          ) : null}
        </DragOverlay>
      </DndContext>
    </ScreenContainer>
  );
}

function colColor(st: string): string {
  return TASK_COLUMNS.find((c) => c.id === st)?.color ?? "#7D8799";
}

// ---------- Column ----------
function Column({
  col,
  tasks,
  count,
  isOver,
  composerOpen,
  draft,
  onOpenComposer,
  onCloseComposer,
  onDraftChange,
  onSubmit,
  onDelete,
}: {
  col: { id: string; label: string; color: string };
  tasks: ManagerTask[];
  count: number;
  isOver: boolean;
  composerOpen: boolean;
  draft: Draft;
  onOpenComposer: () => void;
  onCloseComposer: () => void;
  onDraftChange: (d: Draft) => void;
  onSubmit: (keepOpen: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: col.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        background: isOver ? "#12161F" : "#0F1218",
        border: `1px solid ${isOver ? "rgba(200,240,0,.45)" : "rgba(255,255,255,.06)"}`,
        boxShadow: isOver ? "0 0 0 3px rgba(200,240,0,.10)" : "none",
        borderRadius: 16,
        padding: 14,
        transition: "background .15s ease, border-color .15s ease, box-shadow .15s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
        <span style={{ font: "700 12px Inter, sans-serif", color: "#fff" }}>{col.label}</span>
        <span style={{ marginLeft: "auto", font: "700 11px 'JetBrains Mono', monospace", color: "#7D8799" }}>{count}</span>
        <button
          aria-label={`Add task to ${col.label}`}
          onClick={onOpenComposer}
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,.12)",
            background: "transparent",
            color: "#AEB5C2",
            font: "600 14px Inter, sans-serif",
            lineHeight: "18px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          +
        </button>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 8 }}>
          {tasks.map((t) => (
            <SortableCard key={t.id} task={t} color={col.color} onDelete={onDelete} />
          ))}
        </div>
      </SortableContext>

      {composerOpen ? (
        <Composer
          color={col.color}
          draft={draft}
          onChange={onDraftChange}
          onCancel={onCloseComposer}
          onSubmit={onSubmit}
        />
      ) : (
        <button
          onClick={onOpenComposer}
          style={{
            marginTop: 10,
            width: "100%",
            padding: "9px 12px",
            borderRadius: 10,
            border: "1px dashed rgba(255,255,255,.14)",
            background: "transparent",
            color: "#7D8799",
            font: "600 12px Inter, sans-serif",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          + Add task
        </button>
      )}
    </div>
  );
}

// ---------- Composer ----------
function Composer({
  color,
  draft,
  onChange,
  onCancel,
  onSubmit,
}: {
  color: string;
  draft: Draft;
  onChange: (d: Draft) => void;
  onCancel: () => void;
  onSubmit: (keepOpen: boolean) => void;
}) {
  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "7px 9px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,.10)",
    background: "#0F1218",
    color: "#fff",
    font: "500 12px Inter, sans-serif",
    outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    font: "600 8px 'JetBrains Mono', monospace",
    color: "#7D8799",
    letterSpacing: ".08em",
    display: "block",
    marginBottom: 4,
  };

  return (
    <div
      style={{
        marginTop: 10,
        border: "1px solid rgba(255,255,255,.10)",
        borderLeft: `3px solid ${color}`,
        borderRadius: 12,
        background: "#151821",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 9,
      }}
    >
      <input
        autoFocus
        value={draft.t}
        placeholder="Task title…"
        onChange={(e) => onChange({ ...draft, t: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit(true); // Enter quick-adds and keeps the composer open
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        style={{ ...fieldStyle, font: "600 13px Inter, sans-serif" }}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
        <div>
          <label style={labelStyle}>EVENT</label>
          <input
            value={draft.ev}
            placeholder="Summit"
            onChange={(e) => onChange({ ...draft, ev: e.target.value })}
            onKeyDown={(e) => e.key === "Escape" && onCancel()}
            style={fieldStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>ROLE</label>
          <select
            value={draft.role}
            onChange={(e) => onChange({ ...draft, role: e.target.value })}
            style={fieldStyle}
          >
            {ADD_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>DUE</label>
          <input
            type="date"
            value={draft.due}
            onChange={(e) => onChange({ ...draft, due: e.target.value })}
            onKeyDown={(e) => e.key === "Escape" && onCancel()}
            style={fieldStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>ASSIGNEE</label>
          <select
            value={draft.who}
            onChange={(e) => onChange({ ...draft, who: e.target.value })}
            style={fieldStyle}
          >
            {ASSIGNEES.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        <button
          onClick={() => onSubmit(false)}
          disabled={!draft.t.trim()}
          style={{
            padding: "7px 14px",
            borderRadius: 8,
            border: "none",
            background: draft.t.trim() ? A : "rgba(200,240,0,.25)",
            color: "#0D0D12",
            font: "700 12px Inter, sans-serif",
            cursor: draft.t.trim() ? "pointer" : "not-allowed",
          }}
        >
          Add task
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "7px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,.12)",
            background: "transparent",
            color: "#AEB5C2",
            font: "600 12px Inter, sans-serif",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <span style={{ marginLeft: "auto", font: "500 9px 'JetBrains Mono', monospace", color: "#5A6373" }}>
          ↵ add · esc cancel
        </span>
      </div>
    </div>
  );
}

// ---------- Sortable card wrapper ----------
function SortableCard({ task, color, onDelete }: { task: ManagerTask; color: string; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} color={color} placeholder={isDragging} onDelete={() => onDelete(task.id)} />
    </div>
  );
}

// ---------- Presentational card (shared by board + drag overlay) ----------
function TaskCard({
  task,
  color,
  placeholder,
  overlay,
  onDelete,
}: {
  task: ManagerTask;
  color: string;
  placeholder?: boolean;
  overlay?: boolean;
  onDelete?: () => void;
}) {
  return (
    <div
      style={{
        position: "relative",
        border: placeholder ? `1px dashed ${A}` : "1px solid rgba(255,255,255,.08)",
        borderRadius: 12,
        background: "#151821",
        padding: 13,
        borderLeft: `3px solid ${color}`,
        cursor: overlay ? "grabbing" : "grab",
        opacity: placeholder ? 0.4 : 1,
        // lifted + tilted preview while dragging
        transform: overlay ? "rotate(2.5deg) scale(1.03)" : undefined,
        boxShadow: overlay ? "0 18px 38px rgba(0,0,0,.55)" : "none",
        userSelect: "none",
        touchAction: "none",
      }}
    >
      {onDelete && !placeholder ? (
        <button
          aria-label="Delete task"
          // stop pointer down from arming a drag; click deletes
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 20,
            height: 20,
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,.10)",
            background: "#0F1218",
            color: "#7D8799",
            font: "600 13px Inter, sans-serif",
            lineHeight: "16px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
          }}
        >
          ×
        </button>
      ) : null}
      <div style={{ font: "600 13px/1.35 Inter, sans-serif", color: "#fff", marginBottom: 9, paddingRight: onDelete ? 22 : 0, visibility: placeholder ? "hidden" : "visible" }}>
        {task.t}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", visibility: placeholder ? "hidden" : "visible" }}>
        <span style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", background: "#0F1218", border: "1px solid rgba(255,255,255,.07)", padding: "4px 7px", borderRadius: 6 }}>{task.ev}</span>
        <span style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#AEB5C2" }}>{task.role}</span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#7D8799" }}>{task.due}</span>
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              font: "700 9px Inter, sans-serif",
              color: task.who === "EK" ? "#0D0D12" : "#fff",
              background: avatarColor(task.who),
              flex: "none",
            }}
          >
            {task.who}
          </span>
        </span>
      </div>
    </div>
  );
}
