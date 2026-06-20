"use client";

import { ScreenContainer, useMgrViewport } from "@/components/manager/ScreenContainer";
import { DnaRadar } from "@/components/manager/twin";
import {
  LIME,
  SUMMARY_CELLS,
  REQUIREMENTS,
  DNA_DEF,
  UNDERSTAND_ANALYSIS,
} from "@/lib/manager/data";

export default function Page({ params: _params }: { params: Promise<{ eventId: string }> }) {
  void _params;
  const { isMobile } = useMgrViewport();
  const understandCols = isMobile ? "1fr" : "1.3fr 0.9fr";

  return (
    <ScreenContainer>
      <div style={{ display: "grid", gridTemplateColumns: understandCols, gap: 18, alignItems: "start" }}>
        {/* LEFT column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Event summary */}
          <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", padding: 22 }}>
            <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em", marginBottom: 14 }}>EVENT SUMMARY</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 1, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 14, overflow: "hidden" }}>
              {SUMMARY_CELLS.map((c) => (
                <div key={c.k} style={{ background: "#151821", padding: 16 }}>
                  <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".08em", marginBottom: 7 }}>{c.k}</div>
                  <div style={{ font: "700 15px Inter, sans-serif", color: "#fff" }}>{c.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Requirements parsed & mapped */}
          <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", padding: 22 }}>
            <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em", marginBottom: 14 }}>REQUIREMENTS — PARSED &amp; MAPPED</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {REQUIREMENTS.map((r) => (
                <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 13px", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, background: "#0F1218" }}>
                  <span style={{ width: 22, height: 22, borderRadius: 7, background: "rgba(34,197,94,.14)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" stroke="#22C55E" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
                  </span>
                  <span style={{ flex: 1, font: "600 13px Inter, sans-serif", color: "#fff" }}>{r.label}</span>
                  <span style={{ font: "500 11px 'JetBrains Mono', monospace", color: "#7D8799" }}>{r.map}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI analysis */}
          <div style={{ border: "1px solid rgba(200,240,0,.2)", borderRadius: 18, background: "radial-gradient(480px 260px at 0% 0%,rgba(200,240,0,.05),#151821)", padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" stroke={LIME} strokeWidth="1.7" fill="none" strokeLinecap="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" /></svg>
              <span style={{ font: "600 10px 'JetBrains Mono', monospace", color: LIME, letterSpacing: ".12em" }}>AI ANALYSIS</span>
            </div>
            <p style={{ font: "400 14px/1.7 Inter, sans-serif", color: "#E6E9EF", margin: 0, textWrap: "pretty" }}>{UNDERSTAND_ANALYSIS}</p>
          </div>
        </div>

        {/* RIGHT column — Event DNA */}
        <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", padding: 22, position: "sticky", top: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ font: "700 14px Inter, sans-serif", color: "#fff" }}>Event DNA</div>
            <span style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>8 DIMENSIONS</span>
          </div>
          <p style={{ font: "500 11px/1.5 Inter, sans-serif", color: "#7D8799", margin: "0 0 8px" }}>The operational signature of this event.</p>
          <div style={{ height: 230, margin: "0 -6px 8px" }}>
            <DnaRadar dims={DNA_DEF} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {DNA_DEF.map((d) => {
              const c = d.v >= 75 ? LIME : d.v >= 55 ? "#AEB5C2" : "#7D8799";
              return (
                <div key={d.k}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ font: "600 11px Inter, sans-serif", color: "#E6E9EF" }}>{d.k}</span>
                    <span style={{ font: "700 11px 'JetBrains Mono', monospace", color: c }}>{d.v}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "#0F1218", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${d.v}%`, borderRadius: 2, background: d.v >= 75 ? LIME : "#3A4456" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ScreenContainer>
  );
}
