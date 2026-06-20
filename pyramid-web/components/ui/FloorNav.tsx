"use client";

import { FLOORS, usePyramid } from "@/lib/store";

/** Bottom-center prev/next stepper for the floor view (mirrors the reference's
 *  «  ✋  » controls), wired to the floor list + selectFloor. */
export function FloorNav() {
  const { floorId, view, selectFloor } = usePyramid();
  if (view !== "floor" || floorId == null) return null;

  const idx = FLOORS.findIndex((f) => f.id === floorId);
  if (idx === -1) return null;

  const floor = FLOORS[idx];
  const prev = idx > 0 ? FLOORS[idx - 1] : null;
  const next = idx < FLOORS.length - 1 ? FLOORS[idx + 1] : null;

  return (
    <div className="floor-nav">
      <button
        className="floor-nav-btn"
        onClick={() => prev && selectFloor(prev.id)}
        disabled={!prev}
        aria-label={prev ? `Previous floor: ${prev.name}` : "No lower floor"}
        title={prev?.name}
      >
        ‹
      </button>
      <div className="floor-nav-label" style={{ ["--c" as string]: floor.color }}>
        <span className="floor-nav-dot" />
        <span>{floor.name}</span>
      </div>
      <button
        className="floor-nav-btn"
        onClick={() => next && selectFloor(next.id)}
        disabled={!next}
        aria-label={next ? `Next floor: ${next.name}` : "No higher floor"}
        title={next?.name}
      >
        ›
      </button>
    </div>
  );
}
