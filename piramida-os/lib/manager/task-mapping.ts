import type { PlanWindow } from "@/lib/planning/types";
import type { NewTaskCard } from "./tasks-store";

// Maps generated run-of-show tasks onto the manager board's card shape
// ({ t, ev, role, due, st, who }). Roles are constrained to TASK_ROLES; due
// dates are computed deterministically from the plan window (AI never invents
// dates — it only suggests the phase a task belongs to).

// Assignable board roles (TASK_ROLES minus "all").
export const ASSIGNABLE_ROLES = ["Event Manager", "Operations", "Inventory", "Technician"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

// Default assignee for freshly generated tasks — intentionally "unassigned" so a
// manager picks them up. avatarColor() falls back to a neutral grey for this.
export const UNASSIGNED_WHO = "—";

export type TaskPhase = "setup" | "pre_event" | "event" | "teardown" | "post_event";
export const TASK_PHASES: TaskPhase[] = ["setup", "pre_event", "event", "teardown", "post_event"];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

const PRIORITY_RANK: Record<TaskPriority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const PHASE_RANK: Record<TaskPhase, number> = { setup: 0, pre_event: 1, event: 2, teardown: 3, post_event: 4 };

// Infer an operations role from a task's wording. Used both to repair an invalid
// AI role and as the deterministic-fallback role. Order matters: AV first, then
// operational logistics, then inventory, else the catch-all Event Manager.
export function inferRole(title: string, description = ""): AssignableRole {
  const text = `${title} ${description}`.toLowerCase();
  if (/\b(av|a\/v|mic|microphone|sound|audio|projector|screen|speaker|livestream|stream|lighting|rig|encoder)\b/.test(text)) {
    return "Technician";
  }
  if (/\b(registration|check-?in|qr|desk|setup|set up|teardown|tear down|strike|signage|wayfinding|clean|security|door|flow|crowd)\b/.test(text)) {
    return "Operations";
  }
  if (/\b(inventory|asset|equipment|source|procure|stock|reserve|return)\b/.test(text)) {
    return "Inventory";
  }
  return "Event Manager";
}

export function isAssignableRole(value: unknown): value is AssignableRole {
  return typeof value === "string" && (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}

// "2026-07-15T..." -> "15 Jul" (the board's compact due style). null -> "TBD".
export function formatDueDate(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

// Deterministic due date for a task phase, derived from the plan window. This is
// the "code calculates" half — the AI only chooses which phase a task is in.
export function phaseDueDate(phase: TaskPhase, window: PlanWindow): Date {
  switch (phase) {
    case "setup":
      return new Date(window.setupStart.getTime() - 30 * 60_000);
    case "pre_event":
      return new Date(window.eventStart.getTime() - 60 * 60_000);
    case "event":
      return new Date(window.eventStart.getTime());
    case "teardown":
      return new Date(window.teardownEnd.getTime());
    case "post_event":
      return new Date(window.teardownEnd.getTime() + 60 * 60_000);
  }
}

export interface EnrichedTask {
  title: string;
  description: string;
  priority: TaskPriority;
  role: AssignableRole;
  phase: TaskPhase;
}

// Sort newest-batch tasks by urgency, then by chronological phase, so the board
// shows them in run-of-show order.
export function sortEnriched(tasks: EnrichedTask[]): EnrichedTask[] {
  return [...tasks].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || PHASE_RANK[a.phase] - PHASE_RANK[b.phase],
  );
}

// Final hop: an enriched task -> a board card in the "todo" column.
export function enrichedToCard(task: EnrichedTask, ctx: { eventName: string; window: PlanWindow }): NewTaskCard {
  return {
    t: task.title,
    ev: ctx.eventName,
    role: task.role,
    due: formatDueDate(phaseDueDate(task.phase, ctx.window)),
    st: "todo",
    who: UNASSIGNED_WHO,
  };
}
