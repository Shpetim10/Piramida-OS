"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// All valid next-states per current state (mirrors EVENT_TRANSITIONS).
const TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PENDING_APPROVAL", "PLANNING", "CANCELLED"],
  PENDING_APPROVAL: ["PLANNING", "CANCELLED", "ARCHIVED"],
  PLANNING: ["PROPOSED", "CONFIRMED", "CANCELLED"],
  PROPOSED: ["CONFIRMED", "PLANNING", "CANCELLED"],
  CONFIRMED: ["PUBLISHED", "LAUNCH_READY", "PLANNING", "CANCELLED"],
  PUBLISHED: ["LAUNCH_READY", "LIVE", "CANCELLED"],
  LAUNCH_READY: ["LIVE", "PUBLISHED", "CANCELLED"],
  LIVE: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
  CANCELLED: ["ARCHIVED"],
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "#7D8799",
  PENDING_APPROVAL: "#F59E0B",
  PLANNING: "#C8F000",
  PROPOSED: "#2A6FDB",
  CONFIRMED: "#7A4BD6",
  PUBLISHED: "#22C55E",
  LAUNCH_READY: "#22C55E",
  LIVE: "#C53A6B",
  COMPLETED: "#7D8799",
  ARCHIVED: "#4a5568",
  CANCELLED: "#EF4444",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_APPROVAL: "Pending approval",
  LAUNCH_READY: "Launch ready",
  PLANNING: "Planning",
  PROPOSED: "Proposed",
  CONFIRMED: "Confirmed",
  PUBLISHED: "Published",
  LIVE: "Live",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
  CANCELLED: "Cancel",
  DRAFT: "Draft",
};

// Danger states that require extra confirmation
const DANGER = new Set(["CANCELLED", "ARCHIVED"]);

export function ManagerStatusPanel({
  eventId,
  currentStatus,
}: {
  eventId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = TRANSITIONS[currentStatus] ?? [];
  const color = STATUS_COLOR[currentStatus] ?? "#7D8799";

  async function apply(target: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Status change failed");
      setPending(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  if (next.length === 0) {
    return (
      <div
        style={{
          border: "1px solid rgba(255,255,255,.07)",
          borderRadius: 14,
          background: "#151821",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flex: "none" }} />
        <div style={{ font: "600 13px Inter, sans-serif", color: "#7D8799" }}>
          Status: <span style={{ color }}>{currentStatus}</span> — no further transitions available.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.07)",
        borderRadius: 14,
        background: "#151821",
        padding: "18px 20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flex: "none" }} />
        <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>
          STATUS
        </div>
        <span
          style={{
            font: "600 10px 'JetBrains Mono', monospace",
            letterSpacing: ".08em",
            padding: "3px 9px",
            borderRadius: 6,
            color,
            background: color + "22",
          }}
        >
          {currentStatus}
        </span>
      </div>

      <div style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", marginBottom: 12 }}>
        Move to:
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {next.map((target) => {
          const tc = STATUS_COLOR[target] ?? "#7D8799";
          const isDanger = DANGER.has(target);
          const isConfirming = pending === target;
          return (
            <div key={target}>
              {!isConfirming ? (
                <button
                  onClick={() => (isDanger ? setPending(target) : apply(target))}
                  disabled={saving}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 9,
                    border: `1px solid ${tc}44`,
                    background: "transparent",
                    color: tc,
                    font: "600 12px Inter, sans-serif",
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.5 : 1,
                    transition: "background .15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = tc + "18")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {STATUS_LABEL[target] ?? target}
                </button>
              ) : (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ font: "500 12px Inter, sans-serif", color: "#7D8799" }}>
                    Confirm {STATUS_LABEL[target]}?
                  </span>
                  <button
                    onClick={() => apply(target)}
                    disabled={saving}
                    style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: tc, color: "#fff", font: "600 12px Inter, sans-serif", cursor: "pointer" }}
                  >
                    {saving ? "…" : "Yes"}
                  </button>
                  <button
                    onClick={() => setPending(null)}
                    style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,.1)", background: "transparent", color: "#7D8799", font: "600 12px Inter, sans-serif", cursor: "pointer" }}
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div style={{ marginTop: 12, font: "500 12px Inter, sans-serif", color: "#EF4444" }}>{error}</div>
      )}
    </div>
  );
}
