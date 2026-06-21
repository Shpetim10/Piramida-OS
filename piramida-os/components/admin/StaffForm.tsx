"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminScreen, useAdminViewport } from "@/components/admin/AdminScreen";
import { ASSIGNABLE_ROLES } from "@/lib/admin/data";

const A = "#C8F000";

const fieldLabel: React.CSSProperties = {
  font: "600 9px 'JetBrains Mono', monospace",
  color: "#7D8799",
  letterSpacing: ".1em",
  marginBottom: 7,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 13px",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 10,
  background: "#0F1218",
  font: "500 13px Inter, sans-serif",
  color: "#fff",
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none",
  WebkitAppearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' stroke='%237D8799' stroke-width='2' fill='none' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  paddingRight: 36,
  border: "1px solid rgba(200,240,0,.3)",
  cursor: "pointer",
};

export function StaffForm({
  mode,
  profileId,
  initialName = "",
  initialEmail = "",
  initialRole = "EVENT_MANAGER",
}: {
  mode: "create" | "edit";
  profileId?: string;
  initialName?: string;
  initialEmail?: string;
  initialRole?: string;
}) {
  const { isMobile } = useAdminViewport();
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [roleCode, setRoleCode] = useState(initialRole);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = mode === "edit";

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) { setError("Full name is required."); return; }
    if (!email.trim()) { setError("Email is required."); return; }

    setSaving(true);
    try {
      const url = isEdit && profileId ? `/api/admin/staff/${profileId}` : "/api/admin/staff";
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit
        ? JSON.stringify({ fullName: name.trim() })
        : JSON.stringify({ fullName: name.trim(), email: email.trim(), roleCode });

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `Error ${res.status}`);
        return;
      }
      router.push("/admin/users");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminScreen>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <Link href="/admin/users" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 13px", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, background: "transparent", color: "#AEB5C2", font: "600 12px Inter, sans-serif", textDecoration: "none" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          Staff
        </Link>
      </div>

      <div style={{ border: "1px solid rgba(200,240,0,.25)", borderRadius: 16, background: "radial-gradient(500px 240px at 100% 0%,rgba(200,240,0,.05),#151821)", padding: 22, maxWidth: 920 }}>
        <div style={{ font: "700 14px Inter, sans-serif", color: "#fff", marginBottom: 16 }}>
          {isEdit ? `Edit ${initialName || "staff account"}` : "New staff account"}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: error ? 12 : 18 }}>
          <div>
            <div style={fieldLabel}>FULL NAME</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Arben Doci" style={inputStyle} />
          </div>
          <div>
            <div style={fieldLabel}>EMAIL</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@pyramid.al"
              readOnly={isEdit}
              style={{ ...inputStyle, ...(isEdit ? { opacity: 0.6, cursor: "not-allowed" } : {}) }}
            />
          </div>
          <div>
            <div style={fieldLabel}>ROLE</div>
            <select value={roleCode} onChange={(e) => setRoleCode(e.target.value)} style={selectStyle}>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r.code} value={r.code} style={{ background: "#0F1218" }}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div style={{ font: "500 12px Inter, sans-serif", color: "#EF4444", marginBottom: 14, padding: "10px 13px", borderRadius: 9, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", border: "none", borderRadius: 11, background: saving ? "rgba(200,240,0,.5)" : A, color: "#0D0D12", font: "700 13px Inter, sans-serif", cursor: saving ? "not-allowed" : "pointer" }}
          >
            {saving ? "Creating…" : isEdit ? "Save changes" : "Create account"}
          </button>
          <Link href="/admin/users" style={{ padding: "12px 18px", border: "1px solid rgba(255,255,255,.12)", borderRadius: 11, background: "transparent", color: "#AEB5C2", font: "600 13px Inter, sans-serif", cursor: "pointer", textDecoration: "none" }}>
            Cancel
          </Link>
        </div>
      </div>
    </AdminScreen>
  );
}
