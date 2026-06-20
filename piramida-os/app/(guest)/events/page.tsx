"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useViewport } from "@/lib/useViewport";

interface PublicEvent {
  slug: string;
  title: string;
  description: string | null;
  start: string | null;
  end: string | null;
  venue: string | null;
  registrationOpen: boolean;
}

function formatEventDate(iso: string | null): { day: string; month: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  return {
    day: d.getDate().toString().padStart(2, "0"),
    month: d.toLocaleString("en-GB", { month: "short" }).toUpperCase(),
  };
}

function EventCard({ event }: { event: PublicEvent }) {
  const date = formatEventDate(event.start);
  return (
    <Link
      href={`/events/${event.slug}`}
      style={{
        display: "block",
        textDecoration: "none",
        border: "1px solid rgba(255,255,255,.07)",
        borderRadius: 18,
        overflow: "hidden",
        background: "#151821",
        cursor: "pointer",
      }}
    >
      {/* Poster */}
      <div
        style={{
          position: "relative",
          height: 150,
          background: "linear-gradient(135deg,rgba(42,111,219,.28),#151821 70%)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 2px,transparent 2px 13px)",
          }}
        />
        {/* Registration badge */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            padding: "6px 11px",
            borderRadius: 8,
            background: "rgba(13,13,18,.6)",
            backdropFilter: "blur(6px)",
            font: "600 10px/1 'JetBrains Mono', monospace",
            color: event.registrationOpen ? "#C8F000" : "#7D8799",
            letterSpacing: ".12em",
          }}
        >
          {event.registrationOpen ? "OPEN" : "CLOSED"}
        </div>
        {/* Date badge */}
        {date && (
          <div
            style={{
              position: "absolute",
              bottom: 14,
              left: 14,
              padding: "9px 12px",
              borderRadius: 10,
              background: "rgba(13,13,18,.62)",
              backdropFilter: "blur(6px)",
              textAlign: "center",
            }}
          >
            <div style={{ font: "800 20px/1 Inter, sans-serif", color: "#fff" }}>{date.day}</div>
            <div style={{ font: "600 10px/1 'JetBrains Mono', monospace", color: "#AEB5C2", marginTop: 3, letterSpacing: ".1em" }}>
              {date.month}
            </div>
          </div>
        )}
      </div>
      {/* Body */}
      <div style={{ padding: 18 }}>
        <div style={{ font: "700 17px/1.25 Inter, sans-serif", color: "#fff", marginBottom: 10 }}>
          {event.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, font: "500 12px Inter, sans-serif", color: "#7D8799" }}>
          {event.venue && <span>{event.venue}</span>}
        </div>
        {event.description && (
          <div style={{ font: "400 12px/1.5 Inter, sans-serif", color: "#7D8799", marginTop: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {event.description}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function EventsPage() {
  const { isMobile } = useViewport();
  const padX = isMobile ? 18 : 52;
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/public/events")
      .then((r) => (r.ok ? r.json() : r.json().then((d: { error?: string }) => Promise.reject(d.error ?? "Failed to load"))))
      .then((data: PublicEvent[]) => setEvents(data))
      .catch((e: unknown) => setError(typeof e === "string" ? e : "Failed to load events"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 40, paddingBottom: 8 }}>
        <div style={{ font: "600 11px/1 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".2em", marginBottom: 13 }}>
          PUBLIC EVENTS
        </div>
        <h1 style={{ font: "800 clamp(30px,4.4vw,52px)/1.04 Inter, sans-serif", letterSpacing: "-.03em", margin: "0 0 14px", color: "#fff" }}>
          What&apos;s on at the Pyramid
        </h1>
        <p style={{ font: "400 16px/1.55 Inter, sans-serif", color: "#AEB5C2", maxWidth: 560, margin: 0, textWrap: "pretty" }}>
          Browse upcoming experiences. Tap any event to see the full agenda and register.
        </p>
      </section>

      <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 24, paddingBottom: 54 }}>
        {loading && (
          <div style={{ font: "500 13px Inter, sans-serif", color: "#7D8799", marginBottom: 18 }}>
            Loading events…
          </div>
        )}

        {error && (
          <div style={{ border: "1px solid rgba(239,68,68,.3)", borderRadius: 14, background: "rgba(239,68,68,.08)", padding: 20, font: "500 14px Inter, sans-serif", color: "#EF4444" }}>
            {error}
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, background: "#151821", padding: 32, textAlign: "center", font: "500 13px Inter, sans-serif", color: "#7D8799" }}>
            No upcoming events published yet.
          </div>
        )}

        {events.length > 0 && (
          <>
            <div style={{ font: "500 12px 'JetBrains Mono', monospace", color: "#7D8799", marginBottom: 18, letterSpacing: ".06em" }}>
              {events.length} UPCOMING EVENT{events.length !== 1 ? "S" : ""}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 18 }}>
              {events.map((ev) => (
                <EventCard key={ev.slug} event={ev} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
