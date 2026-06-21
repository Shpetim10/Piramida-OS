"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { AdminScreen, useAdminViewport } from "@/components/admin/AdminScreen";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClarificationAnswer { question: string; answer: string }
interface ScheduleDay { date: string; type: "full" | "half" }
interface ClarificationSchedule {
  startDate?: string;
  endDate?: string;
  days?: ScheduleDay[];
}
interface ClarificationConfig {
  attendees?: number;
  assets?: string[];
  staff?: { count?: number; costPerPerson?: number };
  services?: string[];
  access?: { externalGuests?: boolean; visibility?: string };
  estimatedTotal?: number;
}
interface Clarifications {
  answers?: ClarificationAnswer[];
  schedule?: ClarificationSchedule | null;
  configuration?: ClarificationConfig | null;
}

interface ExtractedNeeds {
  mainStage?: boolean;
  breakoutRooms?: number;
  coffeeArea?: boolean;
  registrationDesk?: boolean;
  publicGuestRegistration?: boolean;
  screens?: number;
  projectors?: number;
  wirelessMicrophones?: number;
  wiredMicrophones?: number;
  chairs?: number;
  tables?: number;
  speakers?: number;
  livestream?: boolean;
}
interface ExtractedJson {
  eventType?: string;
  expectedGuests?: number;
  datePreference?: string;
  setupHours?: number;
  teardownHours?: number;
  needs?: ExtractedNeeds;
  missingFields?: string[];
  confidence?: number;
  clarifyingQuestions?: string[];
  // legacy flat layout support
  mainStage?: boolean;
  breakoutRooms?: number;
  coffeeArea?: boolean;
  registrationDesk?: boolean;
  publicGuestRegistration?: boolean;
  screens?: number;
  projectors?: number;
  wirelessMicrophones?: number;
  wiredMicrophones?: number;
  chairs?: number;
  tables?: number;
  speakers?: number;
  livestream?: boolean;
}

interface EventRequestRow {
  id: string;
  title: string | null;
  rawText: string;
  status: string;
  approvalStatus: string;
  channel: string | null;
  confidence: number | null;
  createdAt: string;
  reviewedAt: string | null;
  clarifications: Clarifications | null;
  extractedJson: ExtractedJson | null;
  missingFields: string[] | null;
  client: { name: string } | null;
  contact: { firstName: string; lastName: string; email: string } | null;
  event: { id: string; status: string } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LIME = "#C8F000";

const APPROVAL_COLOR: Record<string, string> = {
  PENDING_APPROVAL: "#F59E0B",
  APPROVED: "#22C55E",
  REJECTED: "#EF4444",
};
const STATUS_COLOR: Record<string, string> = {
  RECEIVED: "#7D8799",
  PARSED: "#2A6FDB",
  REVIEWED: "#22C55E",
  PLANNING: LIME,
  PROPOSED: "#7A4BD6",
  APPROVED: "#22C55E",
  REJECTED: "#EF4444",
  CANCELLED: "#EF4444",
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtMoney(n: number) {
  return "€" + Math.round(n).toLocaleString("en-US");
}
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
function flatNeeds(ex: ExtractedJson): ExtractedNeeds {
  return ex.needs ?? {
    mainStage: ex.mainStage,
    breakoutRooms: ex.breakoutRooms,
    coffeeArea: ex.coffeeArea,
    registrationDesk: ex.registrationDesk,
    publicGuestRegistration: ex.publicGuestRegistration,
    screens: ex.screens,
    projectors: ex.projectors,
    wirelessMicrophones: ex.wirelessMicrophones,
    wiredMicrophones: ex.wiredMicrophones,
    chairs: ex.chairs,
    tables: ex.tables,
    speakers: ex.speakers,
    livestream: ex.livestream,
  };
}

// ─── Primitive UI pieces ──────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#525B6B", letterSpacing: ".18em", marginBottom: 10 }}>
      {children}
    </div>
  );
}

