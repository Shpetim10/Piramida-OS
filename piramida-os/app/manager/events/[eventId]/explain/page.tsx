"use client";

import { useState } from "react";
import { ScreenContainer, useMgrViewport } from "@/components/manager/ScreenContainer";
import { DecisionGraph } from "@/components/manager/twin";
import { SCENARIOS, AUDIT, LIME } from "@/lib/manager/data";

const A = LIME;

export default function Page({ params }: { params: Promise<{ eventId: string }> }) {
  void params;
  const { isMobile } = useMgrViewport();
  const [scenario, setScenario] = useState("guests");

  const explainCols = isMobile ? "1fr" : "1fr 1fr";
  const impacts = (SCENARIOS[scenario] || SCENARIOS.guests).impacts;

  return (
    <ScreenContainer>
      {/* Decision Graph */}
      <div
        style={{
          border: "1px solid rgba(255,255,255,.07)",
          borderRadius: 18,
          background: "radial-gradient(700px 360px at 30% 0%,rgba(42,111,219,.07),#101319)",
          padding: 22,
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
          <div style={{ font: "700 15px Inter, sans-serif", color: "#fff" }}>Decision Graph</div>
          <span style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>HOW THE PLAN WAS BUILT</span>
        </div>
        <p style={{ font: "500 12px/1.5 Inter, sans-serif", color: "#7D8799", margin: "0 0 8px" }}>
          Every space and asset traced back to the originating requirement.
        </p>
        <div style={{ height: "clamp(260px,32vw,340px)" }}>
          <DecisionGraph />
        </div>
      </div>

      {/* Two columns */}
      <div style={{ display: "grid", gridTemplateColumns: explainCols, gap: 18, alignItems: "start" }}>
        {/* Change Impact */}
        <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", padding: 22 }}>
          <div style={{ font: "700 14px Inter, sans-serif", color: "#fff", marginBottom: 4 }}>Change Impact</div>
          <p style={{ font: "500 12px/1.5 Inter, sans-serif", color: "#7D8799", margin: "0 0 14px" }}>
            Preview what shifts if a decision changes.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {Object.keys(SCENARIOS).map((id) => {
              const active = scenario === id;
              return (
                <button
                  key={id}
                  onClick={() => setScenario(id)}
                  style={{
                    padding: "9px 14px",
                    borderRadius: 9,
                    border: `1px solid ${active ? A : "rgba(255,255,255,.1)"}`,
                    background: active ? "rgba(214,255,0,.08)" : "transparent",
                    color: active ? "#fff" : "#AEB5C2",
                    font: "600 12px Inter, sans-serif",
                    cursor: "pointer",
                  }}
                >
                  {SCENARIOS[id].label}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {impacts.map((i, idx) => (
              <div
                key={`${i.area}-${idx}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 11,
                  padding: 13,
                  border: "1px solid rgba(255,255,255,.07)",
                  borderRadius: 12,
                  background: "#0F1218",
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 7,
                    flex: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    font: "700 13px Inter, sans-serif",
                    color: i.c,
                    background: `${i.c}1f`,
                  }}
                >
                  {i.arrow}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ font: "600 12px Inter, sans-serif", color: "#fff" }}>{i.area}</div>
                  <div style={{ font: "500 11px/1.4 Inter, sans-serif", color: "#AEB5C2", marginTop: 3 }}>{i.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Timeline */}
        <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", padding: 22 }}>
          <div style={{ font: "700 14px Inter, sans-serif", color: "#fff", marginBottom: 4 }}>Audit Timeline</div>
          <p style={{ font: "500 12px/1.5 Inter, sans-serif", color: "#7D8799", margin: "0 0 16px" }}>
            What happened, who did it, and when.
          </p>
          <div style={{ position: "relative", paddingLeft: 22 }}>
            <div style={{ position: "absolute", left: 5, top: 4, bottom: 4, width: 1, background: "rgba(255,255,255,.1)" }} />
            {AUDIT.map((a, idx) => (
              <div key={`${a.what}-${idx}`} style={{ position: "relative", paddingBottom: 16 }}>
                <span
                  style={{
                    position: "absolute",
                    left: -22,
                    top: 2,
                    width: 11,
                    height: 11,
                    borderRadius: "50%",
                    background: a.c,
                    boxShadow: "0 0 0 3px #151821",
                  }}
                />
                <div style={{ font: "600 13px Inter, sans-serif", color: "#fff" }}>{a.what}</div>
                <div style={{ font: "500 11px 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 3 }}>
                  {a.who} · {a.when}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScreenContainer>
  );
}
