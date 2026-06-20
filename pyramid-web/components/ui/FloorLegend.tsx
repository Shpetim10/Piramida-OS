"use client";

import { FLOORS, usePyramid } from "@/lib/store";
import type { Floor } from "@/lib/pyramid-data";

// Building order, top → bottom: the park is the apex, the lower level (-1) the
// wide base. The park has no numeric id, so it always ranks highest.
const rank = (id: Floor["id"]) => (id === "park" ? 999 : id);

export function FloorLegend() {
  const view = usePyramid((s) => s.view);
  const floorId = usePyramid((s) => s.floorId);
  const selectFloor = usePyramid((s) => s.selectFloor);

  if (view !== "floor") return null;

  const rows = [...FLOORS].sort((a, b) => rank(b.id) - rank(a.id));
  const n = rows.length;

  return (
    <aside className="floor-legend" aria-label="Pyramid floor legend">
      <div className="floor-legend-title">PIRAMIDA · {n} LEVELS</div>

      <div className="floor-legend-stack">
        {rows.map((f, i) => {
          const active = f.id === floorId;
          // Width grows from the apex (narrow) to the base (wide).
          const width = 42 + (i / (n - 1)) * 58; // 42% → 100%
          return (
            <button
              key={String(f.id)}
              className={`floor-legend-row ${active ? "active" : ""}`}
              style={{ width: `${width}%`, ["--c" as string]: f.color }}
              onClick={() => selectFloor(f.id)}
              aria-current={active ? "true" : undefined}
              title={f.name}
            >
              <span className="floor-legend-dot" />
              <span className="floor-legend-label">{f.label}</span>
            </button>
          );
        })}
      </div>

      <div className="floor-legend-foot">{rows.find((f) => f.id === floorId)?.name ?? "Select a level"}</div>
    </aside>
  );
}
