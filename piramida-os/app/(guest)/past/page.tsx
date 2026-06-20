"use client";

import { EventCard } from "@/components/EventCard";
import { useViewport } from "@/lib/useViewport";
import { PAST_EVENTS } from "@/lib/data";

export default function PastEventsPage() {
  const { isMobile } = useViewport();
  const padX = isMobile ? 18 : 52;

  return (
    <div>
      <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 40, paddingBottom: 16 }}>
        <div style={{ font: "600 11px/1 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".2em", marginBottom: 13 }}>
          EVENT ARCHIVE
        </div>
        <h1 style={{ font: "800 clamp(30px,4.4vw,52px)/1.04 Inter, sans-serif", letterSpacing: "-.03em", margin: "0 0 14px", color: "#fff" }}>
          Past events
        </h1>
        <p style={{ font: "400 16px/1.55 Inter, sans-serif", color: "#AEB5C2", maxWidth: 560, margin: 0, textWrap: "pretty" }}>
          A look back at experiences the Pyramid has hosted.
        </p>
      </section>

      <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 8, paddingBottom: 54 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 18 }}>
          {PAST_EVENTS.map((ev) => (
            <EventCard key={ev.id} event={ev} variant="pastFull" />
          ))}
        </div>
      </section>
    </div>
  );
}
