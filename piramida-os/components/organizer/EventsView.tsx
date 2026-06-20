"use client";

import Link from "next/link";
import { useViewport } from "@/lib/useViewport";
import type { EventRow } from "@/lib/organizer/portal-data";

export function EventsView({ events }: { events: EventRow[] }) {
  const { isMobile } = useViewport();
  const padX = isMobile ? 18 : 52;

  return (
    <div>
      <section
        style={{
          paddingLeft: padX,
          paddingRight: padX,
          paddingTop: 44,
          paddingBottom: 16,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ font: "600 11px/1 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".2em", marginBottom: 13 }}>
            MY EVENTS
          </div>
          <h1 style={{ font: "800 clamp(28px,4vw,46px)/1.04 Inter, sans-serif", letterSpacing: "-.03em", margin: 0, color: "#fff" }}>
            Your events
          </h1>
        </div>
        <Link
          href="/organizer/create"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 9,
            padding: "14px 22px",
            borderRadius: 12,
            background: "#C8F000",
            color: "#0D0D12",
            font: "700 14px Inter, sans-serif",
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

      <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 12, paddingBottom: 54 }}>
        {events.length === 0 ? (
          <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", padding: 28, font: "400 15px Inter, sans-serif", color: "#7D8799" }}>
            No events yet. Once the venue team approves a request, it will appear here.
          </div>
        ) : (
          <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, overflow: "hidden", background: "#151821" }}>
            {events.map((e) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, flex: "none", background: e.color }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "700 15px Inter, sans-serif", color: "#fff" }}>{e.title}</div>
                  <div style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", marginTop: 3 }}>{e.date} · {e.guests} guests</div>
                </div>
                <span
                  style={{
                    font: "600 10px 'JetBrains Mono', monospace",
                    letterSpacing: ".08em",
                    padding: "5px 10px",
                    borderRadius: 7,
                    color: e.color,
                    background: e.color + "1f",
                    whiteSpace: "nowrap",
                  }}
                >
                  {e.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
