"use client";

import { Suspense, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Pyramid3D } from "@/components/pyramid3d/Pyramid3D";
import { usePyramid } from "@/lib/store";
import { FLOORS, getFloor } from "@/lib/pyramid-data";
import { useViewport } from "@/lib/useViewport";
import { EXPLORE_ORDER, ROOM_DETAIL, ROOM_ROLE, floorOfRoom, recRooms, spaceRef } from "@/lib/data";
import type { LiveEventMarker } from "@/lib/services/events";

// The sliced "layers" mini legend is its own WebGL canvas, so it must be
// client-only (no SSR) — same pattern as the main Pyramid3D scene import.
const FloorSliceMini = dynamic(() => import("@/components/pyramid3d/FloorSliceMini"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", color: "#7D8799", font: "500 10px 'JetBrains Mono', monospace", letterSpacing: ".1em" }}>
      SLICING…
    </div>
  ),
});

// The demo recommendation: rooms the AI suggests for a ~180-guest conference.
const DEMO_ATTENDEES = 180;

function ExploreInner({ liveEvents }: { liveEvents: LiveEventMarker[] }) {
  const params = useSearchParams();
  const { isMobile } = useViewport();
  const padX = isMobile ? 18 : 52;

  const view = usePyramid((s) => s.view);
  const floorId = usePyramid((s) => s.floorId);
  const spaceId = usePyramid((s) => s.spaceId);
  const selectFloor = usePyramid((s) => s.selectFloor);
  const selectSpace = usePyramid((s) => s.selectSpace);
  const explode = usePyramid((s) => s.explode);
  const reset = usePyramid((s) => s.reset);

  const highlight = useMemo(() => recRooms(DEMO_ATTENDEES), []);

  // Open onto the whole pyramid (exterior) first so visitors orbit the full
  // building before diving into a floor — unless a room was deep-linked via
  // ?room=, in which case jump straight into that room.
  useEffect(() => {
    const wanted = params.get("room");
    if (wanted && spaceRef(wanted)) {
      const f = floorOfRoom(wanted);
      if (f != null) selectFloor(f);
      selectSpace(wanted);
      return;
    }
    reset();
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectRoom(id: string) {
    const f = floorOfRoom(id);
    if (f != null) selectFloor(f);
    selectSpace(id);
  }

  // The room whose detail card is shown: the selected one, else the first
  // recommended room so the panel is never empty.
  const activeId = spaceId && ROOM_DETAIL[spaceId] ? spaceId : highlight[0];
  const active = ROOM_DETAIL[activeId];
  const activeRef = spaceRef(activeId);
  const bookable = !!activeRef?.space.eventable;
  const recommended = highlight.includes(activeId);
  const currentFloor = floorId != null ? getFloor(floorId) : undefined;

  // Live events on the currently-viewed floor (for the HUD live count).
  const liveOnFloor = useMemo(
    () => (currentFloor && view === "floor" ? liveEvents.filter((e) => e.floorNumber === currentFloor.id) : []),
    [liveEvents, currentFloor, view],
  );

  return (
    <div>
      <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 40, paddingBottom: 16 }}>
        <div style={{ font: "600 11px/1 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".2em", marginBottom: 13 }}>
          EXPLORE THE PYRAMID
        </div>
        <h1 style={{ font: "800 clamp(30px,4.4vw,52px)/1.04 Inter, sans-serif", letterSpacing: "-.03em", margin: "0 0 14px", color: "#fff" }}>
          Look inside every room
        </h1>
        <p style={{ font: "400 16px/1.55 Inter, sans-serif", color: "#AEB5C2", maxWidth: 560, margin: 0, textWrap: "pretty" }}>
          Orbit the real 3D Pyramid, switch floors and click any space to see its
          capacity, facilities and what it hosts. Rooms glowing
          <span style={{ color: "#D6FF00", fontWeight: 700 }}> lime</span> are AI-recommended for a
          {" "}{DEMO_ATTENDEES}-guest conference, and a
          <span style={{ color: "#ff5c6c", fontWeight: 700 }}> red LIVE pin</span> marks an event happening now.
        </p>
      </section>

      <section
        style={{
          paddingLeft: padX,
          paddingRight: padX,
          paddingTop: 8,
          paddingBottom: 54,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr",
          gap: 22,
          alignItems: "start",
        }}
      >
        {/* 3D viewport */}
        <div
          style={{
            position: "relative",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 20,
            background: "radial-gradient(700px 420px at 50% 30%,rgba(200,240,0,.05),#0B0E13)",
            overflow: "hidden",
            height: "clamp(420px,56vw,640px)",
          }}
        >
          <Pyramid3D mode="interactive" highlight={highlight} liveEvents={liveEvents} />

          {/* HUD: mode + current floor */}
          <div style={{ position: "absolute", top: 16, left: 16, display: "flex", gap: 8, alignItems: "center", pointerEvents: "none" }}>
            <span style={{ padding: "7px 12px", borderRadius: 8, background: "rgba(13,13,18,.6)", border: "1px solid rgba(255,255,255,.08)", font: "600 10px 'JetBrains Mono', monospace", color: "#AEB5C2", letterSpacing: ".1em" }}>
              3D MODEL
            </span>
            <span style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#7D8799" }}>
              {view === "interior"
                ? "ROOM VIEW · CLICK AWAY TO EXIT"
                : view === "floor"
                ? "CLICK A ROOM"
                : view === "exploded"
                ? "LAYERS · CLICK A LEVEL"
                : "ORBIT · DRAG TO ROTATE"}
            </span>
            {liveOnFloor.length > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 8, background: "rgba(225,29,46,.15)", border: "1px solid rgba(225,29,46,.4)", font: "700 10px 'JetBrains Mono', monospace", color: "#ff5c6c", letterSpacing: ".1em" }}>
                <span style={{ position: "relative", width: 7, height: 7 }}>
                  <span className="live-pin-pulse" style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#ff5c6c" }} />
                  <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#ff5c6c" }} />
                </span>
                {liveOnFloor.length} LIVE
              </span>
            )}
          </div>

          {/* Floor selector */}
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
            }}
          >
            {FLOORS.map((f) => {
              const on = floorId === f.id && view !== "exterior";
              const hasLive = liveEvents.some((e) => e.floorNumber === f.id);
              return (
                <button
                  key={String(f.id)}
                  onClick={() => selectFloor(f.id)}
                  title={f.name}
                  style={{
                    position: "relative",
                    minWidth: 34,
                    height: 34,
                    borderRadius: 9,
                    cursor: "pointer",
                    border: `1px solid ${on ? f.color : "rgba(255,255,255,.12)"}`,
                    background: on ? f.color : "transparent",
                    color: on ? "#0D0D12" : "#AEB5C2",
                    font: "800 13px Inter, sans-serif",
                  }}
                >
                  {f.label}
                  {hasLive && (
                    <span
                      title="Live event on this floor"
                      style={{ position: "absolute", top: 3, right: 3, width: 7, height: 7, borderRadius: "50%", background: "#e11d2e", border: "1px solid rgba(13,13,18,.6)" }}
                    />
                  )}
                </button>
              );
            })}
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
            {/* Sliced "layers" view — pulls the pyramid apart into one slab per
                floor (click a slab to enter that floor). */}
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
          </div>
        </div>

        {/* Sidebar */}
        <div>
          {/* Sliced "layers" legend — a live mini cross-section of the pyramid
              that highlights the floor you're currently viewing. */}
          {(view === "floor" || view === "exploded") && (
            <div
              style={{
                border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 16,
                background: "linear-gradient(180deg,rgba(200,240,0,.04),#101319)",
                overflow: "hidden",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px 0" }}>
                <span style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".16em" }}>
                  LAYERS
                </span>
                <span style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>
                  {view === "exploded" ? "SLICED VIEW" : "YOU ARE HERE"}
                </span>
              </div>
              <div style={{ height: 168, margin: "4px 0" }}>
                <FloorSliceMini />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 14px 13px" }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: currentFloor?.color ?? "#7D8799" }} />
                <span style={{ font: "700 13px Inter, sans-serif", color: currentFloor?.color ?? "#AEB5C2" }}>
                  {currentFloor ? currentFloor.name : "Select a level"}
                </span>
              </div>
            </div>
          )}
          {currentFloor && (
            <div style={{ font: "600 11px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em", marginBottom: 10 }}>
              {currentFloor.name.toUpperCase()}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {EXPLORE_ORDER.map((id) => {
              const r = ROOM_DETAIL[id];
              if (!r) return null;
              const on = activeId === id;
              const rec = highlight.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => selectRoom(id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "9px 13px",
                    borderRadius: 10,
                    border: `1px solid ${on ? "rgba(200,240,0,.4)" : rec ? "rgba(200,240,0,.22)" : "rgba(255,255,255,.1)"}`,
                    background: on ? "rgba(200,240,0,.07)" : "#151821",
                    color: on ? "#fff" : "#AEB5C2",
                    font: "600 13px Inter, sans-serif",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: rec ? "#D6FF00" : r.c }} />
                  {r.name}
                </button>
              );
            })}
          </div>

          {active && (
            <div style={{ border: "1px solid rgba(200,240,0,.25)", borderRadius: 18, background: "linear-gradient(180deg,rgba(200,240,0,.05),#151821)", overflow: "hidden" }}>
              <div style={{ position: "relative", height: 170, background: `linear-gradient(135deg,${active.c}44,#101319)`, overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 2px,transparent 2px 14px)" }} />
                <span style={{ position: "absolute", left: 16, bottom: 14, font: "600 10px 'JetBrains Mono', monospace", color: "#AEB5C2", letterSpacing: ".14em", background: "rgba(13,13,18,.55)", padding: "5px 9px", borderRadius: 6 }}>
                  {active.up}
                </span>
              </div>
              <div style={{ padding: 22 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                  <div>
                    <div style={{ font: "800 23px Inter, sans-serif", color: "#fff", letterSpacing: "-.02em" }}>{active.name}</div>
                    <div style={{ font: "500 12px 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 4 }}>
                      {ROOM_ROLE[activeId]?.toUpperCase()} · CAP {active.cap}
                    </div>
                  </div>
                  <span style={{ padding: "7px 12px", borderRadius: 8, background: recommended ? "rgba(214,255,0,.14)" : bookable ? "rgba(34,197,94,.12)" : "rgba(125,135,153,.14)", font: "600 11px 'JetBrains Mono', monospace", color: recommended ? "#D6FF00" : bookable ? "#22C55E" : "#AEB5C2" }}>
                    {recommended ? "RECOMMENDED" : bookable ? "AVAILABLE" : "TENANT"}
                  </span>
                </div>
                <div style={{ font: "600 11px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em", marginBottom: 10 }}>
                  FACILITIES
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                  {active.facilities.map((f) => (
                    <span key={f} style={{ padding: "7px 12px", borderRadius: 9, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", font: "500 12px Inter, sans-serif", color: "#AEB5C2" }}>
                      {f}
                    </span>
                  ))}
                </div>
                <div style={{ font: "600 11px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em", marginBottom: 10 }}>
                  HOSTS
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {active.examples.map((ex) => (
                    <div key={ex} style={{ display: "flex", alignItems: "center", gap: 10, font: "600 13px Inter, sans-serif", color: "#fff" }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: "#C8F000" }} />
                      {ex}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function ExploreClient({ liveEvents }: { liveEvents: LiveEventMarker[] }) {
  return (
    <Suspense fallback={null}>
      <ExploreInner liveEvents={liveEvents} />
    </Suspense>
  );
}
