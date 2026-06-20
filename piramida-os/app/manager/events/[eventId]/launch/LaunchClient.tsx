"use client";

import { useState } from "react";
import { ReadinessRing, MgrIcon } from "@/components/manager/twin";
import { ScreenContainer, useMgrViewport } from "@/components/manager/ScreenContainer";
import type { LaunchReadinessResult, LaunchGate } from "@/lib/services/launch-readiness";

interface Props {
  eventId: string;
  readiness: LaunchReadinessResult;
  gateNotes: Record<string, string>;
}

const STATUS_COLOR: Record<string, string> = {
  go: "#22C55E",
  warning: "#F59E0B",
  blocked: "#EF4444",
};

const STATUS_ICON: Record<string, "check" | "warn" | "x"> = {
  go: "check",
  warning: "warn",
  blocked: "x",
};

const OVERALL_CONFIG = {
  go: {
    color: "#D6FF00",
    title: "Event ready for launch",
    sub: "All critical gates are cleared. The Pyramid is go.",
    up: "CLEARED",
  },
  warning: {
    color: "#F59E0B",
    title: "Launch warning",
    sub: "Some gates need attention before publish. Launching now carries operational risk.",
    up: "CAUTION",
  },
  blocked: {
    color: "#EF4444",
    title: "Launch blocked",
    sub: "Critical gates are unmet. Publishing is disabled until cleared.",
    up: "BLOCKED",
  },
};

export function LaunchClient({ eventId, readiness, gateNotes }: Props) {
  const { isMobile } = useMgrViewport();
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const cfg = OVERALL_CONFIG[readiness.overallStatus];
  const gatesReady = readiness.gates.filter((g: LaunchGate) => g.status === "go").length;
  const publishEnabled = readiness.overallStatus !== "blocked";
  const score = Math.round((gatesReady / Math.max(1, readiness.gates.length)) * 100);

  const launchHeroCols = isMobile ? "1fr" : "1.3fr auto";

  async function handlePublish() {
    if (!publishEnabled) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch(`/api/staff/events/${eventId}/publish`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setPublishError(data.error ?? "Publish failed");
      } else {
        window.location.reload();
      }
    } catch {
      setPublishError("Network error");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <ScreenContainer>
      {publishError && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 12, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.3)", color: "#EF4444", font: "500 13px Inter, sans-serif" }}>
          {publishError}
        </div>
      )}

      {/* Hero */}
      <section style={{ position: "relative", overflow: "hidden", border: `1px solid ${cfg.color}40`, borderRadius: 22, background: `radial-gradient(800px 380px at 18% 0%,${cfg.color}1a,transparent 60%),#101319`, padding: 30 }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)", backgroundSize: "34px 34px", pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: launchHeroCols, gap: 26, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", border: `1px solid ${cfg.color}47`, borderRadius: 100, background: `${cfg.color}14` }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.color, boxShadow: `0 0 8px ${cfg.color}` }} />
              <span style={{ font: "600 10px 'JetBrains Mono', monospace", color: cfg.color, letterSpacing: ".16em" }}>LAUNCH GATE · {cfg.up}</span>
            </div>
            <h1 style={{ font: "800 clamp(30px,4.4vw,52px)/1 Inter, sans-serif", color: "#fff", letterSpacing: "-.03em", margin: "14px 0 12px" }}>{cfg.title}</h1>
            <p style={{ font: "400 15px/1.6 Inter, sans-serif", color: "#AEB5C2", maxWidth: 480, margin: "0 0 22px", textWrap: "pretty" }}>{cfg.sub}</p>
            <button
              onClick={handlePublish}
              disabled={!publishEnabled || publishing}
              style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "15px 26px", borderRadius: 12, border: "none", font: "700 14px Inter, sans-serif", cursor: publishEnabled ? "pointer" : "not-allowed", background: publishEnabled ? cfg.color : "#1A1F2B", color: publishEnabled ? "#0D0D12" : "#525B6B", ...(publishEnabled ? { boxShadow: `0 8px 26px ${cfg.color}33` } : {}) }}>
              {publishing ? "Publishing…" : publishEnabled ? "Publish event & go live" : "Publishing blocked"}
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "relative", width: 188, height: 188 }}>
              <ReadinessRing pct={score} color={cfg.color} />
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div style={{ font: "800 44px/1 Inter, sans-serif", color: "#fff", letterSpacing: "-.03em" }}>
                  {score}<span style={{ fontSize: 20, color: "#7D8799" }}>%</span>
                </div>
                <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: cfg.color, letterSpacing: ".14em", marginTop: 6 }}>READINESS</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gates */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "24px 0 14px" }}>
        <div style={{ font: "700 15px Inter, sans-serif", color: "#fff" }}>Launch gates</div>
        <span style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".08em" }}>{gatesReady} / {readiness.gates.length} CLEARED</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
        {readiness.gates.map((g: LaunchGate) => {
          const c = STATUS_COLOR[g.status];
          return (
            <div key={g.key} style={{ border: `1px solid ${g.status === "go" ? "rgba(255,255,255,.08)" : `${c}4d`}`, borderRadius: 14, background: g.status === "go" ? "#151821" : `${c}0d`, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ width: 24, height: 24, borderRadius: 7, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: `${c}22` }}>
                  <MgrIcon name={STATUS_ICON[g.status]} color={c} />
                </span>
                <span style={{ flex: 1, font: "700 13px Inter, sans-serif", color: "#fff" }}>{g.label}</span>
                <span style={{ font: "700 8px 'JetBrains Mono', monospace", letterSpacing: ".06em", color: c, background: `${c}1f`, padding: "4px 7px", borderRadius: 6, flex: "none" }}>{g.status.toUpperCase()}</span>
              </div>
              <p style={{ font: "500 11px/1.5 Inter, sans-serif", color: "#7D8799", margin: 0 }}>
                {gateNotes[g.key] ?? g.message}
              </p>
              {g.blockers.length > 0 && (
                <ul style={{ margin: "8px 0 0", padding: "0 0 0 14px", listStyle: "disc" }}>
                  {g.blockers.map((b) => (
                    <li key={b} style={{ font: "500 10px Inter, sans-serif", color: "#EF4444", marginBottom: 3 }}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </ScreenContainer>
  );
}
