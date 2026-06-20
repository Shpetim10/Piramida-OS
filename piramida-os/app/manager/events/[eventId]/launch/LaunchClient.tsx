"use client";

import { useState, useCallback } from "react";
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

export function LaunchClient({ eventId, readiness: initialReadiness, gateNotes }: Props) {
  const { isMobile } = useMgrViewport();
  const [readiness, setReadiness] = useState(initialReadiness);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const cfg = OVERALL_CONFIG[readiness.overallStatus];
  const gatesReady = readiness.gates.filter((g: LaunchGate) => g.status === "go").length;
  const publishEnabled = readiness.readyForLaunch;
  const score = Math.round((gatesReady / Math.max(1, readiness.gates.length)) * 100);
  const launchHeroCols = isMobile ? "1fr" : "1.3fr auto";

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/events/${eventId}/launch-readiness`);
      if (res.ok) {
        const data = await res.json() as typeof readiness;
        setReadiness(data);
      }
    } finally {
      setRefreshing(false);
    }
  }, [eventId]);

  async function handlePublish() {
    if (!publishEnabled) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch(`/api/staff/events/${eventId}/publish`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setPublishError(data.error ?? "Publish failed");
      } else {
        await handleRefresh();
      }
    } catch {
      setPublishError("Network error");
    } finally {
      setPublishing(false);
    }
  }

  const pathToGo = readiness.pathToGo ?? [];
  const criticalBlockers = pathToGo.filter((p) => p.critical);
  const advisoryBlockers = pathToGo.filter((p) => !p.critical);

  return (
    <ScreenContainer>
      {publishError && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 12, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.3)", color: "#EF4444", font: "500 13px Inter, sans-serif" }}>
          {publishError}
        </div>
      )}

      {/* Hero */}
      <section style={{ position: "relative", overflow: "hidden", border: `1px solid ${cfg.color}40`, borderRadius: 22, background: `radial-gradient(800px 380px at 18% 0%,${cfg.color}1a,transparent 60%),#101319`, padding: 30, marginBottom: 24 }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)", backgroundSize: "34px 34px", pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: launchHeroCols, gap: 26, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", border: `1px solid ${cfg.color}47`, borderRadius: 100, background: `${cfg.color}14` }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.color, boxShadow: `0 0 8px ${cfg.color}` }} />
              <span style={{ font: "600 10px 'JetBrains Mono', monospace", color: cfg.color, letterSpacing: ".16em" }}>LAUNCH GATE · {cfg.up}</span>
            </div>
            <h1 style={{ font: "800 clamp(30px,4.4vw,52px)/1 Inter, sans-serif", color: "#fff", letterSpacing: "-.03em", margin: "14px 0 12px" }}>{cfg.title}</h1>
            <p style={{ font: "400 15px/1.6 Inter, sans-serif", color: "#AEB5C2", maxWidth: 480, margin: "0 0 22px", textWrap: "pretty" }}>{cfg.sub}</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={handlePublish}
                disabled={!publishEnabled || publishing}
                style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "15px 26px", borderRadius: 12, border: "none", font: "700 14px Inter, sans-serif", cursor: publishEnabled ? "pointer" : "not-allowed", background: publishEnabled ? cfg.color : "#1A1F2B", color: publishEnabled ? "#0D0D12" : "#525B6B", ...(publishEnabled ? { boxShadow: `0 8px 26px ${cfg.color}33` } : {}) }}>
                {publishing ? "Publishing…" : publishEnabled ? "Publish event & go live" : "Publishing blocked"}
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "15px 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,.12)", background: "transparent", color: "#AEB5C2", font: "600 13px Inter, sans-serif", cursor: "pointer" }}>
                {refreshing ? "Refreshing…" : "Refresh gates"}
              </button>
            </div>
          </div>
          {!isMobile && (
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
          )}
        </div>
      </section>

      {/* Path to GO — only when there are blockers */}
      {pathToGo.length > 0 && (
        <div style={{ marginBottom: 24, border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, background: "#0F1218", padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" stroke="#C8F000" strokeWidth="2" fill="none" strokeLinecap="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><circle cx="12" cy="12" r="4" /></svg>
            <span style={{ font: "700 13px Inter, sans-serif", color: "#fff" }}>Path to GO</span>
            <span style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginLeft: "auto" }}>
              {criticalBlockers.length} CRITICAL · {advisoryBlockers.length} ADVISORY
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pathToGo.map((item, idx) => (
              <div key={item.gateKey} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 11, background: item.critical ? "rgba(239,68,68,.06)" : "rgba(245,158,11,.04)", border: `1px solid ${item.critical ? "rgba(239,68,68,.2)" : "rgba(245,158,11,.15)"}` }}>
                <span style={{ font: "700 11px 'JetBrains Mono', monospace", color: "#7D8799", width: 20, textAlign: "center", flex: "none" }}>{idx + 1}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ font: "600 12px Inter, sans-serif", color: "#fff" }}>{item.label}</span>
                  <span style={{ font: "500 11px Inter, sans-serif", color: "#AEB5C2", display: "block", marginTop: 2 }}>{item.action}</span>
                </div>
                {item.critical && (
                  <span style={{ font: "700 8px 'JetBrains Mono', monospace", color: "#EF4444", background: "rgba(239,68,68,.12)", padding: "3px 7px", borderRadius: 5, flex: "none" }}>CRITICAL</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gates grid */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ font: "700 15px Inter, sans-serif", color: "#fff" }}>Launch gates</div>
        <span style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".08em" }}>{gatesReady} / {readiness.gates.length} CLEARED</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
        {readiness.gates.map((g: LaunchGate) => {
          const c = STATUS_COLOR[g.status];
          return (
            <div key={g.key} style={{ border: `1px solid ${g.status === "go" ? "rgba(255,255,255,.08)" : `${c}4d`}`, borderRadius: 14, background: g.status === "go" ? "#151821" : `${c}0d`, padding: 16, position: "relative" }}>
              {g.critical && g.status !== "go" && (
                <span style={{ position: "absolute", top: 10, right: 10, font: "700 7px 'JetBrains Mono', monospace", letterSpacing: ".06em", color: c, background: `${c}22`, padding: "2px 6px", borderRadius: 4 }}>CRITICAL</span>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ width: 24, height: 24, borderRadius: 7, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: `${c}22` }}>
                  <MgrIcon name={STATUS_ICON[g.status]} color={c} />
                </span>
                <span style={{ flex: 1, font: "700 13px Inter, sans-serif", color: "#fff", paddingRight: g.critical && g.status !== "go" ? 60 : 0 }}>{g.label}</span>
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
              {g.nextAction && g.status !== "go" && (
                <p style={{ font: "500 10px Inter, sans-serif", color: c, margin: "8px 0 0", paddingLeft: 2, borderLeft: `2px solid ${c}40` }}>
                  Next: {g.nextAction}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </ScreenContainer>
  );
}
