"use client";

import { useState, useEffect, useRef } from "react";
import { useViewport } from "@/lib/useViewport";
import type { BudgetPackage, BudgetConflict } from "@/lib/planning/budget-allocator";
import type { BudgetNarrative } from "@/lib/ai/budget-narrative";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Stage = "input" | "loading" | "result";

type ApiResponse = {
  package: BudgetPackage;
  narrative: BudgetNarrative;
};

type EventTypeOption = {
  id: string;
  label: string;
  icon: string;
  description: string;
  color: string;
};

const EVENT_TYPES: EventTypeOption[] = [
  { id: "conference", label: "Conference", icon: "M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM9 9h6M9 13h4", description: "Keynote + breakout rooms", color: "#2A6FDB" },
  { id: "workshop", label: "Workshop", icon: "M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z", description: "Hands-on sessions", color: "#1F8A5B" },
  { id: "hackathon", label: "Hackathon", icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z", description: "Multi-day team challenge", color: "#7A4BD6" },
  { id: "exhibition", label: "Exhibition", icon: "M4 6h16M4 10h16M4 14h16M4 18h16", description: "Gallery & visitor flow", color: "#C0612A" },
  { id: "performance", label: "Performance", icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z", description: "Stage & audience", color: "#C53A6B" },
];

const BUDGET_PRESETS = [1000, 2500, 5000, 10000, 20000];
const GUEST_PRESETS = [30, 60, 120, 180, 300];

const TIER_CONFIG = {
  essentials: { label: "Essentials", color: "#7D8799", bg: "rgba(125,135,153,.12)" },
  standard: { label: "Standard", color: "#2A6FDB", bg: "rgba(42,111,219,.12)" },
  "full-service": { label: "Full Service", color: "#C8F000", bg: "rgba(200,240,0,.10)" },
};

const CONFLICT_SEVERITY_COLOR = {
  low: { border: "rgba(200,240,0,.25)", bg: "rgba(200,240,0,.06)", text: "#C8F000", dot: "#C8F000" },
  medium: { border: "rgba(245,158,11,.3)", bg: "rgba(245,158,11,.07)", text: "#F59E0B", dot: "#F59E0B" },
  high: { border: "rgba(239,68,68,.3)", bg: "rgba(239,68,68,.07)", text: "#EF4444", dot: "#EF4444" },
};

const VENUE_ROLE_LABEL = { primary: "Primary", breakout: "Breakout", support: "Support" };

// ---------------------------------------------------------------------------
// Budget ring component
// ---------------------------------------------------------------------------

function BudgetRing({ utilization, total, budget }: { utilization: number; total: number; budget: number }) {
  const [animated, setAnimated] = useState(0);
  const pct = Math.min(1, utilization);
  const color = utilization > 1 ? "#EF4444" : utilization > 0.92 ? "#F59E0B" : "#C8F000";
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = animated * circ;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimated(pct));
    return () => cancelAnimationFrame(raf);
  }, [pct]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={130} height={130} viewBox="0 0 130 130">
        <circle cx={65} cy={65} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={10} />
        <circle
          cx={65}
          cy={65}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 65 65)"
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1), stroke .4s" }}
        />
        <text x={65} y={60} textAnchor="middle" fill="#fff" fontSize={22} fontWeight={800} fontFamily="Inter, sans-serif">
          {Math.round(utilization * 100)}%
        </text>
        <text x={65} y={77} textAnchor="middle" fill="#7D8799" fontSize={10} fontFamily="Inter, sans-serif">
          of budget
        </text>
      </svg>
      <div style={{ textAlign: "center" }}>
        <div style={{ font: "700 18px/1 Inter, sans-serif", color: "#fff" }}>€{Math.round(total).toLocaleString()}</div>
        <div style={{ font: "500 11px/1.4 Inter, sans-serif", color: "#7D8799", marginTop: 3 }}>of €{budget.toLocaleString()} total</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conflict card
// ---------------------------------------------------------------------------

