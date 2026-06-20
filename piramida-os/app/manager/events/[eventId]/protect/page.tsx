"use client";

import { useState } from "react";
import { ScreenContainer, useMgrViewport } from "@/components/manager/ScreenContainer";
import { LIME, PLANNER, CONFLICTS } from "@/lib/manager/data";

const A = LIME;

export default function Page(_props: { params: Promise<{ eventId: string }> }) {
  const { isMobile } = useMgrViewport();
  const [resolved, setResolved] = useState<string[]>([]);

  const openConflicts = 4 - resolved.length;
  const conflictCountColor = openConflicts > 0 ? "#EF4444" : "#22C55E";
  const protectCols = isMobile ? "1fr" : "0.9fr 1.1fr";

  return (
    <ScreenContainer>
      <div style={{ display: "grid", gridTemplateColumns: protectCols, gap: 18, alignItems: "start" }}>
        {/* Inventory Planner */}
        <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ font: "700 15px Inter, sans-serif", color: "#fff" }}>Inventory Planner</div>
            <span style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>FOR 18 JUL</span>
          </div>
          <p style={{ font: "500 12px/1.5 Inter, sans-serif", color: "#7D8799", margin: "0 0 18px" }}>
            Required vs reserved vs available — shortages surface in red.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {PLANNER.map((p) => {
              const availPct = Math.min(100, (p.avail / p.req) * 100);
              const resPct = Math.min(100, (p.res / p.req) * 100);
              const figures = `${p.res}/${p.req} · ${p.avail} free`;
              return (
                <div key={p.cat}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ font: "600 12px Inter, sans-serif", color: "#fff" }}>{p.cat}</span>
                    <span
                      style={{
                        font: "700 9px 'JetBrains Mono', monospace",
                        color: p.short ? "#EF4444" : "#22C55E",
                        background: p.short ? "rgba(239,68,68,.12)" : "rgba(34,197,94,.12)",
                        padding: "3px 7px",
                        borderRadius: 6,
                      }}
                    >
                      {p.short ? "SHORT" : "OK"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1, height: 7, borderRadius: 4, background: "#0F1218", overflow: "hidden", position: "relative" }}>
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${availPct}%`, background: "#2A6FDB", opacity: 0.4 }} />
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${resPct}%`, background: p.short ? "#EF4444" : A, borderRadius: 4 }} />
                    </div>
                    <span style={{ font: "600 11px 'JetBrains Mono', monospace", color: "#7D8799", width: 96, textAlign: "right", flex: "none" }}>{figures}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.06)" }}>
            <span style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#2A6FDB" }}>▮ AVAILABLE</span>
            <span style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#C8F000" }}>▮ RESERVED</span>
            <span style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#EF4444" }}>▮ SHORTAGE</span>
          </div>
        </div>

        {/* Conflict Center */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ font: "700 15px Inter, sans-serif", color: "#fff" }}>Conflict Center</div>
              <div style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", marginTop: 3 }}>Problems caught before they reach the floor.</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ font: "800 22px/1 Inter, sans-serif", color: conflictCountColor }}>{openConflicts}</div>
              <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>OPEN</div>
            </div>
          </div>
          {CONFLICTS.map((c) => {
            const done = resolved.includes(c.id);
            return (
              <div
                key={c.id}
                style={{
                  border: `1px solid ${done ? "rgba(34,197,94,.3)" : "rgba(255,255,255,.08)"}`,
                  borderRadius: 16,
                  background: done ? "rgba(34,197,94,.04)" : "#151821",
                  padding: 20,
                  ...(done ? { opacity: 0.85 } : {}),
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span
                    style={{
                      font: "700 9px 'JetBrains Mono', monospace",
                      letterSpacing: ".06em",
                      color: done ? "#0D0D12" : c.sc === A ? "#0D0D12" : "#fff",
                      background: done ? "#22C55E" : c.sc,
                      padding: "5px 8px",
                      borderRadius: 7,
                      flex: "none",
                    }}
                  >
                    {done ? "RESOLVED" : c.sev}
                  </span>
                  <span style={{ font: "700 14px Inter, sans-serif", color: "#fff", flex: 1 }}>{c.title}</span>
                  <span style={{ font: "600 9px 'JetBrains Mono', monospace", color: done ? "#22C55E" : "#7D8799", flex: "none" }}>
                    {done ? "✓ APPLIED" : "OPEN"}
                  </span>
                </div>
                <p style={{ font: "400 13px/1.6 Inter, sans-serif", color: "#AEB5C2", margin: "0 0 12px" }}>{c.explain}</p>
                <div style={{ padding: 13, borderRadius: 12, background: "rgba(200,240,0,.05)", border: "1px solid rgba(200,240,0,.2)", borderLeft: "3px solid #C8F000", marginBottom: 13 }}>
                  <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".1em", marginBottom: 6 }}>AI RECOMMENDATION</div>
                  <p style={{ font: "500 13px/1.5 Inter, sans-serif", color: "#E6E9EF", margin: 0 }}>{c.rec}</p>
                  <div style={{ font: "500 11px Inter, sans-serif", color: "#7D8799", marginTop: 8 }}>
                    Impact if applied: <span style={{ font: "700 12px Inter, sans-serif", color: c.ic }}>{c.impact}</span>
                  </div>
                </div>
                <button
                  onClick={done ? undefined : () => setResolved((r) => r.concat(c.id))}
                  disabled={done}
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 11,
                    border: "none",
                    cursor: done ? "default" : "pointer",
                    font: "700 13px Inter, sans-serif",
                    background: done ? "rgba(34,197,94,.14)" : A,
                    color: done ? "#22C55E" : "#0D0D12",
                    ...(done ? {} : { boxShadow: "0 6px 20px rgba(200,240,0,.2)" }),
                  }}
                >
                  {done ? "Resolution applied" : "Apply AI resolution"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </ScreenContainer>
  );
}
