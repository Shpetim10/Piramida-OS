import { ScreenContainer } from "@/components/manager/ScreenContainer";
import { PipelineStepNav } from "@/components/manager/PipelineStepNav";
import { DnaRadar } from "@/components/manager/twin";
import { ManagerStatusPanel } from "@/components/manager/ManagerStatusPanel";
import { getEvent } from "@/lib/services/events";
import { computeDNAScores } from "@/lib/services/planning";
import { narratePlan } from "@/lib/ai/explainer";
import { LIME } from "@/lib/manager/data";

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  const event = await getEvent(eventId).catch(() => null);
  const dnaScores = event ? await computeDNAScores(event.requirements).catch(() => []) : [];

  // Request summary data (organizer words + structured form answers)
  type ReqSummary = {
    rawText: string | null;
    clarifications: unknown;
    extractedJson: unknown;
    missingFields: unknown;
    confidence: number | null;
    contact: { firstName: string; lastName: string } | null;
  };
  const req: ReqSummary | null = (event?.request as ReqSummary | null | undefined) ?? null;
  const clarifs = req?.clarifications as Record<string, unknown> | null;
  const reqCfg = clarifs?.configuration as Record<string, unknown> | null;
  const reqSched = clarifs?.schedule as Record<string, unknown> | null;
  const reqAnswers = (clarifs?.answers as { question: string; answer: string }[] | null)?.filter((a) => a.answer) ?? [];
  const reqExtracted = req?.extractedJson as Record<string, unknown> | null;

  function fmtDate(iso: unknown): string {
    if (typeof iso !== "string" || !iso) return "—";
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  }

  function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  type ExtractedNeeds = {
    mainStage?: boolean; breakoutRooms?: number; coffeeArea?: boolean;
    registrationDesk?: boolean; publicGuestRegistration?: boolean;
    screens?: number; projectors?: number; wirelessMicrophones?: number;
    wiredMicrophones?: number; chairs?: number; tables?: number;
    speakers?: number; livestream?: boolean;
  };

  function flatNeeds(ex: Record<string, unknown>): ExtractedNeeds {
    const n = ex.needs as ExtractedNeeds | undefined;
    return n ?? {
      mainStage: ex.mainStage as boolean, breakoutRooms: ex.breakoutRooms as number,
      coffeeArea: ex.coffeeArea as boolean, registrationDesk: ex.registrationDesk as boolean,
      publicGuestRegistration: ex.publicGuestRegistration as boolean,
      screens: ex.screens as number, projectors: ex.projectors as number,
      wirelessMicrophones: ex.wirelessMicrophones as number, wiredMicrophones: ex.wiredMicrophones as number,
      chairs: ex.chairs as number, tables: ex.tables as number,
      speakers: ex.speakers as number, livestream: ex.livestream as boolean,
    };
  }

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
    <>
      <PipelineStepNav eventId={eventId} />
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
            {/* Status control */}
            <div>
              <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em", marginBottom: 10 }}>STATUS CONTROL</div>
              <ManagerStatusPanel eventId={event.id} currentStatus={event.status} />
            </div>

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

            {/* Request summary */}
            {req && (
              <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ flex: 1, font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em" }}>ORGANIZER REQUEST</div>
                  {req.contact && (
                    <span style={{ font: "500 11px Inter, sans-serif", color: "#AEB5C2" }}>
                      {req.contact.firstName} {req.contact.lastName}
                    </span>
                  )}
                </div>
                <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Raw text */}
                  {typeof req.rawText === "string" && req.rawText.length > 0 ? (
                    <div>
                      <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginBottom: 8 }}>ORGANIZER&apos;S WORDS</div>
                      <p style={{ font: "400 13px/1.65 Inter, sans-serif", color: "#AEB5C2", margin: 0, borderLeft: "2px solid rgba(200,240,0,.3)", paddingLeft: 12, textWrap: "pretty" }}>
                        &ldquo;{req.rawText}&rdquo;
                      </p>
                    </div>
                  ) : null}

                  {/* Schedule */}
                  {!!reqSched && !!(reqSched.startDate || reqSched.endDate) && (
                    <div>
                      <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginBottom: 8 }}>SCHEDULE</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "rgba(255,255,255,.05)", borderRadius: 10, overflow: "hidden" }}>
                        {[
                          ["Start date", fmtDate(reqSched.startDate)],
                          ["End date", fmtDate(reqSched.endDate)],
                        ].map(([lbl, val]) => (
                          <div key={lbl} style={{ background: "#0F1218", padding: "10px 12px" }}>
                            <div style={{ font: "500 9px 'JetBrains Mono', monospace", color: "#525B6B", letterSpacing: ".1em", marginBottom: 4 }}>{lbl}</div>
                            <div style={{ font: "700 12px Inter, sans-serif", color: "#E6E9EF" }}>{String(val)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Configuration */}
                  {reqCfg && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>CONFIGURATION</div>
                      {!!reqCfg.attendees && (
                        <ReqRow label="Attendees">{String(reqCfg.attendees)} guests</ReqRow>
                      )}
                      {!!reqCfg.estimatedTotal && typeof reqCfg.estimatedTotal === "number" && (
                        <ReqRow label="Organizer estimate">
                          <span style={{ color: "#C8F000" }}>€{reqCfg.estimatedTotal.toLocaleString()}</span>
                        </ReqRow>
                      )}
                      {!!reqCfg.access && typeof reqCfg.access === "object" && (
                        <ReqRow label="Visibility">
                          {(reqCfg.access as { visibility: string }).visibility === "public" ? "Public" : "Private"}
                          {(reqCfg.access as { externalGuests: boolean }).externalGuests ? " · External guests allowed" : ""}
                        </ReqRow>
                      )}
                      {!!reqCfg.staff && typeof reqCfg.staff === "object" && (
                        <ReqRow label="Staff">
                          {(reqCfg.staff as { count: number }).count} people
                        </ReqRow>
                      )}
                      {Array.isArray(reqCfg.services) && (reqCfg.services as string[]).length > 0 && (
                        <ReqRow label="Services">{(reqCfg.services as string[]).join(", ")}</ReqRow>
                      )}
                      {Array.isArray(reqCfg.assets) && (reqCfg.assets as string[]).length > 0 && (
                        <div>
                          <div style={{ font: "500 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".08em", marginBottom: 6 }}>ASSETS REQUESTED</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {(reqCfg.assets as string[]).map((a) => (
                              <span key={a} style={{ padding: "4px 9px", borderRadius: 6, background: "#0F1218", border: "1px solid rgba(255,255,255,.09)", font: "500 11px Inter, sans-serif", color: "#AEB5C2" }}>{a}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI extraction summary */}
                  {reqExtracted && (
                    <div>
                      <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginBottom: 8 }}>
                        AI EXTRACTION
                        {req.confidence != null && (
                          <span style={{ marginLeft: 8, color: LIME }}>{Math.round(req.confidence * 100)}% CONFIDENCE</span>
                        )}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "rgba(255,255,255,.05)", borderRadius: 10, overflow: "hidden" }}>
                        {([
                          ["Event type", reqExtracted.eventType ? String(reqExtracted.eventType) : null],
                          ["Expected guests", reqExtracted.expectedGuests != null ? String(reqExtracted.expectedGuests) : null],
                          ["Wireless mics", reqExtracted.wirelessMicrophones != null ? String(reqExtracted.wirelessMicrophones) : null],
                          ["Setup hours", reqExtracted.setupHours != null ? `${reqExtracted.setupHours}h` : null],
                        ] as [string, string | null][]).filter(([, v]) => v).map(([lbl, val]) => (
                          <div key={lbl} style={{ background: "#0F1218", padding: "10px 12px" }}>
                            <div style={{ font: "500 9px 'JetBrains Mono', monospace", color: "#525B6B", letterSpacing: ".1em", marginBottom: 4 }}>{lbl}</div>
                            <div style={{ font: "700 12px Inter, sans-serif", color: "#E6E9EF" }}>{val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Missing fields */}
                  {Array.isArray(req.missingFields) && (req.missingFields as string[]).length > 0 && (
                    <div style={{ padding: 12, borderRadius: 10, border: "1px solid rgba(245,158,11,.3)", background: "rgba(245,158,11,.05)" }}>
                      <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#F59E0B", letterSpacing: ".1em", marginBottom: 6 }}>MISSING INFORMATION</div>
                      {(req.missingFields as string[]).map((m) => (
                        <div key={m} style={{ font: "500 12px Inter, sans-serif", color: "#AEB5C2" }}>• {m}</div>
                      ))}
                    </div>
                  )}

                  {/* Q&A answers */}
                  {reqAnswers.length > 0 && (
                    <div>
                      <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginBottom: 8 }}>ORGANIZER ANSWERS</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {reqAnswers.map((a, i) => (
                          <div key={i} style={{ border: "1px solid rgba(255,255,255,.06)", borderRadius: 10, overflow: "hidden" }}>
                            <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,.05)", font: "600 11px Inter, sans-serif", color: "#7D8799" }}>{a.question}</div>
                            <div style={{ padding: "8px 12px", font: "400 12px/1.5 Inter, sans-serif", color: "#E6E9EF" }}>{a.answer}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Requirements — AI Extraction (admin card style) */}
            <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", overflow: "hidden" }}>
              {/* Card header */}
              <div style={{ padding: "14px 22px", borderBottom: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em" }}>
                  {reqExtracted ? "AI EXTRACTION — REQUIREMENTS" : "EVENT FIELDS"}
                </div>
                {reqExtracted && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6, background: "rgba(200,240,0,.08)", border: "1px solid rgba(200,240,0,.18)", font: "600 8px 'JetBrains Mono', monospace", color: LIME, letterSpacing: ".1em" }}>
                    AUTO-PARSED
                  </div>
                )}
              </div>

              {!reqExtracted ? (
                /* No organizer request linked — render event's own fields in same style */
                <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                    <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#525B6B", letterSpacing: ".1em", marginBottom: 9 }}>CORE FIELDS</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "rgba(255,255,255,.05)", borderRadius: 12, overflow: "hidden" }}>
                      {([
                        ["Event type",      event ? capitalize(event.type) : "—"],
                        ["Expected guests", event?.expectedGuests != null ? String(event.expectedGuests) : "—"],
                        ["Setup start",     event?.setupStart ? new Date(event.setupStart).toLocaleString("en-GB", { timeZone: "Europe/Tirane", dateStyle: "medium", timeStyle: "short" }) : "—"],
                        ["Teardown end",    event?.teardownEnd ? new Date(event.teardownEnd).toLocaleString("en-GB", { timeZone: "Europe/Tirane", dateStyle: "medium", timeStyle: "short" }) : "—"],
                      ] as [string, string][]).map(([lbl, val]) => (
                        <div key={lbl} style={{ background: "#0F1218", padding: "12px 14px" }}>
                          <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#525B6B", letterSpacing: ".1em", marginBottom: 5 }}>{lbl}</div>
                          <div style={{ font: "700 14px Inter, sans-serif", color: "#E6E9EF" }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ padding: "12px 14px", borderRadius: 10, border: "1px dashed rgba(255,255,255,.07)", font: "400 12px Inter, sans-serif", color: "#444B5A" }}>
                    This event has no linked organizer request. AI extraction is available only for events created from an organizer request.
                  </div>
                </div>
              ) : (
                <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 20 }}>

                  {/* Core fields grid */}
                  <div>
                    <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#525B6B", letterSpacing: ".1em", marginBottom: 9 }}>CORE FIELDS</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "rgba(255,255,255,.05)", borderRadius: 12, overflow: "hidden" }}>
                      {([
                        ["Event type",      reqExtracted.eventType != null ? capitalize(String(reqExtracted.eventType)) : "—"],
                        ["Expected guests", reqExtracted.expectedGuests != null ? String(reqExtracted.expectedGuests) : "—"],
                        ["Setup hours",     reqExtracted.setupHours != null ? `${reqExtracted.setupHours}h` : "—"],
                        ["Teardown hours",  reqExtracted.teardownHours != null ? `${reqExtracted.teardownHours}h` : "—"],
                      ] as [string, string][]).map(([lbl, val]) => (
                        <div key={lbl} style={{ background: "#0F1218", padding: "12px 14px" }}>
                          <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#525B6B", letterSpacing: ".1em", marginBottom: 5 }}>{lbl}</div>
                          <div style={{ font: "700 14px Inter, sans-serif", color: "#E6E9EF" }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Confidence bar */}
                  {req?.confidence != null && (() => {
                    const pct = Math.round(req.confidence! * 100);
                    const barColor = pct >= 80 ? "#22C55E" : pct >= 60 ? LIME : "#F59E0B";
                    return (
                      <div>
                        <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#525B6B", letterSpacing: ".1em", marginBottom: 7 }}>EXTRACTION CONFIDENCE</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ flex: 1, height: 5, borderRadius: 99, background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: barColor }} />
                          </div>
                          <span style={{ font: "700 12px 'JetBrains Mono', monospace", color: barColor, minWidth: 36 }}>{pct}%</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Detected needs */}
                  {(() => {
                    const needs = flatNeeds(reqExtracted);
                    const NEED_LABELS: [keyof ExtractedNeeds, string][] = [
                      ["mainStage", "Main stage"], ["breakoutRooms", "Breakout rooms"], ["coffeeArea", "Coffee area"],
                      ["registrationDesk", "Registration desk"], ["publicGuestRegistration", "Public registration"],
                      ["screens", "Screens"], ["projectors", "Projectors"], ["wirelessMicrophones", "Wireless mics"],
                      ["wiredMicrophones", "Wired mics"], ["chairs", "Chairs"], ["tables", "Tables"],
                      ["speakers", "Speakers"], ["livestream", "Livestream"],
                    ];
                    return (
                      <div>
                        <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#525B6B", letterSpacing: ".1em", marginBottom: 9 }}>DETECTED NEEDS</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                          {NEED_LABELS.map(([key, lbl]) => {
                            const val = needs[key];
                            const active = val === true || (typeof val === "number" && val > 0);
                            return (
                              <div key={key} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 11px", borderRadius: 10, border: `1px solid ${active ? "rgba(200,240,0,.2)" : "rgba(255,255,255,.06)"}`, background: active ? "rgba(200,240,0,.06)" : "#0F1218" }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? LIME : "#333", flex: "none" }} />
                                <span style={{ font: "500 11px Inter, sans-serif", color: active ? "#fff" : "#555E6E" }}>
                                  {lbl}
                                  {typeof val === "number" && val > 0 && (
                                    <span style={{ font: "700 11px 'JetBrains Mono', monospace", color: LIME, marginLeft: 5 }}>×{val}</span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Missing fields */}
                  {Array.isArray(req?.missingFields) && (req!.missingFields as string[]).length > 0 && (
                    <div>
                      <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#F59E0B", letterSpacing: ".1em", marginBottom: 8 }}>
                        MISSING FIELDS · {(req!.missingFields as string[]).length}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                        {(req!.missingFields as string[]).map((m) => (
                          <span key={m} style={{ display: "inline-flex", alignItems: "center", padding: "4px 9px", borderRadius: 7, font: "700 9px 'JetBrains Mono', monospace", letterSpacing: ".06em", color: "#F59E0B", background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)", whiteSpace: "nowrap" }}>
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Clarifying questions */}
                  {Array.isArray(reqExtracted.clarifyingQuestions) && (reqExtracted.clarifyingQuestions as string[]).length > 0 && (
                    <div>
                      <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginBottom: 8 }}>SUGGESTED CLARIFICATIONS</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {(reqExtracted.clarifyingQuestions as string[]).map((q, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 12px", border: "1px solid rgba(255,255,255,.06)", borderRadius: 10, background: "#0F1218" }}>
                            <span style={{ font: "700 10px 'JetBrains Mono', monospace", color: "#525B6B", marginTop: 2, flex: "none" }}>{String(i + 1).padStart(2, "0")}</span>
                            <span style={{ font: "400 12px/1.5 Inter, sans-serif", color: "#AEB5C2" }}>{q}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}
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
    </>
  );
}

function ReqRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
      <span style={{ font: "500 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".08em", flex: "none" }}>{label.toUpperCase()}</span>
      <span style={{ font: "500 12px Inter, sans-serif", color: "#E6E9EF", textAlign: "right" }}>{children}</span>
    </div>
  );
}
