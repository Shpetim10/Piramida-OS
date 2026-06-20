import { ScreenContainer } from "@/components/manager/ScreenContainer";
import { DnaRadar } from "@/components/manager/twin";
import { getEvent } from "@/lib/services/events";
import { computeDNAScores } from "@/lib/services/planning";
import { narratePlan } from "@/lib/ai/explainer";
import { LIME } from "@/lib/manager/data";

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  const event = await getEvent(eventId).catch(() => null);
  const dnaScores = event ? await computeDNAScores(event.requirements).catch(() => []) : [];

  // Requirements / missing fields are surfaced via event.requirements from the DB.

  const summaryCells = event
    ? [
        { k: "EVENT TYPE", v: event.type },
        { k: "EXPECTED GUESTS", v: String(event.expectedGuests ?? "—") },
        { k: "EVENT CODE", v: event.code },
        { k: "STATUS", v: event.status },
        { k: "SETUP START", v: event.setupStart ? new Date(event.setupStart).toLocaleString("en-GB", { timeZone: "Europe/Tirane", dateStyle: "medium", timeStyle: "short" }) : "—" },
        { k: "TEARDOWN END", v: event.teardownEnd ? new Date(event.teardownEnd).toLocaleString("en-GB", { timeZone: "Europe/Tirane", dateStyle: "medium", timeStyle: "short" }) : "—" },
      ]
    : [];

  // Build requirements list from DB records.
  const requirementRows = event?.requirements.map((r) => ({
    label: r.key.replace(/([A-Z])/g, " $1").trim(),
    map: String(r.valueJson),
    source: r.source ?? "staff",
  })) ?? [];

  // AI narration (uses only tool-verified data from event).
  const planNarration = event
    ? await narratePlan({
        eventTitle: event.title,
        expectedGuests: event.expectedGuests ?? 0,
        spacesAllocated: event.spaceReservations.map((sr) => ({
          name: (sr as { space?: { name: string } }).space?.name ?? sr.spaceId,
          role: "Reserved",
          score: 80,
          reasons: [],
        })),
        conflictCount: event.conflicts.filter((c) => c.status === "OPEN").length,
        feasibilityScore: event.feasibilityScore ?? 0,
      }).catch(() => "Run the planning engine to generate an AI analysis of this event.")
    : "Event not found.";

  const dnaDims = dnaScores.map((d) => ({ k: d.label, s: d.shortLabel, v: d.value }));

  return (
    <ScreenContainer>
      {!event && (
        <div style={{ color: "#EF4444", padding: 24, border: "1px solid rgba(239,68,68,.3)", borderRadius: 14, background: "rgba(239,68,68,.05)" }}>
          Event not found or you do not have access.
        </div>
      )}
      {event && (
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.9fr", gap: 18, alignItems: "start" }}>
          {/* LEFT column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Event summary */}
            <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", padding: 22 }}>
              <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em", marginBottom: 14 }}>EVENT SUMMARY</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 1, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 14, overflow: "hidden" }}>
                {summaryCells.map((c) => (
                  <div key={c.k} style={{ background: "#151821", padding: 16 }}>
                    <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".08em", marginBottom: 7 }}>{c.k}</div>
                    <div style={{ font: "700 15px Inter, sans-serif", color: "#fff" }}>{c.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Requirements */}
            <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", padding: 22 }}>
              <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em", marginBottom: 14 }}>REQUIREMENTS — PARSED &amp; MAPPED</div>
              {requirementRows.length === 0 && (
                <div style={{ color: "#7D8799", font: "500 13px Inter, sans-serif" }}>No requirements yet. Parse the request to extract them.</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {requirementRows.map((r) => (
                  <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 13px", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, background: "#0F1218" }}>
                    <span style={{ width: 22, height: 22, borderRadius: 7, background: "rgba(34,197,94,.14)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" stroke="#22C55E" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
                    </span>
                    <span style={{ flex: 1, font: "600 13px Inter, sans-serif", color: "#fff", textTransform: "capitalize" }}>{r.label}</span>
                    <span style={{ font: "500 11px 'JetBrains Mono', monospace", color: "#7D8799" }}>{r.map}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI analysis */}
            <div style={{ border: "1px solid rgba(214,255,0,.2)", borderRadius: 18, background: "radial-gradient(480px 260px at 0% 0%,rgba(214,255,0,.05),#151821)", padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" stroke={LIME} strokeWidth="1.7" fill="none" strokeLinecap="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" /></svg>
                <span style={{ font: "600 10px 'JetBrains Mono', monospace", color: LIME, letterSpacing: ".12em" }}>AI ANALYSIS</span>
              </div>
              <p style={{ font: "400 14px/1.7 Inter, sans-serif", color: "#E6E9EF", margin: 0, textWrap: "pretty" }}>{planNarration}</p>
            </div>
          </div>

          {/* RIGHT column — Event DNA */}
          <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", padding: 22, position: "sticky", top: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ font: "700 14px Inter, sans-serif", color: "#fff" }}>Event DNA</div>
              <span style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>{dnaDims.length} DIMENSIONS</span>
            </div>
            <p style={{ font: "500 11px/1.5 Inter, sans-serif", color: "#7D8799", margin: "0 0 8px" }}>The operational signature of this event.</p>
            {dnaDims.length > 0 ? (
              <>
                <div style={{ height: 230, margin: "0 -6px 8px" }}>
                  <DnaRadar dims={dnaDims} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {dnaDims.map((d) => {
                    const c = d.v >= 75 ? LIME : d.v >= 55 ? "#AEB5C2" : "#7D8799";
                    return (
                      <div key={d.k}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ font: "600 11px Inter, sans-serif", color: "#E6E9EF" }}>{d.k}</span>
                          <span style={{ font: "700 11px 'JetBrains Mono', monospace", color: c }}>{d.v}</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: "#0F1218", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${d.v}%`, borderRadius: 2, background: d.v >= 75 ? LIME : "#3A4456" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={{ color: "#7D8799", font: "500 13px Inter, sans-serif", padding: "40px 0", textAlign: "center" }}>
                Run the planning engine to compute DNA scores.
              </div>
            )}
          </div>
        </div>
      )}
    </ScreenContainer>
  );
}
