"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDraftEventFromReviewedRequest } from "./actions";
import type { EventIntake, IntakeNeedKey } from "@/lib/ai/event-intake-contract";

type NeedField = {
  key: IntakeNeedKey;
  label: string;
  kind: "boolean" | "number";
  category: string;
  defaultValue: boolean | number;
};

type EventTypeOption = {
  id: string;
  label: string;
};

type RequestSummary = {
  id: string;
  title: string;
  rawText: string;
  organizer: string;
  company: string;
  submitted: string;
  canCreateDraft: boolean;
  existingEventId?: string;
};

const PANEL = {
  shell: { border: "1px solid rgba(255,255,255,.07)", borderRadius: 8, background: "#151821" },
  input: {
    width: "100%",
    boxSizing: "border-box" as const,
    border: "1px solid rgba(255,255,255,.1)",
    borderRadius: 6,
    background: "#0F1218",
    color: "#fff",
    font: "500 13px/1.45 Inter, sans-serif",
    padding: "10px 11px",
    outline: "none",
  },
  label: { font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".08em", marginBottom: 6 },
};

export function EventIntakePanel({
  request,
  initialIntake,
  eventTypes,
  needFields,
}: {
  request: RequestSummary;
  initialIntake: EventIntake | null;
  eventTypes: EventTypeOption[];
  needFields: NeedField[];
}) {
  const router = useRouter();
  const [rawText, setRawText] = useState(request.rawText);
  const [intake, setIntake] = useState<EventIntake | null>(initialIntake);
  const [model, setModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, startParsing] = useTransition();
  const [isCreating, startCreating] = useTransition();

  const fieldsByCategory = useMemo(() => {
    const groups = new Map<string, NeedField[]>();
    for (const field of needFields) {
      groups.set(field.category, [...(groups.get(field.category) ?? []), field]);
    }
    return Array.from(groups.entries());
  }, [needFields]);

  function parseRequest() {
    setError(null);
    startParsing(async () => {
      const res = await fetch("/api/ai/parse-event-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.canCreateDraft ? { requestId: request.id, rawText } : { rawText }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not parse request");
        return;
      }
      setIntake(json.intake);
      setModel(json.model ?? null);
    });
  }

  function createDraft() {
    if (!intake || !request.canCreateDraft) return;
    setError(null);
    startCreating(async () => {
      try {
        const result = await createDraftEventFromReviewedRequest(request.id, intake);
        router.push(`/manager/events/${result.eventId}/understand`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create draft event");
      }
    });
  }

  function updateIntake(patch: Partial<EventIntake>) {
    setIntake((current) => (current ? { ...current, ...patch } : current));
  }

  function updateNeed(key: IntakeNeedKey, value: boolean | number) {
    setIntake((current) =>
      current
        ? {
            ...current,
            needs: { ...current.needs, [key]: value },
          }
        : current,
    );
  }

  function confidenceFor(key: string) {
    if (!intake) return "—";
    const value = intake.fieldConfidence[key] ?? intake.confidence;
    return `${Math.round(value * 100)}%`;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,360px),1fr))", gap: 18, alignItems: "start" }}>
      <section style={{ ...PANEL.shell, overflow: "hidden" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#C53A6B,#1D2230)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 12px Inter, sans-serif", color: "#fff", flex: "none" }}>
            {request.organizer.split(" ").map((part) => part[0]).join("").slice(0, 2)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "600 13px Inter, sans-serif", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{request.organizer} · {request.company}</div>
            <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 2 }}>{request.submitted}</div>
          </div>
          <span style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#0D0D12", background: "#C8F000", padding: "5px 9px", borderRadius: 6 }}>RAW</span>
        </div>
        <div style={{ padding: 20 }}>
          <div style={PANEL.label}>ORGANIZER REQUEST</div>
          <textarea
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            rows={14}
            style={{ ...PANEL.input, resize: "vertical", minHeight: 260 }}
          />
          <button
            type="button"
            onClick={parseRequest}
            disabled={isParsing || rawText.trim().length === 0}
            style={{ width: "100%", marginTop: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, padding: 14, border: "none", borderRadius: 7, background: "#C8F000", color: "#0D0D12", font: "700 13px Inter, sans-serif", cursor: isParsing ? "wait" : "pointer" }}
          >
            {isParsing ? "Parsing..." : "Parse Request"}
          </button>
          {model && <div style={{ marginTop: 10, color: "#7D8799", font: "500 11px 'JetBrains Mono', monospace" }}>MODEL {model}</div>}
          {error && <div style={{ marginTop: 12, color: "#FCA5A5", font: "600 12px/1.5 Inter, sans-serif" }}>{error}</div>}
        </div>
      </section>

      <section style={{ ...PANEL.shell, borderColor: "rgba(200,240,0,.22)", overflow: "hidden" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(200,240,0,.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#C8F000", font: "800 16px Inter, sans-serif" }}>AI</div>
          <div style={{ flex: 1 }}>
            <div style={{ font: "700 13px Inter, sans-serif", color: "#fff" }}>Structured Understanding</div>
            <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 2 }}>STAFF REVIEW REQUIRED</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ font: "800 20px/1 Inter, sans-serif", color: "#C8F000" }}>{intake ? `${Math.round(intake.confidence * 100)}%` : "—"}</div>
            <div style={{ font: "600 8px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>CONF</div>
          </div>
        </div>

        {!intake ? (
          <div style={{ padding: 28, color: "#AEB5C2", font: "500 13px/1.6 Inter, sans-serif" }}>
            Paste or edit the organizer request, then parse it to review extracted fields before a draft event is created.
          </div>
        ) : (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
              <FieldShell label="EVENT TYPE" confidence={confidenceFor("eventType")}>
                <select value={intake.eventType} onChange={(event) => updateIntake({ eventType: event.target.value })} style={PANEL.input}>
                  {eventTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
                </select>
              </FieldShell>
              <FieldShell label="EXPECTED GUESTS" confidence={confidenceFor("expectedGuests")}>
                <input type="number" min={0} value={intake.expectedGuests} onChange={(event) => updateIntake({ expectedGuests: Number(event.target.value) })} style={PANEL.input} />
              </FieldShell>
              <FieldShell label="DATE PREFERENCE" confidence={confidenceFor("datePreference")}>
                <input value={intake.datePreference ?? ""} onChange={(event) => updateIntake({ datePreference: event.target.value })} style={PANEL.input} />
              </FieldShell>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <FieldShell label="SETUP HRS" confidence={confidenceFor("setupHours")}>
                  <input type="number" min={0} step={0.5} value={intake.setupHours ?? 0} onChange={(event) => updateIntake({ setupHours: Number(event.target.value) })} style={PANEL.input} />
                </FieldShell>
                <FieldShell label="TEARDOWN HRS" confidence={confidenceFor("teardownHours")}>
                  <input type="number" min={0} step={0.5} value={intake.teardownHours ?? 0} onChange={(event) => updateIntake({ teardownHours: Number(event.target.value) })} style={PANEL.input} />
                </FieldShell>
              </div>
            </div>

            {intake.missingFields.length > 0 && (
              <div style={{ padding: 13, border: "1px solid rgba(245,158,11,.32)", borderRadius: 7, background: "rgba(245,158,11,.05)" }}>
                <div style={{ ...PANEL.label, color: "#F59E0B" }}>MISSING FIELDS</div>
                <textarea
                  value={intake.missingFields.join("\n")}
                  onChange={(event) => updateIntake({ missingFields: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })}
                  rows={Math.max(2, intake.missingFields.length)}
                  style={{ ...PANEL.input, borderColor: "rgba(245,158,11,.25)" }}
                />
              </div>
            )}

            {intake.suggestedNeeds.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={PANEL.label}>IMPLIED NEEDS TO CONFIRM</div>
                {intake.suggestedNeeds.map((suggestion) => (
                  <div key={`${suggestion.key}-${String(suggestion.value)}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, border: "1px solid rgba(42,111,219,.28)", borderRadius: 7, background: "rgba(42,111,219,.07)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: "700 12px Inter, sans-serif", color: "#fff" }}>{labelForNeed(needFields, suggestion.key)} · {String(suggestion.value)}</div>
                      <div style={{ font: "500 11px/1.5 Inter, sans-serif", color: "#AEB5C2", marginTop: 2 }}>{suggestion.reason}</div>
                    </div>
                    <button type="button" onClick={() => updateNeed(suggestion.key, suggestion.value)} style={{ border: "1px solid rgba(200,240,0,.3)", borderRadius: 6, background: "rgba(200,240,0,.1)", color: "#C8F000", font: "700 11px Inter, sans-serif", padding: "8px 10px", cursor: "pointer" }}>Apply</button>
                  </div>
                ))}
              </div>
            )}

            {fieldsByCategory.map(([category, fields]) => (
              <div key={category}>
                <div style={PANEL.label}>{category.toUpperCase()}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 9 }}>
                  {fields.map((field) => (
                    <FieldShell key={field.key} label={field.label} confidence={confidenceFor(`needs.${field.key}`)}>
                      {field.kind === "boolean" ? (
                        <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 11px", border: "1px solid rgba(255,255,255,.1)", borderRadius: 6, background: "#0F1218", color: "#fff", font: "600 13px Inter, sans-serif" }}>
                          <input type="checkbox" checked={Boolean(intake.needs[field.key])} onChange={(event) => updateNeed(field.key, event.target.checked)} />
                          {Boolean(intake.needs[field.key]) ? "Needed" : "Not needed"}
                        </label>
                      ) : (
                        <input type="number" min={0} value={Number(intake.needs[field.key] ?? 0)} onChange={(event) => updateNeed(field.key, Number(event.target.value))} style={PANEL.input} />
                      )}
                    </FieldShell>
                  ))}
                </div>
              </div>
            ))}

            <FieldShell label="CLARIFYING QUESTIONS" confidence={intake.thinkingLevel === "high" ? "HIGH" : "LITE"}>
              <textarea
                value={intake.clarifyingQuestions.join("\n")}
                onChange={(event) => updateIntake({ clarifyingQuestions: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })}
                rows={Math.max(2, intake.clarifyingQuestions.length)}
                style={{ ...PANEL.input, resize: "vertical" }}
              />
            </FieldShell>

            <button
              type="button"
              onClick={createDraft}
              disabled={isCreating || !request.canCreateDraft || Boolean(request.existingEventId)}
              style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 15, border: "none", borderRadius: 7, background: request.canCreateDraft && !request.existingEventId ? "#C8F000" : "#39414F", color: request.canCreateDraft && !request.existingEventId ? "#0D0D12" : "#AEB5C2", font: "800 14px Inter, sans-serif", cursor: isCreating ? "wait" : "pointer" }}
            >
              {request.existingEventId ? "Draft Event Already Exists" : isCreating ? "Creating Draft..." : "Create Draft Event"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function FieldShell({ label, confidence, children }: { label: string; confidence: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 11, border: "1px solid rgba(255,255,255,.07)", borderRadius: 7, background: "#0F1218" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
        <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".08em" }}>{label}</div>
        <div style={{ font: "700 9px 'JetBrains Mono', monospace", color: confidence === "HIGH" ? "#F59E0B" : "#C8F000" }}>{confidence}</div>
      </div>
      {children}
    </div>
  );
}

function labelForNeed(fields: NeedField[], key: IntakeNeedKey) {
  return fields.find((field) => field.key === key)?.label ?? key;
}
