"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminScreen, useAdminViewport } from "@/components/admin/AdminScreen";
import { STAFF, ROLE_COLOR, staffSlug } from "@/lib/admin/data";

export default function StaffManagementPage() {
  const { isMobile, isNarrow } = useAdminViewport();
  const [disabled, setDisabled] = useState<Record<string, boolean>>({});

  const staffCols = isNarrow ? "1.5fr 1fr 0.8fr" : isMobile ? "1.5fr 1fr 0.8fr" : "1.8fr 1.1fr 0.8fr 0.9fr 1fr";
  const hide: React.CSSProperties = isMobile ? { display: "none" } : {};

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
          <div style={hide}>LAST ACTIVE</div>
          <div style={{ textAlign: "right" }}>ACTIONS</div>
        </div>
        {STAFF.map((s) => {
          const isDisabled = disabled[s.name] !== undefined ? disabled[s.name] : !!s.baseDisabled;
          const rc = ROLE_COLOR[s.role] || "#7D8799";
          return (
            <div key={s.name} style={{ display: "grid", gridTemplateColumns: staffCols, gap: 12, alignItems: "center", padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,.05)", opacity: isDisabled ? 0.5 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <span style={{ width: 34, height: 34, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", font: "700 11px Inter, sans-serif", color: s.ini === "EK" ? "#0D0D12" : "#fff", background: s.c }}>
                  {s.ini}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: "600 13px Inter, sans-serif", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                  <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 2 }}>{s.email}</div>
                </div>
              </div>
              <div>
                <span style={{ display: "inline-block", font: "700 9px 'JetBrains Mono', monospace", letterSpacing: ".04em", color: s.role === "Event Manager" ? "#0D0D12" : rc, background: s.role === "Event Manager" ? rc : `${rc}1f`, padding: "5px 9px", borderRadius: 7 }}>
                  {s.role}
                </span>
              </div>
              <div style={hide}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, font: "600 11px Inter, sans-serif", color: isDisabled ? "#7D8799" : "#22C55E" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", flex: "none", background: isDisabled ? "#7D8799" : "#22C55E" }} />
                  {isDisabled ? "Disabled" : "Active"}
                </span>
              </div>
              <div style={{ ...hide, font: "500 11px 'JetBrains Mono', monospace", color: "#7D8799" }}>{s.last}</div>
              <div style={{ display: "flex", gap: 7, justifyContent: "flex-end" }}>
                <Link href={`/admin/users/${staffSlug(s.name)}`} style={{ padding: "7px 11px", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, background: "transparent", color: "#AEB5C2", font: "600 11px Inter, sans-serif", cursor: "pointer", textDecoration: "none" }}>
                  Edit
                </Link>
                <button
                  onClick={() => setDisabled((prev) => ({ ...prev, [s.name]: !isDisabled }))}
                  style={{ padding: "7px 11px", border: `1px solid ${isDisabled ? "rgba(34,197,94,.4)" : "rgba(239,68,68,.35)"}`, borderRadius: 8, background: "transparent", color: isDisabled ? "#22C55E" : "#EF4444", font: "600 11px Inter, sans-serif", cursor: "pointer" }}
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
