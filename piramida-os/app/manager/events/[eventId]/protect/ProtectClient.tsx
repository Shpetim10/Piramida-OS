"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScreenContainer, useMgrViewport } from "@/components/manager/ScreenContainer";
import { PyramidTwin } from "@/components/manager/twin";
import { twinRoomsFromPositions, type TwinFlow, type TwinPin, type TwinRoomPosition } from "@/lib/manager/twin-overlays";
import { LIME } from "@/lib/manager/data";

const A = LIME;

interface InventoryRow {
  cat: string;
  req: number;
  res: number;
  avail: number;
  short: boolean;
}

interface ConflictRow {
  id: string;
  sev: string;
  sc: string;
  title: string;
  explain: string;
  rec: string;
  impact: string;
  ic: string;
  suggestions: ConflictSuggestion[];
}

interface ConflictSuggestion {
  id: string;
  type: string;
  label: string;
  rationale: string;
  rank: number;
  residualRisk: string;
  costDelta: number;
  disruption: string;
  beforeRisk: string;
  afterRisk: string;
  tradeoffNarration: string;
  gateDelta?: Record<string, string>;
  quoteDelta: number;
  toolTraceCount: number;
  facts: string[];
}

interface ReadinessGate {
  key: string;
  label: string;
  status: "go" | "warning" | "blocked";
  message: string;
}

interface Props {
  inventory: InventoryRow[];
  conflicts: ConflictRow[];
  readinessGates: ReadinessGate[];
  twinRooms: TwinRoomPosition[];
  twinSelectedSlugs: string[];
  twinPins: TwinPin[];
  twinFlows: TwinFlow[];
}

