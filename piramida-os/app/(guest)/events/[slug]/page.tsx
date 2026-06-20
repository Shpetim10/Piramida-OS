"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { PyramidTwin } from "@/lib/PyramidTwin";
import { useViewport } from "@/lib/useViewport";

type AgendaItem = {
  title: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  space: string | null;
};

type PublishedEvent = {
  slug: string;
  title: string | null;
  description: string | null;
  start: string | null;
  end: string | null;
  venue: string | null;
  registrationOpen: boolean;
  capacity: number | null;
  remainingCapacity: number | null;
  agendaItems: AgendaItem[];
};

const LIME = "#C8F000";

const EVENT_TYPE_COLORS: Record<string, string> = {
  conference: "#2A6FDB",
  workshop: "#7A4BD6",
  concert: "#C53A6B",
  exhibition: "#0EA5E9",
  default: "#C8F000",
};

export default function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { isMobile } = useViewport();
  const padX = isMobile ? 18 : 52;

  const [event, setEvent] = useState<PublishedEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Registration form state
  const [regState, setRegState] = useState<"idle" | "form" | "submitting" | "done">("idle");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [ticketToken, setTicketToken] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/public/events/${slug}`)
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); return; }
        const d = await r.json();
        if (d && d.slug) setEvent(d);
        else setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  async function register() {
    if (!fullName.trim() || !email.trim() || !consent) return;
    setRegState("submitting");
    setRegError(null);
    try {
      const res = await fetch(`/api/public/events/${slug}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, consentAccepted: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegError(data.error ?? "Registration failed. Please try again.");
        setRegState("form");
        return;
      }
      setTicketToken(data.ticket?.token ?? null);
      setRegState("done");
    } catch {
      setRegError("Network error. Please try again.");
      setRegState("form");
    }
  }

  const color = EVENT_TYPE_COLORS.default;

  if (loading) {
    return (
      <div style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 60, color: "#7D8799", font: "500 14px Inter, sans-serif" }}>
        Loading event…
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 60, textAlign: "center" }}>
        <div style={{ font: "700 20px Inter, sans-serif", color: "#fff", marginBottom: 10 }}>Event not found</div>
        <Link href="/events" style={{ color: LIME, font: "600 14px Inter, sans-serif" }}>← Browse all events</Link>
      </div>
    );
  }

  const filledSpots = event.capacity != null && event.remainingCapacity != null
    ? event.capacity - event.remainingCapacity
    : null;
  const fillPct = event.capacity && filledSpots != null
    ? Math.round((filledSpots / event.capacity) * 100)
    : null;

  const startDate = event.start ? new Date(event.start) : null;
  const endDate = event.end ? new Date(event.end) : null;

  return (
    <div>
      {/* Hero */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          height: "clamp(220px,30vw,360px)",
          background: `linear-gradient(135deg,${color}33,#151821 70%)`,
          display: "flex",
          alignItems: "flex-end",
        }}
      >
        <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(135deg,rgba(255,255,255,.04) 0 2px,transparent 2px 16px)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent,rgba(13,13,18,.9))" }} />
        <div style={{ position: "relative", paddingLeft: padX, paddingRight: padX, paddingTop: 40, paddingBottom: 30, width: "100%" }}>
          <Link
            href="/events"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              marginBottom: 16,
              padding: "7px 13px",
              border: "1px solid rgba(255,255,255,.16)",
              borderRadius: 9,
              background: "rgba(13,13,18,.5)",
              color: "#AEB5C2",
              font: "600 12px Inter, sans-serif",
              textDecoration: "none",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            All events
          </Link>
          <h1 style={{ font: "800 clamp(30px,5vw,56px)/1.02 Inter, sans-serif", letterSpacing: "-.03em", margin: "0 0 16px", color: "#fff", maxWidth: 760, textWrap: "balance" }}>
            {event.title ?? "Upcoming Event"}
          </h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, font: "500 14px Inter, sans-serif", color: "#AEB5C2" }}>
            {startDate && (
              <span>{startDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
            )}
            {event.venue && <span>{event.venue}</span>}
            {event.capacity && <span>{event.capacity} guests max</span>}
          </div>
        </div>
      </section>

      {/* Body */}
      <section
        style={{
          paddingLeft: padX,
          paddingRight: padX,
          paddingTop: 34,
          paddingBottom: 54,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1.7fr 1fr",
          gap: 34,
          alignItems: "start",
        }}
      >
        {/* Left */}
        <div>
          {event.description && (
            <p style={{ font: "400 16px/1.6 Inter, sans-serif", color: "#AEB5C2", margin: "0 0 30px", textWrap: "pretty" }}>
              {event.description}
            </p>
          )}

          {event.agendaItems.length > 0 && (
            <>
              <h3 style={{ font: "700 19px Inter, sans-serif", color: "#fff", margin: "0 0 16px" }}>Agenda</h3>
              <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, overflow: "hidden", marginBottom: 34 }}>
                {event.agendaItems.map((a, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 18, padding: "15px 18px", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                    {a.startsAt && (
                      <span style={{ font: "600 13px 'JetBrains Mono', monospace", color: LIME, width: 48, flex: "none" }}>
                        {new Date(a.startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    <span style={{ flex: 1, font: "600 14px Inter, sans-serif", color: "#fff" }}>{a.title}</span>
                    {a.space && <span style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", whiteSpace: "nowrap" }}>{a.space}</span>}
                  </div>
                ))}
              </div>
            </>
          )}

          {!event.description && event.agendaItems.length === 0 && (
            <p style={{ font: "400 16px/1.6 Inter, sans-serif", color: "#AEB5C2", margin: "0 0 30px" }}>
              A full-day gathering inside the Pyramid — keynotes, parallel breakout tracks, hands-on demos and curated networking across connected spaces.
            </p>
          )}
        </div>

        {/* Right — registration */}
        <div style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, background: "#151821", padding: 22 }}>
            <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".16em", marginBottom: 6 }}>
              GENERAL ADMISSION
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 18 }}>
              <span style={{ font: "800 30px Inter, sans-serif", color: "#fff" }}>Free</span>
              <span style={{ font: "500 13px Inter, sans-serif", color: "#7D8799" }}>· registration required</span>
            </div>

            {regState === "done" ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, width: "100%", padding: 15, borderRadius: 12, background: "rgba(34,197,94,.12)", color: "#22C55E", font: "700 15px Inter, sans-serif", marginBottom: 12, boxSizing: "border-box" }}>
                  ✓ You&apos;re registered!
                </div>
                {ticketToken && (
                  <div style={{ padding: 14, borderRadius: 12, background: "rgba(200,240,0,.06)", border: "1px solid rgba(200,240,0,.2)", textAlign: "center" }}>
                    <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: LIME, letterSpacing: ".12em", marginBottom: 8 }}>YOUR TICKET TOKEN</div>
                    <div style={{ font: "700 11px 'JetBrains Mono', monospace", color: "#fff", wordBreak: "break-all", letterSpacing: ".06em" }}>{ticketToken}</div>
                    <div style={{ font: "500 11px Inter, sans-serif", color: "#7D8799", marginTop: 8 }}>Show this code at check-in.</div>
                  </div>
                )}
              </div>
            ) : regState === "idle" ? (
              <>
                {event.registrationOpen ? (
                  <button
                    onClick={() => setRegState("form")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 9,
                      width: "100%",
                      padding: 15,
                      border: "none",
                      borderRadius: 12,
                      background: LIME,
                      color: "#0D0D12",
                      font: "700 15px Inter, sans-serif",
                      cursor: "pointer",
                      boxShadow: "0 8px 26px rgba(200,240,0,.2)",
                      boxSizing: "border-box",
                    }}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" fill="none">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                      <path d="M14 14h3v3M20 20h.01M17 20h.01M20 17h.01" />
                    </svg>
                    Register · Get QR Pass
                  </button>
                ) : (
                  <div style={{ textAlign: "center", padding: 15, borderRadius: 12, background: "#1A1F2B", color: "#7D8799", font: "600 14px Inter, sans-serif" }}>
                    Registration closed
                  </div>
                )}
              </>
            ) : (
              /* Registration form */
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  type="text"
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,.12)", background: "#0F1218", color: "#fff", font: "400 14px Inter, sans-serif", outline: "none" }}
                />
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,.12)", background: "#0F1218", color: "#fff", font: "400 14px Inter, sans-serif", outline: "none" }}
                />
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", font: "500 12px/1.5 Inter, sans-serif", color: "#7D8799" }}>
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    style={{ marginTop: 2, accentColor: LIME }}
                  />
                  I consent to my name and email being used to process this registration.
                </label>
                {regError && (
                  <div style={{ font: "500 12px Inter, sans-serif", color: "#EF4444" }}>{regError}</div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={register}
                    disabled={regState === "submitting" || !fullName || !email || !consent}
                    style={{
                      flex: 1,
                      padding: 13,
                      border: "none",
                      borderRadius: 10,
                      background: regState === "submitting" || !fullName || !email || !consent ? "#1A1F2B" : LIME,
                      color: regState === "submitting" || !fullName || !email || !consent ? "#525B6B" : "#0D0D12",
                      font: "700 14px Inter, sans-serif",
                      cursor: regState === "submitting" ? "default" : "pointer",
                    }}
                  >
                    {regState === "submitting" ? "Registering…" : "Confirm Registration"}
                  </button>
                  <button
                    onClick={() => { setRegState("idle"); setRegError(null); }}
                    style={{ padding: "13px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,.1)", background: "transparent", color: "#AEB5C2", font: "600 14px Inter, sans-serif", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Capacity meter */}
            {event.capacity != null && filledSpots != null && (
              <>
                <div style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", marginTop: 14, textAlign: "center" }}>
                  {filledSpots} / {event.capacity} spots filled
                </div>
                <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,.08)", marginTop: 8, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${fillPct}%`, background: LIME, borderRadius: 3 }} />
                </div>
              </>
            )}
          </div>

          {/* Guest map */}
          <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, background: "#151821", padding: 20 }}>
            <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: LIME, letterSpacing: ".16em", marginBottom: 14 }}>
              YOUR GUEST MAP
            </div>
            <div style={{ borderRadius: 12, background: "radial-gradient(400px 240px at 50% 30%,rgba(200,240,0,.04),#101319)", padding: 12, marginBottom: 12 }}>
              <PyramidTwin selected={["green", "blue", "yellow", "entrance", "common"]} labels showRoutes />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, font: "500 12px Inter, sans-serif", color: "#AEB5C2" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: LIME }} />
              Entrance → Registration → Green Room
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
