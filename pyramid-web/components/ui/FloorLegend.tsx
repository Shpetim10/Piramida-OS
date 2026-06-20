"use client";

import dynamic from "next/dynamic";
import { FLOORS, usePyramid } from "@/lib/store";

// The mini view is its own WebGL canvas, so it must be client-only (no SSR) —
// same pattern as the main Scene import in PyramidApp.
const FloorSliceMini = dynamic(() => import("../three/FloorSliceMini"), {
  ssr: false,
  loading: () => <div className="floor-legend-loading">Slicing…</div>,
});

// Right-side panel shown while a floor is open: the REAL sliced pyramid (genuine
// clipped cross-sections) with the current floor highlighted — replacing the old
// abstract width-graded row stack.
export function FloorLegend() {
  const view = usePyramid((s) => s.view);
  const floorId = usePyramid((s) => s.floorId);

  if (view !== "floor") return null;

  const current = FLOORS.find((f) => f.id === floorId);

  return (
    <aside className="floor-legend" aria-label="Sliced pyramid — current floor">
      <div className="floor-legend-title">SLICED VIEW</div>

      <div className="floor-legend-canvas">
        <FloorSliceMini />
      </div>

      <div className="floor-legend-foot" style={current ? { color: current.color } : undefined}>
        {current ? current.name : "Select a level"}
      </div>
    </aside>
  );
}
