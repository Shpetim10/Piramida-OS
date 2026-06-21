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
  acceptsExternalGuests: boolean;
  category: "live" | "upcoming" | "past";
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function PastEventCard({ event }: { event: PublicEvent }) {
  const startLabel = formatDate(event.start);
  const endLabel = formatDate(event.end);

  return (
    <Link
      href={`/events/${event.slug}`}
      style={{ display: "block", textDecoration: "none", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, overflow: "hidden", background: "#151821", cursor: "pointer" }}
    >
      <div style={{ position: "relative", height: 130, background: "linear-gradient(135deg,rgba(85,85,85,.28),#151821 70%)", overflow: "hidden", filter: "saturate(.6)" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(135deg,rgba(255,255,255,.04) 0 2px,transparent 2px 13px)" }} />
        <div style={{ position: "absolute", top: 14, left: 14, padding: "6px 11px", borderRadius: 8, background: "rgba(13,13,18,.6)", font: "600 10px/1 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em" }}>
          COMPLETED
        </div>
        {startLabel && (
          <div style={{ position: "absolute", bottom: 14, left: 14, font: "500 11px/1 'JetBrains Mono', monospace", color: "#555E6E" }}>{startLabel}</div>
        )}
      </div>
      <div style={{ padding: 18 }}>
        <div style={{ font: "700 16px/1.25 Inter, sans-serif", color: "#AEB5C2", marginBottom: 8 }}>{event.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {event.venue && <span style={{ font: "500 12px Inter, sans-serif", color: "#555E6E" }}>{event.venue}</span>}
          {endLabel && startLabel !== endLabel && (
            <span style={{ font: "500 11px Inter, sans-serif", color: "#444B5A" }}>Until {endLabel}</span>
          )}
        </div>
        {event.description && (
          <div style={{ font: "400 12px/1.5 Inter, sans-serif", color: "#555E6E", marginTop: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {event.description}
          </div>
        )}
      </div>
    </Link>
  );
}

function EmptyArchiveState() {
  return (
    <div
      style={{
        border: "1px dashed rgba(255,255,255,.07)",
        borderRadius: 18,
        padding: "clamp(40px,6vw,64px) clamp(24px,4vw,48px)",
        textAlign: "center",
      }}
    >
      <svg width="44" height="38" viewBox="0 0 56 48" fill="none" style={{ marginBottom: 16, opacity: .35 }}>
        <polygon points="28,4 54,44 2,44" stroke="#C8F000" strokeWidth="1.5" fill="none" />
      </svg>
      <h3 style={{ font: "700 clamp(18px,2.5vw,24px)/1.1 Inter, sans-serif", margin: "0 0 10px", color: "#AEB5C2" }}>
        Archive is empty
      </h3>
      <p style={{ font: "400 14px/1.6 Inter, sans-serif", color: "#555E6E", maxWidth: 340, margin: "0 auto" }}>
        No past events have been recorded yet. History begins with the first experience.
      </p>
    </div>
  );
}

export default function PastEventsPage() {
  const { isMobile } = useViewport();
  const padX = isMobile ? 18 : 52;
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/public/events?upcoming=false")
      .then((r) => r.ok ? r.json() : r.json().then((d: { error?: string }) => Promise.reject(d.error ?? "Failed")))
      .then((data: PublicEvent[]) => setEvents(data.filter((e) => e.category === "past")))
      .catch((e: unknown) => setError(typeof e === "string" ? e : "Failed to load events"))
      .finally(() => setLoading(false));
  }, []);

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
        {loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 18 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 200, borderRadius: 18, background: "rgba(255,255,255,.04)", animation: "pulse 1.8s ease-in-out infinite" }} />
            ))}
          </div>
        )}

        {error && !loading && (
          <div style={{ border: "1px solid rgba(239,68,68,.3)", borderRadius: 14, background: "rgba(239,68,68,.08)", padding: 20, font: "500 14px Inter, sans-serif", color: "#EF4444" }}>
            {error}
          </div>
        )}

        {!loading && !error && events.length === 0 && <EmptyArchiveState />}

        {events.length > 0 && (
          <>
            <div style={{ font: "500 12px 'JetBrains Mono', monospace", color: "#7D8799", marginBottom: 18, letterSpacing: ".06em" }}>
              {events.length} PAST EVENT{events.length !== 1 ? "S" : ""}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 18 }}>
              {events.map((ev) => (
                <PastEventCard key={ev.slug} event={ev} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
