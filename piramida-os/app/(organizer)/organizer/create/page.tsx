"use client";

import Link from "next/link";
import { useState } from "react";
import { PyramidTwin } from "@/lib/PyramidTwin";
import { useViewport } from "@/lib/useViewport";
import { useTasksStore, type NewTaskCard } from "@/lib/manager/tasks-store";
import {
  ASSETS,
  type DayType,
  dayWeight,
  DEFAULT_PROMPT,
  EXAMPLE_PROMPTS,
  fmt,
  MAX_DURATION_DAYS,
  MIN_DURATION_DAYS,
  recRooms,
  ROOM_NAME,
  ROOM_PRICE,
  ROOM_REASON,
  ROOM_ROLE,
  SERVICES,
  STAFF_COST_PER_PERSON,
  suggestedStaff,
} from "@/lib/data";

type Stage = "prompt" | "result" | "sent";

type Extraction = {
  eventType: string;
  expectedGuests: number;
  needs: Record<string, number | boolean> & {
    mainStage: boolean;
    breakoutRooms: number;
    coffeeArea: boolean;
    registrationDesk: boolean;
    publicGuestRegistration: boolean;
    screens: number;
    projectors: number;
    wirelessMicrophones: number;
    wiredMicrophones: number;
    livestream: boolean;
  };
  missingFields: string[];
  confidence: number;
  clarifyingQuestions: string[];
};

type AiInfo = {
  model: string;
  confidence: number;
};

type QA = { question: string; answer: string };
type GapField = "attendees" | "schedule";
type Assets = Record<string, number>;
type EventDay = { date: string; type: DayType };

// The earliest / latest scheduled dates. Days may be non-contiguous, so the
// window is derived from whichever dates the organizer has filled in.
function scheduleWindow(days: EventDay[]): { start: string; end: string } {
  const filled = days.map((d) => d.date).filter(Boolean).sort();
  return { start: filled[0] ?? "", end: filled[filled.length - 1] ?? "" };
}

function prettyDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

// A clarifying question / missing field that maps to a form input should not be
// asked as free text — it becomes a highlighted gap on that field instead.
const FIELD_MATCHERS: { test: RegExp; field: GapField }[] = [
  { test: /\b(date|day|when|schedule|calendar|end time|duration|how long|length|days|hours)\b/i, field: "schedule" },
  { test: /\b(guest|attendee|people|headcount|capacity|how many|audience|pax)\b/i, field: "attendees" },
];

function matchField(text: string): GapField | null {
  return FIELD_MATCHERS.find((m) => m.test.test(text))?.field ?? null;
}

// Split the AI's clarifying questions + missing fields into (a) form gaps that
// map to an input and (b) genuinely open questions that need a written answer.
function classifyAsk(ex: Extraction): { gaps: GapField[]; questions: string[] } {
  const gaps = new Set<GapField>();
  const questions: string[] = [];
  const seen = new Set<string>();
  const push = (q: string) => {
    const key = q.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      questions.push(q);
    }
  };
  for (const q of ex.clarifyingQuestions ?? []) {
    const f = matchField(q);
    if (f) gaps.add(f);
    else push(q);
  }
  for (const field of ex.missingFields ?? []) {
    const f = matchField(field);
    if (f) gaps.add(f);
    else push(`Could you tell us more about: ${field}?`);
  }
  return { gaps: [...gaps], questions };
}

const GAP_LABEL: Record<GapField, string> = {
  attendees: "expected attendees",
  schedule: "event dates",
};

const sparkle = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#0D0D12">
    <path d="M12 3l1.8 4.8L18.6 9.6 13.8 11.4 12 16.2 10.2 11.4 5.4 9.6 10.2 7.8z" />
  </svg>
);

