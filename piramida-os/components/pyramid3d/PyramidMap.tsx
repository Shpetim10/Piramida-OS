"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, type CSSProperties } from "react";
import { Pyramid3D } from "./Pyramid3D";
import { usePyramid } from "@/lib/store";
import { FLOORS, getFloor, floorsForSpaces } from "@/lib/pyramid-data";

// The sliced "layers" mini legend is its own WebGL canvas → client-only (no SSR).
const FloorSliceMini = dynamic(() => import("./FloorSliceMini"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", color: "#7D8799", font: "500 9px 'JetBrains Mono', monospace", letterSpacing: ".1em" }}>
      SLICING…
    </div>
  ),
});

export interface PyramidMapProps {
  /** AI-recommended room ids that glow in Pyramid OS lime on the floor view. */
  highlight?: string[];
  /** small label shown in the top-left HUD (e.g. "RECOMMENDED SPACES"). */
  badge?: string;
  height?: number | string;
  style?: CSSProperties;
}

/**
 * Self-contained interactive Pyramid map: the real 3D building with an orbitable
 * exterior, a floor selector, the sliced "layers" view and a current-floor
 * legend. Opens on the whole pyramid. Shares the global pyramid store, so only
 * one interactive map should be mounted at a time.
 */
export function PyramidMap({ highlight, badge = "PYRAMID MAP", height = "clamp(360px,44vw,520px)", style }: PyramidMapProps) {
  const view = usePyramid((s) => s.view);
  const floorId = usePyramid((s) => s.floorId);
  const selectFloor = usePyramid((s) => s.selectFloor);
  const explode = usePyramid((s) => s.explode);
  const reset = usePyramid((s) => s.reset);

  // Recommendation mode: any non-empty highlight steers the map to guide the
  // organizer straight to the recommended rooms (grey the rest, open onto their
  // floor, badge it in the selector).
  const recommend = !!highlight && highlight.length > 0;
  const recFloors = useMemo(() => (recommend ? floorsForSpaces(highlight!) : []), [recommend, highlight]);
  const recFloorSet = useMemo(() => new Set<(typeof FLOORS)[number]["id"]>(recFloors), [recFloors]);

  // On mount: with recommendations, open straight onto the first floor that
  // holds them; otherwise show the whole pyramid (exterior). Either way this
  // clears any stale floor/room inherited from a previously-mounted scene.
  useEffect(() => {
    if (recommend && recFloors.length > 0) selectFloor(recFloors[0]);
    else reset();
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentFloor = floorId != null ? getFloor(floorId) : undefined;
  // The sliced legend lets you click slabs to change floor, so it's hidden in
  // recommend mode where the floor is locked to the suggestions.
  const showLegend = !recommend && (view === "floor" || view === "exploded");

  return (
    <div
      style={{
        position: "relative",
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 20,
        background: "radial-gradient(700px 420px at 50% 30%,rgba(200,240,0,.05),#0B0E13)",
        overflow: "hidden",
        height,
        ...style,
      }}
    >
      <Pyramid3D mode="interactive" highlight={highlight} recommendMode={recommend} />

      {/* HUD: badge + current mode/floor hint */}
      <div style={{ position: "absolute", top: 16, left: 16, display: "flex", gap: 8, alignItems: "center", pointerEvents: "none", flexWrap: "wrap", maxWidth: "70%" }}>
        <span style={{ padding: "7px 12px", borderRadius: 8, background: "rgba(13,13,18,.6)", border: "1px solid rgba(200,240,0,.25)", font: "600 10px 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".1em" }}>
          {badge}
        </span>
        <span style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#7D8799" }}>
          {view === "interior"
            ? "ROOM VIEW · CLICK AWAY TO EXIT"
            : view === "floor"
            ? recommend
              ? "RECOMMENDED · OTHER ROOMS DIMMED"
              : "CLICK A ROOM"
            : view === "exploded"
            ? "LAYERS · CLICK A LEVEL"
            : "ORBIT · DRAG TO ROTATE"}
        </span>
      </div>

      {/* Sliced "layers" legend — which floor you're currently viewing */}
      {showLegend && (
        <div
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 132,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,.1)",
            background: "rgba(13,13,18,.66)",
            backdropFilter: "blur(8px)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "9px 11px 0", font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".14em" }}>
            {view === "exploded" ? "SLICED VIEW" : "YOU ARE HERE"}
          </div>
          <div style={{ height: 118 }}>
            <FloorSliceMini />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 11px 10px" }}>
            <span style={{ width: 8, height: 8, borderRadius: 3, background: currentFloor?.color ?? "#7D8799" }} />
            <span style={{ font: "700 11px Inter, sans-serif", color: currentFloor?.color ?? "#AEB5C2" }}>
              {currentFloor ? currentFloor.name : "Pick a level"}
            </span>
          </div>
        </div>
      )}

      {/* Floor selector + home + layers toggle */}
      <div
        style={{
          position: "absolute",
          bottom: 14,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 7,
          padding: "8px 10px",
          borderRadius: 14,
          background: "rgba(13,13,18,.72)",
          border: "1px solid rgba(255,255,255,.1)",
          backdropFilter: "blur(8px)",
          maxWidth: "calc(100% - 28px)",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {FLOORS.map((f) => {
          const on = floorId === f.id && view !== "exterior" && view !== "exploded";
          // In recommend mode only the suggested floor(s) can be opened — every
          // other floor is locked (disabled), so the organizer is guided straight
          // to the recommendations and can't wander.
          const isRec = recommend && recFloorSet.has(f.id);
          const locked = recommend && !isRec;
          return (
            <button
              key={String(f.id)}
              onClick={() => { if (!locked) selectFloor(f.id); }}
              disabled={locked}
              title={locked ? `${f.name} · not part of your plan` : recommend ? `${f.name} · recommended` : f.name}
              style={{
                position: "relative",
                minWidth: 34,
                height: 34,
                borderRadius: 9,
                cursor: locked ? "not-allowed" : "pointer",
                border: `1px solid ${on ? f.color : isRec ? "rgba(200,240,0,.5)" : "rgba(255,255,255,.12)"}`,
                background: on ? f.color : "transparent",
                color: on ? "#0D0D12" : "#AEB5C2",
                font: "800 13px Inter, sans-serif",
                opacity: locked ? 0.3 : 1,
              }}
            >
              {f.label}
              {isRec && !on && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 3,
                    right: 3,
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#C8F000",
                    boxShadow: "0 0 5px 1px rgba(200,240,0,.8)",
                  }}
                />
              )}
            </button>
          );
        })}
        {/* Whole-building + sliced-layers escapes are hidden in recommend mode —
            the map stays locked to the suggested floor(s). */}
        {!recommend && (
          <>
            <button
              onClick={() => reset()}
              title="Whole building"
              style={{
                minWidth: 34,
                height: 34,
                borderRadius: 9,
                cursor: "pointer",
                border: `1px solid ${view === "exterior" ? "#C8F000" : "rgba(255,255,255,.12)"}`,
                background: view === "exterior" ? "#C8F000" : "transparent",
                color: view === "exterior" ? "#0D0D12" : "#AEB5C2",
                font: "800 14px Inter, sans-serif",
              }}
            >
              ⌂
            </button>
            <button
              onClick={() => (view === "exploded" ? reset() : explode())}
              title={view === "exploded" ? "Exit layers" : "Sliced layers view"}
              style={{
                minWidth: 34,
                height: 34,
                borderRadius: 9,
                cursor: "pointer",
                border: `1px solid ${view === "exploded" ? "#C8F000" : "rgba(255,255,255,.12)"}`,
                background: view === "exploded" ? "#C8F000" : "transparent",
                color: view === "exploded" ? "#0D0D12" : "#AEB5C2",
                font: "800 15px Inter, sans-serif",
                lineHeight: 1,
              }}
            >
              ◤
            </button>
          </>
        )}
      </div>
    </div>
  );
}
