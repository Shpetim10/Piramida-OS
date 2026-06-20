"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PyramidTwin } from "@/lib/PyramidTwin";
import { useViewport } from "@/lib/useViewport";
import { HOME_STATS } from "@/lib/data";

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

const arrow = (
  <svg width="17" height="17" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

function formatDate(iso: string | null): { day: string; month: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  return {
    day: d.getDate().toString().padStart(2, "0"),
    month: d.toLocaleString("en-GB", { month: "short" }).toUpperCase(),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}

function RegistrationBadge({ open, category }: { open: boolean; category: EventCategory }) {
  if (category === "past") {
    return (
      <div style={{ position: "absolute", top: 14, left: 14, padding: "6px 11px", borderRadius: 8, background: "rgba(13,13,18,.6)", font: "600 10px/1 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em" }}>
        COMPLETED
      </div>
    );
  }
  if (category === "live") {
    return (
      <div style={{ position: "absolute", top: 14, left: 14, display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 11px", borderRadius: 8, background: "rgba(239,68,68,.85)" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", animation: "blink 1.4s ease-in-out infinite" }} />
        <span style={{ font: "600 10px/1 'JetBrains Mono', monospace", color: "#fff", letterSpacing: ".12em" }}>LIVE NOW</span>
      </div>
    );
  }
  return (
    <div style={{ position: "absolute", top: 14, left: 14, padding: "6px 11px", borderRadius: 8, background: "rgba(13,13,18,.6)", backdropFilter: "blur(6px)", font: "600 10px/1 'JetBrains Mono', monospace", color: open ? "#C8F000" : "#7D8799", letterSpacing: ".12em" }}>
      {open ? "REG OPEN" : "INVITE ONLY"}
    </div>
  );
}

function GuestBadge({ acceptsExternalGuests }: { acceptsExternalGuests: boolean }) {
  if (acceptsExternalGuests) return null;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 6, background: "rgba(125,135,153,.12)", border: "1px solid rgba(125,135,153,.2)", font: "500 10px/1 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>
      PRIVATE
    </div>
  );
}

function EventCard({ event }: { event: PublicEvent }) {
  const date = formatDate(event.start);
  const POSTER_COLORS: Record<EventCategory, string> = {
    live: "#EF4444",
    upcoming: "#2A6FDB",
    past: "#555",
  };
  const color = POSTER_COLORS[event.category];

  return (
    <Link
      href={`/events/${event.slug}`}
      style={{ display: "block", textDecoration: "none", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, overflow: "hidden", background: "#151821", cursor: "pointer" }}
    >
      {/* Poster */}
      <div style={{ position: "relative", height: 150, background: `linear-gradient(135deg,${color}33,#151821 70%)`, overflow: "hidden", filter: event.category === "past" ? "saturate(.65)" : undefined }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 2px,transparent 2px 13px)" }} />
        <RegistrationBadge open={event.registrationOpen} category={event.category} />
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
        <div style={{ font: "700 17px/1.25 Inter, sans-serif", color: event.category === "past" ? "#AEB5C2" : "#fff", marginBottom: 8 }}>{event.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: event.description ? 8 : 0 }}>
          {event.venue && <span style={{ font: "500 12px Inter, sans-serif", color: "#7D8799" }}>{event.venue}</span>}
          <GuestBadge acceptsExternalGuests={event.acceptsExternalGuests} />
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

function EmptySection({ label }: { label: string }) {
  return (
    <div style={{ border: "1px dashed rgba(255,255,255,.08)", borderRadius: 14, padding: "28px 24px", textAlign: "center", font: "500 13px Inter, sans-serif", color: "#444B5A" }}>
      No {label} right now
    </div>
  );
}

function NoEventsHero() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        border: "1px solid rgba(200,240,0,.14)",
        borderRadius: 22,
        background: "linear-gradient(120deg,rgba(200,240,0,.05),#101318 60%)",
        padding: "clamp(48px,7vw,80px) clamp(28px,5vw,52px)",
        textAlign: "center",
        marginTop: 8,
        marginBottom: 16,
      }}
    >
      <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 360, height: 360, background: "radial-gradient(closest-side,rgba(200,240,0,.08),transparent)", pointerEvents: "none" }} />
      {/* Pyramid icon */}
      <svg width="56" height="48" viewBox="0 0 56 48" fill="none" style={{ marginBottom: 20, opacity: .55 }}>
        <polygon points="28,4 54,44 2,44" stroke="#C8F000" strokeWidth="1.5" fill="rgba(200,240,0,.06)" />
        <line x1="28" y1="4" x2="28" y2="44" stroke="rgba(200,240,0,.25)" strokeWidth="1" />
        <line x1="2" y1="44" x2="54" y2="44" stroke="rgba(200,240,0,.15)" strokeWidth="1" />
      </svg>
      <h2
        style={{
          position: "relative",
          font: "800 clamp(22px,3.5vw,36px)/1.1 Inter, sans-serif",
          letterSpacing: "-.025em",
          margin: "0 0 14px",
          color: "#fff",
          textWrap: "balance",
        }}
      >
        The stage is being set
      </h2>
      <p
        style={{
          position: "relative",
          font: "400 15px/1.6 Inter, sans-serif",
          color: "#7D8799",
          maxWidth: 420,
          margin: "0 auto 28px",
          textWrap: "pretty",
        }}
      >
        No events are published yet. Check back soon — something extraordinary is always in the works at the Pyramid of Tirana.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", position: "relative" }}>
        <Link
          href="/become"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 22px", borderRadius: 11, background: "#C8F000", color: "#0D0D12", font: "700 14px Inter, sans-serif", textDecoration: "none" }}
        >
          Organise an event {arrow}
        </Link>
        <Link
          href="/explore"
          style={{ padding: "13px 22px", border: "1px solid rgba(255,255,255,.14)", borderRadius: 11, background: "rgba(255,255,255,.03)", color: "#fff", font: "600 14px Inter, sans-serif", textDecoration: "none" }}
        >
          Explore the Pyramid
        </Link>
      </div>
    </div>
  );
}

