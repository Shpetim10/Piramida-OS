"use client";

import { useState } from "react";
import { ScreenContainer, useMgrViewport } from "@/components/manager/ScreenContainer";
import { PyramidTwin } from "@/components/manager/twin";
import { SPACES, SPACES_OCC, roomColor, LIME } from "@/lib/manager/data";

const A = LIME;

export default function ManagerSpacesPage() {
  const { isMobile } = useMgrViewport();
  const [focusRoom, setFocusRoom] = useState("green");

  const spacesCols = isMobile ? "1fr" : "1.15fr 0.85fr";

  return (
    <ScreenContainer>
      <div style={{ display: "grid", gridTemplateColumns: spacesCols, gap: 18, alignItems: "start" }}>
        {/* Twin panel */}
        <div style={{ position: "relative", border: "1px solid rgba(255,255,255,.08)", borderRadius: 22, background: "radial-gradient(700px 460px at 50% 24%,rgba(214,255,0,.06),#0B0E13)", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)", backgroundSize: "34px 34px", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: 16, left: 16, padding: "8px 13px", borderRadius: 9, background: "rgba(13,13,18,.6)", border: "1px solid rgba(255,255,255,.08)" }}>
            <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>PYRAMID TWIN</div>
            <div style={{ font: "700 12px Inter, sans-serif", color: "#fff", marginTop: 3 }}>Reservations · 18 Jul</div>
          </div>
          <div style={{ height: "clamp(400px,46vh,520px)", padding: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <PyramidTwin
              selected={["green", "blue", "yellow", "common", "entrance"]}
              layer="occupancy"
              occ={SPACES_OCC}
              focus={focusRoom}
              onRoom={(id) => setFocusRoom(id)}
            />
          </div>
        </div>

        {/* Space rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {SPACES.map((s) => {
            const free = s.status === "Free";
            const isF = focusRoom === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setFocusRoom(s.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  textAlign: "left",
                  padding: 16,
                  border: `1px solid ${isF ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.07)"}`,
                  borderRadius: 15,
                  background: free ? "rgba(21,24,33,.6)" : "#151821",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                <span style={{ width: 10, height: 34, borderRadius: 5, background: roomColor(s.id), flex: "none" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ font: "700 14px Inter, sans-serif", color: "#fff" }}>{s.name}</span>
                    <span
                      style={{
                        font: "700 8px 'JetBrains Mono', monospace",
                        letterSpacing: ".06em",
                        color: free ? "#22C55E" : A,
                        background: free ? "rgba(34,197,94,.14)" : "rgba(214,255,0,.12)",
                        padding: "4px 7px",
                        borderRadius: 6,
                      }}
                    >
                      {s.status}
                    </span>
                  </div>
                  <div style={{ font: "500 11px Inter, sans-serif", color: "#7D8799", marginTop: 4 }}>
                    {s.now} · <span style={{ color: "#AEB5C2" }}>{s.when}</span>
                  </div>
                </div>
                <div style={{ textAlign: "right", flex: "none" }}>
                  <div style={{ font: "700 13px 'JetBrains Mono', monospace", color: "#fff" }}>{s.cap}</div>
                  <div style={{ font: "600 8px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".06em", marginTop: 3 }}>CAP · {s.util}% USED</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </ScreenContainer>
  );
}
