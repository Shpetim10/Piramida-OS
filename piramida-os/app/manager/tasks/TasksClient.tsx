"use client";

import { useState } from "react";
import { ScreenContainer, useMgrViewport } from "@/components/manager/ScreenContainer";
import { LIME } from "@/lib/manager/data";

const A = LIME;

const TASK_COLUMNS = [
  { id: "todo", label: "To Do", color: "#7D8799" },
  { id: "progress", label: "In Progress", color: "#2A6FDB" },
  { id: "blocked", label: "Blocked", color: "#EF4444" },
  { id: "done", label: "Done", color: "#22C55E" },
];

function statusToCol(status: string): string {
  switch (status) {
    case "TODO": return "todo";
    case "IN_PROGRESS": return "progress";
    case "BLOCKED": return "blocked";
    case "READY":
    case "DONE": return "done";
    default: return "";
  }
}

export type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  eventTitle: string | null;
  assigneeInitials: string;
};

interface Props {
  tasks: TaskRow[];
}

export function TasksClient({ tasks }: Props) {
  const { isMobile, isNarrow } = useMgrViewport();

  const eventTitles = Array.from(new Set(tasks.map((t) => t.eventTitle).filter(Boolean))) as string[];
  const filters = ["all", ...eventTitles];
  const [filterEvent, setFilterEvent] = useState("all");

  const filteredTasks =
    filterEvent === "all" ? tasks : tasks.filter((t) => t.eventTitle === filterEvent);
  const visibleTasks = filteredTasks.filter((t) => statusToCol(t.status) !== "");

  const taskCols = isNarrow ? "1fr" : isMobile ? "1fr 1fr" : "repeat(4,1fr)";

  return (
    <ScreenContainer>
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 18 }}>
        <span
          style={{
            font: "600 10px 'JetBrains Mono', monospace",
            color: "#7D8799",
            letterSpacing: ".1em",
            marginRight: 4,
          }}
        >
          FILTER
        </span>
        {filters.map((f) => {
          const active = filterEvent === f;
          return (
            <button
              key={f}
              onClick={() => setFilterEvent(f)}
              style={{
                padding: "8px 14px",
                borderRadius: 100,
                border: `1px solid ${active ? A : "rgba(255,255,255,.12)"}`,
                background: active ? A : "transparent",
                color: active ? "#0D0D12" : "#AEB5C2",
                font: "600 12px Inter, sans-serif",
                cursor: "pointer",
                maxWidth: 180,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {f === "all" ? "All events" : f}
            </button>
          );
        })}
      </div>

      {visibleTasks.length === 0 && (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            color: "#7D8799",
            font: "500 14px Inter, sans-serif",
          }}
        >
          No tasks found — run <code>npm run db:seed</code> to populate demo data.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: taskCols, gap: 14, alignItems: "start" }}>
        {TASK_COLUMNS.map((col) => {
          const colTasks = visibleTasks.filter((t) => statusToCol(t.status) === col.id);
          return (
            <div
              key={col.id}
              style={{
                background: "#0F1218",
                border: "1px solid rgba(255,255,255,.06)",
                borderRadius: 16,
                padding: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                <span style={{ font: "700 12px Inter, sans-serif", color: "#fff" }}>{col.label}</span>
                <span
                  style={{
                    marginLeft: "auto",
                    font: "700 11px 'JetBrains Mono', monospace",
                    color: "#7D8799",
                  }}
                >
                  {colTasks.length}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {colTasks.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      border: "1px solid rgba(255,255,255,.08)",
                      borderRadius: 12,
                      background: "#151821",
                      padding: 13,
                      borderLeft: `3px solid ${col.color}`,
                    }}
                  >
                    <div
                      style={{
                        font: "600 13px/1.35 Inter, sans-serif",
                        color: "#fff",
                        marginBottom: 9,
                      }}
                    >
                      {t.title}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      {t.eventTitle && (
                        <span
                          style={{
                            font: "600 9px 'JetBrains Mono', monospace",
                            color: "#7D8799",
                            background: "#0F1218",
                            border: "1px solid rgba(255,255,255,.07)",
                            padding: "4px 7px",
                            borderRadius: 6,
                            maxWidth: 120,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {t.eventTitle}
                        </span>
                      )}
                      <span
                        style={{
                          font: "600 9px 'JetBrains Mono', monospace",
                          color: "#AEB5C2",
                        }}
                      >
                        {t.priority}
                      </span>
                      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                        {t.dueAt && (
                          <span
                            style={{
                              font: "500 10px 'JetBrains Mono', monospace",
                              color: "#7D8799",
                            }}
                          >
                            {new Date(t.dueAt).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </span>
                        )}
                        <span
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            font: "700 9px Inter, sans-serif",
                            color: "#0D0D12",
                            background: t.assigneeInitials === "??" ? "#39414F" : A,
                            flex: "none",
                          }}
                        >
                          {t.assigneeInitials}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </ScreenContainer>
  );
}
