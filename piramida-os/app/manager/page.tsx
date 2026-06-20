"use client";

import Link from "next/link";
import { ScreenContainer, useMgrViewport } from "@/components/manager/ScreenContainer";
import { PyramidTwin, ReadinessRing } from "@/components/manager/twin";
import {
  LIME,
  FOCUS_EVENT_ID,
  KPI_DEF,
  ATTENTION,
  PIPE_STEPS,
  PIPE_COLOR,
  ACTIVE_EVENTS,
  occMap,
} from "@/lib/manager/data";

const A = LIME;

export default function ManagerDashboardPage() {
  const { isMobile } = useMgrViewport();
  const e = (s: string) => `/manager/events/${FOCUS_EVENT_ID}/${s}`;
  const target = (to: string) => (to === "requests" ? "/manager/requests" : e(to));

  return (
    <ScreenContainer>
      {/* Hero */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          border: "1px solid rgba(200,240,0,.22)",
          borderRadius: 22,
          background: "radial-gradient(900px 420px at 18% 0%,rgba(200,240,0,.10),transparent 60%),#101319",
          padding: 30,
          marginBottom: 22,
        }}
      >
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)", backgroundSize: "34px 34px", pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.4fr auto", gap: 28, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", border: "1px solid rgba(200,240,0,.28)", borderRadius: 100, background: "rgba(200,240,0,.05)", marginBottom: 16 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: A, boxShadow: "0 0 8px #C8F000" }} />
              <span style={{ font: "600 10px/1 'JetBrains Mono', monospace", color: A, letterSpacing: ".16em" }}>OPERATIONAL STATUS · LIVE</span>
            </div>
            <h1 style={{ font: "800 clamp(28px,4vw,46px)/1 Inter, sans-serif", color: "#fff", letterSpacing: "-.03em", margin: "0 0 12px" }}>
              Pyramid is <span style={{ color: A }}>92% operational-ready</span>
            </h1>
            <p style={{ font: "400 15px/1.6 Inter, sans-serif", color: "#AEB5C2", maxWidth: 520, margin: "0 0 22px", textWrap: "pretty" }}>
              3 events in the pipeline. One flagship — the NextGen Startup Summit — is mid-simulation with a single medium conflict standing between it and launch.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href={e("simulate")} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 20px", border: "none", borderRadius: 11, background: A, color: "#0D0D12", font: "700 13px Inter, sans-serif", cursor: "pointer", boxShadow: "0 6px 22px rgba(200,240,0,.2)", textDecoration: "none" }}>
                Open Simulation
                <svg width="15" height="15" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
              <Link href={e("protect")} style={{ padding: "13px 20px", border: "1px solid rgba(255,255,255,.14)", borderRadius: 11, background: "transparent", color: "#fff", font: "600 13px Inter, sans-serif", cursor: "pointer", textDecoration: "none" }}>
                Resolve 1 conflict
              </Link>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <div style={{ position: "relative", width: 200, height: 200 }}>
              <ReadinessRing pct={92} color={A} />
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                <div style={{ font: "800 46px/1 Inter, sans-serif", color: "#fff", letterSpacing: "-.03em" }}>
                  92<span style={{ fontSize: 22, color: "#7D8799" }}>%</span>
                </div>
                <div style={{ font: "600 9px/1 'JetBrains Mono', monospace", color: A, letterSpacing: ".16em", marginTop: 6 }}>READY</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14, marginBottom: 22 }}>
        {KPI_DEF.map((k) => {
          const valColor = k.tone === A ? A : k.tone === "#fff" ? "#fff" : k.tone;
          return (
            <div key={k.label} style={{ border: `1px solid ${k.tone === A ? "rgba(200,240,0,.22)" : "rgba(255,255,255,.07)"}`, borderRadius: 16, background: k.tone === A ? "linear-gradient(180deg,rgba(200,240,0,.06),#151821)" : "#151821", padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", flex: "none", background: k.tone, boxShadow: `0 0 7px ${k.tone}66` }} />
                <span style={{ font: "600 10px/1 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>{k.label.toUpperCase()}</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                <span style={{ font: "800 30px/1 Inter, sans-serif", letterSpacing: "-.03em", color: valColor }}>{k.value}</span>
                <span style={{ font: "600 13px Inter, sans-serif", color: "#7D8799" }}>{k.unit || ""}</span>
              </div>
              <div style={{ font: "500 11px/1.3 Inter, sans-serif", color: "#7D8799", marginTop: 6 }}>{k.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Two columns */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 0.9fr", gap: 18, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Needs your attention */}
          <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ font: "700 14px Inter, sans-serif", color: "#fff" }}>Needs your attention</div>
              <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".08em" }}>4 ITEMS</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {ATTENTION.map((a) => (
                <Link key={a.title} href={target(a.to)} style={{ display: "flex", gap: 13, alignItems: "flex-start", textAlign: "left", padding: 13, border: "1px solid rgba(255,255,255,.07)", borderRadius: 13, background: "#0F1218", cursor: "pointer", width: "100%", textDecoration: "none" }}>
                  <span style={{ font: "700 9px 'JetBrains Mono', monospace", letterSpacing: ".06em", color: a.c === A ? "#0D0D12" : "#fff", background: a.c, padding: "5px 8px", borderRadius: 7, flex: "none", alignSelf: "center" }}>{a.sev}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", font: "600 13px/1.3 Inter, sans-serif", color: "#fff" }}>{a.title}</span>
                    <span style={{ display: "block", font: "500 11px/1.4 Inter, sans-serif", color: "#7D8799", marginTop: 3 }}>{a.meta}</span>
                  </span>
                  <span style={{ font: "600 11px 'JetBrains Mono', monospace", color: A, whiteSpace: "nowrap", flex: "none", alignSelf: "center" }}>{a.action} ›</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Summit pipeline */}
          <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ font: "700 14px Inter, sans-serif", color: "#fff" }}>Summit pipeline</div>
              <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".08em" }}>REQUEST → LAUNCH</div>
            </div>
            <p style={{ font: "500 12px/1.5 Inter, sans-serif", color: "#7D8799", margin: "0 0 18px" }}>Where the flagship event sits in the operational pipeline.</p>
            <div style={{ display: "flex", gap: 6 }}>
              {PIPE_STEPS.map((p) => (
                <Link key={p.id} href={target(p.id)} style={{ flex: 1, textAlign: "center", cursor: "pointer", textDecoration: "none" }}>
                  <div style={{ height: 6, borderRadius: 3, background: PIPE_COLOR[p.state], ...(p.state === "active" ? { boxShadow: `0 0 10px ${A}` } : {}), ...(p.state === "pending" ? { opacity: 0.6 } : {}) }} />
                  <div style={{ font: "600 11px Inter, sans-serif", color: p.state === "pending" ? "#7D8799" : "#fff", marginTop: 8 }}>{p.label}</div>
                  <div style={{ font: "600 8px 'JetBrains Mono', monospace", color: "#525B6B", letterSpacing: ".06em", marginTop: 3 }}>{p.state.toUpperCase()}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Live occupancy twin */}
          <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "radial-gradient(420px 280px at 50% 30%,rgba(200,240,0,.05),#101319)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 0" }}>
              <div style={{ font: "700 13px Inter, sans-serif", color: "#fff" }}>Live occupancy</div>
              <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>PYRAMID TWIN</div>
            </div>
            <div style={{ height: 230, padding: "6px 10px 4px" }}>
              <PyramidTwin selected={["green", "blue", "yellow", "common", "entrance"]} layer="occupancy" occ={occMap()} />
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, padding: "0 18px 16px" }}>
              <span style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#22C55E" }}>● UNDER 70%</span>
              <span style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#C8F000" }}>● 70–90%</span>
              <span style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#EF4444" }}>● OVER 90%</span>
            </div>
          </div>

          {/* Active events */}
          <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", padding: 20 }}>
            <div style={{ font: "700 13px Inter, sans-serif", color: "#fff", marginBottom: 14 }}>Active events</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {ACTIVE_EVENTS.map((ev) => (
                <div key={ev.title} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ textAlign: "center", flex: "none", width: 38 }}>
                    <div style={{ font: "800 15px/1 Inter, sans-serif", color: "#fff" }}>{ev.day}</div>
                    <div style={{ font: "600 8px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".08em" }}>{ev.mon}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "600 12px/1.2 Inter, sans-serif", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</div>
                    <div style={{ height: 5, borderRadius: 3, background: "#0F1218", marginTop: 7, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${ev.pct}%`, background: ev.c, borderRadius: 3 }} />
                    </div>
                  </div>
                  <div style={{ font: "700 9px 'JetBrains Mono', monospace", letterSpacing: ".06em", color: ev.c, background: `${ev.c}1f`, padding: "5px 8px", borderRadius: 7, flex: "none" }}>{ev.stage}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ScreenContainer>
  );
}
