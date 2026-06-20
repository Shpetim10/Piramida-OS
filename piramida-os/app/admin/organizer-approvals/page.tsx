"use client";

import { useState } from "react";
import { AdminScreen, useAdminViewport } from "@/components/admin/AdminScreen";
import { ORGANIZER_APPLICATIONS as APPS, LIME } from "@/lib/admin/data";

const A = LIME;
type Decision = "pending" | "approved" | "rejected";

export default function OrganizerApprovalsPage() {
  const { isMobile } = useAdminViewport();
  const [selApp, setSelApp] = useState("lumen");
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});

  const statusOf = (id: string): Decision => decisions[id] || "pending";
  const decide = (id: string, d: Decision) => setDecisions((prev) => ({ ...prev, [id]: d }));

  const det = APPS.find((a) => a.id === selApp) || APPS[0];
  const detStt = statusOf(det.id);

  const tabs: [string, string, number][] = [
    ["pending", "Pending", APPS.filter((a) => statusOf(a.id) === "pending").length],
    ["approved", "Approved", APPS.filter((a) => statusOf(a.id) === "approved").length],
    ["rejected", "Rejected", APPS.filter((a) => statusOf(a.id) === "rejected").length],
  ];

  return (
    <AdminScreen>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 9, marginBottom: 18, flexWrap: "wrap" }}>
        {tabs.map(([, labelText, count], i) => {
          const active = i === 0;
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
              <span style={{ font: "700 10px 'JetBrains Mono', monospace", marginLeft: 4, color: active ? "#0D0D12" : "#7D8799" }}>{count}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "0.8fr 1.2fr", gap: 18, alignItems: "start" }}>
        {/* List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {APPS.map((a) => {
            const stt = statusOf(a.id);
            const isSel = selApp === a.id;
            const pill = stt === "pending" ? "PENDING" : stt === "approved" ? "APPROVED" : "REJECTED";
            return (
              <button
                key={a.id}
                onClick={() => setSelApp(a.id)}
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
                  <span style={{ width: 38, height: 38, borderRadius: 10, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", font: "700 12px Inter, sans-serif", color: "#fff", background: `linear-gradient(135deg,${a.c},#1D2230)` }}>
                    {a.initials}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <span style={{ display: "block", font: "700 13px Inter, sans-serif", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.company}</span>
                    <span style={{ display: "block", font: "500 11px Inter, sans-serif", color: "#7D8799", marginTop: 2 }}>{a.org}</span>
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
        <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, background: "#151821", overflow: "hidden", position: "sticky", top: 18 }}>
          <div style={{ padding: 22, borderBottom: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 48, height: 48, borderRadius: 13, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", font: "700 15px Inter, sans-serif", color: "#fff", background: `linear-gradient(135deg,${det.c},#1D2230)` }}>
              {det.initials}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "800 18px Inter, sans-serif", color: "#fff", letterSpacing: "-.01em" }}>{det.company}</div>
              <div style={{ font: "500 12px 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 3 }}>{det.site} · {det.size}</div>
            </div>
            <span style={{ font: "700 9px 'JetBrains Mono', monospace", letterSpacing: ".06em", flex: "none", color: det.verified ? "#22C55E" : "#F59E0B", background: det.verified ? "rgba(34,197,94,.12)" : "rgba(245,158,11,.12)", padding: "6px 10px", borderRadius: 8 }}>
              {det.verified ? "✓ VERIFIED" : "⚠ UNVERIFIED"}
            </span>
          </div>
          <div style={{ padding: 22 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
              <div style={{ padding: 13, border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, background: "#0F1218" }}>
                <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginBottom: 6 }}>ORGANIZER</div>
                <div style={{ font: "700 14px Inter, sans-serif", color: "#fff" }}>{det.org}</div>
                <div style={{ font: "500 11px Inter, sans-serif", color: "#7D8799", marginTop: 2 }}>{det.title}</div>
              </div>
              <div style={{ padding: 13, border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, background: "#0F1218" }}>
                <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginBottom: 6 }}>HISTORY</div>
                <div style={{ font: "700 14px Inter, sans-serif", color: "#fff" }}>{det.prev}</div>
                <div style={{ font: "500 11px Inter, sans-serif", color: "#7D8799", marginTop: 2 }}>Submitted {det.submitted}</div>
              </div>
            </div>
            <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em", marginBottom: 9 }}>REQUEST REASON</div>
            <p style={{ font: "400 14px/1.7 Inter, sans-serif", color: "#E6E9EF", margin: "0 0 20px", textWrap: "pretty" }}>&ldquo;{det.reason}&rdquo;</p>

            {detStt === "pending" ? (
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => decide(det.id, "approved")} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, border: "none", borderRadius: 12, background: A, color: "#0D0D12", font: "700 14px Inter, sans-serif", cursor: "pointer", boxShadow: "0 6px 20px rgba(200,240,0,.2)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
                  Approve organizer
                </button>
                <button onClick={() => decide(det.id, "rejected")} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 20px", border: "1px solid rgba(239,68,68,.4)", borderRadius: 12, background: "rgba(239,68,68,.06)", color: "#EF4444", font: "700 14px Inter, sans-serif", cursor: "pointer" }}>
                  Reject
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
      </div>
    </AdminScreen>
  );
}
