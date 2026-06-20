import { create } from "zustand";
import { FLOORS, type Floor, type EventInfo } from "./pyramid-data";

export type View = "exterior" | "floor" | "interior" | "exploded";

interface State {
  view: View;
  floorId: Floor["id"] | null;
  spaceId: string | null;
  /** local overrides of an event's editable fields (e.g. chair count) keyed by spaceId */
  overrides: Record<string, Partial<EventInfo>>;

  selectFloor: (id: Floor["id"]) => void;
  selectSpace: (id: string) => void;
  /** enter the exploded "sliced pyramid" overview */
  explode: () => void;
  back: () => void;
  reset: () => void;
  updateEvent: (spaceId: string, patch: Partial<EventInfo>) => void;
}

export const usePyramid = create<State>((set) => ({
  view: "exterior",
  floorId: null,
  spaceId: null,
  overrides: {},

  selectFloor: (id) => set({ view: "floor", floorId: id, spaceId: null }),
  selectSpace: (id) => set({ view: "interior", spaceId: id }),
  explode: () => set({ view: "exploded", floorId: null, spaceId: null }),
  back: () =>
    set((s) =>
      s.view === "interior"
        ? { view: "floor", spaceId: null }
        : { view: "exterior", floorId: null, spaceId: null },
    ),
  reset: () => set({ view: "exterior", floorId: null, spaceId: null }),
  updateEvent: (spaceId, patch) =>
    set((s) => ({ overrides: { ...s.overrides, [spaceId]: { ...s.overrides[spaceId], ...patch } } })),
}));

/** Resolve an event with any local overrides applied. */
export function useResolvedEvent(spaceId: string | null, base?: EventInfo) {
  const override = usePyramid((s) => (spaceId ? s.overrides[spaceId] : undefined));
  if (!base) {
    // an event created on-the-fly for a previously empty space
    if (override?.layout)
      return {
        title: override.title ?? "New event",
        layout: override.layout,
        chairs: override.chairs ?? 0,
        tables: override.tables,
        status: override.status ?? "draft",
      } as EventInfo;
    return undefined;
  }
  return { ...base, ...override } as EventInfo;
}

export { FLOORS };
