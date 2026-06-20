"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminScreen, useAdminViewport } from "@/components/admin/AdminScreen";
import { ROLE_COLOR } from "@/lib/admin/data";

interface StaffProfile {
  id: string;
  fullName: string;
  email: string;
  status: string;
  updatedAt: string;
  profileRoles: { role: { code: string; label: string } }[];
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function avatarColor(code: string): string {
  const map: Record<string, string> = {
    EVENT_MANAGER: "#C8F000",
    OPERATIONS_MANAGER: "#2A6FDB",
    TECHNICIAN: "#C0612A",
    ADMIN: "#EF4444",
    SUPER_ADMIN: "#EF4444",
  };
  return map[code] ?? "#7D8799";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
}

export default function StaffManagementPage() {
  const { isMobile, isNarrow } = useAdminViewport();
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const staffCols = isNarrow ? "1.5fr 1fr 0.8fr" : isMobile ? "1.5fr 1fr 0.8fr" : "1.8fr 1.1fr 0.8fr 0.9fr 1fr";
  const hide: React.CSSProperties = isMobile ? { display: "none" } : {};

  useEffect(() => {
    fetch("/api/admin/staff")
      .then((r) => r.json())
      .then((d) => setStaff(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggleStatus(s: StaffProfile) {
    const nextStatus = s.status === "DISABLED" ? "ACTIVE" : "DISABLED";
    setTogglingId(s.id);
    try {
      const res = await fetch(`/api/admin/staff/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setStaff((prev) =>
          prev.map((m) => (m.id === s.id ? { ...m, status: nextStatus } : m))
        );
      }
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <AdminScreen>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <p style={{ font: "400 14px/1.5 Inter, sans-serif", color: "#AEB5C2", margin: 0, maxWidth: 440 }}>
          Create, edit and disable staff accounts, and assign each one an operational role.
        </p>
        <Link href="/admin/users/new" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 18px", border: "none", borderRadius: 11, background: "#C8F000", color: "#0D0D12", font: "700 13px Inter, sans-serif", cursor: "pointer", flex: "none", boxShadow: "0 6px 20px rgba(200,240,0,.18)", textDecoration: "none" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Create Staff
        </Link>
      </div>

      <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: staffCols, gap: 12, padding: "13px 20px", borderBottom: "1px solid rgba(255,255,255,.07)", font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>
          <div>STAFF MEMBER</div>
          <div>ROLE</div>
          <div style={hide}>STATUS</div>
          <div style={hide}>LAST UPDATED</div>
          <div style={{ textAlign: "right" }}>ACTIONS</div>
        </div>

        {loading && (
          <div style={{ padding: "32px 20px", font: "500 13px Inter, sans-serif", color: "#7D8799", textAlign: "center" }}>
            Loading staff…
          </div>
        )}

        {!loading && staff.length === 0 && (
          <div style={{ padding: "32px 20px", font: "500 13px Inter, sans-serif", color: "#7D8799", textAlign: "center" }}>
            No staff accounts yet.
          </div>
        )}

        {staff.map((s) => {
          const roleEntry = s.profileRoles[0]?.role;
          const roleLabel = roleEntry?.label ?? "—";
          const roleCode = roleEntry?.code ?? "";
          const rc = ROLE_COLOR[roleLabel] ?? avatarColor(roleCode);
          const isDisabled = s.status === "DISABLED";
          const toggling = togglingId === s.id;
          const ini = initials(s.fullName);
          const avatarBg = avatarColor(roleCode);

          return (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: staffCols, gap: 12, alignItems: "center", padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,.05)", opacity: isDisabled ? 0.5 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <span style={{ width: 34, height: 34, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", font: "700 11px Inter, sans-serif", color: roleCode === "EVENT_MANAGER" ? "#0D0D12" : "#fff", background: avatarBg }}>
                  {ini}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: "600 13px Inter, sans-serif", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.fullName}</div>
                  <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 2 }}>{s.email}</div>
                </div>
              </div>
              <div>
                <span style={{ display: "inline-block", font: "700 9px 'JetBrains Mono', monospace", letterSpacing: ".04em", color: roleLabel === "Event Manager" ? "#0D0D12" : rc, background: roleLabel === "Event Manager" ? rc : `${rc}1f`, padding: "5px 9px", borderRadius: 7 }}>
                  {roleLabel}
                </span>
              </div>
              <div style={hide}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, font: "600 11px Inter, sans-serif", color: isDisabled ? "#7D8799" : "#22C55E" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", flex: "none", background: isDisabled ? "#7D8799" : "#22C55E" }} />
                  {s.status === "INVITED" ? "Invited" : isDisabled ? "Disabled" : "Active"}
                </span>
              </div>
              <div style={{ ...hide, font: "500 11px 'JetBrains Mono', monospace", color: "#7D8799" }}>
                {formatDate(s.updatedAt)}
              </div>
              <div style={{ display: "flex", gap: 7, justifyContent: "flex-end" }}>
                <Link href={`/admin/users/${s.id}`} style={{ padding: "7px 11px", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, background: "transparent", color: "#AEB5C2", font: "600 11px Inter, sans-serif", cursor: "pointer", textDecoration: "none" }}>
                  Edit
                </Link>
                <button
                  onClick={() => toggleStatus(s)}
                  disabled={toggling}
                  style={{ padding: "7px 11px", border: `1px solid ${isDisabled ? "rgba(34,197,94,.4)" : "rgba(239,68,68,.35)"}`, borderRadius: 8, background: "transparent", color: isDisabled ? "#22C55E" : "#EF4444", font: "600 11px Inter, sans-serif", cursor: toggling ? "not-allowed" : "pointer", opacity: toggling ? 0.6 : 1 }}
                >
                  {isDisabled ? "Enable" : "Disable"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </AdminScreen>
  );
}
