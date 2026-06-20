"use client";

import { useEffect, useState } from "react";
import { AdminScreen, useAdminViewport } from "@/components/admin/AdminScreen";
import { LIME } from "@/lib/admin/data";

const A = LIME;

interface OrganizerProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  createdAt: string;
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    client: {
      name: string;
      website: string | null;
      notes: string | null;
    };
  } | null;
}

type Decision = "pending" | "approved" | "rejected";

export default function OrganizerApprovalsPage() {
  const { isMobile } = useAdminViewport();
  const [organizers, setOrganizers] = useState<OrganizerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selId, setSelId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    fetch("/api/admin/organizers")
      .then((r) => r.json())
      .then((data) => {
        setOrganizers(Array.isArray(data) ? data : []);
        if (data.length > 0) setSelId(data[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const statusOf = (id: string): Decision => decisions[id] ?? "pending";

  async function approve(id: string) {
    setActing(true);
    try {
      const res = await fetch(`/api/admin/organizers/${id}/approve`, { method: "POST" });
      if (res.ok) setDecisions((p) => ({ ...p, [id]: "approved" }));
    } finally {
      setActing(false);
    }
  }

  async function reject(id: string) {
    if (!rejectReason.trim()) {
      setShowRejectInput(true);
      return;
    }
    setActing(true);
    try {
      const res = await fetch(`/api/admin/organizers/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (res.ok) {
        setDecisions((p) => ({ ...p, [id]: "rejected" }));
        setShowRejectInput(false);
        setRejectReason("");
      }
    } finally {
      setActing(false);
    }
  }

  const det = organizers.find((o) => o.id === selId);
  const detStt = det ? statusOf(det.id) : "pending";

  const tabs: [string, string, number][] = [
    ["pending", "Pending", organizers.filter((o) => statusOf(o.id) === "pending").length],
    ["approved", "Approved", organizers.filter((o) => statusOf(o.id) === "approved").length],
    ["rejected", "Rejected", organizers.filter((o) => statusOf(o.id) === "rejected").length],
  ];

  if (loading) {
    return (
      <AdminScreen>
        <div style={{ color: "#7D8799", font: "500 14px Inter, sans-serif", padding: 40 }}>
          Loading organizer applications…
        </div>
      </AdminScreen>
    );
  }

  if (organizers.length === 0) {
    return (
      <AdminScreen>
        <div style={{ color: "#7D8799", font: "500 14px Inter, sans-serif", padding: 40 }}>
          No pending organizer applications.
        </div>
      </AdminScreen>
    );
  }

  return (
    <AdminScreen>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 9, marginBottom: 18, flexWrap: "wrap" }}>
        {tabs.map(([, labelText, count]) => {
          const active = labelText === "Pending";
          return (
            <button
              key={labelText}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "9px 15px",
                borderRadius: 100,
                border: `1px solid ${active ? A : "rgba(255,255,255,.12)"}`,
                background: active ? A : "transparent",
                color: active ? "#0D0D12" : "#AEB5C2",
                font: "600 12px Inter, sans-serif",
                cursor: "pointer",
              }}
            >
              {labelText}{" "}
              <span style={{ font: "700 10px 'JetBrains Mono', monospace", marginLeft: 4, color: active ? "#0D0D12" : "#7D8799" }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "0.8fr 1.2fr", gap: 18, alignItems: "start" }}>
        {/* List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {organizers.map((o) => {
            const stt = statusOf(o.id);
            const isSel = selId === o.id;
            const pill = stt === "pending" ? "PENDING" : stt === "approved" ? "APPROVED" : "REJECTED";
            const initials = o.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
            return (
              <button
                key={o.id}
                onClick={() => { setSelId(o.id); setShowRejectInput(false); }}
                style={{
                  border: `1px solid ${isSel ? "rgba(200,240,0,.35)" : "rgba(255,255,255,.07)"}`,
                  borderRadius: 14,
                  background: isSel ? "rgba(200,240,0,.05)" : "#151821",
                  padding: 14,
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 11, width: "100%" }}>
                  <span style={{ width: 38, height: 38, borderRadius: 10, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", font: "700 12px Inter, sans-serif", color: "#fff", background: "linear-gradient(135deg,#C53A6B,#1D2230)" }}>
                    {initials}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <span style={{ display: "block", font: "700 13px Inter, sans-serif", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {o.contact?.client.name ?? o.fullName}
                    </span>
                    <span style={{ display: "block", font: "500 11px Inter, sans-serif", color: "#7D8799", marginTop: 2 }}>{o.fullName}</span>
                  </span>
                  <span
                    style={{
                      font: "700 8px 'JetBrains Mono', monospace",
                      letterSpacing: ".06em",
                      flex: "none",
                      color: stt === "approved" ? "#0D0D12" : stt === "rejected" ? "#EF4444" : "#F59E0B",
                      background: stt === "approved" ? A : stt === "rejected" ? "rgba(239,68,68,.14)" : "rgba(245,158,11,.14)",
                      padding: "4px 7px",
                      borderRadius: 6,
                    }}
                  >
                    {pill}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail */}
        {det && (
          <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, background: "#151821", overflow: "hidden", position: "sticky", top: 18 }}>
            <div style={{ padding: 22, borderBottom: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ width: 48, height: 48, borderRadius: 13, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", font: "700 15px Inter, sans-serif", color: "#fff", background: "linear-gradient(135deg,#C53A6B,#1D2230)" }}>
                {det.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "800 18px Inter, sans-serif", color: "#fff", letterSpacing: "-.01em" }}>
                  {det.contact?.client.name ?? det.fullName}
                </div>
                <div style={{ font: "500 12px 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 3 }}>
                  {det.contact?.client.website ?? det.email}
                </div>
              </div>
            </div>

            <div style={{ padding: 22 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                <div style={{ padding: 13, border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, background: "#0F1218" }}>
                  <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginBottom: 6 }}>ORGANIZER</div>
                  <div style={{ font: "700 14px Inter, sans-serif", color: "#fff" }}>{det.fullName}</div>
                  <div style={{ font: "500 11px Inter, sans-serif", color: "#7D8799", marginTop: 2 }}>{det.email}</div>
                </div>
                <div style={{ padding: 13, border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, background: "#0F1218" }}>
                  <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginBottom: 6 }}>SUBMITTED</div>
                  <div style={{ font: "700 14px Inter, sans-serif", color: "#fff" }}>
                    {new Date(det.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                  <div style={{ font: "500 11px Inter, sans-serif", color: "#7D8799", marginTop: 2 }}>{det.phone ?? "No phone"}</div>
                </div>
              </div>

              {det.contact?.client.notes && (
                <>
                  <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em", marginBottom: 9 }}>
                    ORGANIZATION DESCRIPTION
                  </div>
                  <p style={{ font: "400 14px/1.7 Inter, sans-serif", color: "#E6E9EF", margin: "0 0 20px", textWrap: "pretty" }}>
                    &ldquo;{det.contact.client.notes}&rdquo;
                  </p>
                </>
              )}

              {/* Reject reason input */}
              {showRejectInput && detStt === "pending" && (
                <div style={{ marginBottom: 14 }}>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection…"
                    style={{ width: "100%", minHeight: 80, padding: 12, borderRadius: 10, border: "1px solid rgba(239,68,68,.4)", background: "rgba(239,68,68,.06)", color: "#fff", font: "400 13px Inter, sans-serif", resize: "none", boxSizing: "border-box" }}
                  />
                </div>
              )}

              {detStt === "pending" ? (
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => approve(det.id)}
                    disabled={acting}
                    style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, border: "none", borderRadius: 12, background: acting ? "#555" : A, color: "#0D0D12", font: "700 14px Inter, sans-serif", cursor: acting ? "default" : "pointer", boxShadow: acting ? "none" : "0 6px 20px rgba(200,240,0,.2)" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
                    Approve organizer
                  </button>
                  <button
                    onClick={() => reject(det.id)}
                    disabled={acting}
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 20px", border: "1px solid rgba(239,68,68,.4)", borderRadius: 12, background: "rgba(239,68,68,.06)", color: "#EF4444", font: "700 14px Inter, sans-serif", cursor: acting ? "default" : "pointer" }}
                  >
                    {showRejectInput ? "Confirm reject" : "Reject"}
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    padding: 15,
                    borderRadius: 12,
                    textAlign: "center",
                    font: "700 14px Inter, sans-serif",
                    color: detStt === "approved" ? "#0D0D12" : "#EF4444",
                    background: detStt === "approved" ? A : "rgba(239,68,68,.08)",
                    border: `1px solid ${detStt === "approved" ? A : "rgba(239,68,68,.3)"}`,
                  }}
                >
                  {detStt === "approved" ? "✓ Organizer approved — access granted" : "✕ Application rejected"}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminScreen>
  );
}
