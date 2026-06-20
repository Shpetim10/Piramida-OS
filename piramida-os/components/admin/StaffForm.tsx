"use client";

import Link from "next/link";
import { useState } from "react";
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

export function StaffForm({
  mode,
  initialName = "",
  initialEmail = "",
  initialRole = "Event Manager",
}: {
  mode: "create" | "edit";
  initialName?: string;
  initialEmail?: string;
  initialRole?: string;
}) {
  const { isMobile } = useAdminViewport();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [role, setRole] = useState(initialRole);

  const isEdit = mode === "edit";

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

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={fieldLabel}>FULL NAME</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Arben Doci" style={inputStyle} />
          </div>
          <div>
            <div style={fieldLabel}>EMAIL</div>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@pyramid.al" style={inputStyle} />
          </div>
          <div>
            <div style={fieldLabel}>ROLE</div>
            <div style={{ padding: "12px 13px", border: "1px solid rgba(200,240,0,.3)", borderRadius: 10, background: "#0F1218", font: "600 13px Inter, sans-serif", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              {role}
              <svg width="14" height="14" viewBox="0 0 24 24" stroke="#7D8799" strokeWidth="2" fill="none" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 18 }}>
          {ASSIGNABLE_ROLES.map((r) => {
            const active = role === r;
            return (
              <button
                key={r}
                onClick={() => setRole(r)}
                style={{ padding: "8px 13px", borderRadius: 9, border: `1px solid ${active ? A : "rgba(255,255,255,.12)"}`, background: active ? "rgba(200,240,0,.08)" : "transparent", color: active ? "#fff" : "#AEB5C2", font: "600 12px Inter, sans-serif", cursor: "pointer" }}
              >
                {r}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin/users" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", border: "none", borderRadius: 11, background: A, color: "#0D0D12", font: "700 13px Inter, sans-serif", cursor: "pointer", textDecoration: "none" }}>
            {isEdit ? "Save changes" : "Create account"}
          </Link>
          <Link href="/admin/users" style={{ padding: "12px 18px", border: "1px solid rgba(255,255,255,.12)", borderRadius: 11, background: "transparent", color: "#AEB5C2", font: "600 13px Inter, sans-serif", cursor: "pointer", textDecoration: "none" }}>
            Cancel
          </Link>
        </div>
      </div>
    </AdminScreen>
  );
}
