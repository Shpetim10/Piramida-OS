"use client";

import { Pyramid3D } from "@/components/pyramid3d/Pyramid3D";
import { floorOfRoom } from "@/lib/data";

// PyramidTwin now renders the real three.js pyramid (ported from pyramid-web)
// instead of the old demo SVG triangle. The public prop contract is preserved so
// existing callers (events guest map, organizer create) keep working — but
// `selected` now carries REAL 3D room ids (e.g. "km1-4"), not the six demo ids.
//
//   • hero  → ambient, locked, auto-rotating exterior (no room highlight).
//   • else  → a locked, slowly-orbiting floor view that highlights `selected`
//             rooms in Pyramid OS lime. `labels` / `showRoutes` are accepted for
//             compatibility but the 3D scene conveys the same information via the
//             in-scene room pins and the lime highlight, so they are no-ops here.
export interface PyramidTwinProps {
  selected?: string[];
  showRoutes?: boolean;
  labels?: boolean;
  hero?: boolean;
  onRoom?: (id: string) => void;
}

export function PyramidTwin({ selected = [], hero = false }: PyramidTwinProps) {
  // Open the floor of the first highlighted room so its lime-glowing rooms are
  // in view (recommendations stay on one floor — see recRooms in lib/data).
  const initialFloor = selected.length ? floorOfRoom(selected[0]) ?? -1 : -1;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "5 / 4",
        minHeight: 280,
        maxHeight: 460,
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <Pyramid3D
        mode={hero ? "ambient" : "map"}
        highlight={hero ? undefined : selected}
        initialFloor={initialFloor}
      />
    </div>
  );
}
