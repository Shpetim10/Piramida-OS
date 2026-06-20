"use client";

import { ScreenContainer } from "@/components/manager/ScreenContainer";
import { INV_SUMMARY, INV_CATS, LIME } from "@/lib/manager/data";

const A = LIME;

export default function ManagerInventoryPage() {
  return (
    <ScreenContainer>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 20 }}>
        {INV_SUMMARY.map((s) => (
          <div key={s.label} style={{ border: `1px solid ${s.tone === A ? "rgba(214,255,0,.2)" : "rgba(255,255,255,.07)"}`, borderRadius: 16, background: "#151821", padding: 18 }}>
            <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginBottom: 12 }}>{s.label.toUpperCase()}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span style={{ font: "800 30px/1 Inter, sans-serif", letterSpacing: "-.03em", color: s.tone }}>{s.value}</span>
              <span style={{ font: "600 12px Inter, sans-serif", color: "#7D8799" }}>{s.unit}</span>
            </div>
            <div style={{ font: "500 11px Inter, sans-serif", color: "#7D8799", marginTop: 6 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Category header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ font: "700 15px Inter, sans-serif", color: "#fff" }}>Category health</div>
        <span style={{ font: "500 12px Inter, sans-serif", color: "#7D8799" }}>Operational awareness — not stock management.</span>
      </div>

      {/* Category cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
        {INV_CATS.map((c) => (
          <div key={c.cat} style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, background: "#151821", padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div style={{ font: "700 14px Inter, sans-serif", color: "#fff" }}>{c.cat}</div>
                <div style={{ font: "500 11px Inter, sans-serif", color: "#7D8799", marginTop: 3 }}>{c.items}</div>
              </div>
              <span style={{ font: "700 9px 'JetBrains Mono', monospace", letterSpacing: ".06em", color: c.sc, background: `${c.sc}1f`, padding: "5px 9px", borderRadius: 7, flex: "none" }}>{c.status}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
              <div style={{ flex: 1, height: 7, borderRadius: 4, background: "#0F1218", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${c.health}%`, borderRadius: 4, background: c.sc }} />
              </div>
              <span style={{ font: "800 15px 'JetBrains Mono', monospace", color: c.sc }}>{c.health}</span>
            </div>
            <div style={{ font: "500 12px/1.45 Inter, sans-serif", color: "#AEB5C2" }}>{c.note}</div>
          </div>
        ))}
      </div>
    </ScreenContainer>
  );
}