function Pill({
  children,
  color = "#7D8799",
  bg,
  border,
}: {
  children: React.ReactNode;
  color?: string;
  bg?: string;
  border?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 9px",
        borderRadius: 7,
        font: "700 9px 'JetBrains Mono', monospace",
        letterSpacing: ".06em",
        color,
        background: bg ?? "rgba(255,255,255,.05)",
        border: `1px solid ${border ?? "rgba(255,255,255,.09)"}`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
      <span style={{ font: "500 11px 'JetBrains Mono', monospace", color: "#525B6B", minWidth: 130, flex: "none" }}>{label}</span>
      <span style={{ font: "500 13px Inter, sans-serif", color: "#E6E9EF" }}>{value}</span>
    </div>
  );
}

function NeedChip({ label, value }: { label: string; value: boolean | number | undefined }) {
  const active = value === true || (typeof value === "number" && value > 0);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "7px 11px",
        borderRadius: 10,
        border: `1px solid ${active ? "rgba(200,240,0,.2)" : "rgba(255,255,255,.06)"}`,
        background: active ? "rgba(200,240,0,.06)" : "#0F1218",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? LIME : "#333", flex: "none" }} />
      <span style={{ font: "500 11px Inter, sans-serif", color: active ? "#fff" : "#555E6E" }}>
        {label}
        {typeof value === "number" && value > 0 ? (
          <span style={{ font: "700 11px 'JetBrains Mono', monospace", color: LIME, marginLeft: 5 }}>×{value}</span>
        ) : null}
      </span>
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "#22C55E" : pct >= 60 ? LIME : "#F59E0B";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 99, background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: color, transition: "width .5s ease" }} />
      </div>
      <span style={{ font: "700 12px 'JetBrains Mono', monospace", color, minWidth: 36 }}>{pct}%</span>
    </div>
  );
}

// ─── Detail Panel sections ────────────────────────────────────────────────────

