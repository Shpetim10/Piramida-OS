"use client";

import { FLOORS, usePyramid } from "@/lib/store";

export function FloorSelector() {
  const { floorId, view, selectFloor, reset } = usePyramid();
  if (view === "interior") return null;

  return (
    <div className="floor-selector">
      <div className="floor-selector-label">PËRZGJIDH KATIN · SELECT FLOOR</div>
      <div className="floor-hexes">
        {FLOORS.map((f) => {
          const active = floorId === f.id;
          return (
            <button
              key={String(f.id)}
              className={`hex ${active ? "active" : ""}`}
              style={{ ["--c" as string]: f.color }}
              onClick={() => selectFloor(f.id)}
              title={f.name}
            >
              <span>{f.label}</span>
            </button>
          );
        })}
        <button className="hex park" onClick={reset} title="Exterior view">
          <span>⌂</span>
        </button>
      </div>
    </div>
  );
}
