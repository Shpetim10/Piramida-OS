"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useViewport } from "@/lib/useViewport";

type EventCategory = "live" | "upcoming" | "past";

interface PublicEvent {
  slug: string;
  title: string;
  description: string | null;
  start: string | null;
  end: string | null;
  venue: string | null;
  registrationOpen: boolean;
  acceptsExternalGuests: boolean;
  category: EventCategory;
}

function formatEventDate(iso: string | null): { day: string; month: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  return {
    day: d.getDate().toString().padStart(2, "0"),
    month: d.toLocaleString("en-GB", { month: "short" }).toUpperCase(),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}

const CATEGORY_COLOR: Record<EventCategory, string> = {
  live: "#EF4444",
  upcoming: "#2A6FDB",
  past: "#555",
};

function EventCard({ event }: { event: PublicEvent }) {
  const date = formatEventDate(event.start);
  const color = CATEGORY_COLOR[event.category];
  const isPast = event.category === "past";

  return (
    <Link
      href={`/events/${event.slug}`}
      style={{ display: "block", textDecoration: "none", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, overflow: "hidden", background: "#151821", cursor: "pointer" }}
    >
      {/* Poster */}
      <div style={{ position: "relative", height: 150, background: `linear-gradient(135deg,${color}33,#151821 70%)`, overflow: "hidden", filter: isPast ? "saturate(.6)" : undefined }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 2px,transparent 2px 13px)" }} />

        {/* Top-left badge */}
        {event.category === "live" ? (
          <div style={{ position: "absolute", top: 14, left: 14, display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 11px", borderRadius: 8, background: "rgba(239,68,68,.85)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", animation: "blink 1.4s ease-in-out infinite" }} />
            <span style={{ font: "600 10px/1 'JetBrains Mono', monospace", color: "#fff", letterSpacing: ".12em" }}>LIVE NOW</span>
          </div>
        ) : isPast ? (
          <div style={{ position: "absolute", top: 14, left: 14, padding: "6px 11px", borderRadius: 8, background: "rgba(13,13,18,.6)", font: "600 10px/1 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em" }}>
            COMPLETED
          </div>
        ) : (
          <div style={{ position: "absolute", top: 14, left: 14, padding: "6px 11px", borderRadius: 8, background: "rgba(13,13,18,.6)", backdropFilter: "blur(6px)", font: "600 10px/1 'JetBrains Mono', monospace", color: event.registrationOpen ? "#C8F000" : "#7D8799", letterSpacing: ".12em" }}>
            {event.registrationOpen ? "REG OPEN" : "INVITE ONLY"}
          </div>
        )}

        {/* Date badge */}
        {date && (
          <div style={{ position: "absolute", bottom: 14, left: 14, padding: "9px 12px", borderRadius: 10, background: "rgba(13,13,18,.62)", backdropFilter: "blur(6px)", textAlign: "center" }}>
            <div style={{ font: "800 20px/1 Inter, sans-serif", color: "#fff" }}>{date.day}</div>
            <div style={{ font: "600 10px/1 'JetBrains Mono', monospace", color: "#AEB5C2", marginTop: 3, letterSpacing: ".1em" }}>{date.month}</div>
          </div>
        )}
        {date && (
          <div style={{ position: "absolute", bottom: 14, right: 14, font: "500 11px/1 'JetBrains Mono', monospace", color: "#7D8799" }}>{date.time}</div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: 18 }}>
        <div style={{ font: "700 17px/1.25 Inter, sans-serif", color: isPast ? "#AEB5C2" : "#fff", marginBottom: 8 }}>{event.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: event.description ? 8 : 0 }}>
          {event.venue && <span style={{ font: "500 12px Inter, sans-serif", color: "#7D8799" }}>{event.venue}</span>}
          {!event.acceptsExternalGuests && (
            <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 8px", borderRadius: 6, background: "rgba(125,135,153,.1)", border: "1px solid rgba(125,135,153,.2)", font: "500 10px/1 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>
              PRIVATE
            </span>
          )}
        </div>
        {event.description && (
          <div style={{ font: "400 12px/1.5 Inter, sans-serif", color: "#7D8799", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {event.description}
          </div>
        )}
      </div>
    </Link>
  );
}

function EmptyEventsState() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        border: "1px solid rgba(200,240,0,.12)",
        borderRadius: 20,
        background: "linear-gradient(120deg,rgba(200,240,0,.04),#101318 60%)",
        padding: "clamp(40px,6vw,72px) clamp(24px,4vw,48px)",
        textAlign: "center",
      }}
    >
      <div style={{ position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)", width: 300, height: 300, background: "radial-gradient(closest-side,rgba(200,240,0,.07),transparent)", pointerEvents: "none" }} />
      <svg width="48" height="42" viewBox="0 0 56 48" fill="none" style={{ marginBottom: 16, opacity: .5 }}>
        <polygon points="28,4 54,44 2,44" stroke="#C8F000" strokeWidth="1.5" fill="rgba(200,240,0,.06)" />
        <line x1="28" y1="4" x2="28" y2="44" stroke="rgba(200,240,0,.2)" strokeWidth="1" />
      </svg>
      <h3 style={{ position: "relative", font: "800 clamp(20px,3vw,28px)/1.1 Inter, sans-serif", letterSpacing: "-.02em", margin: "0 0 10px", color: "#fff" }}>
        Nothing scheduled yet
      </h3>
      <p style={{ position: "relative", font: "400 14px/1.6 Inter, sans-serif", color: "#7D8799", maxWidth: 360, margin: "0 auto 24px" }}>
        No events have been published at the Pyramid of Tirana yet. Stay tuned — the stage is always being prepared.
      </p>
      <Link
        href="/become"
        style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 22px", borderRadius: 10, background: "#C8F000", color: "#0D0D12", font: "700 14px Inter, sans-serif", textDecoration: "none" }}
      >
        Propose an event
        <svg width="15" height="15" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </Link>
    </div>
  );
}

type FilterKey = "all" | "live" | "upcoming" | "past" | "open";

const FILTERS: { id: FilterKey; label: string }[] = [
  { id: "all", label: "All" },
  { id: "live", label: "Live now" },
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "open", label: "Open registration" },
];