export function ProtectClient({
  inventory,
  conflicts,
  readinessGates,
  twinRooms,
  twinSelectedSlugs,
  twinPins,
  twinFlows,
}: Props) {
  const { isMobile } = useMgrViewport();
  const router = useRouter();
  const [resolved, setResolved] = useState<string[]>([]);
  const [applying, setApplying] = useState<string | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const openConflicts = conflicts.filter((c) => !resolved.includes(c.id)).length;
  const conflictCountColor = openConflicts > 0 ? "#EF4444" : "#22C55E";
  const protectCols = isMobile ? "1fr" : "0.9fr 1.1fr";
  const visiblePins = twinPins.filter((pin) => !resolved.includes(pin.conflictId));
  const visibleFlows = twinFlows.filter((flow) => !resolved.includes(flow.conflictId));
  const twinRoomDefs = twinRoomsFromPositions(twinRooms);
  const selectedSlugs = twinSelectedSlugs.length > 0 ? twinSelectedSlugs : twinRooms.map((room) => room.slug).slice(0, 4);

  async function applyFix(conflictId: string, suggestionId: string) {
    setApplying(conflictId);
    setError(null);
    try {
      const res = await fetch(`/api/staff/conflicts/${conflictId}/fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to apply fix");
      } else {
        setResolved((r) => r.concat(conflictId));
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setApplying(null);
    }
  }

  const warningGates = readinessGates.filter((gate) => gate.status !== "go");

  return (
    <ScreenContainer>
      {error && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 12, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.3)", color: "#EF4444", font: "500 13px Inter, sans-serif" }}>
          {error}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: protectCols, gap: 18, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 8, background: "#151821", padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ font: "700 15px Inter, sans-serif", color: "#fff" }}>Operations Twin</div>
              <span style={{ font: "700 9px 'JetBrains Mono', monospace", color: "#F59E0B", letterSpacing: ".08em" }}>{openConflicts} PINS</span>
            </div>
            <div style={{ height: isMobile ? 270 : 330, position: "relative" }}>
              <PyramidTwin selected={selectedSlugs} layer="flow" rooms={twinRoomDefs} />
              {visibleFlows.map((flow) => {
                const dx = flow.x2Pct - flow.x1Pct;
                const dy = flow.y2Pct - flow.y1Pct;
                const length = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                return (
                  <div
                    key={flow.conflictId}
                    title={flow.label}
                    style={{
                      position: "absolute",
                      left: `${flow.x1Pct}%`,
                      top: `${flow.y1Pct}%`,
                      width: `${length}%`,
                      height: 2,
                      background: flow.color,
                      transform: `rotate(${angle}deg)`,
                      transformOrigin: "left center",
                      opacity: 0.85,
                    }}
                  />
                );
              })}
              {visiblePins.map((pin) => (
                <div
                  key={pin.conflictId}
                  title={pin.title}
                  style={{
                    position: "absolute",
                    left: `${pin.xPct}%`,
                    top: `${pin.yPct}%`,
                    width: 12,
                    height: 12,
                    marginLeft: -6,
                    marginTop: -6,
                    borderRadius: 6,
                    background: pin.color,
                    boxShadow: `0 0 0 6px ${pin.color}33`,
                  }}
                />
              ))}
            </div>
            {warningGates.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {warningGates.map((gate) => (
                  <span key={gate.key} style={{ border: `1px solid ${gate.status === "blocked" ? "rgba(239,68,68,.35)" : "rgba(245,158,11,.35)"}`, borderRadius: 6, padding: "6px 8px", color: gate.status === "blocked" ? "#EF4444" : "#F59E0B", font: "700 10px 'JetBrains Mono', monospace" }}>
                    {gate.label.toUpperCase()} {gate.status.toUpperCase()}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 8, background: "#151821", padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ font: "700 15px Inter, sans-serif", color: "#fff" }}>Inventory Planner</div>
            </div>
            {inventory.length === 0 ? (
              <div style={{ color: "#7D8799", font: "500 13px Inter, sans-serif", padding: "20px 0", textAlign: "center" }}>
                Run the planning engine to populate inventory data.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                {inventory.map((p) => {
                  const availPct = p.req > 0 ? Math.min(100, (p.avail / p.req) * 100) : 100;
                  const resPct = p.req > 0 ? Math.min(100, (p.res / p.req) * 100) : 100;
                  const figures = `${p.res}/${p.req} · ${p.avail} free`;
                  return (
                    <div key={p.cat}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ font: "600 12px Inter, sans-serif", color: "#fff" }}>{p.cat}</span>
                        <span style={{ font: "700 9px 'JetBrains Mono', monospace", color: p.short ? "#EF4444" : "#22C55E", background: p.short ? "rgba(239,68,68,.12)" : "rgba(34,197,94,.12)", padding: "3px 7px", borderRadius: 6 }}>
                          {p.short ? "SHORT" : "OK"}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ flex: 1, height: 7, borderRadius: 4, background: "#0F1218", overflow: "hidden", position: "relative" }}>
                          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${availPct}%`, background: "#2A6FDB", opacity: 0.4 }} />
                          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${resPct}%`, background: p.short ? "#EF4444" : A, borderRadius: 4 }} />
                        </div>
                        <span style={{ font: "600 11px 'JetBrains Mono', monospace", color: "#7D8799", width: 96, textAlign: "right", flex: "none" }}>{figures}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Conflict Center */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ font: "700 15px Inter, sans-serif", color: "#fff" }}>Conflict Center</div>
              <div style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", marginTop: 3 }}>Problems caught before they reach the floor.</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ font: "800 22px/1 Inter, sans-serif", color: conflictCountColor }}>{openConflicts}</div>
              <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>OPEN</div>
            </div>
          </div>
          {conflicts.length === 0 && (
            <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, background: "#151821", padding: 24, textAlign: "center", color: "#7D8799", font: "500 13px Inter, sans-serif" }}>
              No conflicts detected. Run the planning engine to check.
            </div>
          )}
          {conflicts.map((c) => {
            const done = resolved.includes(c.id);
            const isApplying = applying === c.id;
            const activeSuggestionId = selectedSuggestion[c.id] ?? c.suggestions[0]?.id ?? null;
            const activeSuggestion = c.suggestions.find((suggestion) => suggestion.id === activeSuggestionId) ?? c.suggestions[0];
            return (
              <div key={c.id} style={{ border: `1px solid ${done ? "rgba(34,197,94,.3)" : "rgba(255,255,255,.08)"}`, borderRadius: 8, background: done ? "rgba(34,197,94,.04)" : "#151821", padding: 20, ...(done ? { opacity: 0.85 } : {}) }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ font: "700 9px 'JetBrains Mono', monospace", letterSpacing: ".06em", color: done ? "#0D0D12" : "#fff", background: done ? "#22C55E" : c.sc, padding: "5px 8px", borderRadius: 7, flex: "none" }}>
                    {done ? "RESOLVED" : c.sev}
                  </span>
                  <span style={{ font: "700 14px Inter, sans-serif", color: "#fff", flex: 1 }}>{c.title}</span>
                  <span style={{ font: "600 9px 'JetBrains Mono', monospace", color: done ? "#22C55E" : "#7D8799", flex: "none" }}>{done ? "✓ APPLIED" : "OPEN"}</span>
                </div>
                <p style={{ font: "400 13px/1.6 Inter, sans-serif", color: "#AEB5C2", margin: "0 0 12px" }}>{c.explain}</p>
                {c.suggestions.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 13 }}>
                    {c.suggestions.map((s) => {
                      const active = activeSuggestion?.id === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedSuggestion((current) => ({ ...current, [c.id]: s.id }))}
                          style={{ textAlign: "left", border: `1px solid ${active ? "rgba(214,255,0,.45)" : "rgba(255,255,255,.08)"}`, borderRadius: 8, background: active ? "rgba(214,255,0,.06)" : "#10141C", padding: 12, cursor: "pointer" }}
                        >
                          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ font: "700 12px Inter, sans-serif", color: "#fff" }}>#{s.rank} {s.label}</span>
                            <span style={{ font: "700 9px 'JetBrains Mono', monospace", color: active ? A : "#7D8799" }}>{s.type}</span>
                          </div>
                          <p style={{ font: "500 12px/1.5 Inter, sans-serif", color: "#AEB5C2", margin: "8px 0 0" }}>{s.rationale}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
                {activeSuggestion && (
                  <div style={{ padding: 13, borderRadius: 8, background: "rgba(214,255,0,.05)", border: "1px solid rgba(214,255,0,.2)", borderLeft: "3px solid #D6FF00", marginBottom: 13 }}>
                    <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#D6FF00", letterSpacing: ".1em", marginBottom: 6 }}>FIX SIMULATION PREVIEW</div>
                    <p style={{ font: "500 13px/1.5 Inter, sans-serif", color: "#E6E9EF", margin: 0 }}>{activeSuggestion.tradeoffNarration || activeSuggestion.rationale}</p>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 8, marginTop: 10 }}>
                      <Metric label="Risk" value={`${activeSuggestion.residualRisk.toUpperCase()}`} color={activeSuggestion.residualRisk === "low" ? "#22C55E" : "#F59E0B"} />
                      <Metric label="Disruption" value={activeSuggestion.disruption.toUpperCase()} color={activeSuggestion.disruption === "low" ? "#22C55E" : "#F59E0B"} />
                      <Metric label="Quote delta" value={`${activeSuggestion.quoteDelta.toLocaleString()} ALL`} color="#AEB5C2" />
                    </div>
                    {activeSuggestion.gateDelta && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                        {Object.entries(activeSuggestion.gateDelta).map(([gate, delta]) => (
                          <span key={gate} style={{ border: "1px solid rgba(34,197,94,.3)", borderRadius: 6, padding: "5px 7px", color: "#22C55E", font: "700 10px 'JetBrains Mono', monospace" }}>
                            {gate.toUpperCase()} {delta}
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{ font: "500 11px Inter, sans-serif", color: "#7D8799", marginTop: 10 }}>
                      Tool-certified facts: {activeSuggestion.toolTraceCount} call(s)
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                      {activeSuggestion.facts.map((fact) => (
                        <span key={fact} style={{ background: "rgba(42,111,219,.14)", border: "1px solid rgba(42,111,219,.28)", borderRadius: 6, padding: "5px 7px", color: "#AEB5C2", font: "600 10px Inter, sans-serif" }}>{fact}</span>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  onClick={done || !activeSuggestionId ? undefined : () => applyFix(c.id, activeSuggestionId)}
                  disabled={done || isApplying || !activeSuggestionId}
                  style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", cursor: done || !activeSuggestionId ? "default" : "pointer", font: "700 13px Inter, sans-serif", background: done ? "rgba(34,197,94,.14)" : !activeSuggestionId ? "#1A1F2B" : A, color: done ? "#22C55E" : !activeSuggestionId ? "#525B6B" : "#0D0D12", ...(done || !activeSuggestionId ? {} : { boxShadow: "0 6px 20px rgba(214,255,0,.2)" }) }}>
                  {isApplying ? "Applying..." : done ? "Resolution applied" : activeSuggestionId ? "Apply selected fix" : "Manual resolution required"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </ScreenContainer>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "rgba(0,0,0,.16)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 6, padding: 9 }}>
      <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".08em" }}>{label.toUpperCase()}</div>
      <div style={{ font: "800 13px Inter, sans-serif", color, marginTop: 4 }}>{value}</div>
    </div>
  );
}
