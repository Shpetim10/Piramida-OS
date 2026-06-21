import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { TASKS, TASK_COLUMNS, type ManagerTask } from "./data";

// Shared client-side source of truth for the manager Tasks board.
//
// The board used to read a static const, so tasks created on one screen (e.g.
// the run-of-show tasks the organizer's plan generates) never reached the board.
// This zustand store fixes that: it's seeded from the demo TASKS and persisted
// to localStorage, so the organizer's create flow can append generated tasks and
// the manager board reads them on its next load — across navigation and personas
// in the same browser. In-memory/local is fine for the demo.
//
// Backend seam: swap updateBoard/addGeneratedTasks for the real server actions
// (lib/services/tasks.ts createTask / updateTaskStatus, API route
// app/api/events/[eventId]/tasks) when persisting for real. The demo column ids
// (todo/progress/blocked/done) are kept here — they differ from the Prisma
// TaskStatus enum (TODO/IN_PROGRESS/BLOCKED/READY/DONE/CANCELLED); map at the
// boundary, not on the board.

export const TASK_COLUMN_IDS = TASK_COLUMNS.map((c) => c.id);
export type TaskBoard = Record<string, ManagerTask[]>;

function seedBoard(): TaskBoard {
  const board: TaskBoard = Object.fromEntries(TASK_COLUMN_IDS.map((id) => [id, [] as ManagerTask[]]));
  TASKS.forEach((t, i) => {
    const task: ManagerTask = { ...t, id: `seed-${i}` };
    (board[task.st] ?? (board[task.st] = [])).push(task);
  });
  return board;
}

// A board card without an id — what the task generator hands to the store.
export type NewTaskCard = Omit<ManagerTask, "id">;

interface TasksState {
  board: TaskBoard;
  nextId: number;
  /** Functional board update — mirrors React's setState(prev => next). */
  updateBoard: (updater: (prev: TaskBoard) => TaskBoard) => void;
  /** Allocate a unique, persisted card id (e.g. for the inline composer). */
  genId: () => string;
  /**
   * Append generated tasks to the top of their target column (default todo) so
   * they surface immediately. Returns how many were added. Cards keep their `st`.
   */
  addGeneratedTasks: (cards: NewTaskCard[]) => number;
}

export const useTasksStore = create<TasksState>()(
  persist(
    (set, get) => ({
      board: seedBoard(),
      nextId: 1,
      updateBoard: (updater) => set((s) => ({ board: updater(s.board) })),
      genId: () => {
        const id = `new-${get().nextId}`;
        set((s) => ({ nextId: s.nextId + 1 }));
        return id;
      },
      addGeneratedTasks: (cards) => {
        if (!cards.length) return 0;
        set((s) => {
          let n = s.nextId;
          const board: TaskBoard = { ...s.board };
          const grouped: Record<string, ManagerTask[]> = {};
          for (const card of cards) {
            const col = TASK_COLUMN_IDS.includes(card.st) ? card.st : "todo";
            const task: ManagerTask = { ...card, st: col, id: `gen-${n++}` };
            (grouped[col] ??= []).push(task);
          }
          for (const col of Object.keys(grouped)) {
            board[col] = [...grouped[col], ...(board[col] ?? [])];
          }
          return { board, nextId: n };
        });
        return cards.length;
      },
    }),
    {
      name: "piramida.manager.board.v2",
      storage: createJSONStorage(() => localStorage),
      // skipHydration: read localStorage only after mount (via persist.rehydrate)
      // so the server render and first client render both use the seed — no
      // hydration mismatch. Consumers call useTasksStore.persist.rehydrate().
      skipHydration: true,
      partialize: (s) => ({ board: s.board, nextId: s.nextId }),
    },
  ),
);
