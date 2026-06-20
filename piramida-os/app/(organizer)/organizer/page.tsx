"use client";

import Link from "next/link";
import { useViewport } from "@/lib/useViewport";
import { DASH_STATS, REQUESTS } from "@/lib/data";

export default function DashboardPage() {
  const { isMobile } = useViewport();
  const padX = isMobile ? 18 : 52;

  return (
    <div>
      <section
        style={{
          paddingLeft: padX,
          paddingRight: padX,
          paddingTop: 44,
          paddingBottom: 14,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ font: "600 11px/1 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".2em", marginBottom: 13 }}>
            ORGANIZER STUDIO
          </div>
          <h1 style={{ font: "800 clamp(28px,4vw,46px)/1.04 Inter, sans-serif", letterSpacing: "-.03em", margin: 0, color: "#fff" }}>
            Welcome back, Adriatik
          </h1>
        </div>
        <Link
          href="/organizer/create"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 9,
            padding: "14px 24px",
            borderRadius: 12,
            background: "#C8F000",
            color: "#0D0D12",
            font: "700 14px Inter, sans-serif",
            boxShadow: "0 8px 26px rgba(200,240,0,.2)",
            whiteSpace: "nowrap",
            textDecoration: "none",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Create Event
        </Link>
      </section>

      <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 20, paddingBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 16 }}>
          {DASH_STATS.map((k) => (
            <div
              key={k.label}
              style={{
                border: `1px solid ${k.accent ? "rgba(200,240,0,.25)" : "rgba(255,255,255,.07)"}`,
                borderRadius: 18,
                background: k.accent ? "linear-gradient(180deg,rgba(200,240,0,.06),#151821)" : "#151821",
                padding: 22,
              }}
            >
              <div style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", marginBottom: 14 }}>{k.label}</div>
              <div style={{ font: "800 clamp(30px,3.4vw,42px)/1 Inter, sans-serif", letterSpacing: "-.03em", color: k.accent ? "#C8F000" : "#fff" }}>
                {k.value}
              </div>
              <div style={{ font: "500 12px 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 12 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          paddingLeft: padX,
          paddingRight: padX,
          paddingTop: 20,
          paddingBottom: 54,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1.3fr 1fr",
          gap: 22,
          alignItems: "start",
        }}
      >
        <div style={{ border: "1px solid rgba(200,240,0,.22)", borderRadius: 20, background: "linear-gradient(135deg,rgba(200,240,0,.06),#151821 60%)", padding: 26, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, right: 0, width: 240, height: 240, background: "radial-gradient(closest-side,rgba(200,240,0,.12),transparent)", pointerEvents: "none" }} />
          <div style={{ position: "relative", font: "600 10px 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".16em", marginBottom: 6 }}>
            ACTIVE EVENT · IN PLANNING
          </div>
          <h2 style={{ position: "relative", font: "800 clamp(22px,2.6vw,30px)/1.1 Inter, sans-serif", letterSpacing: "-.02em", margin: "6px 0 18px", color: "#fff" }}>
            NextGen Startup Summit 2026
          </h2>
          <div style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
            {["180 guests", "4 spaces", "18 Jul 2026", "€10,516"].map((t) => (
              <span key={t} style={{ padding: "7px 12px", borderRadius: 8, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", font: "600 12px Inter, sans-serif", color: "#AEB5C2" }}>
                {t}
              </span>
            ))}
          </div>
          <div style={{ position: "relative", display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/organizer/create" style={{ padding: "12px 20px", borderRadius: 11, background: "#C8F000", color: "#0D0D12", font: "700 13px Inter, sans-serif", textDecoration: "none" }}>
              Edit event
            </Link>
            <Link href="/organizer/requests" style={{ padding: "12px 20px", border: "1px solid rgba(255,255,255,.14)", borderRadius: 11, background: "transparent", color: "#fff", font: "600 13px Inter, sans-serif", textDecoration: "none" }}>
              View request status
            </Link>
          </div>
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 20, background: "#151821", padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".16em" }}>PENDING REQUESTS</div>
            <Link href="/organizer/requests" style={{ font: "600 11px Inter, sans-serif", color: "#C8F000", textDecoration: "none" }}>View all</Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {REQUESTS.map((r) => (
              <div key={r.event} style={{ border: "1px solid rgba(255,255,255,.06)", borderRadius: 13, padding: 14 }}>
                <div style={{ font: "600 13px Inter, sans-serif", color: "#fff", marginBottom: 6 }}>{r.event}</div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 7, font: "600 11px 'JetBrains Mono', monospace", color: r.sc }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: r.sc, boxShadow: `0 0 7px ${r.sc}` }} />
                  {r.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
