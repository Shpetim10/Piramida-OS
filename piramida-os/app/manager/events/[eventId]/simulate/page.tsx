"use client";

import { use, useState } from "react";
import { ScreenContainer, useMgrViewport } from "@/components/manager/ScreenContainer";
import { PyramidTwin } from "@/components/manager/twin";
import {
  LIME,
  LAYER_DEF,
  LAYER_META,
  ROOM_META,
  ROLE_BY_ROOM,
  ROOM_CAP,
  DEFAULT_ALLOC,
  occMap,
  roomColor,
  occColor,
  fmt,
} from "@/lib/manager/data";

const A = LIME;

type TwinLayer = "allocation" | "occupancy" | "flow" | "setup";

export default function Page({ params }: { params: Promise<{ eventId: string }> }) {
  use(params);
  const { isMobile } = useMgrViewport();

  const [twinLayer, setTwinLayer] = useState<TwinLayer>("allocation");
  const [focusRoom, setFocusRoom] = useState<string>("green");
  const [alloc, setAlloc] = useState<string[]>(DEFAULT_ALLOC);

  const simCols = isMobile ? "1fr" : "1.4fr 0.95fr";

  const occ = occMap();
  const isAlloc = alloc.includes(focusRoom);
  const fr = ROOM_META[focusRoom] || ROOM_META.green;
  const focusOcc = occ[focusRoom] || 0;
  const focusOccColor = occColor(focusOcc);

  const allocCapNum = alloc.reduce((t, id) => t + (ROOM_CAP[id] || 0), 0);
  const allocCapacity = fmt(allocCapNum);

  const lm = LAYER_META[twinLayer];
  const layerLabel = lm[0];
  const layerHint = lm[1];

  const toggleAlloc = () =>
    setAlloc((s) =>
      s.includes(focusRoom) ? s.filter((x) => x !== focusRoom) : s.concat(focusRoom)
    );

  const allocList = ["green", "blue", "yellow", "common", "entrance", "orange"].map((id) => {
    const on = alloc.includes(id);
    const isF = focusRoom === id;
    return {
      id,
      name: ROOM_META[id].name,
      role: ROLE_BY_ROOM[id],
      color: roomColor(id),
      focus: () => setFocusRoom(id),
      border: isF ? "rgba(255,255,255,.25)" : "rgba(255,255,255,.07)",
      bg: on ? "#0F1218" : "rgba(15,18,24,.5)",
      tag: on ? "ALLOCATED" : "FREE",
      tagColor: on ? "#0D0D12" : "#7D8799",
      tagBg: on ? A : "#1A1F2B",
    };
  });

  return (
    <ScreenContainer>
      {/* Layer tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <span style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginRight: 4 }}>
          TWIN LAYER
        </span>
        {LAYER_DEF.map((l) => {
          const active = twinLayer === l.id;
          return (
            <button
              key={l.id}
              onClick={() => setTwinLayer(l.id as TwinLayer)}
              style={{
                padding: "9px 15px",
                borderRadius: 9,
                border: `1px solid ${active ? A : "rgba(255,255,255,.1)"}`,
                background: active ? A : "transparent",
                color: active ? "#0D0D12" : "#AEB5C2",
                font: "600 12px Inter, sans-serif",
                cursor: "pointer",
              }}
            >
              {l.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: simCols, gap: 18, alignItems: "start" }}>
        {/* Twin panel */}
        <div
          style={{
            position: "relative",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 22,
            background: "radial-gradient(780px 520px at 50% 24%,rgba(200,240,0,.07),#0B0E13)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)",
              backgroundSize: "34px 34px",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              padding: "8px 13px",
              borderRadius: 9,
              background: "rgba(13,13,18,.6)",
              border: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>{layerLabel}</div>
            <div style={{ font: "700 12px Inter, sans-serif", color: "#fff", marginTop: 3 }}>{layerHint}</div>
          </div>
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              textAlign: "right",
              padding: "8px 13px",
              borderRadius: 9,
              background: "rgba(13,13,18,.6)",
              border: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>ALLOCATED</div>
            <div style={{ font: "800 16px/1 Inter, sans-serif", color: "#C8F000", marginTop: 3 }}>
              {alloc.length}
              <span style={{ fontSize: 11, color: "#7D8799" }}> / 6 rooms</span>
            </div>
          </div>
          <div style={{ height: "clamp(420px,52vh,580px)", padding: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <PyramidTwin selected={alloc} layer={twinLayer} occ={occ} focus={focusRoom} onRoom={(id) => setFocusRoom(id)} />
          </div>
          <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
            <div style={{ font: "500 11px Inter, sans-serif", color: "#7D8799" }}>
              Click any room to inspect the AI reasoning behind its allocation
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Focus room card */}
          <div
            style={{
              border: "1px solid rgba(200,240,0,.24)",
              borderRadius: 18,
              background: "radial-gradient(420px 240px at 100% 0%,rgba(200,240,0,.07),#151821)",
              padding: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 11, height: 4, borderRadius: 2, background: roomColor(focusRoom) }} />
                <div style={{ font: "800 17px Inter, sans-serif", color: "#fff", letterSpacing: "-.01em" }}>{fr.name}</div>
              </div>
              <span
                style={{
                  font: "600 9px 'JetBrains Mono', monospace",
                  letterSpacing: ".06em",
                  color: isAlloc ? "#0D0D12" : "#7D8799",
                  background: isAlloc ? A : "#1A1F2B",
                  padding: "5px 9px",
                  borderRadius: 7,
                }}
              >
                {fr.role}
              </span>
            </div>
            <div style={{ display: "flex", gap: 18, marginBottom: 16 }}>
              <div>
                <div style={{ font: "800 20px/1 Inter, sans-serif", color: "#fff" }}>{fr.cap}</div>
                <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".08em", marginTop: 4 }}>CAPACITY</div>
              </div>
              <div>
                <div style={{ font: "800 20px/1 Inter, sans-serif", color: focusOccColor }}>{focusOcc}%</div>
                <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".08em", marginTop: 4 }}>OCCUPANCY</div>
              </div>
              <div>
                <div style={{ font: "800 20px/1 Inter, sans-serif", color: "#C8F000" }}>{fr.conf}%</div>
                <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".08em", marginTop: 4 }}>AI CONFIDENCE</div>
              </div>
            </div>
            <div
              style={{
                padding: 14,
                border: "1px solid rgba(255,255,255,.08)",
                borderRadius: 12,
                background: "#0F1218",
                marginBottom: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" stroke="#C8F000" strokeWidth="1.8" fill="none" strokeLinecap="round">
                  <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
                </svg>
                <span style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".1em" }}>WHY THE AI CHOSE THIS</span>
              </div>
              <p style={{ font: "400 13px/1.6 Inter, sans-serif", color: "#E6E9EF", margin: 0, textWrap: "pretty" }}>{fr.reason}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ font: "500 11px Inter, sans-serif", color: "#7D8799" }}>
                Alt: <span style={{ color: "#AEB5C2" }}>{fr.alt}</span>
              </div>
              <button
                onClick={toggleAlloc}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: isAlloc ? "1px solid rgba(255,255,255,.18)" : "none",
                  cursor: "pointer",
                  font: "700 12px Inter, sans-serif",
                  flex: "none",
                  background: isAlloc ? "transparent" : A,
                  color: isAlloc ? "#fff" : "#0D0D12",
                }}
              >
                {isAlloc ? "Remove from plan" : "Allocate to plan"}
              </button>
            </div>
          </div>

          {/* Allocation summary */}
          <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ font: "700 13px Inter, sans-serif", color: "#fff" }}>Allocation summary</div>
              <span style={{ font: "700 11px 'JetBrains Mono', monospace", color: "#C8F000" }}>{allocCapacity} cap · 180 guests</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {allocList.map((r) => (
                <button
                  key={r.id}
                  onClick={r.focus}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    textAlign: "left",
                    padding: "11px 12px",
                    border: `1px solid ${r.border}`,
                    borderRadius: 11,
                    background: r.bg,
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: r.color, flex: "none" }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", font: "600 12px Inter, sans-serif", color: "#fff" }}>{r.name}</span>
                    <span style={{ display: "block", font: "500 10px 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 2 }}>{r.role}</span>
                  </span>
                  <span
                    style={{
                      font: "700 9px 'JetBrains Mono', monospace",
                      letterSpacing: ".06em",
                      flex: "none",
                      color: r.tagColor,
                      background: r.tagBg,
                      padding: "4px 8px",
                      borderRadius: 6,
                    }}
                  >
                    {r.tag}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ScreenContainer>
  );
}
