"use client";

import { useViewport } from "@/lib/useViewport";
import type { OrganizerProfileData } from "@/lib/organizer/portal-data";

export function ProfileView({ name, org, initials, info, track }: OrganizerProfileData) {
  const { isMobile } = useViewport();
  const padX = isMobile ? 18 : 52;

  return (
    <div>
      <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 44, paddingBottom: 16 }}>
        <div style={{ font: "600 11px/1 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".2em", marginBottom: 13 }}>
          PROFILE
        </div>
        <h1 style={{ font: "800 clamp(28px,4vw,46px)/1.04 Inter, sans-serif", letterSpacing: "-.03em", margin: 0, color: "#fff" }}>
          Your organizer profile
        </h1>
      </section>

      <section
        style={{
          paddingLeft: padX,
          paddingRight: padX,
          paddingTop: 16,
          paddingBottom: 54,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1.3fr 1fr",
          gap: 22,
          alignItems: "start",
        }}
      >
        <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 20, background: "#151821", padding: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "linear-gradient(135deg,#2A6FDB,#1F8A5B)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 22px Inter, sans-serif", color: "#fff", flex: "none" }}>
              {initials}
            </div>
            <div>
              <div style={{ font: "800 22px Inter, sans-serif", color: "#fff", letterSpacing: "-.02em" }}>{name}</div>
              <div style={{ font: "500 13px 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 4 }}>Organizer · {org}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {info.map((row, i) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "13px 0",
                  borderBottom: i < info.length - 1 ? "1px solid rgba(255,255,255,.05)" : "none",
                  font: "500 13px Inter, sans-serif",
                  color: "#7D8799",
                }}
              >
                <span>{row.label}</span>
                <span style={{ color: "#fff" }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 20, background: "#151821", padding: 22 }}>
            <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".16em", marginBottom: 18 }}>
              YOUR TRACK RECORD
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
              {track.map((t) => (
                <div key={t.label}>
                  <div style={{ font: "800 28px Inter, sans-serif", color: t.accent ? "#C8F000" : "#fff", letterSpacing: "-.03em" }}>{t.value}</div>
                  <div style={{ font: "500 11px Inter, sans-serif", color: "#7D8799", marginTop: 6 }}>{t.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