export default function EventsPage() {
  const { isMobile } = useViewport();
  const padX = isMobile ? 18 : 52;
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    fetch("/api/public/events?upcoming=false")
      .then((r) => (r.ok ? r.json() : r.json().then((d: { error?: string }) => Promise.reject(d.error ?? "Failed"))))
      .then((data: PublicEvent[]) => setEvents(data))
      .catch((e: unknown) => setError(typeof e === "string" ? e : "Failed to load events"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = events.filter((ev) => {
    if (filter === "all") return true;
    if (filter === "open") return ev.registrationOpen && ev.category !== "past";
    return ev.category === filter;
  });

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
          Browse experiences at the Pyramid. Events marked <span style={{ color: "#7D8799", fontWeight: 600 }}>PRIVATE</span> are invite-only; all others welcome external guests.
        </p>
      </section>

      {/* Filters */}
      {!loading && !error && events.length > 0 && (
        <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 20, paddingBottom: 4 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: filter === f.id ? "1px solid rgba(200,240,0,.5)" : "1px solid rgba(255,255,255,.1)",
                  background: filter === f.id ? "rgba(200,240,0,.1)" : "transparent",
                  color: filter === f.id ? "#C8F000" : "#7D8799",
                  font: "600 12px Inter, sans-serif",
                  cursor: "pointer",
                  transition: "all .15s",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 24, paddingBottom: 54 }}>
        {loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 18 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 240, borderRadius: 18, background: "rgba(255,255,255,.04)", animation: "pulse 1.8s ease-in-out infinite" }} />
            ))}
          </div>
        )}

        {error && !loading && (
          <div style={{ border: "1px solid rgba(239,68,68,.3)", borderRadius: 14, background: "rgba(239,68,68,.08)", padding: 20, font: "500 14px Inter, sans-serif", color: "#EF4444" }}>
            {error}
          </div>
        )}

        {!loading && !error && events.length === 0 && <EmptyEventsState />}

        {!loading && !error && events.length > 0 && filtered.length === 0 && (
          <div style={{ border: "1px dashed rgba(255,255,255,.08)", borderRadius: 14, padding: "28px 24px", textAlign: "center", font: "500 13px Inter, sans-serif", color: "#444B5A" }}>
            No events match this filter.
          </div>
        )}

        {filtered.length > 0 && (
          <>
            <div style={{ font: "500 12px 'JetBrains Mono', monospace", color: "#7D8799", marginBottom: 18, letterSpacing: ".06em" }}>
              {filtered.length} EVENT{filtered.length !== 1 ? "S" : ""}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 18 }}>
              {filtered.map((ev) => (
                <EventCard key={ev.slug} event={ev} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
