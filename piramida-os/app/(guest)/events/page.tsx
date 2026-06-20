"use client";

import { useState } from "react";
import { EventCard } from "@/components/EventCard";
import { useViewport } from "@/lib/useViewport";
import { EVENT_FILTERS, LIVE_EVENTS } from "@/lib/data";

export default function EventsPage() {
  const { isMobile } = useViewport();
  const padX = isMobile ? 18 : 52;
  const [filter, setFilter] = useState("all");

  const filtered =
    filter === "all" ? LIVE_EVENTS : LIVE_EVENTS.filter((e) => e.type === filter);

  return (
    <div>
      <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 40, paddingBottom: 8 }}>
        <div style={{ font: "600 11px/1 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".2em", marginBottom: 13 }}>
          PUBLIC EVENTS
        </div>
        <h1 style={{ font: "800 clamp(30px,4.4vw,52px)/1.04 Inter, sans-serif", letterSpacing: "-.03em", margin: "0 0 14px", color: "#fff" }}>
          What&apos;s on at the Pyramid
        </h1>
        <p style={{ font: "400 16px/1.55 Inter, sans-serif", color: "#AEB5C2", maxWidth: 560, margin: "0 0 24px", textWrap: "pretty" }}>
          Browse upcoming and live experiences. Tap any event to see the full agenda
          and register.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {EVENT_FILTERS.map((f) => {
            const on = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  padding: "9px 16px",
                  borderRadius: 100,
                  border: `1px solid ${on ? "#C8F000" : "rgba(255,255,255,.12)"}`,
                  background: on ? "#C8F000" : "transparent",
                  color: on ? "#0D0D12" : "#AEB5C2",
                  font: "600 13px Inter, sans-serif",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </section>

      <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 24, paddingBottom: 54 }}>
        <div style={{ font: "500 12px 'JetBrains Mono', monospace", color: "#7D8799", marginBottom: 18, letterSpacing: ".06em" }}>
          {filtered.length} EVENTS
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 18 }}>
          {filtered.map((ev) => (
            <EventCard key={ev.id} event={ev} variant="upcoming" />
          ))}
        </div>
      </section>
    </div>
  );
}
