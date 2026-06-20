"use client";

import { useState } from "react";
import type { PlanDiff } from "@/lib/planning/plan-diff";

const LIME = "#C8F000";

interface Scenario {
  label: string;
  guests: number;
}

function buildScenarios(fromGuests: number): Scenario[] {
  return [
    { label: `+60 guests (→${fromGuests + 60})`, guests: fromGuests + 60 },
    { label: `−60 guests (→${Math.max(1, fromGuests - 60)})`, guests: Math.max(1, fromGuests - 60) },
  ];
}

interface SimResult {
  fromGuests: number;
  toGuests: number;
  diff: PlanDiff;
}

function fmt(n: number): string {
  return Math.abs(n).toLocaleString("en-US");
}

function DiffRow({ label, value, positive }: { label: string; value: string; positive: boolean | null }) {
  const c = positive === null ? "#AEB5C2" : positive ? "#22C55E" : "#EF4444";
  const arrow = positive === null ? "↕" : positive ? "↑" : "↓";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: 13, border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, background: "#0F1218" }}>
      <span style={{ width: 22, height: 22, borderRadius: 7, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", font: "700 13px Inter, sans-serif", color: c, background: `${c}1f` }}>
        {arrow}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ font: "600 12px Inter, sans-serif", color: "#fff" }}>{label}</div>
        <div style={{ font: "500 11px/1.4 Inter, sans-serif", color: "#AEB5C2", marginTop: 3 }}>{value}</div>
      </div>
    </div>
  );
}

export function ChangeImpactPanel({ eventId, fromGuests }: { eventId: string; fromGuests: number }) {
  const SCENARIOS = buildScenarios(fromGuests);
  const [active, setActive] = useState<string | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runScenario(scenario: Scenario) {
    if (active === scenario.label) {
      setActive(null);
      setResult(null);
      return;
    }
    setActive(scenario.label);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/simulate-change`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedGuests: scenario.guests }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? "Simulation failed");
        return;
      }
      const data = await res.json() as SimResult;
      setResult(data);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const diff = result?.diff;

  // Build impact rows from diff
  const impacts: Array<{ label: string; value: string; positive: boolean | null }> = [];
  if (diff) {
    if (diff.guestsDelta !== 0) {
      impacts.push({
        label: "Guests",
        value: `${result!.fromGuests} → ${result!.toGuests} (${diff.guestsDelta > 0 ? "+" : ""}${diff.guestsDelta})`,
        positive: null,
      });
    }
    if (diff.spacesAdded.length > 0) {
      impacts.push({ label: "Spaces added", value: diff.spacesAdded.join(", "), positive: true });
    }
    if (diff.spacesRemoved.length > 0) {
      impacts.push({ label: "Spaces removed", value: diff.spacesRemoved.join(", "), positive: false });
    }
    if (diff.shortagesAdded.length > 0) {
      impacts.push({ label: "New shortages", value: diff.shortagesAdded.join(", "), positive: false });
    }
    if (diff.shortagesRemoved.length > 0) {
      impacts.push({ label: "Shortages resolved", value: diff.shortagesRemoved.join(", "), positive: true });
    }
    if (diff.quoteTotal.delta !== 0) {
      const dir = diff.quoteTotal.delta > 0;
      impacts.push({
        label: "Quote total",
        value: `${fmt(diff.quoteTotal.from)} → ${fmt(diff.quoteTotal.to)} ${diff.quoteTotal.currency} (${dir ? "+" : ""}${fmt(diff.quoteTotal.delta)})`,
        positive: !dir,
      });
    }
    if (diff.feasibilityScore.delta !== 0) {
      impacts.push({
        label: "Feasibility",
        value: `${diff.feasibilityScore.from}% → ${diff.feasibilityScore.to}% (${diff.feasibilityScore.delta > 0 ? "+" : ""}${diff.feasibilityScore.delta}pp)`,
        positive: diff.feasibilityScore.delta > 0,
      });
    }
    for (const al of diff.assetLines) {
      impacts.push({
        label: al.name,
        value: `${al.fromReserved} → ${al.toReserved} reserved`,
        positive: al.delta < 0,
      });
    }
  }

  return (
    <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", padding: 22 }}>
      <div style={{ font: "700 14px Inter, sans-serif", color: "#fff", marginBottom: 4 }}>Change Impact</div>
      <p style={{ font: "500 12px/1.5 Inter, sans-serif", color: "#7D8799", margin: "0 0 14px" }}>
        Simulate a decision change and preview the full downstream effect on spaces, assets, quote, and feasibility.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {SCENARIOS.map((s) => {
          const isActive = active === s.label;
          return (
            <button
              key={s.label}
              onClick={() => runScenario(s)}
              disabled={loading && !isActive}
              style={{
                padding: "9px 14px",
                borderRadius: 9,
                border: `1px solid ${isActive ? LIME : "rgba(255,255,255,.1)"}`,
                background: isActive ? "rgba(200,240,0,.08)" : "transparent",
                color: isActive ? "#fff" : "#AEB5C2",
                font: "600 12px Inter, sans-serif",
                cursor: "pointer",
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {loading && (
        <div style={{ color: "#7D8799", font: "500 12px Inter, sans-serif", padding: "20px 0" }}>Running simulation…</div>
      )}
      {error && (
        <div style={{ color: "#EF4444", font: "500 12px Inter, sans-serif", padding: "12px 14px", background: "rgba(239,68,68,.06)", borderRadius: 10, marginBottom: 12 }}>{error}</div>
      )}
      {!loading && impacts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {impacts.map((i, idx) => (
            <DiffRow key={`${i.label}-${idx}`} label={i.label} value={i.value} positive={i.positive} />
          ))}
        </div>
      )}
      {!loading && !result && !error && (
        <div style={{ color: "#39414F", font: "500 12px Inter, sans-serif", padding: "30px 0", textAlign: "center" }}>
          Pick a scenario above to simulate the impact.
        </div>
      )}
    </div>
  );
}
