"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PyramidTwin } from "@/lib/PyramidTwin";
import { useViewport } from "@/lib/useViewport";
import { EXPLORE_ORDER, ROOM_DETAIL } from "@/lib/data";

function ExploreInner() {
  const params = useSearchParams();
  const initial = params.get("room");
  const [room, setRoom] = useState(
    initial && ROOM_DETAIL[initial] ? initial : "green"
  );
  const { isMobile } = useViewport();
  const padX = isMobile ? 18 : 52;
  const active = ROOM_DETAIL[room];

  return (
    <div>
      <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 40, paddingBottom: 16 }}>
        <div style={{ font: "600 11px/1 'JetBrains Mono', monospace", color: "#D6FF00", letterSpacing: ".2em", marginBottom: 13 }}>
          EXPLORE THE PYRAMID
        </div>
        <h1 style={{ font: "800 clamp(30px,4.4vw,52px)/1.04 Inter, sans-serif", letterSpacing: "-.03em", margin: "0 0 14px", color: "#fff" }}>
          Look inside every room
        </h1>
        <p style={{ font: "400 16px/1.55 Inter, sans-serif", color: "#AEB5C2", maxWidth: 560, margin: 0, textWrap: "pretty" }}>
          Tap any space in the 2.5D model to see its capacity, facilities, photos and
          the kind of events it hosts.
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
        <div
          style={{
            position: "relative",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 20,
            background: "radial-gradient(700px 420px at 50% 30%,rgba(214,255,0,.05),#0B0E13)",
            overflow: "hidden",
            minHeight: "clamp(360px,46vw,560px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 26,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div style={{ position: "absolute", top: 16, left: 16, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ padding: "7px 12px", borderRadius: 8, background: "rgba(13,13,18,.6)", border: "1px solid rgba(255,255,255,.08)", font: "600 10px 'JetBrains Mono', monospace", color: "#AEB5C2", letterSpacing: ".1em" }}>
              2.5D MODEL
            </span>
            <span style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#7D8799" }}>TAP A ROOM</span>
          </div>
          <div style={{ position: "relative", width: "100%", maxWidth: 560 }}>
            <PyramidTwin selected={[room]} labels showRoutes={false} onRoom={(id) => setRoom(id)} />
          </div>
        </div>

        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {EXPLORE_ORDER.map((id) => {
              const r = ROOM_DETAIL[id];
              const on = room === id;
              return (
                <button
                  key={id}
                  onClick={() => setRoom(id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "9px 13px",
                    borderRadius: 10,
                    border: `1px solid ${on ? "rgba(214,255,0,.4)" : "rgba(255,255,255,.1)"}`,
                    background: on ? "rgba(214,255,0,.07)" : "#151821",
                    color: on ? "#fff" : "#AEB5C2",
                    font: "600 13px Inter, sans-serif",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: r.c }} />
                  {r.name}
                </button>
              );
            })}
          </div>

          <div style={{ border: "1px solid rgba(214,255,0,.25)", borderRadius: 18, background: "linear-gradient(180deg,rgba(214,255,0,.05),#151821)", overflow: "hidden" }}>
            <div
              style={{
                position: "relative",
                height: 170,
                background: `linear-gradient(135deg,${active.c}44,#101319)`,
                overflow: "hidden",
              }}
            >
              <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 2px,transparent 2px 14px)" }} />
              <span style={{ position: "absolute", left: 16, bottom: 14, font: "600 10px 'JetBrains Mono', monospace", color: "#AEB5C2", letterSpacing: ".14em", background: "rgba(13,13,18,.55)", padding: "5px 9px", borderRadius: 6 }}>
                ROOM PHOTO · {active.up}
              </span>
            </div>
            <div style={{ padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ font: "800 23px Inter, sans-serif", color: "#fff", letterSpacing: "-.02em" }}>{active.name}</div>
                  <div style={{ font: "500 12px 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 4 }}>
                    CAPACITY · {active.cap}
                  </div>
                </div>
                <span style={{ padding: "7px 12px", borderRadius: 8, background: "rgba(34,197,94,.12)", font: "600 11px 'JetBrains Mono', monospace", color: "#22C55E" }}>
                  AVAILABLE
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
                EXAMPLE EVENTS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {active.examples.map((ex) => (
                  <div key={ex} style={{ display: "flex", alignItems: "center", gap: 10, font: "600 13px Inter, sans-serif", color: "#fff" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: "#D6FF00" }} />
                    {ex}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={null}>
      <ExploreInner />
    </Suspense>
  );
}