function ConflictCard({ conflict }: { conflict: BudgetConflict }) {
  const cfg = CONFLICT_SEVERITY_COLOR[conflict.severity];
  return (
    <div style={{ padding: "12px 14px", borderRadius: 12, border: `1px solid ${cfg.border}`, background: cfg.bg, display: "flex", gap: 12 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.dot, flex: "none", marginTop: 5 }} />
      <div>
        <div style={{ font: "600 12px/1.4 Inter, sans-serif", color: cfg.text, marginBottom: 3 }}>{conflict.message}</div>
        <div style={{ font: "400 11px/1.4 Inter, sans-serif", color: "#AEB5C2" }}>{conflict.suggestion}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Venue card
// ---------------------------------------------------------------------------

function VenueCard({ venue }: { venue: BudgetPackage["venues"][0] }) {
  const roleColor = venue.role === "primary" ? "#C8F000" : venue.role === "breakout" ? "#2A6FDB" : "#7D8799";
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 14,
        border: `1px solid rgba(255,255,255,.07)`,
        background: "#151821",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: venue.color, borderRadius: "3px 0 0 3px" }} />
      <div style={{ paddingLeft: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ font: "700 14px/1.2 Inter, sans-serif", color: "#fff" }}>{venue.name}</div>
          <span style={{ font: "600 10px/1 'JetBrains Mono', monospace", color: roleColor, background: `${roleColor}18`, padding: "3px 8px", borderRadius: 100, border: `1px solid ${roleColor}30` }}>
            {VENUE_ROLE_LABEL[venue.role]}
          </span>
        </div>
        <div style={{ font: "400 12px/1.5 Inter, sans-serif", color: "#7D8799", marginTop: 4 }}>{venue.reason}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
          <div style={{ font: "500 11px/1 Inter, sans-serif", color: "#AEB5C2" }}>
            {venue.capacity} seats · €{venue.pricePerDay}/day
          </div>
          <div style={{ font: "700 13px/1 Inter, sans-serif", color: "#fff" }}>€{venue.totalPrice.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BudgetPlannerPage() {
  const { isMobile } = useViewport();
  const padX = isMobile ? 18 : 52;

  const [stage, setStage] = useState<Stage>("input");
  const [eventType, setEventType] = useState("conference");
  const [budget, setBudget] = useState(5000);
  const [budgetInput, setBudgetInput] = useState("5000");
  const [guestCount, setGuestCount] = useState(100);
  const [days, setDays] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Typewriter effect for AI narrative
  const [visibleNarrative, setVisibleNarrative] = useState("");
  const narrativeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const text = result?.narrative.narrative ?? "";
    if (!text) return;
    let i = 0;
    if (narrativeRef.current) clearInterval(narrativeRef.current);
    // Defer the initial reset to avoid synchronous setState inside the effect
    const handle = setTimeout(() => {
      setVisibleNarrative("");
      narrativeRef.current = setInterval(() => {
        i++;
        setVisibleNarrative(text.slice(0, i));
        if (i >= text.length && narrativeRef.current) {
          clearInterval(narrativeRef.current);
        }
      }, 18);
    }, 0);
    return () => {
      clearTimeout(handle);
      if (narrativeRef.current) clearInterval(narrativeRef.current);
    };
  }, [result]);

  function handleBudgetInput(val: string) {
    setBudgetInput(val);
    const n = parseFloat(val.replace(/,/g, ""));
    if (!isNaN(n) && n >= 100) setBudget(n);
  }

  async function generate() {
    setError(null);
    setStage("loading");
    try {
      const res = await fetch("/api/organizer/budget-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType,
          budget,
          guestCount,
          days,
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate: endDate || startDate } : {}),
        }),
      });
      if (res.status === 401) {
        window.location.assign("/login?next=/organizer/budget");
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.package) {
        setError(data?.error ?? "Could not generate package. Please try again.");
        setStage("input");
        return;
      }
      setResult(data as ApiResponse);
      setStage("result");
    } catch {
      setError("Network error — please try again.");
      setStage("input");
    }
  }

  async function submitRequest() {
    if (!result) return;
    setSubmitting(true);
    setSubmitError(null);
    const pkg = result.package;
    const assetSummary = pkg.assets.map((a) => `${a.label}: ${a.qty}`);
    try {
      const res = await fetch("/api/organizer/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${pkg.eventType.charAt(0).toUpperCase() + pkg.eventType.slice(1)} · ${pkg.guestCount} guests · Budget €${pkg.budget.toLocaleString()}`,
          rawText: `Budget-planned ${pkg.eventType} for ${pkg.guestCount} guests over ${pkg.days} day(s). Total budget: €${pkg.budget.toLocaleString()}. Package tier: ${pkg.tier}. ${result.narrative.narrative}`,
          channel: "portal",
          configuration: {
            attendees: pkg.guestCount,
            assets: assetSummary,
            services: pkg.services.map((s) => s.label),
            staff: pkg.staff,
            estimatedTotal: Math.round(pkg.total),
            budgetPlan: {
              budget: pkg.budget,
              tier: pkg.tier,
              venues: pkg.venues.map((v) => ({ id: v.id, name: v.name, role: v.role })),
              budgetUtilization: pkg.budgetUtilization,
            },
          },
        }),
      });
      if (res.status === 401) {
        window.location.assign("/login?next=/organizer/budget");
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSubmitError((d as { error?: string }).error ?? "Submission failed.");
        return;
      }
      setSubmitted(true);
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Submitted confirmation ────────────────────────────────────────────────
  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", gap: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(200,240,0,.12)", border: "1.5px solid rgba(200,240,0,.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#C8F000" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2 style={{ font: "800 24px/1.1 Inter, sans-serif", color: "#fff", margin: 0, textAlign: "center" }}>
          Request submitted
        </h2>
        <p style={{ font: "400 15px/1.6 Inter, sans-serif", color: "#AEB5C2", maxWidth: 420, textAlign: "center", margin: 0 }}>
          Your budget-planned event request has been sent to the Pyramid team for review. You&apos;ll hear back shortly.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={() => { setSubmitted(false); setResult(null); setStage("input"); }}
            style={{ padding: "11px 22px", borderRadius: 10, border: "1px solid rgba(255,255,255,.12)", background: "#151821", color: "#fff", font: "600 13px Inter, sans-serif", cursor: "pointer" }}
          >
            Plan another event
          </button>
          <a
            href="/organizer/requests"
            style={{ padding: "11px 22px", borderRadius: 10, border: "none", background: "#C8F000", color: "#0D0D12", font: "700 13px Inter, sans-serif", cursor: "pointer", textDecoration: "none" }}
          >
            View my requests
          </a>
        </div>
      </div>
    );
  }

  // ── Loading stage ─────────────────────────────────────────────────────────
  if (stage === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 }}>
        <style>{`
          @keyframes pyramidPulse { 0%,100%{opacity:.4;transform:scale(.93)} 50%{opacity:1;transform:scale(1.07)} }
          @keyframes dotBounce { 0%,80%,100%{transform:translateY(0);opacity:.35} 40%{transform:translateY(-7px);opacity:1} }
          @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        `}</style>
        <div style={{ position: "relative" }}>
          <svg width={80} height={80} viewBox="0 0 34 34" fill="none" style={{ animation: "pyramidPulse 2s ease-in-out infinite" }}>
            <polygon points="17,3 31,30 3,30" stroke="rgba(200,240,0,.3)" strokeWidth="1.5" />
            <polygon points="17,3 24,16.5 10,16.5" fill="#C8F000" />
            <polygon points="10,16.5 24,16.5 31,30 3,30" fill="rgba(200,240,0,.18)" />
          </svg>
        </div>
        <div>
          <div style={{ font: "700 16px/1 Inter, sans-serif", color: "#fff", textAlign: "center", marginBottom: 8 }}>
            Building your package
          </div>
          <div style={{ font: "400 13px/1.5 Inter, sans-serif", color: "#7D8799", textAlign: "center" }}>
            Allocating venues · pricing equipment · checking conflicts
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#C8F000", animation: `dotBounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
          ))}
        </div>
      </div>
    );
  }

  // ── Result stage ──────────────────────────────────────────────────────────
  if (stage === "result" && result) {
    const pkg = result.package;
    const narrative = result.narrative;
    const tierCfg = TIER_CONFIG[pkg.tier];
    const hasConflicts = pkg.conflicts.length > 0;
    const highConflicts = pkg.conflicts.filter((c) => c.severity === "high");

    return (
      <div style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 36, paddingBottom: 60 }}>
        <style>{`
          @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
          @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
          .fadeUp { animation: fadeUp .5s ease both; }
          .fadeUp-1 { animation: fadeUp .5s .1s ease both; }
          .fadeUp-2 { animation: fadeUp .5s .2s ease both; }
          .fadeUp-3 { animation: fadeUp .5s .3s ease both; }
          .fadeUp-4 { animation: fadeUp .5s .4s ease both; }
          .fadeUp-5 { animation: fadeUp .5s .5s ease both; }
        `}</style>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="fadeUp" style={{ marginBottom: 32 }}>
          <button
            onClick={() => { setStage("input"); setResult(null); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.1)", background: "transparent", color: "#AEB5C2", font: "500 12px Inter, sans-serif", cursor: "pointer", marginBottom: 20 }}
          >
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ font: "600 10px/1 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".2em" }}>BUDGET PACKAGE</span>
                <span style={{ font: "600 10px/1 'JetBrains Mono', monospace", color: tierCfg.color, background: tierCfg.bg, padding: "3px 9px", borderRadius: 100 }}>
                  {tierCfg.label.toUpperCase()}
                </span>
              </div>
              <h1 style={{ font: "800 clamp(22px,3.5vw,34px)/1.1 Inter, sans-serif", color: "#fff", margin: "0 0 10px", letterSpacing: "-.02em" }}>
                {narrative.headline}
              </h1>
              <p style={{ font: "400 14px/1.6 Inter, sans-serif", color: "#AEB5C2", margin: 0, maxWidth: 560 }}>
                {visibleNarrative}
                <span style={{ opacity: visibleNarrative.length < narrative.narrative.length ? 1 : 0, borderRight: "2px solid #C8F000", marginLeft: 1 }}>&nbsp;</span>
              </p>
            </div>
            <BudgetRing utilization={pkg.budgetUtilization} total={pkg.total} budget={pkg.budget} />
          </div>
        </div>

        {/* ── AI Highlights ────────────────────────────────────────────────── */}
        <div className="fadeUp-1" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32 }}>
          {narrative.highlights.map((h, i) => (
            <div
              key={i}
              style={{ padding: "8px 14px", borderRadius: 100, background: "#151821", border: "1px solid rgba(255,255,255,.09)", font: "500 12px Inter, sans-serif", color: "#AEB5C2" }}
            >
              {h}
            </div>
          ))}
          <div style={{ padding: "8px 14px", borderRadius: 100, background: "rgba(200,240,0,.07)", border: "1px solid rgba(200,240,0,.2)", font: "500 12px Inter, sans-serif", color: "#C8F000" }}>
            AI: {narrative.model}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>
          {/* ── Left column ───────────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Venues */}
            <section className="fadeUp-2">
              <SectionHeader icon="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" label="Venue Plan" count={pkg.venues.length} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                {pkg.venues.map((v) => <VenueCard key={v.id} venue={v} />)}
              </div>
            </section>

            {/* Equipment */}
            {pkg.assets.length > 0 && (
              <section className="fadeUp-3">
                <SectionHeader icon="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" label="Equipment" count={pkg.assets.length} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 8, marginTop: 10 }}>
                  {pkg.assets.map((a) => (
                    <div
                      key={a.id}
                      style={{ padding: "11px 13px", borderRadius: 12, background: "#151821", border: "1px solid rgba(255,255,255,.07)", display: "flex", flexDirection: "column", gap: 4 }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ font: "700 14px/1 Inter, sans-serif", color: "#fff" }}>×{a.qty}</span>
                        <span style={{ font: "500 11px/1 Inter, sans-serif", color: "#7D8799" }}>€{a.totalPrice.toLocaleString()}</span>
                      </div>
                      <div style={{ font: "600 12px/1.3 Inter, sans-serif", color: "#AEB5C2" }}>{a.label}</div>
                      <div style={{ font: "400 10px/1.3 Inter, sans-serif", color: "#5A6278" }}>{a.sub}</div>
                      {a.shortfall > 0 && (
                        <div style={{ font: "500 10px/1.2 Inter, sans-serif", color: "#F59E0B", marginTop: 2 }}>
                          {a.shortfall} short — budget limited
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ── Right column ──────────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Services + Staff */}
            <section className="fadeUp-2">
              <SectionHeader icon="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" label="Services & Staff" count={(pkg.services.length) + (pkg.staff ? 1 : 0)} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                {pkg.services.map((s) => (
                  <div key={s.id} style={{ padding: "12px 14px", borderRadius: 12, background: "#151821", border: "1px solid rgba(255,255,255,.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ font: "600 13px/1.2 Inter, sans-serif", color: "#fff" }}>{s.label}</div>
                      <div style={{ font: "400 11px/1.3 Inter, sans-serif", color: "#7D8799" }}>{s.sub}</div>
                    </div>
                    <div style={{ font: "700 13px/1 Inter, sans-serif", color: "#AEB5C2" }}>€{s.price.toLocaleString()}</div>
                  </div>
                ))}
                {pkg.staff && (
                  <div style={{ padding: "12px 14px", borderRadius: 12, background: "#151821", border: "1px solid rgba(255,255,255,.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ font: "600 13px/1.2 Inter, sans-serif", color: "#fff" }}>Event Staff</div>
                      <div style={{ font: "400 11px/1.3 Inter, sans-serif", color: "#7D8799" }}>{pkg.staff.count} × €{pkg.staff.pricePerPerson}/person</div>
                    </div>
                    <div style={{ font: "700 13px/1 Inter, sans-serif", color: "#AEB5C2" }}>€{pkg.staff.total.toLocaleString()}</div>
                  </div>
                )}
                {pkg.services.length === 0 && !pkg.staff && (
                  <div style={{ padding: "14px", borderRadius: 12, background: "#111318", border: "1px dashed rgba(255,255,255,.07)", font: "400 12px Inter, sans-serif", color: "#5A6278", textAlign: "center" }}>
                    No services fit within budget
                  </div>
                )}
              </div>
            </section>

            {/* Cost breakdown */}
            <section className="fadeUp-3">
              <SectionHeader icon="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M12 7h.01M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" label="Cost Breakdown" />
              <div style={{ marginTop: 10, borderRadius: 14, background: "#151821", border: "1px solid rgba(255,255,255,.07)", overflow: "hidden" }}>
                {[
                  { label: "Venues", value: pkg.venues.reduce((t, v) => t + v.totalPrice, 0) },
                  { label: "Equipment", value: pkg.assets.reduce((t, a) => t + a.totalPrice, 0) },
                  { label: "Services", value: pkg.services.reduce((t, s) => t + s.price, 0) },
                  ...(pkg.staff ? [{ label: "Staff", value: pkg.staff.total }] : []),
                ].filter((l) => l.value > 0).map((line, i, arr) => (
                  <div key={line.label} style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,.05)" : "none" }}>
                    <span style={{ font: "500 12px Inter, sans-serif", color: "#AEB5C2" }}>{line.label}</span>
                    <span style={{ font: "600 12px Inter, sans-serif", color: "#fff" }}>€{line.value.toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderTop: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.02)" }}>
                  <span style={{ font: "500 12px Inter, sans-serif", color: "#7D8799" }}>Subtotal</span>
                  <span style={{ font: "600 12px Inter, sans-serif", color: "#AEB5C2" }}>€{Math.round(pkg.subtotal).toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderTop: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.02)" }}>
                  <span style={{ font: "500 12px Inter, sans-serif", color: "#7D8799" }}>VAT (20%)</span>
                  <span style={{ font: "600 12px Inter, sans-serif", color: "#AEB5C2" }}>€{Math.round(pkg.vat).toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "13px 14px", borderTop: "1px solid rgba(255,255,255,.1)" }}>
                  <span style={{ font: "700 13px Inter, sans-serif", color: "#fff" }}>Total</span>
                  <span style={{ font: "800 14px Inter, sans-serif", color: "#C8F000" }}>€{Math.round(pkg.total).toLocaleString()}</span>
                </div>
              </div>
            </section>

            {/* Conflicts */}
            {hasConflicts && (
              <section className="fadeUp-4">
                <SectionHeader
                  icon="M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.73-3L13.73 4a2 2 0 00-3.46 0L2.27 16A2 2 0 004 19z"
                  label="Conflict Alerts"
                  count={pkg.conflicts.length}
                  countColor={highConflicts.length > 0 ? "#EF4444" : "#F59E0B"}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  {pkg.conflicts.map((c, i) => <ConflictCard key={i} conflict={c} />)}
                </div>
              </section>
            )}

            {/* Recommendations */}
            {pkg.recommendations.length > 0 && (
              <section className="fadeUp-4">
                <SectionHeader icon="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" label="Recommendations" />
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  {pkg.recommendations.map((r, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, padding: "10px 12px", borderRadius: 10, background: "#151821", border: "1px solid rgba(255,255,255,.06)" }}>
                      <span style={{ color: "#C8F000", flex: "none", marginTop: 1 }}>→</span>
                      <span style={{ font: "400 12px/1.5 Inter, sans-serif", color: "#AEB5C2" }}>{r}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* ── CTA ───────────────────────────────────────────────────────────── */}
        <div className="fadeUp-5" style={{ marginTop: 32, padding: "20px 24px", borderRadius: 16, background: "#151821", border: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ font: "700 15px/1.2 Inter, sans-serif", color: "#fff" }}>
              Ready to launch this experience?
            </div>
            <div style={{ font: "400 12px/1.4 Inter, sans-serif", color: "#7D8799", marginTop: 4 }}>
              Submit this package to the Pyramid team for review and planning.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => { setStage("input"); setResult(null); }}
              style={{ padding: "11px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,.12)", background: "transparent", color: "#AEB5C2", font: "600 13px Inter, sans-serif", cursor: "pointer" }}
            >
              Adjust
            </button>
            <button
              onClick={submitRequest}
              disabled={submitting}
              style={{ padding: "11px 24px", borderRadius: 10, border: "none", background: submitting ? "rgba(200,240,0,.5)" : "#C8F000", color: "#0D0D12", font: "700 13px Inter, sans-serif", cursor: submitting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}
            >
              {submitting ? "Submitting…" : "Submit Request"}
              {!submitting && (
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </div>
          {submitError && (
            <div style={{ width: "100%", font: "500 12px Inter, sans-serif", color: "#EF4444" }}>{submitError}</div>
          )}
        </div>
      </div>
    );
  }

  // ── Input stage (default) ─────────────────────────────────────────────────
  return (
    <div style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 40, paddingBottom: 60 }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .fi { animation: fadeUp .45s ease both; }
        .fi-1 { animation: fadeUp .45s .07s ease both; }
        .fi-2 { animation: fadeUp .45s .14s ease both; }
        .fi-3 { animation: fadeUp .45s .21s ease both; }
        .fi-4 { animation: fadeUp .45s .28s ease both; }
        input[type=range]::-webkit-slider-thumb { width:20px;height:20px;background:#C8F000;border-radius:50%;cursor:pointer;-webkit-appearance:none; }
        input[type=range]::-webkit-slider-runnable-track { height:4px;border-radius:4px; }
        input[type=range] { -webkit-appearance:none;width:100%;height:4px;background:rgba(255,255,255,.1);border-radius:4px;outline:none;cursor:pointer; }
      `}</style>

      {/* Header */}
      <div className="fi" style={{ maxWidth: 700, marginBottom: 40 }}>
        <div style={{ font: "600 11px/1 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".2em", marginBottom: 12 }}>
          BUDGET PLANNER
        </div>
        <h1 style={{ font: "800 clamp(26px,4vw,42px)/1.06 Inter, sans-serif", color: "#fff", margin: "0 0 12px", letterSpacing: "-.025em" }}>
          What can your budget unlock?
        </h1>
        <p style={{ font: "400 15px/1.6 Inter, sans-serif", color: "#AEB5C2", margin: 0, maxWidth: 480 }}>
          Set your event type, budget, and headcount. The Pyramid assembles the best possible experience — venues, equipment, and services — perfectly aligned and conflict-checked.
        </p>
      </div>

      <div style={{ maxWidth: 700 }}>
        {/* Event type */}
        <div className="fi-1" style={{ marginBottom: 28 }}>
          <label style={{ font: "600 12px/1 Inter, sans-serif", color: "#AEB5C2", letterSpacing: ".04em", textTransform: "uppercase", display: "block", marginBottom: 12 }}>
            Event Type
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 8 }}>
            {EVENT_TYPES.map((t) => {
              const active = eventType === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setEventType(t.id)}
                  style={{
                    padding: "13px 12px",
                    borderRadius: 14,
                    border: active ? `1.5px solid ${t.color}60` : "1px solid rgba(255,255,255,.08)",
                    background: active ? `${t.color}12` : "#151821",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all .2s",
                  }}
                >
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={active ? t.color : "#7D8799"} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", marginBottom: 8 }}>
                    <path d={t.icon} />
                  </svg>
                  <div style={{ font: "700 13px/1.2 Inter, sans-serif", color: active ? "#fff" : "#AEB5C2" }}>{t.label}</div>
                  <div style={{ font: "400 10px/1.3 Inter, sans-serif", color: active ? t.color : "#5A6278", marginTop: 3 }}>{t.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Budget */}
        <div className="fi-2" style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
            <label style={{ font: "600 12px/1 Inter, sans-serif", color: "#AEB5C2", letterSpacing: ".04em", textTransform: "uppercase" }}>
              Budget (EUR, VAT inclusive)
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ font: "600 12px/1 Inter, sans-serif", color: "#7D8799" }}>€</span>
              <input
                type="text"
                value={budgetInput}
                onChange={(e) => handleBudgetInput(e.target.value)}
                style={{ width: 100, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,.12)", background: "#151821", color: "#fff", font: "700 14px Inter, sans-serif", textAlign: "right", outline: "none" }}
              />
            </div>
          </div>
          <input
            type="range"
            min={500}
            max={50000}
            step={500}
            value={budget}
            onChange={(e) => {
              const v = Number(e.target.value);
              setBudget(v);
              setBudgetInput(String(v));
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {BUDGET_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => { setBudget(p); setBudgetInput(String(p)); }}
                style={{
                  padding: "6px 13px",
                  borderRadius: 100,
                  border: `1px solid ${budget === p ? "rgba(200,240,0,.35)" : "rgba(255,255,255,.09)"}`,
                  background: budget === p ? "rgba(200,240,0,.08)" : "transparent",
                  color: budget === p ? "#C8F000" : "#7D8799",
                  font: "500 12px Inter, sans-serif",
                  cursor: "pointer",
                }}
              >
                €{p.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Guests + Days */}
        <div className="fi-3" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20, marginBottom: 32 }}>
          {/* Guest count */}
          <div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
              <label style={{ font: "600 12px/1 Inter, sans-serif", color: "#AEB5C2", letterSpacing: ".04em", textTransform: "uppercase" }}>
                Guests
              </label>
              <span style={{ font: "700 16px/1 Inter, sans-serif", color: "#fff" }}>{guestCount}</span>
            </div>
            <input
              type="range"
              min={10}
              max={500}
              step={10}
              value={guestCount}
              onChange={(e) => setGuestCount(Number(e.target.value))}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {GUEST_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setGuestCount(p)}
                  style={{
                    padding: "5px 11px",
                    borderRadius: 100,
                    border: `1px solid ${guestCount === p ? "rgba(200,240,0,.35)" : "rgba(255,255,255,.09)"}`,
                    background: guestCount === p ? "rgba(200,240,0,.08)" : "transparent",
                    color: guestCount === p ? "#C8F000" : "#7D8799",
                    font: "500 11px Inter, sans-serif",
                    cursor: "pointer",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Days */}
          <div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
              <label style={{ font: "600 12px/1 Inter, sans-serif", color: "#AEB5C2", letterSpacing: ".04em", textTransform: "uppercase" }}>
                Duration
              </label>
              <span style={{ font: "700 16px/1 Inter, sans-serif", color: "#fff" }}>{days} day{days > 1 ? "s" : ""}</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[1, 2, 3, 5, 7].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 10,
                    border: `1px solid ${days === d ? "rgba(200,240,0,.35)" : "rgba(255,255,255,.09)"}`,
                    background: days === d ? "rgba(200,240,0,.08)" : "#151821",
                    color: days === d ? "#C8F000" : "#AEB5C2",
                    font: "600 13px Inter, sans-serif",
                    cursor: "pointer",
                  }}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Event dates — for real availability checking */}
        <div style={{ marginBottom: 28 }}>
          <label style={{ font: "600 12px/1 Inter, sans-serif", color: "#AEB5C2", letterSpacing: ".04em", textTransform: "uppercase", display: "block", marginBottom: 10 }}>
            Event Dates <span style={{ font: "400 10px/1 Inter, sans-serif", color: "#525B6B", letterSpacing: "0", textTransform: "none", marginLeft: 6 }}>— used to check real venue availability</span>
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderRadius: 12, background: "#151821", border: `1px solid ${startDate ? "rgba(200,240,0,.22)" : "rgba(255,255,255,.08)"}`, transition: "border-color .2s" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={startDate ? "rgba(200,240,0,.7)" : "#525B6B"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
              <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
            </svg>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
              }}
              style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: startDate ? "#fff" : "#525B6B", font: "500 13px Inter, sans-serif", colorScheme: "dark" }}
            />
            <span style={{ color: "#3D4555", font: "400 12px Inter, sans-serif", flex: "none" }}>→</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: endDate ? "#fff" : "#525B6B", font: "500 13px Inter, sans-serif", colorScheme: "dark" }}
            />
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(""); setEndDate(""); }}
                style={{ flex: "none", background: "none", border: "none", color: "#525B6B", cursor: "pointer", font: "500 12px Inter, sans-serif", padding: "0 2px" }}
                aria-label="Clear dates"
              >✕</button>
            )}
          </div>
          {!startDate && (
            <div style={{ font: "400 11px/1 Inter, sans-serif", color: "#3D4555", marginTop: 6 }}>
              Skip to see all venues — add dates to filter out already-booked spaces.
            </div>
          )}
        </div>

        {/* Budget summary preview */}
        <div className="fi-3" style={{ padding: "14px 18px", borderRadius: 14, background: "#151821", border: "1px solid rgba(255,255,255,.07)", marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            {[
              { label: "Event", value: EVENT_TYPES.find((t) => t.id === eventType)?.label ?? eventType },
              { label: "Budget", value: `€${budget.toLocaleString()}` },
              { label: "Guests", value: String(guestCount) },
              { label: "Days", value: `${days} day${days > 1 ? "s" : ""}` },
              ...(startDate ? [{ label: "From", value: new Date(`${startDate}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) }] : []),
            ].map((item) => (
              <div key={item.label} style={{ textAlign: "center" }}>
                <div style={{ font: "400 10px/1 'JetBrains Mono', monospace", color: "#5A6278", letterSpacing: ".1em", marginBottom: 4 }}>{item.label.toUpperCase()}</div>
                <div style={{ font: "700 14px/1 Inter, sans-serif", color: "#fff" }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 10, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", font: "500 12px Inter, sans-serif", color: "#EF4444" }}>
            {error}
          </div>
        )}

        {/* Generate button */}
        <div className="fi-4">
          <button
            onClick={generate}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 28px",
              borderRadius: 14,
              border: "none",
              background: "linear-gradient(135deg,#C8F000,#9ab800)",
              color: "#0D0D12",
              font: "700 15px Inter, sans-serif",
              cursor: "pointer",
              boxShadow: "0 8px 32px rgba(200,240,0,.25)",
            }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="#0D0D12">
              <path d="M12 3l1.8 4.8L18.6 9.6 13.8 11.4 12 16.2 10.2 11.4 5.4 9.6 10.2 7.8z" />
            </svg>
            Generate My Package
          </button>
          <p style={{ font: "400 11px/1.4 Inter, sans-serif", color: "#5A6278", marginTop: 10 }}>
            AI generates the narrative · deterministic engine allocates venues, assets, and services · conflicts flagged automatically
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared section header
// ---------------------------------------------------------------------------

function SectionHeader({
  icon,
  label,
  count,
  countColor = "#7D8799",
}: {
  icon: string;
  label: string;
  count?: number;
  countColor?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#7D8799" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d={icon} />
      </svg>
      <span style={{ font: "600 11px/1 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em", textTransform: "uppercase" }}>
        {label}
      </span>
      {count !== undefined && (
        <span style={{ font: "700 10px/1 Inter, sans-serif", color: countColor, background: `${countColor}18`, padding: "2px 7px", borderRadius: 100 }}>
          {count}
        </span>
      )}
    </div>
  );
}
