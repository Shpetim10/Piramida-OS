"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { OrganizerEventDetail } from "@/lib/organizer/event-management";
import type { OrganizerIdentity } from "./OrganizerShell";

// ─── types ───────────────────────────────────────────────────────────────────

interface GuestRow {
  id: string;
  fullName: string;
  email: string;
  company: string | null;
  status: string;
  ticketStatus: string | null;
  checkedIn: boolean;
  registeredAt: string;
}

interface VersionRow {
  id: string;
  version: number;
  reason: string | null;
  createdAt: string;
  snapshot: unknown;
}

interface BillRow {
  id: string;
  type: string;
  status: string;
  subtotal: string;
  total: string;
  currency: string;
  notes: string | null;
  version: number;
  createdAt: string;
  items: { id: string; label: string; quantity: string; unitPrice: string; lineTotal: string }[];
}

interface TimelineItem {
  id: string;
  title: string;
  description: string | null;
  spaceId: string | null;
  startsAt: string;
  endsAt: string;
  sortOrder: number | null;
  publicVisible: boolean;
  createdAt: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: "details", label: "Details" },
  { key: "guests", label: "Guests" },
  { key: "timeline", label: "Timeline" },
  { key: "bills", label: "Bills" },
  { key: "versions", label: "Versions" },
  { key: "scan", label: "Scan" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "#7D8799",
  PLANNING: "#C8F000",
  PROPOSED: "#F59E0B",
  CONFIRMED: "#22C55E",
  PUBLISHED: "#2A6FDB",
  LAUNCH_READY: "#22C55E",
  LIVE: "#C53A6B",
  COMPLETED: "#7D8799",
  ARCHIVED: "#7D8799",
  CANCELLED: "#EF4444",
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { dateStyle: "medium" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// ─── sub-components ──────────────────────────────────────────────────────────

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.07)",
        borderRadius: 18,
        background: "#151821",
        overflow: "hidden",
        marginBottom: 24,
      }}
    >
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        padding: "14px 20px",
        borderBottom: "1px solid rgba(255,255,255,.05)",
        alignItems: "flex-start",
      }}
    >
      <div style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", width: 140, flex: "none" }}>
        {label}
      </div>
      <div style={{ font: "500 14px Inter, sans-serif", color: "#E0E0E0", flex: 1 }}>{value}</div>
    </div>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        font: "600 10px 'JetBrains Mono', monospace",
        letterSpacing: ".08em",
        padding: "4px 10px",
        borderRadius: 7,
        color,
        background: color + "22",
      }}
    >
      {children}
    </span>
  );
}

function Btn({
  onClick,
  children,
  accent,
  danger,
  disabled,
  small,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  accent?: boolean;
  danger?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: small ? "8px 16px" : "11px 20px",
        borderRadius: 10,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        font: `600 ${small ? 12 : 14}px Inter, sans-serif`,
        background: accent ? "#C8F000" : danger ? "#EF4444" : "rgba(255,255,255,.08)",
        color: accent ? "#0D0D12" : "#fff",
        opacity: disabled ? 0.45 : 1,
        transition: "opacity .15s",
      }}
    >
      {children}
    </button>
  );
}

// ─── Status lifecycle banner ─────────────────────────────────────────────────

const STATUS_STEPS = [
  { key: "PLANNING", label: "Planning" },
  { key: "PROPOSED", label: "Proposed" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "PUBLISHED", label: "Published" },
  { key: "LAUNCH_READY", label: "Launch ready" },
  { key: "LIVE", label: "Live" },
  { key: "COMPLETED", label: "Completed" },
] as const;

const CANCELLABLE = new Set(["CONFIRMED", "PUBLISHED", "LAUNCH_READY", "LIVE"]);

