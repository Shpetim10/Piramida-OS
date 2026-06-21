"use client";

import dynamic from "next/dynamic";
import { useEffect, type CSSProperties } from "react";
import { usePyramid } from "@/lib/store";
import type { Floor } from "@/lib/pyramid-data";
import type { LiveEventMarker } from "@/lib/services/events";

// r3f touches window/DOM, so the WebGL <Canvas> must be client-only. This is the
// SSR-safe boundary required by the port (mirrors pyramid-web/PyramidApp.tsx).
const Scene = dynamic(() => import("./Scene"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        width: "100%",
        height: "100%",
        color: "#7D8799",
        font: "500 13px 'JetBrains Mono', monospace",
        letterSpacing: ".1em",
      }}
    >
      LOADING THE PYRAMID…
    </div>
  ),
});

export type Pyramid3DMode = "ambient" | "interactive" | "map";

export interface Pyramid3DProps {
  /** ambient = locked auto-rotating hero (home); interactive = full orbit + room
   *  selection (explore); map = locked, slowly orbiting floor view (guest map). */
  mode?: Pyramid3DMode;
  /** AI-recommended room ids that glow in Pyramid OS lime on the floor view. */
  highlight?: string[];
  /** Live events (from the DB timeline) to mark with LIVE pins on the floor view. */
  liveEvents?: LiveEventMarker[];
  /** Recommendation mode: grey every room that isn't in `highlight` so the eye
   *  lands only on the recommended ones. Opt-in (off for explore/guest map). */
  recommendMode?: boolean;
  /** floor to open on mount (map always; interactive optional). */
  initialFloor?: Floor["id"];
  className?: string;
  style?: CSSProperties;
}

/**
 * Single ported three.js pyramid presented in three modes. All scene state lives
 * in the shared zustand store (lib/store); this wrapper just sets the initial
 * view for the mode and forwards the presentation flags to the Canvas.
 */
export function Pyramid3D({ mode = "interactive", highlight, liveEvents, recommendMode = false, initialFloor, className, style }: Pyramid3DProps) {
  const reset = usePyramid((s) => s.reset);
  const selectFloor = usePyramid((s) => s.selectFloor);

  useEffect(() => {
    if (mode === "ambient") {
      reset(); // exterior hero — the model self-rotates while exterior
    } else if (mode === "map") {
      selectFloor(initialFloor ?? -1); // open the floor so its rooms + highlight show
    } else if (initialFloor != null) {
      selectFloor(initialFloor);
    }
    // initialFloor is intentionally part of the deps so re-targeting re-frames.
  }, [mode, initialFloor, reset, selectFloor]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        // Only the interactive (/explore) scene should capture pointer/scroll.
        // As an ambient hero background or a decorative map it must never trap
        // the page's scroll or clicks. Caller `style` can still override.
        pointerEvents: mode === "interactive" ? "auto" : "none",
        ...style,
      }}
      className={className}
    >
      <Scene interactive={mode === "interactive"} autoRotate={mode === "map"} highlight={highlight} liveEvents={liveEvents} recommendMode={recommendMode} bare={mode === "ambient"} />
    </div>
  );
}
