"use client";

import { useState } from "react";
import { ScreenContainer, useMgrViewport } from "@/components/manager/ScreenContainer";
import { ReadinessRing, MgrIcon } from "@/components/manager/twin";
import {
  LIME,
  LAUNCH_STATES,
  LAUNCH_CONF,
  GATE_BASE,
  GATE_STATE_MAP,
  GATE_COLOR,
  GATE_ICON,
} from "@/lib/manager/data";

const A = LIME;

export default function Page({ params }: { params: Promise<{ eventId: string }> }) {
  void params;
  const { isMobile } = useMgrViewport();
  const [launchState, setLaunchState] = useState("ready");

  const lc = LAUNCH_CONF[launchState];
  const launchHeroCols = isMobile ? "1fr" : "1.3fr auto";
  const states = GATE_STATE_MAP[launchState];
  const gatesReady = states.filter((s) => s === "ready").length;
  const publishEnabled = launchState !== "blocked";

  return (
    <ScreenContainer>
      {/* Preview state toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginRight: 4 }}>PREVIEW STATE</span>
        {LAUNCH_STATES.map((l) => {
          const active = launchState === l.id;
          return (
            <button
              key={l.id}
              onClick={() => setLaunchState(l.id)}
              style={{
                padding: "9px 16px",
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

      {/* Hero */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          border: `1px solid ${lc.color}40`,
          borderRadius: 22,
          background: `radial-gradient(800px 380px at 18% 0%,${lc.color}1a,transparent 60%),#101319`,
          padding: 30,
        }}
      >
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)", backgroundSize: "34px 34px", pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: launchHeroCols, gap: 26, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", border: `1px solid ${lc.color}47`, borderRadius: 100, background: `${lc.color}14` }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: lc.color, boxShadow: `0 0 8px ${lc.color}` }} />
              <span style={{ font: "600 10px 'JetBrains Mono', monospace", color: lc.color, letterSpacing: ".16em" }}>LAUNCH GATE · {lc.up}</span>
            </div>
            <h1 style={{ font: "800 clamp(30px,4.4vw,52px)/1 Inter, sans-serif", color: "#fff", letterSpacing: "-.03em", margin: "14px 0 12px" }}>{lc.title}</h1>
            <p style={{ font: "400 15px/1.6 Inter, sans-serif", color: "#AEB5C2", maxWidth: 480, margin: "0 0 22px", textWrap: "pretty" }}>{lc.sub}</p>
            <button
              onClick={() => {}}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                padding: "15px 26px",
                borderRadius: 12,
                border: "none",
                font: "700 14px Inter, sans-serif",
                cursor: publishEnabled ? "pointer" : "not-allowed",
                background: publishEnabled ? lc.color : "#1A1F2B",
                color: publishEnabled ? "#0D0D12" : "#525B6B",
                ...(publishEnabled ? { boxShadow: `0 8px 26px ${lc.color}33` } : {}),
              }}
            >
              {publishEnabled ? "Publish event & go live" : "Publishing blocked"}
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "relative", width: 188, height: 188 }}>
              <ReadinessRing pct={lc.score} color={lc.color} />
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div style={{ font: "800 44px/1 Inter, sans-serif", color: "#fff", letterSpacing: "-.03em" }}>
                  {lc.score}<span style={{ fontSize: 20, color: "#7D8799" }}>%</span>
                </div>
                <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: lc.color, letterSpacing: ".14em", marginTop: 6 }}>READINESS</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gates */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "24px 0 14px" }}>
        <div style={{ font: "700 15px Inter, sans-serif", color: "#fff" }}>Launch gates</div>
        <span style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".08em" }}>{gatesReady} / 10 CLEARED</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
        {GATE_BASE.map((g, i) => {
          const s = states[i];
          const c = GATE_COLOR[s];
          return (
            <div
              key={g.k}
              style={{
                border: `1px solid ${s === "ready" ? "rgba(255,255,255,.08)" : `${c}4d`}`,
                borderRadius: 14,
                background: s === "ready" ? "#151821" : `${c}0d`,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ width: 24, height: 24, borderRadius: 7, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: `${c}22` }}>
                  <MgrIcon name={GATE_ICON[s]} color={c} />
                </span>
                <span style={{ flex: 1, font: "700 13px Inter, sans-serif", color: "#fff" }}>{g.k}</span>
                <span style={{ font: "700 8px 'JetBrains Mono', monospace", letterSpacing: ".06em", color: c, background: `${c}1f`, padding: "4px 7px", borderRadius: 6, flex: "none" }}>{s.toUpperCase()}</span>
              </div>
              <p style={{ font: "500 11px/1.5 Inter, sans-serif", color: "#7D8799", margin: 0 }}>{g.note}</p>
            </div>
          );
        })}
      </div>
    </ScreenContainer>
  );
}