function StatusPanel({
  event,
  eventId,
  onStatusChange,
}: {
  event: OrganizerEventDetail;
  eventId: string;
  onStatusChange: () => void;
}) {
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const color = STATUS_COLOR[event.status] ?? "#7D8799";
  const canCancel = CANCELLABLE.has(event.status);

  const currentStepIdx = STATUS_STEPS.findIndex((s) => s.key === event.status);
  const isCancelled = event.status === "CANCELLED";
  const isTerminal = ["COMPLETED", "ARCHIVED", "CANCELLED"].includes(event.status);

  async function doCancel() {
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/organizer/events/${eventId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Cancel failed");
      setShowCancel(false);
      onStatusChange();
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", padding: 20, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ font: "600 12px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>STATUS</div>
          <Badge color={color}>{event.status}</Badge>
        </div>
        {canCancel && !showCancel && (
          <button
            onClick={() => setShowCancel(true)}
            style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid #EF444444", background: "transparent", color: "#EF4444", font: "600 12px Inter, sans-serif", cursor: "pointer" }}
          >
            Cancel event
          </button>
        )}
      </div>

      {/* Progress track */}
      {!isCancelled && (
        <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", paddingBottom: 4 }}>
          {STATUS_STEPS.map((step, idx) => {
            const done = idx < currentStepIdx;
            const active = idx === currentStepIdx;
            const future = idx > currentStepIdx;
            const stepColor = done ? "#22C55E" : active ? color : "rgba(255,255,255,.15)";
            return (
              <div key={step.key} style={{ display: "flex", alignItems: "center", flex: idx < STATUS_STEPS.length - 1 ? 1 : "none" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: stepColor, flexShrink: 0, boxShadow: active ? `0 0 8px ${color}88` : "none" }} />
                  <div style={{ font: `${active ? 600 : 500} 10px Inter, sans-serif`, color: future ? "#4a5568" : active ? "#fff" : "#7D8799", whiteSpace: "nowrap" }}>
                    {step.label}
                  </div>
                </div>
                {idx < STATUS_STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 1, background: done ? "#22C55E44" : "rgba(255,255,255,.08)", margin: "0 4px", marginBottom: 16, minWidth: 16 }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {isCancelled && (
        <div style={{ font: "500 13px Inter, sans-serif", color: "#EF4444", padding: "8px 0" }}>
          This event has been cancelled.
        </div>
      )}

      {isTerminal && !isCancelled && (
        <div style={{ font: "500 13px Inter, sans-serif", color: "#7D8799", marginTop: 8 }}>
          This event is {event.status.toLowerCase()}. No further organizer actions available.
        </div>
      )}

      {!canCancel && !isTerminal && (
        <div style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", marginTop: 12 }}>
          Status changes are managed by the Pyramid team. You will be notified as your event progresses.
        </div>
      )}

      {showCancel && (
        <div style={{ marginTop: 16, borderTop: "1px solid rgba(239,68,68,.2)", paddingTop: 16 }}>
          <div style={{ font: "600 13px Inter, sans-serif", color: "#EF4444", marginBottom: 12 }}>
            Cancel this event?
          </div>
          <div style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", marginBottom: 12 }}>
            This will cancel the event. If guests are registered, consider notifying them separately. This action cannot be undone.
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for cancellation (optional)"
            rows={2}
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.12)", background: "#0D0D12", color: "#fff", font: "500 13px Inter, sans-serif", resize: "vertical", boxSizing: "border-box" }}
          />
          {cancelError && <div style={{ color: "#EF4444", font: "500 12px Inter, sans-serif", marginTop: 8 }}>{cancelError}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <Btn danger onClick={doCancel} disabled={cancelling}>{cancelling ? "Cancelling…" : "Confirm cancel"}</Btn>
            <Btn onClick={() => { setShowCancel(false); setReason(""); setCancelError(null); }}>Keep event</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Details tab ─────────────────────────────────────────────────────────────

function DetailsTab({ event, eventId }: { event: OrganizerEventDetail; eventId: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExtraCost, setShowExtraCost] = useState(false);

  const [title, setTitle] = useState(event.title);
  const [summary, setSummary] = useState(event.summary ?? "");
  const [guests, setGuests] = useState(String(event.expectedGuests ?? ""));
  const [extraItems, setExtraItems] = useState<{ label: string; unitPrice: string; quantity: string }[]>([]);
  const [extraNotes, setExtraNotes] = useState("");

  const color = STATUS_COLOR[event.status] ?? "#7D8799";

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (title !== event.title) body.title = title;
      if (summary !== (event.summary ?? "")) body.summary = summary;
      if (guests && Number(guests) !== event.expectedGuests) body.expectedGuests = Number(guests);
      if (showExtraCost && extraItems.length > 0) {
        body.extraCostItems = extraItems.map((i) => ({
          label: i.label,
          unitPrice: parseFloat(i.unitPrice),
          quantity: parseInt(i.quantity) || 1,
        }));
        body.extraCostNotes = extraNotes || undefined;
      }

      const res = await fetch(`/api/organizer/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? "Save failed");
      }
      setEditing(false);
      setShowExtraCost(false);
      setExtraItems([]);
      setExtraNotes("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function addExtraItem() {
    setExtraItems((p) => [...p, { label: "", unitPrice: "0", quantity: "1" }]);
  }

  function removeExtraItem(idx: number) {
    setExtraItems((p) => p.filter((_, i) => i !== idx));
  }

  const inputStyle = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,.12)",
    background: "#0D0D12",
    color: "#fff",
    font: "500 14px Inter, sans-serif",
    boxSizing: "border-box" as const,
  };

  return (
    <div>
      {/* Status panel always visible at top */}
      <StatusPanel event={event} eventId={eventId} onStatusChange={() => router.refresh()} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ font: "700 18px Inter, sans-serif", color: "#fff" }}>Event Details</div>
        {event.editable && !editing && (
          <Btn accent onClick={() => setEditing(true)}>Edit Details</Btn>
        )}
        {!event.editable && event.status !== "CANCELLED" && (
          <Badge color="#7D8799">Read-only · {event.status}</Badge>
        )}
      </div>

      {editing ? (
        <div style={{ border: "1px solid rgba(200,240,0,.3)", borderRadius: 18, padding: 24, background: "#151821", marginBottom: 24 }}>
          <div style={{ font: "600 13px Inter, sans-serif", color: "#C8F000", marginBottom: 20 }}>Editing event details</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", display: "block", marginBottom: 6 }}>Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", display: "block", marginBottom: 6 }}>Summary</label>
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div>
              <label style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", display: "block", marginBottom: 6 }}>Expected guests</label>
              <input type="number" min="1" value={guests} onChange={(e) => setGuests(e.target.value)} style={{ ...inputStyle, width: 140 }} />
            </div>

            <div style={{ borderTop: "1px solid rgba(255,255,255,.07)", paddingTop: 16 }}>
              <button
                onClick={() => setShowExtraCost((p) => !p)}
                style={{ background: "none", border: "none", color: "#C8F000", font: "600 13px Inter, sans-serif", cursor: "pointer", padding: 0 }}
              >
                {showExtraCost ? "▼" : "▶"} Add extra cost items (generates supplement bill)
              </button>
              {showExtraCost && (
                <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  {extraItems.map((item, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        placeholder="Description"
                        value={item.label}
                        onChange={(e) => setExtraItems((p) => p.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <input
                        placeholder="Qty"
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => setExtraItems((p) => p.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))}
                        style={{ ...inputStyle, width: 70 }}
                      />
                      <input
                        placeholder="Unit price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => setExtraItems((p) => p.map((x, i) => i === idx ? { ...x, unitPrice: e.target.value } : x))}
                        style={{ ...inputStyle, width: 110 }}
                      />
                      <button onClick={() => removeExtraItem(idx)} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 18 }}>×</button>
                    </div>
                  ))}
                  <Btn small onClick={addExtraItem}>+ Add item</Btn>
                  <div>
                    <label style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", display: "block", marginBottom: 6 }}>Notes for supplement bill</label>
                    <textarea value={extraNotes} onChange={(e) => setExtraNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 14, color: "#EF4444", font: "500 13px Inter, sans-serif" }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <Btn accent onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Btn>
            <Btn onClick={() => { setEditing(false); setShowExtraCost(false); setExtraItems([]); }}>Cancel</Btn>
          </div>
        </div>
      ) : (
        <Section>
          <Row label="Title" value={event.title} />
          <Row label="Status" value={<Badge color={color}>{event.status}</Badge>} />
          <Row label="Type" value={event.type} />
          <Row label="Visibility" value={event.visibility} />
          <Row label="Expected guests" value={event.expectedGuests ?? "—"} />
          <Row label="Event start" value={fmt(event.eventStart)} />
          <Row label="Event end" value={fmt(event.eventEnd)} />
          <Row label="Summary" value={event.summary || <span style={{ color: "#7D8799" }}>—</span>} />
          {event.publication && (
            <>
              <Row label="Public title" value={event.publication.publicTitle} />
              <Row label="Slug" value={<span style={{ font: "500 13px 'JetBrains Mono', monospace", color: "#C8F000" }}>/{event.publication.slug}</span>} />
              <Row label="Registration" value={event.publication.registrationOpen ? <Badge color="#22C55E">OPEN</Badge> : <Badge color="#7D8799">CLOSED</Badge>} />
              <Row label="Public capacity" value={event.publication.capacityPublic ?? "—"} />
            </>
          )}
        </Section>
      )}
    </div>
  );
}

// ─── Guests tab ───────────────────────────────────────────────────────────────

function GuestsTab({ eventId, isPublic }: { eventId: string; isPublic: boolean }) {
  const [guests, setGuests] = useState<GuestRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPublic) return;
    fetch(`/api/organizer/events/${eventId}/guests`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setGuests(d);
      })
      .catch(() => setError("Failed to load guests"));
  }, [eventId, isPublic]);

  if (!isPublic) {
    return (
      <div style={{ color: "#7D8799", font: "500 14px Inter, sans-serif", padding: "32px 0" }}>
        Guest list is only available for public events.
      </div>
    );
  }

  const checkedIn = guests?.filter((g) => g.checkedIn).length ?? 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ font: "700 18px Inter, sans-serif", color: "#fff" }}>Registered Guests</div>
        {guests && (
          <div style={{ font: "500 13px Inter, sans-serif", color: "#7D8799" }}>
            {guests.length} registered · <span style={{ color: "#22C55E" }}>{checkedIn} checked in</span>
          </div>
        )}
      </div>

      {error && <div style={{ color: "#EF4444", font: "500 13px Inter, sans-serif", marginBottom: 16 }}>{error}</div>}
      {!guests && !error && <div style={{ color: "#7D8799", font: "500 14px Inter, sans-serif" }}>Loading…</div>}
      {guests && guests.length === 0 && (
        <div style={{ color: "#7D8799", font: "500 14px Inter, sans-serif" }}>No registrations yet.</div>
      )}
      {guests && guests.length > 0 && (
        <Section>
          {guests.map((g) => (
            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: g.checkedIn ? "#22C55E22" : "#7D879922",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  font: "700 13px Inter, sans-serif",
                  color: g.checkedIn ? "#22C55E" : "#7D8799",
                  flex: "none",
                }}
              >
                {g.fullName.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "600 14px Inter, sans-serif", color: "#fff" }}>{g.fullName}</div>
                <div style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", marginTop: 2 }}>
                  {g.email}{g.company ? ` · ${g.company}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <Badge color={g.checkedIn ? "#22C55E" : "#7D8799"}>
                  {g.checkedIn ? "CHECKED IN" : g.ticketStatus ?? g.status}
                </Badge>
                <div style={{ font: "500 11px Inter, sans-serif", color: "#4a5568", marginTop: 4 }}>
                  {fmtDate(g.registeredAt)}
                </div>
              </div>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

// ─── Timeline tab ─────────────────────────────────────────────────────────────

function TimelineTab({
  eventId,
  editable,
  event,
}: {
  eventId: string;
  editable: boolean;
  event: OrganizerEventDetail;
}) {
  const [items, setItems] = useState<TimelineItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyForm = { title: "", description: "", startsAt: "", endsAt: "", publicVisible: true };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(() => {
    fetch(`/api/organizer/events/${eventId}/timeline`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setItems(d);
      })
      .catch(() => setError("Failed to load timeline"));
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  // Group items by day
  const days: Record<string, TimelineItem[]> = {};
  (items ?? []).forEach((item) => {
    const day = item.startsAt.slice(0, 10);
    if (!days[day]) days[day] = [];
    days[day].push(item);
  });

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const url = editingId
        ? `/api/organizer/events/${eventId}/timeline/${editingId}`
        : `/api/organizer/events/${eventId}/timeline`;
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          startsAt: form.startsAt,
          endsAt: form.endsAt,
          publicVisible: form.publicVisible,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed");
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this timeline item?")) return;
    const res = await fetch(`/api/organizer/events/${eventId}/timeline/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  function startEdit(item: TimelineItem) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      description: item.description ?? "",
      startsAt: item.startsAt.slice(0, 16),
      endsAt: item.endsAt.slice(0, 16),
      publicVisible: item.publicVisible,
    });
    setShowForm(true);
  }

  const inputStyle = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,.12)",
    background: "#0D0D12",
    color: "#fff",
    font: "500 14px Inter, sans-serif",
    boxSizing: "border-box" as const,
  };

  const eventStartStr = event.eventStart ? event.eventStart.slice(0, 16) : "";
  const eventEndStr = event.eventEnd ? event.eventEnd.slice(0, 16) : "";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ font: "700 18px Inter, sans-serif", color: "#fff" }}>Event Timeline</div>
        {editable && !showForm && (
          <Btn accent onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}>+ Add item</Btn>
        )}
      </div>

      {(!event.publication || event.publication.status === "DRAFT") && (
        <div style={{ font: "500 12px Inter, sans-serif", color: "#F59E0B", background: "#F59E0B0d", border: "1px solid #F59E0B33", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
          Your event is not published yet — timeline items you add now will be saved as a draft and will go live when the Pyramid team publishes the event.
        </div>
      )}
      {event.eventStart && event.eventEnd && (
        <div style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", marginBottom: 16 }}>
          Event runs {fmtDate(event.eventStart)} – {fmtDate(event.eventEnd)}. Items must stay within these days.
        </div>
      )}

      {showForm && (
        <div style={{ border: "1px solid rgba(200,240,0,.3)", borderRadius: 18, padding: 24, background: "#151821", marginBottom: 24 }}>
          <div style={{ font: "600 13px Inter, sans-serif", color: "#C8F000", marginBottom: 18 }}>
            {editingId ? "Edit timeline item" : "New timeline item"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", display: "block", marginBottom: 5 }}>Title *</label>
              <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} style={inputStyle} placeholder="e.g. Opening keynote" />
            </div>
            <div>
              <label style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", display: "block", marginBottom: 5 }}>Description</label>
              <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", display: "block", marginBottom: 5 }}>Starts at *</label>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  min={eventStartStr}
                  max={eventEndStr}
                  onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", display: "block", marginBottom: 5 }}>Ends at *</label>
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  min={form.startsAt || eventStartStr}
                  max={eventEndStr}
                  onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", font: "500 13px Inter, sans-serif", color: "#7D8799" }}>
              <input
                type="checkbox"
                checked={form.publicVisible}
                onChange={(e) => setForm((p) => ({ ...p, publicVisible: e.target.checked }))}
              />
              Visible on public event page
            </label>
          </div>
          {error && <div style={{ marginTop: 12, color: "#EF4444", font: "500 13px Inter, sans-serif" }}>{error}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <Btn accent onClick={submit} disabled={saving || !form.title || !form.startsAt || !form.endsAt}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Add item"}
            </Btn>
            <Btn onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); setError(null); }}>Cancel</Btn>
          </div>
        </div>
      )}

      {!items && !error && <div style={{ color: "#7D8799", font: "500 14px Inter, sans-serif" }}>Loading…</div>}
      {error && !showForm && <div style={{ color: "#EF4444", font: "500 13px Inter, sans-serif", marginBottom: 16 }}>{error}</div>}

      {items && Object.keys(days).length === 0 && (
        <div style={{ color: "#7D8799", font: "500 14px Inter, sans-serif" }}>No timeline items yet. {editable ? "Add the first one above." : ""}</div>
      )}

      {Object.entries(days).sort(([a], [b]) => a.localeCompare(b)).map(([day, dayItems]) => (
        <div key={day} style={{ marginBottom: 24 }}>
          <div style={{ font: "600 12px 'JetBrains Mono', monospace", letterSpacing: ".1em", color: "#C8F000", marginBottom: 12 }}>
            {new Date(day + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
          <div style={{ borderLeft: "2px solid rgba(200,240,0,.25)", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            {dayItems.sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((item) => (
              <div
                key={item.id}
                style={{
                  border: "1px solid rgba(255,255,255,.07)",
                  borderRadius: 14,
                  padding: "14px 18px",
                  background: "#0D0D12",
                  display: "flex",
                  gap: 16,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ font: "600 12px 'JetBrains Mono', monospace", color: "#7D8799", minWidth: 100, paddingTop: 2 }}>
                  {fmtTime(item.startsAt)} – {fmtTime(item.endsAt)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "600 14px Inter, sans-serif", color: "#fff" }}>{item.title}</div>
                  {item.description && (
                    <div style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", marginTop: 4 }}>{item.description}</div>
                  )}
                  {!item.publicVisible && (
                    <span style={{ font: "500 11px Inter, sans-serif", color: "#4a5568", marginTop: 4, display: "block" }}>Hidden from public</span>
                  )}
                </div>
                {editable && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => startEdit(item)} style={{ background: "none", border: "none", color: "#7D8799", cursor: "pointer", padding: 4 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={() => remove(item.id)} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", padding: 4 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Proposal panel ───────────────────────────────────────────────────────────

interface ProposalData {
  id: string;
  status: string;
  title: string;
  body: string;
  sentAt: string | null;
  respondedAt: string | null;
  responseNote: string | null;
  quoteTotal: string;
  quoteCurrency: string;
  quoteItems: { label: string; lineTotal: string }[];
}

const PROPOSAL_STATUS_COLOR: Record<string, string> = {
  DRAFT: "#7D8799",
  SENT: "#F59E0B",
  APPROVED: "#22C55E",
  CHANGES_REQUESTED: "#EF4444",
  REJECTED: "#EF4444",
  CANCELLED: "#7D8799",
};

function ProposalPanel({ eventId }: { eventId: string }) {
  const [proposal, setProposal] = useState<ProposalData | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/organizer/events/${eventId}/proposal`)
      .then((r) => r.json())
      .then((d) => setProposal(d))
      .catch(() => setProposal(null));
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  async function respond(action: "approve" | "request_changes") {
    setSaving(true);
    setErr(null);
    try {
      const body = action === "approve"
        ? { action }
        : { action, note: note.trim() };
      const res = await fetch(`/api/organizer/events/${eventId}/proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed");
      setProposal(j);
      setNoteOpen(false);
      setNote("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  if (proposal === undefined) return null;

  if (!proposal) {
    return (
      <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, background: "#151821", padding: "20px 24px", marginBottom: 24 }}>
        <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em", marginBottom: 10 }}>PROPOSAL</div>
        <div style={{ font: "500 13px Inter, sans-serif", color: "#7D8799" }}>
          No proposal has been sent yet. Staff will share a proposal with you once the plan is ready.
        </div>
      </div>
    );
  }

  const statusColor = PROPOSAL_STATUS_COLOR[proposal.status] ?? "#7D8799";
  const canAct = proposal.status === "SENT";

  return (
    <div style={{ border: `1px solid ${statusColor}33`, borderRadius: 14, background: "#151821", padding: "20px 24px", marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em" }}>PROPOSAL</div>
        <span style={{ font: "600 10px 'JetBrains Mono', monospace", padding: "3px 10px", borderRadius: 6, color: statusColor, background: statusColor + "22" }}>
          {proposal.status}
        </span>
      </div>

      <div style={{ font: "700 15px Inter, sans-serif", color: "#fff", marginBottom: 8 }}>{proposal.title}</div>
      <div style={{ font: "400 13px/1.7 Inter, sans-serif", color: "#AEB5C2", marginBottom: 18, whiteSpace: "pre-wrap" }}>{proposal.body}</div>

      {/* Quote summary inside proposal */}
      <div style={{ background: "#0F1218", borderRadius: 10, padding: "14px 16px", marginBottom: 18 }}>
        <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginBottom: 10 }}>COST SUMMARY</div>
        {proposal.quoteItems.map((item, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
            <span style={{ font: "500 12px Inter, sans-serif", color: "#AEB5C2" }}>{item.label}</span>
            <span style={{ font: "600 12px 'JetBrains Mono', monospace", color: "#fff" }}>{item.lineTotal} {proposal.quoteCurrency}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
          <span style={{ font: "700 13px Inter, sans-serif", color: "#fff" }}>Total</span>
          <span style={{ font: "700 15px 'JetBrains Mono', monospace", color: "#C8F000" }}>{proposal.quoteTotal} {proposal.quoteCurrency}</span>
        </div>
      </div>

      {proposal.sentAt && (
        <div style={{ font: "500 11px Inter, sans-serif", color: "#4a5568", marginBottom: 14 }}>
          Sent {fmtDate(proposal.sentAt)}
          {proposal.respondedAt && ` · Responded ${fmtDate(proposal.respondedAt)}`}
        </div>
      )}

      {proposal.responseNote && (
        <div style={{ background: "rgba(239,68,68,.07)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#EF4444", letterSpacing: ".1em", marginBottom: 6 }}>YOUR CHANGE REQUEST</div>
          <div style={{ font: "500 13px Inter, sans-serif", color: "#AEB5C2" }}>{proposal.responseNote}</div>
        </div>
      )}

      {canAct && !noteOpen && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => respond("approve")}
            disabled={saving}
            style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: "#22C55E", color: "#000", font: "700 13px Inter, sans-serif", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "…" : "Approve proposal"}
          </button>
          <button
            onClick={() => setNoteOpen(true)}
            disabled={saving}
            style={{ padding: "10px 22px", borderRadius: 10, border: "1px solid rgba(239,68,68,.4)", background: "transparent", color: "#EF4444", font: "700 13px Inter, sans-serif", cursor: "pointer" }}
          >
            Request changes
          </button>
        </div>
      )}

      {canAct && noteOpen && (
        <div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Describe what you would like changed…"
            rows={4}
            style={{ width: "100%", boxSizing: "border-box", background: "#0F1218", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, color: "#fff", font: "500 13px Inter, sans-serif", padding: "12px 14px", resize: "vertical", outline: "none", marginBottom: 10 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => respond("request_changes")}
              disabled={saving || !note.trim()}
              style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: "#EF4444", color: "#fff", font: "700 13px Inter, sans-serif", cursor: saving || !note.trim() ? "not-allowed" : "pointer", opacity: saving || !note.trim() ? 0.5 : 1 }}
            >
              {saving ? "…" : "Send request"}
            </button>
            <button
              onClick={() => { setNoteOpen(false); setNote(""); }}
              style={{ padding: "9px 18px", borderRadius: 9, border: "1px solid rgba(255,255,255,.1)", background: "transparent", color: "#7D8799", font: "600 13px Inter, sans-serif", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {err && <div style={{ marginTop: 10, font: "500 12px Inter, sans-serif", color: "#EF4444" }}>{err}</div>}
    </div>
  );
}

// ─── Bills tab ────────────────────────────────────────────────────────────────

function BillsTab({ eventId }: { eventId: string }) {
  const [bills, setBills] = useState<BillRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/organizer/events/${eventId}/bills`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setBills(d); })
      .catch(() => setError("Failed to load bills"));
  }, [eventId]);

  if (!bills && !error) return <div style={{ color: "#7D8799", font: "500 14px Inter, sans-serif" }}>Loading…</div>;
  if (error) return <div style={{ color: "#EF4444", font: "500 13px Inter, sans-serif" }}>{error}</div>;

  return (
    <div>
      <ProposalPanel eventId={eventId} />
      {(!bills || bills.length === 0) && (
        <div style={{ color: "#7D8799", font: "500 14px Inter, sans-serif" }}>No bills yet.</div>
      )}
      {bills && bills.length > 0 && (
        <div style={{ font: "700 18px Inter, sans-serif", color: "#fff", marginBottom: 20 }}>Bills & Quotes</div>
      )}
      {(bills ?? []).map((bill) => (
        <div key={bill.id} style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, background: "#151821", marginBottom: 14, overflow: "hidden" }}>
          <div
            onClick={() => setExpanded((p) => p === bill.id ? null : bill.id)}
            style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Badge color={bill.type === "SUPPLEMENT" ? "#F59E0B" : "#2A6FDB"}>{bill.type}</Badge>
                <Badge color={bill.status === "APPROVED" ? "#22C55E" : bill.status === "DRAFT" ? "#7D8799" : "#F59E0B"}>{bill.status}</Badge>
              </div>
              <div style={{ font: "500 12px Inter, sans-serif", color: "#7D8799", marginTop: 6 }}>
                v{bill.version} · {fmtDate(bill.createdAt)}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ font: "700 16px Inter, sans-serif", color: "#C8F000" }}>
                {bill.total} {bill.currency}
              </div>
              <div style={{ font: "500 11px Inter, sans-serif", color: "#4a5568", marginTop: 3 }}>{bill.items.length} items</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7D8799" strokeWidth="2" strokeLinecap="round">
              <path d={expanded === bill.id ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
            </svg>
          </div>

          {expanded === bill.id && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", padding: "16px 20px" }}>
              {bill.notes && (
                <div style={{ font: "500 13px Inter, sans-serif", color: "#7D8799", marginBottom: 14 }}>{bill.notes}</div>
              )}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Description", "Qty", "Unit price", "Total"].map((h) => (
                      <th key={h} style={{ font: "600 11px Inter, sans-serif", color: "#4a5568", textAlign: "left", padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bill.items.map((i) => (
                    <tr key={i.id}>
                      <td style={{ font: "500 13px Inter, sans-serif", color: "#E0E0E0", padding: "9px 10px", borderBottom: "1px solid rgba(255,255,255,.04)" }}>{i.label}</td>
                      <td style={{ font: "500 13px Inter, sans-serif", color: "#7D8799", padding: "9px 10px", borderBottom: "1px solid rgba(255,255,255,.04)" }}>{i.quantity}</td>
                      <td style={{ font: "500 13px Inter, sans-serif", color: "#7D8799", padding: "9px 10px", borderBottom: "1px solid rgba(255,255,255,.04)" }}>{i.unitPrice}</td>
                      <td style={{ font: "700 13px Inter, sans-serif", color: "#C8F000", padding: "9px 10px", borderBottom: "1px solid rgba(255,255,255,.04)" }}>{i.lineTotal}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ font: "700 13px Inter, sans-serif", color: "#7D8799", padding: "10px 10px 0", textAlign: "right" }}>Total</td>
                    <td style={{ font: "700 15px Inter, sans-serif", color: "#C8F000", padding: "10px 10px 0" }}>{bill.total} {bill.currency}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Versions tab ─────────────────────────────────────────────────────────────

function VersionsTab({ eventId }: { eventId: string }) {
  const [versions, setVersions] = useState<VersionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/organizer/events/${eventId}/versions`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setVersions(d); })
      .catch(() => setError("Failed to load version history"));
  }, [eventId]);

  if (!versions && !error) return <div style={{ color: "#7D8799", font: "500 14px Inter, sans-serif" }}>Loading…</div>;
  if (error) return <div style={{ color: "#EF4444", font: "500 13px Inter, sans-serif" }}>{error}</div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <div style={{ font: "700 18px Inter, sans-serif", color: "#fff" }}>Version History</div>
        <Badge color="#7D8799">View only · No revert</Badge>
      </div>

      {(!versions || versions.length === 0) && (
        <div style={{ color: "#7D8799", font: "500 14px Inter, sans-serif" }}>No versions recorded yet.</div>
      )}

      {versions && versions.map((v) => {
        const snap = v.snapshot as Record<string, unknown> | null;
        const isOrgEdit = snap && snap.editedBy === "organizer";

        return (
          <div key={v.id} style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, background: "#151821", marginBottom: 12, overflow: "hidden" }}>
            <div
              onClick={() => setExpanded((p) => p === v.id ? null : v.id)}
              style={{ padding: "14px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
            >
              <div style={{ font: "700 13px 'JetBrains Mono', monospace", color: "#C8F000", width: 36, flex: "none" }}>
                v{v.version}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ font: "600 13px Inter, sans-serif", color: "#fff" }}>{v.reason ?? "Plan snapshot"}</div>
                <div style={{ font: "500 11px Inter, sans-serif", color: "#4a5568", marginTop: 3 }}>{fmt(v.createdAt)}</div>
              </div>
              <Badge color={isOrgEdit ? "#F59E0B" : "#2A6FDB"}>{isOrgEdit ? "ORGANIZER" : "STAFF"}</Badge>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7D8799" strokeWidth="2" strokeLinecap="round">
                <path d={expanded === v.id ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
              </svg>
            </div>

            {expanded === v.id && snap && isOrgEdit && (
              <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", padding: "16px 20px" }}>
                <div style={{ font: "600 12px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginBottom: 12 }}>CHANGES</div>
                {["title", "summary", "expectedGuests"].map((field) => {
                  const before = (snap.before as Record<string, unknown>)?.[field];
                  const after = (snap.after as Record<string, unknown>)?.[field];
                  if (before === after) return null;
                  return (
                    <div key={field} style={{ marginBottom: 10 }}>
                      <div style={{ font: "500 11px Inter, sans-serif", color: "#4a5568", marginBottom: 4 }}>{field}</div>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <div style={{ flex: 1, background: "#EF444411", borderRadius: 6, padding: "6px 10px", font: "500 13px Inter, sans-serif", color: "#EF4444" }}>
                          {String(before ?? "—")}
                        </div>
                        <div style={{ color: "#7D8799" }}>→</div>
                        <div style={{ flex: 1, background: "#22C55E11", borderRadius: 6, padding: "6px 10px", font: "500 13px Inter, sans-serif", color: "#22C55E" }}>
                          {String(after ?? "—")}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Scan tab ─────────────────────────────────────────────────────────────────

function ScanTab({ eventId }: { eventId: string }) {
  const [token, setToken] = useState("");
  const [result, setResult] = useState<{ valid: boolean; alreadyCheckedIn: boolean; guestName: string | null; ticketStatus: string; message: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Try to use browser camera QR scanning via ZXing if available
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  async function scan() {
    if (!token.trim()) return;
    setScanning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/organizer/events/${eventId}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Scan failed");
      setResult(j);
      setToken("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function startCamera() {
    setCameraError(null);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const codeReader = new BrowserQRCodeReader();
      const devices = await BrowserQRCodeReader.listVideoInputDevices();
      if (devices.length === 0) { setCameraError("No camera found"); return; }
      setCameraActive(true);

      codeReader.decodeFromVideoDevice(devices[0].deviceId, videoRef.current!, async (result) => {
        if (result) {
          const t = result.getText();
          setToken(t);
          setCameraActive(false);

          setScanning(true);
          try {
            const res = await fetch(`/api/organizer/events/${eventId}/scan`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: t }),
            });
            const j = await res.json();
            setResult(j);
          } catch { setError("Scan failed"); } finally { setScanning(false); }
        }
      });
    } catch (e) {
      setCameraError(e instanceof Error ? e.message : "Camera error");
      setCameraActive(false);
    }
  }

  const resultColor = result?.valid ? "#22C55E" : result?.alreadyCheckedIn ? "#F59E0B" : "#EF4444";

  return (
    <div>
      <div style={{ font: "700 18px Inter, sans-serif", color: "#fff", marginBottom: 20 }}>Ticket Check-In</div>

      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && scan()}
          placeholder="Paste or scan ticket token…"
          style={{
            flex: 1,
            minWidth: 240,
            padding: "11px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,.12)",
            background: "#0D0D12",
            color: "#fff",
            font: "500 14px Inter, sans-serif",
          }}
        />
        <Btn accent onClick={scan} disabled={scanning || !token.trim()}>
          {scanning ? "Scanning…" : "Check in"}
        </Btn>
        <Btn onClick={startCamera}>Use camera</Btn>
      </div>

      {cameraError && <div style={{ color: "#EF4444", font: "500 13px Inter, sans-serif", marginBottom: 12 }}>{cameraError}</div>}

      {cameraActive && (
        <div style={{ marginBottom: 20, border: "1px solid rgba(200,240,0,.3)", borderRadius: 14, overflow: "hidden", maxWidth: 400 }}>
          <video ref={videoRef} style={{ width: "100%", display: "block" }} autoPlay playsInline muted />
          <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ font: "500 12px Inter, sans-serif", color: "#7D8799" }}>Scanning…</span>
            <button onClick={() => setCameraActive(false)} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", font: "500 12px Inter, sans-serif" }}>Stop</button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ border: "1px solid #EF4444", borderRadius: 12, padding: "16px 20px", color: "#EF4444", font: "500 14px Inter, sans-serif", marginBottom: 16 }}>
          {error}
        </div>
      )}

      {result && (
        <div
          style={{
            border: `1px solid ${resultColor}44`,
            borderRadius: 14,
            padding: "20px 24px",
            background: resultColor + "0d",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: resultColor + "22",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "none",
            }}
          >
            {result.valid ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={resultColor} strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={resultColor} strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            )}
          </div>
          <div>
            <div style={{ font: "700 16px Inter, sans-serif", color: resultColor }}>{result.message}</div>
            {result.guestName && (
              <div style={{ font: "500 13px Inter, sans-serif", color: "#7D8799", marginTop: 4 }}>Guest: {result.guestName}</div>
            )}
            <div style={{ font: "500 12px Inter, sans-serif", color: "#4a5568", marginTop: 2 }}>Status: {result.ticketStatus}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OrganizerEventManagement({
  event,
  activeTab,
}: {
  event: OrganizerEventDetail;
  activeTab: string;
  identity: OrganizerIdentity;
}) {
  const router = useRouter();
  const color = STATUS_COLOR[event.status] ?? "#7D8799";
  const currentTab = (TABS.find((t) => t.key === activeTab)?.key ?? "details") as TabKey;

  function goTab(key: string) {
    router.push(`/organizer/events/${event.id}?tab=${key}`);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D12", color: "#fff" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,.07)", padding: "24px 32px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          <Link
            href="/organizer/events"
            style={{ color: "#7D8799", font: "500 13px Inter, sans-serif", textDecoration: "none", display: "flex", alignItems: "center", gap: 5, marginTop: 4, flex: "none" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
            My Events
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h1 style={{ font: "700 clamp(20px,3vw,28px)/1.1 Inter, sans-serif", margin: 0, color: "#fff" }}>
                {event.title}
              </h1>
              <Badge color={color}>{event.status}</Badge>
              {!event.editable && <Badge color="#4a5568">Read-only</Badge>}
            </div>
            <div style={{ font: "500 13px Inter, sans-serif", color: "#7D8799", marginTop: 6 }}>
              {event.eventStart ? fmtDate(event.eventStart) : "Date TBD"}
              {event.eventEnd && event.eventEnd !== event.eventStart ? ` – ${fmtDate(event.eventEnd)}` : ""}
              {event.expectedGuests != null ? ` · ${event.expectedGuests} guests` : ""}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, overflowX: "auto" }}>
          {TABS.map((tab) => {
            const active = tab.key === currentTab;
            // Hide guest/scan tabs if event is not public or has no publication
            if (tab.key === "guests" && (!event.isPublic || !event.publication)) return null;
            if (tab.key === "scan" && !event.publication) return null;
            if (tab.key === "timeline" && !event.editable) return null;
            return (
              <button
                key={tab.key}
                onClick={() => goTab(tab.key)}
                style={{
                  padding: "12px 20px",
                  border: "none",
                  borderBottom: active ? "2px solid #C8F000" : "2px solid transparent",
                  background: "none",
                  color: active ? "#C8F000" : "#7D8799",
                  font: `${active ? 600 : 500} 13px Inter, sans-serif`,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "color .15s",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ padding: "28px 32px", maxWidth: 900 }}>
        {currentTab === "details" && <DetailsTab event={event} eventId={event.id} />}
        {currentTab === "guests" && <GuestsTab eventId={event.id} isPublic={event.isPublic} />}
        {currentTab === "timeline" && (
          <TimelineTab eventId={event.id} editable={event.editable} event={event} />
        )}
        {currentTab === "bills" && <BillsTab eventId={event.id} />}
        {currentTab === "versions" && <VersionsTab eventId={event.id} />}
        {currentTab === "scan" && <ScanTab eventId={event.id} />}
      </div>
    </div>
  );
}
