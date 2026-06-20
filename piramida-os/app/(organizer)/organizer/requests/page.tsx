"use client";

import { useViewport } from "@/lib/useViewport";
import { REQUESTS } from "@/lib/data";

export default function RequestsPage() {
  const { isMobile } = useViewport();
  const padX = isMobile ? 18 : 52;

  return (
    <div>
      <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 44, paddingBottom: 16 }}>
        <div style={{ font: "600 11px/1 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".2em", marginBottom: 13 }}>
          REQUESTS
        </div>
        <h1 style={{ font: "800 clamp(28px,4vw,46px)/1.04 Inter, sans-serif", letterSpacing: "-.03em", margin: "0 0 14px", color: "#fff" }}>
          Approval status
        </h1>
        <p style={{ font: "400 16px/1.55 Inter, sans-serif", color: "#AEB5C2", maxWidth: 540, margin: 0, textWrap: "pretty" }}>
          Track each event you&apos;ve submitted for the venue team&apos;s review.
        </p>
      </section>

      <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 14, paddingBottom: 54 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {REQUESTS.map((r) => (
            <div
              key={r.event}
              style={{
                border: "1px solid rgba(255,255,255,.07)",
                borderRadius: 16,
                background: "#151821",
                padding: 20,
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 18,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ font: "700 16px Inter, sans-serif", color: "#fff", marginBottom: 6 }}>{r.event}</div>
                <div style={{ font: "500 12px 'JetBrains Mono', monospace", color: "#7D8799", marginBottom: 10 }}>{r.date}</div>
                <div style={{ font: "400 14px/1.5 Inter, sans-serif", color: "#AEB5C2", maxWidth: 520, textWrap: "pretty" }}>{r.desc}</div>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, font: "600 11px 'JetBrains Mono', monospace", color: r.sc }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: r.sc, boxShadow: `0 0 7px ${r.sc}` }} />
                {r.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