function ScheduleSection({ s }: { s: ClarificationSchedule }) {
  const hasDays = s.days && s.days.length > 0;
  return (
    <div>
      <SectionLabel>SCHEDULE</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "rgba(255,255,255,.05)", borderRadius: 12, overflow: "hidden" }}>
        {[
          ["Start date", fmtDate(s.startDate)],
          ["End date", fmtDate(s.endDate)],
          ["Duration", hasDays ? `${s.days!.length} day${s.days!.length !== 1 ? "s" : ""}` : "—"],
          ["Full / half", hasDays ? s.days!.filter((d) => d.type === "full").length + " full, " + s.days!.filter((d) => d.type === "half").length + " half" : "—"],
        ].map(([lbl, val]) => (
          <div key={lbl} style={{ background: "#0F1218", padding: "12px 14px" }}>
            <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#525B6B", letterSpacing: ".1em", marginBottom: 5 }}>{lbl}</div>
            <div style={{ font: "700 13px Inter, sans-serif", color: "#E6E9EF" }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfigSection({ c }: { c: ClarificationConfig }) {
  const access = c.access;
  return (
    <div>
      <SectionLabel>EVENT CONFIGURATION</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {c.attendees != null && <InfoRow label="Attendees" value={<><strong style={{ color: LIME }}>{c.attendees}</strong> guests</>} />}
        {c.estimatedTotal != null && <InfoRow label="Estimated total" value={<strong style={{ color: "#22C55E" }}>{fmtMoney(c.estimatedTotal)}</strong>} />}
        {access?.visibility && <InfoRow label="Visibility" value={capitalize(access.visibility)} />}
        {access?.externalGuests != null && (
          <InfoRow label="External guests" value={
            <Pill color={access.externalGuests ? "#22C55E" : "#F59E0B"} bg={access.externalGuests ? "rgba(34,197,94,.1)" : "rgba(245,158,11,.1)"} border={access.externalGuests ? "rgba(34,197,94,.25)" : "rgba(245,158,11,.25)"}>
              {access.externalGuests ? "ALLOWED" : "INVITE ONLY"}
            </Pill>
          } />
        )}
        {c.staff?.count != null && (
          <InfoRow label="Event staff" value={<>{c.staff.count} person{c.staff.count !== 1 ? "s" : ""}{c.staff.costPerPerson ? ` · ${fmtMoney(c.staff.costPerPerson)}/person` : ""}</>} />
        )}
      </div>
      {c.assets && c.assets.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#525B6B", letterSpacing: ".1em", marginBottom: 8 }}>ASSETS REQUESTED</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {c.assets.map((a) => (
              <Pill key={a} color="#AEB5C2" bg="rgba(255,255,255,.04)" border="rgba(255,255,255,.08)">{a}</Pill>
            ))}
          </div>
        </div>
      )}
      {c.services && c.services.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#525B6B", letterSpacing: ".1em", marginBottom: 8 }}>SERVICES</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {c.services.map((s) => (
              <Pill key={s} color={LIME} bg="rgba(200,240,0,.06)" border="rgba(200,240,0,.18)">{s}</Pill>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QASection({ answers }: { answers: ClarificationAnswer[] }) {
  return (
    <div>
      <SectionLabel>ORGANIZER Q&amp;A · {answers.length} ANSWERED</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {answers.map((qa, i) => (
          <div key={i} style={{ border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, background: "#0F1218", overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,.05)", font: "600 11px Inter, sans-serif", color: "#7D8799" }}>
              {qa.question}
            </div>
            <div style={{ padding: "10px 14px", font: "400 13px/1.6 Inter, sans-serif", color: "#E6E9EF" }}>
              {qa.answer}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIExtractionSection({ ex, confidence, missingFields }: { ex: ExtractedJson; confidence: number | null; missingFields: string[] | null }) {
  const needs = flatNeeds(ex);
  const missing = missingFields ?? ex.missingFields ?? [];
  const questions = ex.clarifyingQuestions ?? [];
  const conf = ex.confidence ?? confidence;

  const NEED_LABELS: [keyof ExtractedNeeds, string][] = [
    ["mainStage", "Main stage"], ["breakoutRooms", "Breakout rooms"], ["coffeeArea", "Coffee area"],
    ["registrationDesk", "Registration desk"], ["publicGuestRegistration", "Public registration"],
    ["screens", "Screens"], ["projectors", "Projectors"], ["wirelessMicrophones", "Wireless mics"],
    ["wiredMicrophones", "Wired mics"], ["chairs", "Chairs"], ["tables", "Tables"],
    ["speakers", "Speakers"], ["livestream", "Livestream"],
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <SectionLabel>AI EXTRACTION</SectionLabel>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6, background: "rgba(200,240,0,.08)", border: "1px solid rgba(200,240,0,.18)", font: "600 8px 'JetBrains Mono', monospace", color: LIME, letterSpacing: ".1em", marginBottom: 10 }}>
          AUTO-PARSED
        </div>
      </div>

      {/* Core fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "rgba(255,255,255,.05)", borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
        {[
          ["Event type", ex.eventType ? capitalize(ex.eventType) : "—"],
          ["Expected guests", ex.expectedGuests != null ? String(ex.expectedGuests) : "—"],
          ["Setup hours", ex.setupHours != null ? `${ex.setupHours}h` : "—"],
          ["Teardown hours", ex.teardownHours != null ? `${ex.teardownHours}h` : "—"],
        ].map(([lbl, val]) => (
          <div key={lbl} style={{ background: "#0F1218", padding: "12px 14px" }}>
            <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#525B6B", letterSpacing: ".1em", marginBottom: 5 }}>{lbl}</div>
            <div style={{ font: "700 14px Inter, sans-serif", color: "#E6E9EF" }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Confidence */}
      {conf != null && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#525B6B", letterSpacing: ".1em", marginBottom: 7 }}>EXTRACTION CONFIDENCE</div>
          <ConfidenceBar value={conf} />
        </div>
      )}

      {/* Needs grid */}
      <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#525B6B", letterSpacing: ".1em", marginBottom: 9 }}>DETECTED NEEDS</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
        {NEED_LABELS.map(([key, lbl]) => (
          <NeedChip key={key} label={lbl} value={needs[key]} />
        ))}
      </div>

      {/* Missing fields */}
      {missing.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#F59E0B", letterSpacing: ".1em", marginBottom: 8 }}>MISSING FIELDS · {missing.length}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {missing.map((m) => (
              <Pill key={m} color="#F59E0B" bg="rgba(245,158,11,.08)" border="rgba(245,158,11,.2)">{m}</Pill>
            ))}
          </div>
        </div>
      )}

      {/* Clarifying questions */}
      {questions.length > 0 && (
        <div>
          <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginBottom: 8 }}>SUGGESTED CLARIFICATIONS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {questions.map((q, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 12px", border: "1px solid rgba(255,255,255,.06)", borderRadius: 10, background: "#0F1218" }}>
                <span style={{ font: "700 10px 'JetBrains Mono', monospace", color: "#525B6B", marginTop: 2, flex: "none" }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ font: "400 12px/1.5 Inter, sans-serif", color: "#AEB5C2" }}>{q}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Action bar ───────────────────────────────────────────────────────────────

function ActionBtn({
  label, onClick, variant = "ghost", disabled, icon,
}: {
  label: string;
  onClick: () => void;
  variant?: "primary" | "danger" | "ghost" | "warning";
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: LIME, color: "#0D0D12", border: "none", boxShadow: "0 6px 20px rgba(200,240,0,.22)" },
    danger: { background: "rgba(239,68,68,.08)", color: "#EF4444", border: "1px solid rgba(239,68,68,.3)" },
    ghost: { background: "rgba(255,255,255,.04)", color: "#AEB5C2", border: "1px solid rgba(255,255,255,.1)" },
    warning: { background: "rgba(245,158,11,.08)", color: "#F59E0B", border: "1px solid rgba(245,158,11,.25)" },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: "13px 20px", borderRadius: 12,
        font: "700 13px Inter, sans-serif",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "opacity .15s",
        whiteSpace: "nowrap",
        ...styles[variant],
      }}
    >
      {icon}
      {label}
    </button>
  );
}

const CheckIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12l5 5L20 6" />
  </svg>
);
const XIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
const SparkIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
  </svg>
);
const ArrowIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const ReviewIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

function ActionBar({
  request,
  onUpdate,
}: {
  request: EventRequestRow;
  onUpdate: (patch: Partial<EventRequestRow>) => void;
}) {
  const [acting, setActing] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const { status, id } = request;
  const terminal = status === "REJECTED" || status === "CANCELLED" || status === "APPROVED";
  const eventCreated = !!request.event;

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function call(label: string, url: string, body?: object): Promise<unknown | null> {
    setActing(label);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast((json as { error?: string }).error ?? `${label} failed`, false);
        return null;
      }
      return json;
    } catch {
      showToast(`${label} failed — network error`, false);
      return null;
    } finally {
      setActing(null);
    }
  }

  async function handleParse() {
    const res = await call("Parsing", `/api/requests/${id}/parse`) as { request?: Partial<EventRequestRow>; extraction?: ExtractedJson } | null;
    if (res) {
      onUpdate({ status: "PARSED", extractedJson: res.extraction ?? request.extractedJson, ...res.request });
      showToast("Request parsed — AI extraction complete", true);
    }
  }

  async function handleReview() {
    const res = await call("Reviewing", `/api/requests/${id}/review`) as Partial<EventRequestRow> | null;
    if (res) {
      onUpdate({ status: "REVIEWED", reviewedAt: res.reviewedAt ?? new Date().toISOString() });
      showToast("Marked as reviewed", true);
    }
  }

  async function handleApproveAndPlan() {
    const res = await call("Approving", `/api/requests/${id}/create-event`) as { event?: { id: string; status: string } } | null;
    if (res) {
      const eventId = (res as { id?: string }).id ?? (res.event?.id);
      const eventStatus = (res as { status?: string }).status ?? res.event?.status ?? "DRAFT";
      onUpdate({
        status: "PLANNING",
        approvalStatus: "APPROVED",
        event: eventId ? { id: eventId, status: eventStatus } : request.event,
      });
      showToast("Event created — request is now in Planning", true);
    }
  }

  async function handleReject() {
    if (!showReject) { setShowReject(true); return; }
    if (!rejectReason.trim()) { showToast("Please enter a rejection reason", false); return; }
    const res = await call("Rejecting", `/api/requests/${id}/reject`, { reason: rejectReason });
    if (res) {
      onUpdate({ status: "REJECTED", approvalStatus: "REJECTED" });
      showToast("Request rejected", true);
      setShowReject(false);
      setRejectReason("");
    }
  }

  const busy = acting !== null;

  if (terminal && !eventCreated) {
    const isRej = status === "REJECTED";
    return (
      <div
        style={{
          display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderRadius: 14,
          background: isRej ? "rgba(239,68,68,.06)" : "rgba(255,255,255,.04)",
          border: `1px solid ${isRej ? "rgba(239,68,68,.2)" : "rgba(255,255,255,.08)"}`,
        }}
      >
        <span style={{ font: "700 20px Inter, sans-serif", lineHeight: 1 }}>{isRej ? "✕" : "✓"}</span>
        <span style={{ font: "600 13px Inter, sans-serif", color: isRej ? "#EF4444" : "#7D8799" }}>
          {isRej ? "Request rejected" : "Request cancelled"}
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderRadius: 11,
            background: toast.ok ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)",
            border: `1px solid ${toast.ok ? "rgba(34,197,94,.25)" : "rgba(239,68,68,.25)"}`,
            font: "500 13px Inter, sans-serif",
            color: toast.ok ? "#22C55E" : "#EF4444",
          }}
        >
          <span style={{ font: "700 14px Inter, sans-serif" }}>{toast.ok ? "✓" : "✕"}</span>
          {toast.msg}
        </div>
      )}

      {/* Reject text input */}
      {showReject && (
        <div>
          <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#525B6B", letterSpacing: ".12em", marginBottom: 7 }}>
            REASON FOR REJECTION
          </div>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Explain why this request cannot be accommodated…"
            style={{
              width: "100%", minHeight: 80, padding: 12, borderRadius: 10, resize: "vertical",
              border: "1px solid rgba(239,68,68,.35)", background: "rgba(239,68,68,.05)",
              color: "#fff", font: "400 13px/1.5 Inter, sans-serif", boxSizing: "border-box",
            }}
          />
        </div>
      )}

      {/* Event already created → Open in Manager */}
      {eventCreated && request.event && (
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            padding: "14px 18px", borderRadius: 13,
            background: "rgba(200,240,0,.06)", border: "1px solid rgba(200,240,0,.2)",
          }}
        >
          <div>
            <div style={{ font: "700 13px Inter, sans-serif", color: LIME }}>Event created</div>
            <div style={{ font: "500 11px 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 3 }}>
              Status: {request.event.status}
            </div>
          </div>
          <Link
            href={`/manager/events/${request.event.id}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px",
              borderRadius: 10, background: LIME, color: "#0D0D12",
              font: "700 13px Inter, sans-serif", textDecoration: "none",
            }}
          >
            Open in Manager {ArrowIcon}
          </Link>
        </div>
      )}

      {/* Primary action buttons */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {/* Parse — only when RECEIVED and no extraction yet */}
        {status === "RECEIVED" && !request.extractedJson && (
          <ActionBtn
            label={acting === "Parsing" ? "Parsing…" : "Parse with AI"}
            onClick={handleParse}
            variant="ghost"
            disabled={busy}
            icon={SparkIcon}
          />
        )}

        {/* Mark reviewed — RECEIVED or PARSED */}
        {(status === "RECEIVED" || status === "PARSED") && !eventCreated && (
          <ActionBtn
            label={acting === "Reviewing" ? "Marking…" : "Mark Reviewed"}
            onClick={handleReview}
            variant="ghost"
            disabled={busy}
            icon={ReviewIcon}
          />
        )}

        {/* Approve & Start Planning — not yet in PLANNING/terminal */}
        {!eventCreated && !terminal && (
          <ActionBtn
            label={acting === "Approving" ? "Creating event…" : "Approve & Start Planning"}
            onClick={handleApproveAndPlan}
            variant="primary"
            disabled={busy}
            icon={CheckIcon}
          />
        )}

        {/* Reject — any non-terminal, non-planning state (or in planning without event) */}
        {!terminal && (
          <ActionBtn
            label={
              acting === "Rejecting" ? "Rejecting…"
              : showReject ? "Confirm Rejection"
              : "Reject Request"
            }
            onClick={handleReject}
            variant="danger"
            disabled={busy}
            icon={showReject ? XIcon : XIcon}
          />
        )}

        {/* Cancel reject form */}
        {showReject && !busy && (
          <ActionBtn
            label="Cancel"
            onClick={() => { setShowReject(false); setRejectReason(""); }}
            variant="ghost"
          />
        )}
      </div>

      {/* Action progress label */}
      {busy && (
        <div style={{ font: "500 12px 'JetBrains Mono', monospace", color: "#525B6B", letterSpacing: ".06em" }}>
          {acting}…
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminEventRequestsPage() {
  const { isMobile } = useAdminViewport();
  const [requests, setRequests] = useState<EventRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selId, setSelId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/event-requests")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? (data as EventRequestRow[]) : [];
        setRequests(list);
        if (list.length > 0) setSelId(list[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const patchRequest = useCallback((id: string, patch: Partial<EventRequestRow>) => {
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
  }, []);

  const det = useMemo(() => requests.find((r) => r.id === selId), [requests, selId]);
  const hasClarifications = !!(det?.clarifications && (
    (det.clarifications.answers && det.clarifications.answers.length > 0) ||
    det.clarifications.schedule ||
    det.clarifications.configuration
  ));

  if (loading) {
    return (
      <AdminScreen>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "0.75fr 1.25fr", gap: 18 }}>
          {[140, 140, 100].map((h, i) => (
            <div key={i} style={{ height: h, borderRadius: 14, background: "rgba(255,255,255,.04)", animation: "pulse 1.8s ease-in-out infinite" }} />
          ))}
        </div>
      </AdminScreen>
    );
  }

  if (requests.length === 0) {
    return (
      <AdminScreen>
        <div
          style={{
            border: "1px dashed rgba(255,255,255,.07)",
            borderRadius: 20,
            padding: "clamp(40px,6vw,72px) clamp(24px,4vw,48px)",
            textAlign: "center",
          }}
        >
          <svg width="44" height="38" viewBox="0 0 56 48" fill="none" style={{ marginBottom: 16, opacity: .35 }}>
            <polygon points="28,4 54,44 2,44" stroke={LIME} strokeWidth="1.5" fill="none" />
            <line x1="28" y1="20" x2="28" y2="32" stroke={LIME} strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="28" cy="38" r="1.5" fill={LIME} />
          </svg>
          <h3 style={{ font: "700 18px Inter, sans-serif", color: "#AEB5C2", margin: "0 0 8px" }}>No event requests yet</h3>
          <p style={{ font: "400 13px/1.6 Inter, sans-serif", color: "#525B6B", maxWidth: 320, margin: "0 auto" }}>
            When organizers submit requests through the portal, they will appear here for review.
          </p>
        </div>
      </AdminScreen>
    );
  }

  return (
    <AdminScreen>
      {/* Count header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <span style={{ font: "800 18px Inter, sans-serif", color: "#fff", letterSpacing: "-.015em" }}>Incoming requests</span>
        <span style={{ font: "700 11px 'JetBrains Mono', monospace", color: "#0D0D12", background: LIME, padding: "3px 8px", borderRadius: 7 }}>
          {requests.length}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "320px 1fr", gap: 18, alignItems: "start" }}>
        {/* ── Left: request list ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {requests.map((r) => {
            const isSel = selId === r.id;
            const approvalColor = APPROVAL_COLOR[r.approvalStatus] ?? "#7D8799";
            const statusColor = STATUS_COLOR[r.status] ?? "#7D8799";
            const date = fmtDate(r.createdAt);
            return (
              <button
                key={r.id}
                onClick={() => setSelId(r.id)}
                style={{
                  border: `1px solid ${isSel ? "rgba(200,240,0,.35)" : "rgba(255,255,255,.07)"}`,
                  borderRadius: 14,
                  background: isSel ? "rgba(200,240,0,.04)" : "#151821",
                  padding: "14px 16px",
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                  boxShadow: isSel ? `inset 3px 0 0 ${LIME}` : "none",
                  transition: "all .15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <span style={{ font: "700 13px Inter, sans-serif", color: "#fff", lineHeight: 1.3 }}>
                    {r.title || r.client?.name || "Untitled request"}
                  </span>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", flex: "none", background: approvalColor, boxShadow: `0 0 6px ${approvalColor}`, marginTop: 4 }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ font: "500 11px Inter, sans-serif", color: "#7D8799" }}>
                    {r.client?.name ?? "Unknown client"}
                  </span>
                  {r.contact && (
                    <span style={{ font: "400 11px Inter, sans-serif", color: "#444B5A" }}>
                      · {r.contact.firstName} {r.contact.lastName}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <span style={{
                    font: "700 8px 'JetBrains Mono', monospace",
                    letterSpacing: ".06em",
                    padding: "3px 7px",
                    borderRadius: 5,
                    color: statusColor,
                    background: `${statusColor}18`,
                    border: `1px solid ${statusColor}40`,
                  }}>{r.status}</span>
                  {r.channel && (
                    <span style={{ font: "500 9px 'JetBrains Mono', monospace", color: "#444B5A" }}>{r.channel}</span>
                  )}
                  <span style={{ font: "500 10px Inter, sans-serif", color: "#444B5A", marginLeft: "auto" }}>{date}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Right: detail panel ── */}
        {det && (
          <div
            style={{
              border: "1px solid rgba(255,255,255,.08)",
              borderRadius: 20,
              background: "#151821",
              overflow: "hidden",
              position: isMobile ? "static" : "sticky",
              top: 18,
              maxHeight: isMobile ? "none" : "calc(100vh - 100px)",
              overflowY: isMobile ? "visible" : "auto",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "22px 24px",
                borderBottom: "1px solid rgba(255,255,255,.07)",
                background: "linear-gradient(135deg,rgba(200,240,0,.04),#151821 60%)",
              }}
            >
              <div style={{ font: "800 20px/1.15 Inter, sans-serif", color: "#fff", letterSpacing: "-.02em", marginBottom: 6 }}>
                {det.title || det.client?.name || "Untitled event request"}
              </div>
              {det.contact && (
                <div style={{ font: "500 12px 'JetBrains Mono', monospace", color: "#7D8799", marginBottom: 14 }}>
                  {det.contact.firstName} {det.contact.lastName}
                  <span style={{ color: "#444B5A" }}> · {det.contact.email}</span>
                </div>
              )}
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                <Pill
                  color={APPROVAL_COLOR[det.approvalStatus] ?? "#7D8799"}
                  bg={`${APPROVAL_COLOR[det.approvalStatus] ?? "#7D8799"}18`}
                  border={`${APPROVAL_COLOR[det.approvalStatus] ?? "#7D8799"}40`}
                >
                  {det.approvalStatus.replace(/_/g, " ")}
                </Pill>
                <Pill
                  color={STATUS_COLOR[det.status] ?? "#7D8799"}
                  bg={`${STATUS_COLOR[det.status] ?? "#7D8799"}18`}
                  border={`${STATUS_COLOR[det.status] ?? "#7D8799"}40`}
                >
                  {det.status}
                </Pill>
                {det.channel && <Pill>{det.channel.toUpperCase()}</Pill>}
                {det.event && (
                  <Pill color={LIME} bg="rgba(200,240,0,.08)" border="rgba(200,240,0,.2)">
                    EVENT CREATED · {det.event.status}
                  </Pill>
                )}
              </div>
            </div>

            {/* Meta row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "rgba(255,255,255,.04)", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
              {[
                ["CLIENT", det.client?.name ?? "—"],
                ["SUBMITTED", fmtDate(det.createdAt)],
                ["REVIEWED", det.reviewedAt ? fmtDate(det.reviewedAt) : "Pending"],
                ["AI CONFIDENCE", det.confidence != null ? `${Math.round(det.confidence * 100)}%` : "—"],
              ].map(([lbl, val]) => (
                <div key={lbl} style={{ background: "#0F1218", padding: "12px 16px" }}>
                  <div style={{ font: "500 9px 'JetBrains Mono', monospace", color: "#525B6B", letterSpacing: ".12em", marginBottom: 4 }}>{lbl}</div>
                  <div style={{ font: "700 13px Inter, sans-serif", color: "#E6E9EF" }}>{val}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 26 }}>
              {/* Original request */}
              <div>
                <SectionLabel>ORIGINAL REQUEST</SectionLabel>
                <div
                  style={{
                    position: "relative",
                    padding: "16px 18px 16px 22px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,.07)",
                    background: "#0F1218",
                  }}
                >
                  <div style={{ position: "absolute", top: 14, left: 10, bottom: 14, width: 3, borderRadius: 2, background: LIME, opacity: .6 }} />
                  <p style={{ font: "400 14px/1.75 Inter, sans-serif", color: "#E6E9EF", margin: 0, textWrap: "pretty" }}>
                    {det.rawText}
                  </p>
                </div>
              </div>

              {/* Schedule */}
              {det.clarifications?.schedule && (
                <ScheduleSection s={det.clarifications.schedule} />
              )}

              {/* Configuration */}
              {det.clarifications?.configuration && (
                <ConfigSection c={det.clarifications.configuration} />
              )}

              {/* Q&A */}
              {det.clarifications?.answers && det.clarifications.answers.length > 0 && (
                <QASection answers={det.clarifications.answers} />
              )}

              {/* No clarifications at all */}
              {!hasClarifications && (
                <div style={{ padding: "16px 18px", borderRadius: 12, border: "1px dashed rgba(255,255,255,.07)", font: "400 13px Inter, sans-serif", color: "#444B5A", textAlign: "center" }}>
                  No additional details captured from the organizer portal.
                </div>
              )}

              {/* AI Extraction */}
              {det.extractedJson && (
                <>
                  <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", margin: "0 -24px", padding: "0 24px" }} />
                  <AIExtractionSection
                    ex={det.extractedJson}
                    confidence={det.confidence}
                    missingFields={det.missingFields ?? null}
                  />
                </>
              )}

              {/* Action bar */}
              <div style={{ borderTop: "1px solid rgba(255,255,255,.08)", margin: "0 -24px", paddingTop: 22, paddingLeft: 0, paddingRight: 0 }}>
                <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#525B6B", letterSpacing: ".18em", marginBottom: 14 }}>
                  ACTIONS
                </div>
                <ActionBar
                  request={det}
                  onUpdate={(patch) => patchRequest(det.id, patch)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminScreen>
  );
}