export default function CreateEventPage() {
  const { isMobile } = useViewport();
  const padX = isMobile ? 18 : 52;

  const [stage, setStage] = useState<Stage>("prompt");
  const [text, setText] = useState("");
  const [attendees, setAttendees] = useState(180);
  const [days, setDays] = useState<EventDay[]>([{ date: "", type: "full" }]);
  const [assets, setAssets] = useState<Assets>(() => Object.fromEntries(ASSETS.map((a) => [a.id, 0])));
  const [services, setServices] = useState<string[]>(["catering", "registration"]);
  const [staffEnabled, setStaffEnabled] = useState(false);
  const [staffCount, setStaffCount] = useState(2);
  const [allowExternalGuests, setAllowExternalGuests] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [eventType, setEventType] = useState("event");
  const [gaps, setGaps] = useState<Set<GapField>>(new Set());

  // Run-of-show tasks generated for the manager board on plan confirmation.
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksAdded, setTasksAdded] = useState<number | null>(null);

  function clearGap(field: GapField) {
    setGaps((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }
  function setAssetQty(id: string, qty: number) {
    const max = ASSETS.find((a) => a.id === id)?.max ?? 999;
    setAssets((prev) => ({ ...prev, [id]: Math.max(0, Math.min(max, qty)) }));
  }
  function setDayCount(n: number) {
    const target = Math.max(MIN_DURATION_DAYS, Math.min(MAX_DURATION_DAYS, n));
    setDays((prev) => {
      if (target === prev.length) return prev;
      if (target < prev.length) return prev.slice(0, target);
      const next = [...prev];
      while (next.length < target) next.push({ date: "", type: "full" });
      return next;
    });
  }
  function setDayDate(i: number, date: string) {
    clearGap("schedule");
    setDays((prev) => prev.map((d, idx) => (idx === i ? { ...d, date } : d)));
  }
  function setDayType(i: number, type: DayType) {
    clearGap("schedule");
    setDays((prev) => prev.map((d, idx) => (idx === i ? { ...d, type } : d)));
  }

  const weightSum = days.reduce((t, d) => t + dayWeight(d.type), 0);
  const mult = weightSum;
  const { start: startDate, end: endDate } = scheduleWindow(days);
  const rooms = recRooms(attendees);

  const roomLines = rooms.map((id) => ({
    label: ROOM_NAME[id],
    role: ROOM_ROLE[id],
    amount: "€" + fmt(ROOM_PRICE[id] * mult),
  }));
  const assetLines = ASSETS.filter((a) => (assets[a.id] ?? 0) > 0).map((a) => ({
    label: `${a.label} × ${assets[a.id]}`,
    amount: "€" + fmt(a.unit * assets[a.id]),
  }));
  const serviceLines = SERVICES.filter((s) => services.includes(s.id)).map((s) => ({
    label: s.label,
    amount: "€" + fmt(s.perHead ? s.perHead * attendees : s.price ?? 0),
  }));
  const staffCost = staffEnabled ? staffCount * STAFF_COST_PER_PERSON : 0;
  const staffLines = staffEnabled && staffCount > 0 ? [{ label: `Event staff × ${staffCount}`, amount: "€" + fmt(staffCost) }] : [];

  const roomCost = rooms.reduce((t, id) => t + ROOM_PRICE[id] * mult, 0);
  const assetCost = ASSETS.reduce((t, a) => t + a.unit * (assets[a.id] ?? 0), 0);
  const serviceCost = SERVICES.filter((s) => services.includes(s.id)).reduce(
    (t, s) => t + (s.perHead ? s.perHead * attendees : s.price ?? 0),
    0
  );
  const subtotal = roomCost + assetCost + serviceCost + staffCost;
  const svc = subtotal * 0.1;
  const total = subtotal + svc;

  const reasonBullets = rooms.map((id) => ({ room: ROOM_NAME[id], text: ROOM_REASON[id] }));
  const summaryRooms = rooms.map((id) => ROOM_NAME[id]).join(" · ");
  const convText = text || DEFAULT_PROMPT;

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [ai, setAi] = useState<AiInfo | null>(null);
  const [qa, setQa] = useState<QA[]>([]);

  function setAnswer(i: number, answer: string) {
    setQa((prev) => prev.map((row, idx) => (idx === i ? { ...row, answer } : row)));
  }

  // Apply Gemini's structured extraction to the live planner. The AI only
  // structures the free text — recommended rooms, asset suggestions and the
  // quote are computed deterministically below from this state. Everything it
  // pre-fills stays freely editable by the organizer.
  function applyExtraction(ex: Extraction) {
    if (ex.eventType) setEventType(ex.eventType);
    const guests = typeof ex.expectedGuests === "number" && ex.expectedGuests > 0 ? ex.expectedGuests : 0;
    if (guests > 0) setAttendees(Math.min(450, Math.max(20, guests)));

    const n = ex.needs ?? {};
    // Pre-fill asset quantities from the extracted needs.
    setAssets((prev) => {
      const next = { ...prev };
      for (const a of ASSETS) {
        const v = n[a.needKey];
        if (typeof v === "number" && v > 0) next[a.id] = Math.min(a.max, v);
      }
      return next;
    });

    const nextServices: string[] = [];
    if (n.coffeeArea) nextServices.push("catering");
    if (n.registrationDesk || n.publicGuestRegistration) nextServices.push("registration");
    if (nextServices.length) setServices(nextServices);

    // Suggest event staff (organizer can switch this off or change the count).
    if (guests > 0) {
      setStaffEnabled(true);
      setStaffCount(suggestedStaff(guests));
    }

    // Online registration implies external guests + a public event by default.
    if (n.publicGuestRegistration) {
      setAllowExternalGuests(true);
      setIsPublic(true);
    }
  }

  async function generatePlan() {
    const rawText = text || DEFAULT_PROMPT;
    setText(rawText);
    setPlanError(null);
    setPlanLoading(true);
    try {
      const res = await fetch("/api/organizer/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      if (res.status === 401) {
        window.location.assign("/login?next=/organizer/create");
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.extraction) {
        // The AI is an enhancement, not a gate — fall through to the planner.
        setPlanError(data?.error ?? "AI planning is unavailable right now — showing a standard plan.");
        setStage("result");
        return;
      }
      const ex = data.extraction as Extraction;
      applyExtraction(ex);
      setAi({
        model: data.model,
        confidence: typeof data.confidence === "number" ? data.confidence : ex.confidence,
      });
      const { gaps: gapFields, questions } = classifyAsk(ex);
      // A guess for guests already fills the slider, so don't nag for it.
      const realGaps = gapFields.filter((g) => !(g === "attendees" && ex.expectedGuests > 0));
      setGaps(new Set(realGaps));
      setQa(questions.map((question) => ({ question, answer: "" })));
      setStage("result");
    } catch {
      setPlanError("Network error — showing a standard plan.");
      setStage("result");
    } finally {
      setPlanLoading(false);
    }
  }

  async function sendRequest() {
    const rawText = text || DEFAULT_PROMPT;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const answered = qa
        .map((row) => ({ question: row.question, answer: row.answer.trim() }))
        .filter((row) => row.answer.length > 0);
      const assetSummary = ASSETS.filter((a) => (assets[a.id] ?? 0) > 0).map((a) => `${a.label}: ${assets[a.id]}`);
      const dayList = days.map((d, i) => ({ day: i + 1, date: d.date, type: d.type }));
      const res = await fetch("/api/organizer/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          channel: "portal",
          clarifications: answered,
          schedule: { startDate, endDate, days: days.map((d) => ({ date: d.date, type: d.type })) },
          configuration: {
            attendees,
            days: dayList,
            assets: assetSummary,
            staff: staffEnabled ? { count: staffCount, costPerPerson: STAFF_COST_PER_PERSON } : null,
            services: SERVICES.filter((s) => services.includes(s.id)).map((s) => s.label),
            access: { externalGuests: allowExternalGuests, visibility: isPublic ? "public" : "private" },
            estimatedTotal: Math.round(total),
          },
        }),
      });
      if (res.status === 401) {
        // Not signed in (no organizer session). Send them to login and return
        // here afterwards so the request can be submitted.
        window.location.assign("/login?next=/organizer/create");
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSubmitError(d.error ?? "Submission failed. Please try again.");
        return;
      }
      setStage("sent");
      // The AI is an enhancement, not a gate — generate run-of-show tasks in the
      // background so reaching the confirmation screen is never blocked on it.
      void generateRunOfShowTasks();
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Turn the organizer's CHOICES into run-of-show tasks (deterministic core +
  // Gemini enrichment, server-side) and push them onto the shared manager Tasks
  // board. Best-effort: any failure simply leaves the count unset.
  async function generateRunOfShowTasks() {
    setTasksLoading(true);
    setTasksAdded(null);
    try {
      const res = await fetch("/api/organizer/plan-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType,
          attendees,
          schedule: { startDate, endDate, days: days.map((d) => ({ date: d.date, type: d.type })) },
          assets,
          services,
          rooms,
          access: { externalGuests: allowExternalGuests, isPublic },
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data?.tasks) && data.tasks.length) {
        // Pull the latest persisted board first so we append (not overwrite) any
        // tasks the manager already has, then add ours to the "todo" column.
        await useTasksStore.persist.rehydrate();
        const added = useTasksStore.getState().addGeneratedTasks(data.tasks as NewTaskCard[]);
        setTasksAdded(added);
      } else {
        setTasksAdded(0);
      }
    } catch {
      setTasksAdded(0);
    } finally {
      setTasksLoading(false);
    }
  }

  const optionButton = (
    on: boolean,
    onClick: () => void,
    label: string,
    sub: string,
    key: string
  ) => (
    <button
      key={key}
      onClick={onClick}
      style={{
        textAlign: "left",
        cursor: "pointer",
        padding: "13px 14px",
        borderRadius: 12,
        border: `1px solid ${on ? "rgba(200,240,0,.4)" : "rgba(255,255,255,.09)"}`,
        background: on ? "rgba(200,240,0,.06)" : "#151821",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            flex: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: "700 11px Inter, sans-serif",
            color: "#0D0D12",
            background: on ? "#C8F000" : "transparent",
            border: `1px solid ${on ? "#C8F000" : "rgba(255,255,255,.2)"}`,
          }}
        >
          {on ? "✓" : ""}
        </span>
        <div>
          <div style={{ font: "600 13px Inter, sans-serif", color: "#fff" }}>{label}</div>
          <div style={{ font: "500 11px Inter, sans-serif", color: "#7D8799", marginTop: 2 }}>{sub}</div>
        </div>
      </div>
    </button>
  );

  return (
    <div>
      <style>{`
        @keyframes aiGlow { 0%,100% { opacity: .55; transform: scale(.94); } 50% { opacity: 1; transform: scale(1.06); } }
        @keyframes aiSweep { 0% { transform: translateX(-120%); } 100% { transform: translateX(320%); } }
        @keyframes aiBounce { 0%,80%,100% { transform: translateY(0); opacity: .4; } 40% { transform: translateY(-5px); opacity: 1; } }
        @keyframes gapPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,.5); border-color: rgba(245,158,11,.85); } 50% { box-shadow: 0 0 0 5px rgba(245,158,11,0); border-color: rgba(245,158,11,.45); } }
      `}</style>
      {stage === "prompt" && (
        <section
          style={{
            position: "relative",
            overflow: "hidden",
            paddingLeft: padX,
            paddingRight: padX,
            paddingTop: 40,
            paddingBottom: 54,
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(720px 440px at 50% 6%,rgba(200,240,0,.08),transparent 60%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
            <div style={{ font: "600 11px/1 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".2em", marginBottom: 14 }}>
              CREATE EVENT
            </div>
            <h1 style={{ font: "800 clamp(28px,4.4vw,48px)/1.04 Inter, sans-serif", letterSpacing: "-.03em", margin: "0 0 12px", color: "#fff", textWrap: "balance" }}>
              What do you want to host?
            </h1>
            <p style={{ font: "400 16px/1.55 Inter, sans-serif", color: "#AEB5C2", maxWidth: 480, margin: "0 auto", textWrap: "pretty" }}>
              Describe your event in plain words. The Pyramid will find your rooms.
            </p>
            <div style={{ maxWidth: 540, margin: "18px auto 0", animation: "floatY 8s ease-in-out infinite" }}>
              <PyramidTwin selected={rooms} labels showRoutes />
            </div>
          </div>
          <div style={{ position: "relative", maxWidth: 720, margin: "0 auto" }}>
            <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 18, background: "#151821", padding: 18, boxShadow: "0 18px 50px rgba(0,0,0,.4)" }}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. A startup conference for 180 people with a keynote, two breakout rooms and a networking area with coffee…"
                style={{
                  width: "100%",
                  minHeight: 120,
                  resize: "none",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: "#fff",
                  font: "400 16px/1.6 Inter, sans-serif",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {EXAMPLE_PROMPTS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => {
                        setText(p.text);
                        setAttendees(p.att);
                      }}
                      style={{
                        padding: "8px 13px",
                        borderRadius: 100,
                        border: "1px solid rgba(255,255,255,.12)",
                        background: "transparent",
                        color: "#AEB5C2",
                        font: "500 12px Inter, sans-serif",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={generatePlan}
                  disabled={planLoading}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "13px 22px",
                    borderRadius: 12,
                    background: planLoading ? "#2A3040" : "#C8F000",
                    color: planLoading ? "#7D8799" : "#0D0D12",
                    font: "700 14px Inter, sans-serif",
                    cursor: planLoading ? "default" : "pointer",
                    whiteSpace: "nowrap",
                    border: "none",
                  }}
                >
                  {planLoading ? null : sparkle}
                  {planLoading ? "Reading your request…" : "Generate plan"}
                </button>
              </div>
            </div>

            {planLoading && (
              <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderRadius: 16, border: "1px solid rgba(200,240,0,.22)", background: "rgba(200,240,0,.04)" }}>
                <span style={{ width: 36, height: 36, borderRadius: 11, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(200,240,0,.12)", animation: "aiGlow 1.4s ease-in-out infinite" }}>
                  {sparkle}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, font: "600 13px Inter, sans-serif", color: "#fff" }}>
                    Pyramid AI is reading your request
                    <span style={{ display: "inline-flex", gap: 4 }}>
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: "#C8F000",
                            animation: `aiBounce 1.1s ${i * 0.18}s ease-in-out infinite`,
                          }}
                        />
                      ))}
                    </span>
                  </div>
                  <div style={{ marginTop: 9, height: 4, borderRadius: 4, overflow: "hidden", background: "rgba(255,255,255,.06)" }}>
                    <div style={{ height: "100%", width: "35%", borderRadius: 4, background: "linear-gradient(90deg,transparent,#C8F000,transparent)", animation: "aiSweep 1.2s ease-in-out infinite" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {stage === "result" && (
        <>
          <section style={{ paddingLeft: padX, paddingRight: padX, paddingTop: 32, paddingBottom: 8, maxWidth: 980 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
              <div style={{ font: "600 11px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".16em" }}>
                CREATE EVENT · CONVERSATION
              </div>
              <button onClick={() => setStage("prompt")} style={{ font: "600 12px Inter, sans-serif", color: "#C8F000", background: "none", border: "none", cursor: "pointer" }}>
                ↺ Re-describe
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <div style={{ maxWidth: 560, padding: "14px 18px", borderRadius: "16px 16px 4px 16px", background: "#1D2230", border: "1px solid rgba(255,255,255,.08)", font: "400 15px/1.55 Inter, sans-serif", color: "#fff" }}>
                {convText}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, flex: "none", background: "rgba(200,240,0,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {sparkle}
              </div>
              <div style={{ maxWidth: 600, padding: "14px 18px", borderRadius: "4px 16px 16px 16px", background: "rgba(200,240,0,.05)", border: "1px solid rgba(200,240,0,.18)", font: "400 15px/1.55 Inter, sans-serif", color: "#AEB5C2" }}>
                Got it — I&apos;ve read your request and highlighted{" "}
                <b style={{ color: "#fff" }}>{rooms.length} recommended spaces</b> in the
                Pyramid and built a live quote. Adjust attendees, duration or services on
                the right and I&apos;ll re-plan instantly.

                {ai && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 7, background: "rgba(200,240,0,.1)", border: "1px solid rgba(200,240,0,.25)", font: "600 11px 'JetBrains Mono', monospace", color: "#C8F000" }}>
                      {Math.round(ai.confidence * 100)}% confidence
                    </span>
                    <span style={{ padding: "5px 10px", borderRadius: 7, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", font: "600 11px 'JetBrains Mono', monospace", color: "#7D8799" }}>
                      {ai.model.startsWith("gemini") ? "Gemini intake" : "Standard intake"}
                    </span>
                  </div>
                )}

                {qa.length > 0 && (
                  <div style={{ marginTop: 12, font: "400 14px/1.5 Inter, sans-serif", color: "#AEB5C2" }}>
                    I have a few quick questions below — your answers go straight to the venue team.
                  </div>
                )}

                {planError && (
                  <div style={{ marginTop: 10, font: "500 13px Inter, sans-serif", color: "#F59E0B" }}>{planError}</div>
                )}
              </div>
            </div>
          </section>

          <section
            style={{
              paddingLeft: padX,
              paddingRight: padX,
              paddingTop: 24,
              paddingBottom: 54,
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1.15fr 1fr",
              gap: 22,
              alignItems: "start",
            }}
          >
            <div style={{ position: "sticky", top: 20 }}>
              <div
                style={{
                  position: "relative",
                  border: "1px solid rgba(255,255,255,.08)",
                  borderRadius: 20,
                  background: "radial-gradient(680px 420px at 50% 35%,rgba(200,240,0,.06),#0B0E13)",
                  overflow: "hidden",
                  minHeight: "clamp(320px,40vw,460px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 22,
                }}
              >
                <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)", backgroundSize: "38px 38px" }} />
                <div style={{ position: "absolute", top: 16, left: 16, padding: "7px 12px", borderRadius: 8, background: "rgba(13,13,18,.6)", border: "1px solid rgba(255,255,255,.08)", font: "600 10px 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".1em" }}>
                  RECOMMENDED SPACES
                </div>
                <div style={{ position: "relative", width: "100%", maxWidth: 520 }}>
                  <PyramidTwin selected={rooms} labels showRoutes />
                </div>
              </div>
              <div style={{ marginTop: 16, border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, background: "#151821", padding: 18 }}>
                <div style={{ font: "600 11px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em", marginBottom: 12 }}>
                  WHY THESE ROOMS
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {reasonBullets.map((b) => (
                    <div key={b.room} style={{ display: "flex", gap: 10 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 2, background: "#C8F000", flex: "none", marginTop: 6 }} />
                      <div style={{ font: "400 13px/1.5 Inter, sans-serif", color: "#AEB5C2" }}>
                        <b style={{ color: "#fff" }}>{b.room}</b> — {b.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, background: "#151821", padding: 20 }}>
                <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".16em", marginBottom: 16 }}>
                  EVENT REQUIREMENTS · LIVE
                </div>
                {gaps.size > 0 && (
                  <div style={{ display: "flex", gap: 9, alignItems: "flex-start", marginBottom: 16, padding: "11px 13px", borderRadius: 11, border: "1px solid rgba(245,158,11,.3)", background: "rgba(245,158,11,.06)" }}>
                    <span style={{ font: "14px", flex: "none" }}>⚡</span>
                    <div style={{ font: "400 12.5px/1.5 Inter, sans-serif", color: "#F7C66B" }}>
                      A couple of details are missing — please complete the highlighted{" "}
                      {[...gaps].map((g) => GAP_LABEL[g]).join(" & ")} field{gaps.size > 1 ? "s" : ""} below.
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ font: "600 13px Inter, sans-serif", color: "#fff" }}>Attendees</span>
                  <span style={{ font: "700 15px 'JetBrains Mono', monospace", color: "#C8F000" }}>{attendees}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 20,
                    padding: gaps.has("attendees") ? "8px 10px" : 0,
                    borderRadius: 11,
                    border: gaps.has("attendees") ? "1px solid rgba(245,158,11,.7)" : "1px solid transparent",
                    animation: gaps.has("attendees") ? "gapPulse 1.6s ease-in-out infinite" : undefined,
                  }}
                >
                  <button onClick={() => { clearGap("attendees"); setAttendees((v) => Math.max(20, v - 10)); }} style={stepBtn}>−</button>
                  <input
                    type="range"
                    min={20}
                    max={450}
                    value={attendees}
                    onChange={(e) => { clearGap("attendees"); setAttendees(+e.target.value); }}
                    style={{ flex: 1 }}
                  />
                  <button onClick={() => { clearGap("attendees"); setAttendees((v) => Math.min(450, v + 10)); }} style={stepBtn}>+</button>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ font: "600 13px Inter, sans-serif", color: "#fff" }}>Schedule</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <button onClick={() => setDayCount(days.length - 1)} style={miniBtn} aria-label="Remove a day">−</button>
                    <span style={{ font: "700 13px 'JetBrains Mono', monospace", color: "#C8F000", minWidth: 54, textAlign: "center" }}>
                      {days.length} day{days.length > 1 ? "s" : ""}
                    </span>
                    <button onClick={() => setDayCount(days.length + 1)} style={miniBtn} aria-label="Add a day">+</button>
                  </div>
                </div>
                <p style={{ font: "400 12px/1.5 Inter, sans-serif", color: "#7D8799", margin: "0 0 10px" }}>
                  Set each day&apos;s date and whether it&apos;s a half or full day. Days don&apos;t need to be consecutive.
                </p>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginBottom: 12,
                    padding: gaps.has("schedule") ? "10px" : 0,
                    borderRadius: 12,
                    border: gaps.has("schedule") ? "1px solid rgba(245,158,11,.7)" : "1px solid transparent",
                    animation: gaps.has("schedule") ? "gapPulse 1.6s ease-in-out infinite" : undefined,
                  }}
                >
                  {days.map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", width: 38, flex: "none" }}>
                        DAY {i + 1}
                      </span>
                      <input
                        type="date"
                        value={d.date}
                        onChange={(e) => setDayDate(i, e.target.value)}
                        style={{ flex: 1, minWidth: 130, boxSizing: "border-box", padding: "9px 11px", borderRadius: 9, border: "1px solid rgba(255,255,255,.1)", background: "#0F1218", color: d.date ? "#fff" : "#7D8799", font: "600 12px Inter, sans-serif", colorScheme: "dark" }}
                      />
                      <div style={{ display: "flex", flex: "none", borderRadius: 9, overflow: "hidden", border: "1px solid rgba(255,255,255,.1)" }}>
                        {(["half", "full"] as DayType[]).map((t) => {
                          const on = d.type === t;
                          return (
                            <button
                              key={t}
                              onClick={() => setDayType(i, t)}
                              style={{
                                padding: "9px 11px",
                                border: "none",
                                cursor: "pointer",
                                background: on ? "#C8F000" : "transparent",
                                color: on ? "#0D0D12" : "#AEB5C2",
                                font: "600 11px Inter, sans-serif",
                              }}
                            >
                              {t === "half" ? "½ day" : "Full"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    marginBottom: 20,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px dashed rgba(200,240,0,.3)",
                    background: "rgba(200,240,0,.04)",
                    color: startDate ? "#fff" : "#7D8799",
                    font: "600 12.5px Inter, sans-serif",
                  }}
                >
                  {startDate
                    ? days.length > 1
                      ? `Event window · ${prettyDate(startDate)} → ${prettyDate(endDate)}`
                      : `Event date · ${prettyDate(startDate)}`
                    : "Pick at least one date above"}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ font: "600 13px Inter, sans-serif", color: "#fff" }}>Assets</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 100, background: "rgba(200,240,0,.1)", border: "1px solid rgba(200,240,0,.25)", font: "600 9px 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".06em" }}>
                    AI SUGGESTED
                  </span>
                </div>
                <p style={{ font: "400 12px/1.5 Inter, sans-serif", color: "#7D8799", margin: "0 0 12px" }}>
                  Pre-filled from your request — adjust any quantity if it&apos;s not quite right.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                  {ASSETS.map((a) => {
                    const qty = assets[a.id] ?? 0;
                    return (
                      <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 11, border: `1px solid ${qty > 0 ? "rgba(200,240,0,.25)" : "rgba(255,255,255,.08)"}`, background: qty > 0 ? "rgba(200,240,0,.04)" : "#0F1218" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ font: "600 13px Inter, sans-serif", color: "#fff" }}>{a.label}</div>
                          <div style={{ font: "500 11px Inter, sans-serif", color: "#7D8799", marginTop: 2 }}>{a.sub} · €{fmt(a.unit)}/ea</div>
                        </div>
                        <button onClick={() => setAssetQty(a.id, qty - 1)} style={miniBtn}>−</button>
                        <span style={{ minWidth: 30, textAlign: "center", font: "700 14px 'JetBrains Mono', monospace", color: qty > 0 ? "#C8F000" : "#7D8799" }}>{qty}</span>
                        <button onClick={() => setAssetQty(a.id, qty + 1)} style={miniBtn}>+</button>
                      </div>
                    );
                  })}
                </div>

                <div style={{ font: "600 13px Inter, sans-serif", color: "#fff", marginBottom: 10 }}>Services</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
                  {SERVICES.map((s) =>
                    optionButton(services.includes(s.id), () => toggle(services, setServices, s.id), s.label, s.sub, s.id)
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ font: "600 13px Inter, sans-serif", color: "#fff" }}>Event staff</span>
                  <button
                    onClick={() => setStaffEnabled((v) => !v)}
                    role="switch"
                    aria-checked={staffEnabled}
                    style={{ width: 42, height: 24, borderRadius: 12, border: "none", cursor: "pointer", position: "relative", background: staffEnabled ? "#C8F000" : "#2A3040", transition: "background .2s", flex: "none" }}
                  >
                    <span style={{ position: "absolute", top: 3, left: staffEnabled ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: staffEnabled ? "#0D0D12" : "#7D8799", transition: "left .2s" }} />
                  </button>
                </div>
                <p style={{ font: "400 12px/1.5 Inter, sans-serif", color: "#7D8799", margin: "0 0 12px" }}>
                  Guest-facing hosts &amp; ushers at €{fmt(STAFF_COST_PER_PERSON)}/person. Venue setup &amp; teardown crew is included separately and not billed here.
                </p>
                {staffEnabled && (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                    <button onClick={() => setStaffCount((v) => Math.max(1, v - 1))} style={stepBtn}>−</button>
                    <div style={{ flex: 1, textAlign: "center", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.1)", background: "#0F1218", font: "700 15px 'JetBrains Mono', monospace", color: "#fff" }}>
                      {staffCount} <span style={{ font: "500 12px Inter, sans-serif", color: "#7D8799" }}>staff</span>
                    </div>
                    <button onClick={() => setStaffCount((v) => Math.min(200, v + 1))} style={stepBtn}>+</button>
                  </div>
                )}

                <div style={{ height: 1, background: "rgba(255,255,255,.06)", margin: "20px 0" }} />

                <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".16em", marginBottom: 14 }}>
                  EVENT ACCESS
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                  <span style={{ font: "600 13px Inter, sans-serif", color: "#fff" }}>Allow external guests</span>
                  <button
                    onClick={() => setAllowExternalGuests((v) => !v)}
                    role="switch"
                    aria-checked={allowExternalGuests}
                    style={{ width: 42, height: 24, borderRadius: 12, border: "none", cursor: "pointer", position: "relative", background: allowExternalGuests ? "#C8F000" : "#2A3040", transition: "background .2s", flex: "none" }}
                  >
                    <span style={{ position: "absolute", top: 3, left: allowExternalGuests ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: allowExternalGuests ? "#0D0D12" : "#7D8799", transition: "left .2s" }} />
                  </button>
                </div>
                <p style={{ font: "400 12px/1.5 Inter, sans-serif", color: "#7D8799", margin: "0 0 18px" }}>
                  {allowExternalGuests
                    ? "Guests outside your organization can be invited — online registration & web check-in can be opened for this event."
                    : "Invite-only — attendance is limited to your own contacts."}
                </p>

                <div style={{ font: "600 13px Inter, sans-serif", color: "#fff", marginBottom: 10 }}>Visibility</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {([
                    { id: false, label: "Private", sub: "Hidden — not listed publicly" },
                    { id: true, label: "Public", sub: "Listed on the public events page" },
                  ] as const).map((opt) => {
                    const on = isPublic === opt.id;
                    return (
                      <button
                        key={opt.label}
                        onClick={() => setIsPublic(opt.id)}
                        style={{
                          textAlign: "left",
                          cursor: "pointer",
                          padding: "12px 14px",
                          borderRadius: 12,
                          border: `1px solid ${on ? "rgba(200,240,0,.4)" : "rgba(255,255,255,.09)"}`,
                          background: on ? "rgba(200,240,0,.06)" : "#0F1218",
                        }}
                      >
                        <div style={{ font: "600 13px Inter, sans-serif", color: on ? "#C8F000" : "#fff" }}>{opt.label}</div>
                        <div style={{ font: "500 11px/1.4 Inter, sans-serif", color: "#7D8799", marginTop: 3 }}>{opt.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {qa.length > 0 && (
                <div style={{ border: "1px solid rgba(200,240,0,.22)", borderRadius: 18, background: "linear-gradient(180deg,rgba(200,240,0,.04),#151821)", padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 7, flex: "none", background: "rgba(200,240,0,.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {sparkle}
                    </span>
                    <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".16em" }}>
                      A FEW QUESTIONS
                    </div>
                  </div>
                  <p style={{ font: "400 12px/1.5 Inter, sans-serif", color: "#7D8799", margin: "0 0 14px" }}>
                    Answering helps the venue team plan accurately. Your answers are saved with the request.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {qa.map((row, i) => (
                      <div key={i}>
                        <label style={{ display: "block", font: "600 13px Inter, sans-serif", color: "#fff", marginBottom: 8 }}>
                          {row.question}
                        </label>
                        <textarea
                          value={row.answer}
                          onChange={(e) => setAnswer(i, e.target.value)}
                          placeholder="Type your answer…"
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            minHeight: 62,
                            resize: "vertical",
                            padding: "11px 13px",
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,.1)",
                            background: "#0F1218",
                            color: "#fff",
                            font: "400 13px/1.5 Inter, sans-serif",
                            outline: "none",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ border: "1px solid rgba(200,240,0,.22)", borderRadius: 18, background: "linear-gradient(180deg,rgba(200,240,0,.05),#151821)", padding: 20 }}>
                <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".16em", marginBottom: 14 }}>
                  LIVE QUOTE
                </div>
                {roomLines.map((l) => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                    <span style={{ flex: 1, font: "600 13px Inter, sans-serif", color: "#fff" }}>{l.label}</span>
                    <span style={{ font: "500 11px Inter, sans-serif", color: "#7D8799" }}>{l.role}</span>
                    <span style={{ font: "600 13px 'JetBrains Mono', monospace", color: "#fff", width: 72, textAlign: "right" }}>{l.amount}</span>
                  </div>
                ))}
                {[...assetLines, ...serviceLines, ...staffLines].map((l) => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                    <span style={{ flex: 1, font: "600 13px Inter, sans-serif", color: "#AEB5C2" }}>{l.label}</span>
                    <span style={{ font: "600 13px 'JetBrains Mono', monospace", color: "#fff", width: 72, textAlign: "right" }}>{l.amount}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", font: "500 13px Inter, sans-serif", color: "#7D8799" }}>
                  <span>Subtotal</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>€{fmt(subtotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "0 0 12px", font: "500 13px Inter, sans-serif", color: "#7D8799", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                  <span>Service (10%)</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>€{fmt(svc)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0 0", font: "800 24px Inter, sans-serif", color: "#fff", letterSpacing: "-.02em" }}>
                  <span>Total</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#C8F000" }}>€{fmt(total)}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {submitError && (
                  <div style={{ width: "100%", font: "500 12px Inter, sans-serif", color: "#EF4444", marginBottom: 4 }}>
                    {submitError}
                  </div>
                )}
                <button
                  onClick={sendRequest}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    minWidth: 180,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: 15,
                    border: "none",
                    borderRadius: 12,
                    background: submitting ? "#2A3040" : "#C8F000",
                    color: submitting ? "#7D8799" : "#0D0D12",
                    font: "700 14px Inter, sans-serif",
                    cursor: submitting ? "default" : "pointer",
                    boxShadow: submitting ? "none" : "0 8px 26px rgba(200,240,0,.2)",
                  }}
                >
                  {submitting ? "Submitting…" : "Approve & send for approval"}
                </button>
                <button
                  onClick={() => setStage("prompt")}
                  style={{ padding: "15px 20px", border: "1px solid rgba(255,255,255,.14)", borderRadius: 12, background: "transparent", color: "#fff", font: "600 14px Inter, sans-serif", cursor: "pointer" }}
                >
                  Request changes
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {stage === "sent" && (
        <section
          style={{
            position: "relative",
            overflow: "hidden",
            paddingLeft: padX,
            paddingRight: padX,
            paddingTop: 70,
            paddingBottom: 70,
            textAlign: "center",
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(640px 420px at 50% 20%,rgba(34,197,94,.12),transparent 60%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", maxWidth: 560, margin: "0 auto" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", font: "700 32px Inter, sans-serif", color: "#0D0D12", boxShadow: "0 0 0 8px rgba(34,197,94,.14)" }}>
              ✓
            </div>
            <h1 style={{ font: "800 clamp(28px,4.6vw,48px)/1.05 Inter, sans-serif", letterSpacing: "-.03em", margin: "0 0 14px", color: "#fff", textWrap: "balance" }}>
              Request sent for manager approval
            </h1>
            <p style={{ font: "400 16px/1.55 Inter, sans-serif", color: "#AEB5C2", margin: "0 auto 24px", maxWidth: 440, textWrap: "pretty" }}>
              Your plan has been submitted. The venue team will review your spaces and
              quote, and you&apos;ll be notified once it&apos;s confirmed.
            </p>
            <div style={{ display: "inline-flex", flexDirection: "column", gap: 10, border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, background: "#151821", padding: "18px 22px", textAlign: "left", marginBottom: 28, minWidth: 300 }}>
              <div style={summaryRow}><span>Spaces</span><span style={{ color: "#fff" }}>{summaryRooms}</span></div>
              <div style={summaryRow}><span>Attendees</span><span style={{ color: "#fff" }}>{attendees}</span></div>
              {startDate && (
                <div style={summaryRow}><span>Dates</span><span style={{ color: "#fff" }}>{prettyDate(startDate)} → {prettyDate(endDate)}</span></div>
              )}
              <div style={summaryRow}><span>Estimated total</span><span style={{ color: "#C8F000", fontFamily: "'JetBrains Mono', monospace" }}>€{fmt(total)}</span></div>
            </div>

            {(tasksLoading || tasksAdded !== null) && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  maxWidth: 360,
                  margin: "0 auto 28px",
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: `1px solid ${tasksAdded && tasksAdded > 0 ? "rgba(200,240,0,.3)" : "rgba(255,255,255,.1)"}`,
                  background: tasksAdded && tasksAdded > 0 ? "rgba(200,240,0,.05)" : "#151821",
                  font: "600 13px Inter, sans-serif",
                  color: "#AEB5C2",
                  textAlign: "left",
                }}
              >
                {tasksLoading ? (
                  <>
                    <span style={{ width: 22, height: 22, borderRadius: 7, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(200,240,0,.12)", animation: "aiGlow 1.4s ease-in-out infinite" }}>
                      {sparkle}
                    </span>
                    Pyramid AI is preparing your run-of-show tasks…
                  </>
                ) : tasksAdded && tasksAdded > 0 ? (
                  <>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: "#22C55E", color: "#0D0D12", font: "700 12px Inter, sans-serif" }}>
                      ✓
                    </span>
                    <span style={{ color: "#fff" }}>{tasksAdded} task{tasksAdded > 1 ? "s" : ""} added to the operations board</span>
                  </>
                ) : (
                  <span>The venue team will prepare your operational tasks.</span>
                )}
              </div>
            )}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/organizer/requests" style={{ padding: "14px 24px", borderRadius: 12, background: "#C8F000", color: "#0D0D12", font: "700 14px Inter, sans-serif", textDecoration: "none" }}>
                View in Requests
              </Link>
              <Link href="/organizer" style={{ padding: "14px 24px", border: "1px solid rgba(255,255,255,.14)", borderRadius: 12, background: "transparent", color: "#fff", font: "600 14px Inter, sans-serif", textDecoration: "none" }}>
                Back to Dashboard
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

const stepBtn: React.CSSProperties = {
  width: 34,
  height: 34,
  flex: "none",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,.12)",
  background: "#1D2230",
  color: "#fff",
  font: "600 18px Inter, sans-serif",
  cursor: "pointer",
  lineHeight: 1,
};

const miniBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  flex: "none",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,.12)",
  background: "#1D2230",
  color: "#fff",
  font: "600 15px Inter, sans-serif",
  cursor: "pointer",
  lineHeight: 1,
};

const summaryRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 24,
  font: "500 13px Inter, sans-serif",
  color: "#7D8799",
};
