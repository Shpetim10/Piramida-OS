"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { EventCard } from "@/components/EventCard";
import { PyramidTwin } from "@/lib/PyramidTwin";
import { useViewport } from "@/lib/useViewport";
import {
  HOME_STATS,
  ONGOING_EVENTS,
  PAST_EVENTS,
  UPCOMING_EVENTS,
} from "@/lib/data";

const arrow = (
  <svg width="17" height="17" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export default function HomePage() {
  const router = useRouter();
  const { isMobile } = useViewport();
  const padX = isMobile ? 18 : 52;
  const pastPreview = PAST_EVENTS.slice(0, 3);

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
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(820px 520px at 50% 8%,rgba(200,240,0,.10),transparent 60%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)",
            backgroundSize: "50px 50px",
            maskImage: "radial-gradient(circle at 50% 30%,#000,transparent 72%)",
            WebkitMaskImage: "radial-gradient(circle at 50% 30%,#000,transparent 72%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 780, margin: "0 auto" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              padding: "7px 14px",
              border: "1px solid rgba(200,240,0,.28)",
              borderRadius: 100,
              background: "rgba(200,240,0,.05)",
              marginBottom: 24,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#C8F000", boxShadow: "0 0 8px #C8F000" }} />
            <span style={{ font: "600 10px/1 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".18em" }}>
              THE PYRAMID OF TIRANA · LIVE
            </span>
          </div>
          <h1
            style={{
              font: "800 clamp(34px,6vw,66px)/1.02 Inter, sans-serif",
              letterSpacing: "-.035em",
              margin: "0 0 18px",
              color: "#fff",
              textWrap: "balance",
            }}
          >
            Step inside a building that
            <span style={{ color: "#C8F000" }}> hosts experiences</span>
          </h1>
          <p
            style={{
              font: "400 clamp(15px,1.6vw,18px)/1.6 Inter, sans-serif",
              color: "#AEB5C2",
              maxWidth: 540,
              margin: "0 auto 14px",
              textWrap: "pretty",
            }}
          >
            Explore every room of the Pyramid in 2.5D, discover what&apos;s on, and
            register in seconds. Tap a room to look inside.
          </p>
        </div>
        <div
          style={{
            position: "relative",
            zIndex: 2,
            maxWidth: 760,
            margin: "18px auto 0",
            animation: "floatY 8s ease-in-out infinite",
          }}
        >
          <PyramidTwin
            hero
            selected={["green", "blue", "yellow", "entrance"]}
            showRoutes
            labels={false}
            onRoom={(id) => router.push(`/explore?room=${id}`)}
          />
        </div>
        <div
          style={{
            position: "relative",
            zIndex: 3,
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
            justifyContent: "center",
            marginTop: 8,
          }}
        >
          <Link
            href="/explore"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              padding: "15px 26px",
              borderRadius: 12,
              background: "#C8F000",
              color: "#0D0D12",
              font: "700 15px Inter, sans-serif",
              boxShadow: "0 8px 30px rgba(200,240,0,.22)",
              textDecoration: "none",
            }}
          >
            Explore the Pyramid
            {arrow}
          </Link>
          <Link
            href="/events"
            style={{
              padding: "15px 24px",
              border: "1px solid rgba(255,255,255,.14)",
              borderRadius: 12,
              background: "rgba(255,255,255,.03)",
              color: "#fff",
              font: "600 15px Inter, sans-serif",
              textDecoration: "none",
            }}
          >
            Browse events
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 18, paddingBottom: 8 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
            gap: 1,
            background: "rgba(255,255,255,.06)",
            border: "1px solid rgba(255,255,255,.06)",
            borderRadius: 18,
            overflow: "hidden",
          }}
        >
          {HOME_STATS.map((s) => (
            <div key={s.label} style={{ background: "#0D0D12", padding: 24, textAlign: "center" }}>
              <div style={{ font: "800 clamp(24px,3vw,34px)/1 Inter, sans-serif", color: "#fff", letterSpacing: "-.03em" }}>
                {s.value}
              </div>
              <div style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", marginTop: 8 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Happening now */}
      <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 48, paddingBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", boxShadow: "0 0 8px #EF4444", animation: "blink 1.4s ease-in-out infinite" }} />
          <h2 style={{ font: "800 clamp(22px,2.8vw,30px)/1 Inter, sans-serif", letterSpacing: "-.02em", margin: 0, color: "#fff" }}>
            Happening now
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 18 }}>
          {ONGOING_EVENTS.map((ev) => (
            <EventCard key={ev.id} event={ev} variant="live" />
          ))}
        </div>
      </section>

      {/* Upcoming */}
      <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 42, paddingBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
          <h2 style={{ font: "800 clamp(22px,2.8vw,30px)/1 Inter, sans-serif", letterSpacing: "-.02em", margin: 0, color: "#fff" }}>
            Upcoming experiences
          </h2>
          <Link href="/events" style={pillButton}>
            All events
          </Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 18 }}>
          {UPCOMING_EVENTS.map((ev) => (
            <EventCard key={ev.id} event={ev} variant="upcoming" />
          ))}
        </div>
      </section>

      {/* Past */}
      <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 42, paddingBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
          <h2 style={{ font: "800 clamp(22px,2.8vw,30px)/1 Inter, sans-serif", letterSpacing: "-.02em", margin: 0, color: "#fff" }}>
            Past events
          </h2>
          <Link href="/past" style={pillButton}>
            Browse archive
          </Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 18 }}>
          {pastPreview.map((ev) => (
            <EventCard key={ev.id} event={ev} variant="pastPreview" />
          ))}
        </div>
      </section>

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
          <div
            style={{
              position: "absolute",
              top: -40,
              right: -40,
              width: 280,
              height: 280,
              background: "radial-gradient(closest-side,rgba(200,240,0,.14),transparent)",
              pointerEvents: "none",
            }}
          />
          <h2
            style={{
              position: "relative",
              font: "800 clamp(26px,4vw,42px)/1.05 Inter, sans-serif",
              letterSpacing: "-.03em",
              margin: "0 0 14px",
              color: "#fff",
              textWrap: "balance",
            }}
          >
            Have an event in mind?
          </h2>
          <p
            style={{
              position: "relative",
              font: "400 16px/1.55 Inter, sans-serif",
              color: "#AEB5C2",
              maxWidth: 480,
              margin: "0 auto 26px",
              textWrap: "pretty",
            }}
          >
            Become an organizer and let Pyramid OS turn your idea into a room-by-room
            plan and an instant quote.
          </p>
          <Link
            href="/become"
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              padding: "16px 30px",
              borderRadius: 13,
              background: "#C8F000",
              color: "#0D0D12",
              font: "700 16px Inter, sans-serif",
              boxShadow: "0 10px 36px rgba(200,240,0,.26)",
              textDecoration: "none",
            }}
          >
            Become an Organizer
            {arrow}
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
