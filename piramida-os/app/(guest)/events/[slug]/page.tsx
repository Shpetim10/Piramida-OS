"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useViewport } from "@/lib/useViewport";

interface AgendaItem {
  title: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  space: string | null;
}

interface PublicEventDetail {
  slug: string;
  title: string;
  description: string | null;
  start: string | null;
  end: string | null;
  venue: string | null;
  registrationOpen: boolean;
  capacity: number | null;
  remainingCapacity: number | null;
  agendaItems: AgendaItem[];
}

interface RegisteredState {
  status: string;
  ticketToken: string | null;
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatFullDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { isMobile } = useViewport();
  const padX = isMobile ? 18 : 52;

  const [event, setEvent] = useState<PublicEventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [formState, setFormState] = useState({ fullName: "", email: "", company: "", consentAccepted: false });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [registered, setRegistered] = useState<RegisteredState | null>(null);

  useEffect(() => {
    fetch(`/api/public/events/${encodeURIComponent(slug)}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        if (!r.ok) return r.json().then((d: { error?: string }) => Promise.reject(d.error ?? "Failed"));
        return r.json();
      })
      .then((data: PublicEventDetail | null) => { if (data) setEvent(data); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!formState.consentAccepted) { setFormError("Please accept the terms to continue."); return; }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/public/events/${encodeURIComponent(slug)}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formState.fullName,
          email: formState.email,
          company: formState.company || undefined,
          consentAccepted: true,
        }),
      });
      const data = await res.json() as { status?: string; ticketToken?: string | null; error?: string };
      if (!res.ok) { setFormError(data.error ?? "Registration failed."); return; }
      setRegistered({ status: data.status ?? "CONFIRMED", ticketToken: data.ticketToken ?? null });
    } catch {
      setFormError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const filledPct = event?.capacity && event.remainingCapacity !== null
    ? Math.round(((event.capacity - event.remainingCapacity) / event.capacity) * 100)
    : null;

  if (loading) {
    return (
      <div style={{ padding: "80px 52px", font: "500 14px Inter, sans-serif", color: "#7D8799" }}>
        Loading event…
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div style={{ padding: "80px 52px" }}>
        <div style={{ font: "800 28px Inter, sans-serif", color: "#fff", marginBottom: 12 }}>Event not found</div>
        <Link href="/events" style={{ color: "#C8F000", font: "600 14px Inter, sans-serif" }}>
          ← Back to events
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Hero */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          height: "clamp(220px,30vw,360px)",
          background: "linear-gradient(135deg,rgba(42,111,219,.3),#151821 70%)",
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
            <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            All events
          </Link>
          <h1 style={{ font: "800 clamp(28px,5vw,52px)/1.02 Inter, sans-serif", letterSpacing: "-.03em", margin: "0 0 14px", color: "#fff", maxWidth: 760, textWrap: "balance" }}>
            {event.title}
          </h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, font: "500 14px Inter, sans-serif", color: "#AEB5C2" }}>
            {event.start && <span>{formatFullDate(event.start)}</span>}
            {event.venue && <span>{event.venue}</span>}
          </div>
        </div>
      </section>

      {/* Content grid */}
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
        {/* Left: description + agenda */}
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
                    <span style={{ font: "600 13px 'JetBrains Mono', monospace", color: "#C8F000", width: 52, flex: "none" }}>
                      {formatTime(a.startsAt)}
                    </span>
                    <span style={{ flex: 1, font: "600 14px Inter, sans-serif", color: "#fff" }}>{a.title}</span>
                    {a.space && (
                      <span style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", whiteSpace: "nowrap" }}>{a.space}</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right: registration card */}
        <div style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, background: "#151821", padding: 22 }}>
            <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".16em", marginBottom: 6 }}>
              GENERAL ADMISSION
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 18 }}>
              <span style={{ font: "800 28px Inter, sans-serif", color: "#fff" }}>Free</span>
              <span style={{ font: "500 13px Inter, sans-serif", color: "#7D8799" }}>· registration required</span>
            </div>

            {/* Registered success */}
            {registered ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                  padding: 16, borderRadius: 12,
                  background: registered.status === "WAITLISTED" ? "rgba(245,158,11,.12)" : "rgba(34,197,94,.12)",
                  color: registered.status === "WAITLISTED" ? "#F59E0B" : "#22C55E",
                  font: "700 15px Inter, sans-serif",
                }}>
                  {registered.status === "WAITLISTED" ? "⏳ Added to waitlist" : "✓ You're registered!"}
                </div>
                {registered.ticketToken && (
                  <Link
                    href={`/tickets/${registered.ticketToken}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      padding: "12px 18px",
                      borderRadius: 12,
                      border: "1px solid rgba(200,240,0,.3)",
                      background: "rgba(200,240,0,.07)",
                      color: "#C8F000",
                      font: "700 13px Inter, sans-serif",
                      textDecoration: "none",
                    }}
                  >
                    View QR ticket →
                  </Link>
                )}
              </div>
            ) : event.registrationOpen ? (
              /* Registration form */
              <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ font: "600 11px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".08em" }}>FULL NAME *</span>
                  <input
                    required
                    value={formState.fullName}
                    onChange={(e) => setFormState((s) => ({ ...s, fullName: e.target.value }))}
                    placeholder="Your full name"
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ font: "600 11px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".08em" }}>EMAIL *</span>
                  <input
                    required
                    type="email"
                    value={formState.email}
                    onChange={(e) => setFormState((s) => ({ ...s, email: e.target.value }))}
                    placeholder="you@example.com"
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ font: "600 11px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".08em" }}>COMPANY</span>
                  <input
                    value={formState.company}
                    onChange={(e) => setFormState((s) => ({ ...s, company: e.target.value }))}
                    placeholder="Optional"
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={formState.consentAccepted}
                    onChange={(e) => setFormState((s) => ({ ...s, consentAccepted: e.target.checked }))}
                    style={{ marginTop: 3, accentColor: "#C8F000", flex: "none" }}
                  />
                  <span style={{ font: "400 12px/1.4 Inter, sans-serif", color: "#AEB5C2" }}>
                    I agree to receive event updates and confirm my registration.
                  </span>
                </label>
                {formError && (
                  <div style={{ font: "500 12px Inter, sans-serif", color: "#EF4444" }}>{formError}</div>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 9,
                    width: "100%",
                    padding: 15,
                    border: "none",
                    borderRadius: 12,
                    background: submitting ? "#6B7280" : "#C8F000",
                    color: "#0D0D12",
                    font: "700 15px Inter, sans-serif",
                    cursor: submitting ? "not-allowed" : "pointer",
                    boxShadow: submitting ? "none" : "0 8px 26px rgba(200,240,0,.2)",
                    transition: "background .15s",
                  }}
                >
                  {submitting ? "Registering…" : "Register · Get QR Pass"}
                </button>
              </form>
            ) : (
              <div style={{ padding: 16, borderRadius: 12, background: "rgba(125,135,153,.1)", color: "#7D8799", font: "600 14px Inter, sans-serif", textAlign: "center" }}>
                Registration closed
              </div>
            )}

            {/* Capacity bar */}
            {filledPct !== null && (
              <>
                <div style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", marginTop: 16, textAlign: "center" }}>
                  {event.capacity! - event.remainingCapacity!} / {event.capacity} spots filled
                </div>
                <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,.08)", marginTop: 8, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${filledPct}%`, background: "#C8F000", borderRadius: 3 }} />
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.1)",
  background: "#0F1218",
  color: "#fff",
  font: "500 13px Inter, sans-serif",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};
