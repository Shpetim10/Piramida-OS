"use client";

import { use, useState } from "react";
import Link from "next/link";
import { PyramidTwin } from "@/lib/PyramidTwin";
import { useViewport } from "@/lib/useViewport";
import { AGENDA, EVENT_COLORS, getEvent, SPEAKERS } from "@/lib/data";

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { isMobile } = useViewport();
  const padX = isMobile ? 18 : 52;
  const [registered, setRegistered] = useState(false);

  const detail = getEvent(id);
  const color = EVENT_COLORS[detail.type] ?? "#333";

  return (
    <div>
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          height: "clamp(220px,30vw,360px)",
          background: `linear-gradient(135deg,${color}33,#151821 70%)`,
          display: "flex",
          alignItems: "flex-end",
        }}
      >
        <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(135deg,rgba(255,255,255,.04) 0 2px,transparent 2px 16px)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent,rgba(13,13,18,.9))" }} />
        <div style={{ position: "relative", paddingLeft: padX, paddingRight: padX, paddingTop: 40, paddingBottom: 30, width: "100%" }}>
          <Link
            href="/events"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              marginBottom: 16,
              padding: "7px 13px",
              border: "1px solid rgba(255,255,255,.16)",
              borderRadius: 9,
              background: "rgba(13,13,18,.5)",
              color: "#AEB5C2",
              font: "600 12px Inter, sans-serif",
              textDecoration: "none",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            All events
          </Link>
          <h1 style={{ font: "800 clamp(30px,5vw,56px)/1.02 Inter, sans-serif", letterSpacing: "-.03em", margin: "0 0 16px", color: "#fff", maxWidth: 760, textWrap: "balance" }}>
            {detail.title}
          </h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, font: "500 14px Inter, sans-serif", color: "#AEB5C2" }}>
            <span>{detail.day} {detail.month} 2026</span>
            <span>{detail.room}</span>
            <span>{detail.guests} guests</span>
          </div>
        </div>
      </section>

      <section
        style={{
          paddingLeft: padX,
          paddingRight: padX,
          paddingTop: 34,
          paddingBottom: 54,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1.7fr 1fr",
          gap: 34,
          alignItems: "start",
        }}
      >
        <div>
          <p style={{ font: "400 16px/1.6 Inter, sans-serif", color: "#AEB5C2", margin: "0 0 30px", textWrap: "pretty" }}>
            A full-day gathering inside the Pyramid — keynotes, parallel breakout
            tracks, hands-on demos and curated networking across four connected spaces.
          </p>
          <h3 style={{ font: "700 19px Inter, sans-serif", color: "#fff", margin: "0 0 16px" }}>Agenda</h3>
          <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, overflow: "hidden", marginBottom: 34 }}>
            {AGENDA.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 18, padding: "15px 18px", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                <span style={{ font: "600 13px 'JetBrains Mono', monospace", color: "#D6FF00", width: 48, flex: "none" }}>{a.time}</span>
                <span style={{ flex: 1, font: "600 14px Inter, sans-serif", color: "#fff" }}>{a.title}</span>
                <span style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", whiteSpace: "nowrap" }}>{a.room}</span>
              </div>
            ))}
          </div>
          <h3 style={{ font: "700 19px Inter, sans-serif", color: "#fff", margin: "0 0 16px" }}>Speakers</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
            {SPEAKERS.map((s) => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, background: "#151821", padding: 14 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    font: "700 13px Inter, sans-serif",
                    color: "#fff",
                    flex: "none",
                    background: `linear-gradient(135deg,${s.c},#1D2230)`,
                  }}
                >
                  {s.ini}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: "600 13px Inter, sans-serif", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                  <div style={{ font: "500 11px Inter, sans-serif", color: "#7D8799", marginTop: 2 }}>{s.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, background: "#151821", padding: 22 }}>
            <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".16em", marginBottom: 6 }}>
              GENERAL ADMISSION
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 18 }}>
              <span style={{ font: "800 30px Inter, sans-serif", color: "#fff" }}>Free</span>
              <span style={{ font: "500 13px Inter, sans-serif", color: "#7D8799" }}>· registration required</span>
            </div>
            {registered ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, width: "100%", padding: 15, borderRadius: 12, background: "rgba(34,197,94,.12)", color: "#22C55E", font: "700 15px Inter, sans-serif" }}>
                ✓ You&apos;re registered
              </div>
            ) : (
              <button
                onClick={() => setRegistered(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 9,
                  width: "100%",
                  padding: 15,
                  border: "none",
                  borderRadius: 12,
                  background: "#D6FF00",
                  color: "#0D0D12",
                  font: "700 15px Inter, sans-serif",
                  cursor: "pointer",
                  boxShadow: "0 8px 26px rgba(214,255,0,.2)",
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" fill="none">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <path d="M14 14h3v3M20 20h.01M17 20h.01M20 17h.01" />
                </svg>
                Register · Get QR Pass
              </button>
            )}
            <div style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", marginTop: 14, textAlign: "center" }}>
              128 / 180 spots filled
            </div>
            <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,.08)", marginTop: 8, overflow: "hidden" }}>
              <div style={{ height: "100%", width: "71%", background: "#D6FF00", borderRadius: 3 }} />
            </div>
          </div>

          <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, background: "#151821", padding: 20 }}>
            <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#D6FF00", letterSpacing: ".16em", marginBottom: 14 }}>
              YOUR GUEST MAP
            </div>
            <div style={{ borderRadius: 12, background: "radial-gradient(400px 240px at 50% 30%,rgba(214,255,0,.04),#101319)", padding: 12, marginBottom: 12 }}>
              <PyramidTwin selected={["green", "blue", "yellow", "entrance", "common"]} labels showRoutes />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, font: "500 12px Inter, sans-serif", color: "#AEB5C2" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "#D6FF00" }} />
              Entrance → Registration → Green Room
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