function SectionHeader({ title, live, href, linkLabel }: { title: string; live?: boolean; href?: string; linkLabel?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {live && (
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", boxShadow: "0 0 8px #EF4444", animation: "blink 1.4s ease-in-out infinite", flexShrink: 0 }} />
        )}
        <h2 style={{ font: "800 clamp(22px,2.8vw,30px)/1 Inter, sans-serif", letterSpacing: "-.02em", margin: 0, color: "#fff" }}>{title}</h2>
      </div>
      {href && (
        <Link href={href} style={pillButton}>{linkLabel ?? "See all"}</Link>
      )}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { isMobile } = useViewport();
  const padX = isMobile ? 18 : 52;

  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/public/events?upcoming=false")
      .then((r) => r.ok ? r.json() : r.json().then((d: { error?: string }) => Promise.reject(d.error ?? "Failed")))
      .then((data: PublicEvent[]) => setEvents(data))
      .catch((e: unknown) => setError(typeof e === "string" ? e : "Failed to load events"))
      .finally(() => setLoading(false));
  }, []);

  const liveEvents = events.filter((e) => e.category === "live");
  const upcomingEvents = events.filter((e) => e.category === "upcoming");
  const pastEvents = events.filter((e) => e.category === "past").slice(0, 3);
  const hasAny = events.length > 0;

  return (
    <div>
      {/* Hero */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          paddingLeft: padX,
          paddingRight: padX,
          paddingTop: isMobile ? 34 : 56,
          paddingBottom: 40,
          textAlign: "center",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(820px 520px at 50% 8%,rgba(200,240,0,.10),transparent 60%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)", backgroundSize: "50px 50px", maskImage: "radial-gradient(circle at 50% 30%,#000,transparent 72%)", WebkitMaskImage: "radial-gradient(circle at 50% 30%,#000,transparent 72%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 780, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "7px 14px", border: "1px solid rgba(200,240,0,.28)", borderRadius: 100, background: "rgba(200,240,0,.05)", marginBottom: 24 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#C8F000", boxShadow: "0 0 8px #C8F000" }} />
            <span style={{ font: "600 10px/1 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".18em" }}>THE PYRAMID OF TIRANA · LIVE</span>
          </div>
          <h1 style={{ font: "800 clamp(34px,6vw,66px)/1.02 Inter, sans-serif", letterSpacing: "-.035em", margin: "0 0 18px", color: "#fff", textWrap: "balance" }}>
            Step inside a building that
            <span style={{ color: "#C8F000" }}> hosts experiences</span>
          </h1>
          <p style={{ font: "400 clamp(15px,1.6vw,18px)/1.6 Inter, sans-serif", color: "#AEB5C2", maxWidth: 540, margin: "0 auto 14px", textWrap: "pretty" }}>
            Explore every room of the Pyramid in 2.5D, discover what&apos;s on, and register in seconds.
          </p>
        </div>
        <div style={{ position: "relative", zIndex: 2, maxWidth: 760, margin: "18px auto 0", animation: "floatY 8s ease-in-out infinite" }}>
          <PyramidTwin hero selected={["green", "blue", "yellow", "entrance"]} showRoutes labels={false} onRoom={(id) => router.push(`/explore?room=${id}`)} />
        </div>
        <div style={{ position: "relative", zIndex: 3, display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", marginTop: 8 }}>
          <Link href="/explore" style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "15px 26px", borderRadius: 12, background: "#C8F000", color: "#0D0D12", font: "700 15px Inter, sans-serif", boxShadow: "0 8px 30px rgba(200,240,0,.22)", textDecoration: "none" }}>
            Explore the Pyramid {arrow}
          </Link>
          <Link href="/events" style={{ padding: "15px 24px", border: "1px solid rgba(255,255,255,.14)", borderRadius: 12, background: "rgba(255,255,255,.03)", color: "#fff", font: "600 15px Inter, sans-serif", textDecoration: "none" }}>
            Browse events
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 18, paddingBottom: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 1, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 18, overflow: "hidden" }}>
          {HOME_STATS.map((s) => (
            <div key={s.label} style={{ background: "#0D0D12", padding: 24, textAlign: "center" }}>
              <div style={{ font: "800 clamp(24px,3vw,34px)/1 Inter, sans-serif", color: "#fff", letterSpacing: "-.03em" }}>{s.value}</div>
              <div style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", marginTop: 8 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Loading skeleton */}
      {loading && (
        <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 48 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 18 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 240, borderRadius: 18, background: "rgba(255,255,255,.04)", animation: "pulse 1.8s ease-in-out infinite" }} />
            ))}
          </div>
        </section>
      )}

      {/* Error state */}
      {error && !loading && (
        <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 48 }}>
          <div style={{ border: "1px solid rgba(239,68,68,.3)", borderRadius: 14, background: "rgba(239,68,68,.08)", padding: 20, font: "500 14px Inter, sans-serif", color: "#EF4444" }}>
            {error}
          </div>
        </section>
      )}

      {/* No events at all */}
      {!loading && !error && !hasAny && (
        <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 32, paddingBottom: 16 }}>
          <NoEventsHero />
        </section>
      )}

      {/* Happening now */}
      {!loading && !error && hasAny && (
        <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 48, paddingBottom: 10 }}>
          <SectionHeader title="Happening now" live />
          {liveEvents.length === 0 ? (
            <EmptySection label="live events" />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 18 }}>
              {liveEvents.map((ev) => <EventCard key={ev.slug} event={ev} />)}
            </div>
          )}
        </section>
      )}

      {/* Upcoming */}
      {!loading && !error && hasAny && (
        <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 42, paddingBottom: 10 }}>
          <SectionHeader title="Upcoming experiences" href="/events" linkLabel="All events" />
          {upcomingEvents.length === 0 ? (
            <EmptySection label="upcoming events" />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 18 }}>
              {upcomingEvents.map((ev) => <EventCard key={ev.slug} event={ev} />)}
            </div>
          )}
        </section>
      )}

      {/* Past */}
      {!loading && !error && pastEvents.length > 0 && (
        <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 42, paddingBottom: 18 }}>
          <SectionHeader title="Past events" href="/past" linkLabel="Browse archive" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 18 }}>
            {pastEvents.map((ev) => <EventCard key={ev.slug} event={ev} />)}
          </div>
        </section>
      )}

      {/* CTA */}
      <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 30, paddingBottom: 54 }}>
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            border: "1px solid rgba(200,240,0,.22)",
            borderRadius: 22,
            background: "linear-gradient(120deg,rgba(200,240,0,.08),#151821 55%)",
            padding: "clamp(28px,5vw,52px)",
            textAlign: "center",
          }}
        >
          <div style={{ position: "absolute", top: -40, right: -40, width: 280, height: 280, background: "radial-gradient(closest-side,rgba(200,240,0,.14),transparent)", pointerEvents: "none" }} />
          <h2 style={{ position: "relative", font: "800 clamp(26px,4vw,42px)/1.05 Inter, sans-serif", letterSpacing: "-.03em", margin: "0 0 14px", color: "#fff", textWrap: "balance" }}>
            Have an event in mind?
          </h2>
          <p style={{ position: "relative", font: "400 16px/1.55 Inter, sans-serif", color: "#AEB5C2", maxWidth: 480, margin: "0 auto 26px", textWrap: "pretty" }}>
            Become an organizer and let Pyramid OS turn your idea into a room-by-room plan and an instant quote.
          </p>
          <Link
            href="/become"
            style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 9, padding: "16px 30px", borderRadius: 13, background: "#C8F000", color: "#0D0D12", font: "700 16px Inter, sans-serif", boxShadow: "0 10px 36px rgba(200,240,0,.26)", textDecoration: "none" }}
          >
            Become an Organizer {arrow}
          </Link>
        </div>
      </section>
    </div>
  );
}

const pillButton: React.CSSProperties = {
  padding: "10px 18px",
  border: "1px solid rgba(255,255,255,.14)",
  borderRadius: 10,
  background: "transparent",
  color: "#fff",
  font: "600 13px Inter, sans-serif",
  whiteSpace: "nowrap",
  textDecoration: "none",
};
