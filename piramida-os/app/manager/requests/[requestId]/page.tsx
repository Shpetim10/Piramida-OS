"use client";

import { use } from "react";
import Link from "next/link";
import { ScreenContainer, useMgrViewport } from "@/components/manager/ScreenContainer";
import {
  REQUEST_TABS,
  REQUEST_RAW,
  REQUEST_ATTACH,
  REQUEST_FIELDS,
  REQUEST_CHIPS,
  REQUEST_MISSING,
  FOCUS_EVENT_ID,
} from "@/lib/manager/data";

export default function Page({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = use(params);
  const { isMobile } = useMgrViewport();
  const reqCols = isMobile ? "1fr" : "1fr 1.05fr";
  const id = requestId || FOCUS_EVENT_ID;
  const activeTab = REQUEST_TABS.findIndex((t) => t.id === id);
  const active = activeTab < 0 ? 0 : activeTab;

  return (
    <ScreenContainer>
      {/* Request tabs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        {REQUEST_TABS.map((t, i) => {
          const on = i === active;
          return (
            <Link
              key={t.id}
              href={`/manager/requests/${t.id}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                padding: "10px 15px",
                borderRadius: 11,
                border: `1px solid ${on ? "rgba(200,240,0,.4)" : "rgba(255,255,255,.1)"}`,
                background: on ? "rgba(200,240,0,.07)" : "#151821",
                color: on ? "#fff" : "#AEB5C2",
                font: "600 13px Inter, sans-serif",
                cursor: "pointer",
                textDecoration: "none",
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.c, boxShadow: `0 0 7px ${t.c}` }} />
              {t.label}
            </Link>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: reqCols, gap: 18, alignItems: "start" }}>
        {/* Left — raw organizer request */}
        <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#C53A6B,#1D2230)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 12px Inter, sans-serif", color: "#fff", flex: "none" }}>SK</div>
            <div style={{ flex: 1 }}>
              <div style={{ font: "600 13px Inter, sans-serif", color: "#fff" }}>Sara Kelmendi · Lumen Labs</div>
              <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 2 }}>SUBMITTED 18 JUN · ORGANIZER</div>
            </div>
            <span style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#0D0D12", background: "#C8F000", padding: "5px 9px", borderRadius: 7 }}>RAW REQUEST</span>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em", marginBottom: 10 }}>ORGANIZER&apos;S WORDS</div>
            <p style={{ font: "400 15px/1.7 Inter, sans-serif", color: "#E6E9EF", margin: "0 0 20px", textWrap: "pretty" }}>{REQUEST_RAW}</p>
            <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em", marginBottom: 10 }}>ATTACHED</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {REQUEST_ATTACH.map((f) => (
                <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", border: "1px solid rgba(255,255,255,.07)", borderRadius: 11, background: "#0F1218" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" stroke="#7D8799" strokeWidth="1.6" fill="none"><path d="M5 4h11l3 3v13H5z" /><path d="M15 4v4h4" /></svg>
                  <span style={{ font: "500 12px Inter, sans-serif", color: "#AEB5C2", flex: 1 }}>{f.name}</span>
                  <span style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#525B6B" }}>{f.size}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — AI structured understanding */}
        <div style={{ border: "1px solid rgba(200,240,0,.22)", borderRadius: 18, background: "radial-gradient(560px 320px at 80% 0%,rgba(200,240,0,.06),#151821)", overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(200,240,0,.12)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" stroke="#C8F000" strokeWidth="1.7" fill="none" strokeLinecap="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" /></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ font: "700 13px Inter, sans-serif", color: "#fff" }}>AI Structured Understanding</div>
              <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 2 }}>PARSED FROM RAW REQUEST</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ font: "800 18px/1 Inter, sans-serif", color: "#C8F000" }}>94%</div>
              <div style={{ font: "600 8px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>CONFIDENCE</div>
            </div>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {REQUEST_FIELDS.map((f) => (
                <div key={f.k} style={{ padding: 13, border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, background: "#0F1218" }}>
                  <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginBottom: 6 }}>{f.k}</div>
                  <div style={{ font: "700 14px Inter, sans-serif", color: "#fff" }}>{f.v}</div>
                </div>
              ))}
            </div>
            <div style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em", marginBottom: 9 }}>DETECTED REQUIREMENTS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
              {REQUEST_CHIPS.map((c) => (
                <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 8, background: "rgba(200,240,0,.07)", border: "1px solid rgba(200,240,0,.18)", font: "600 11px Inter, sans-serif", color: "#E6E9EF" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#C8F000" }} />
                  {c}
                </span>
              ))}
            </div>
            <div style={{ padding: 14, border: "1px solid rgba(245,158,11,.3)", borderRadius: 12, background: "rgba(245,158,11,.05)", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" stroke="#F59E0B" strokeWidth="2" fill="none" strokeLinecap="round"><path d="M12 8v5M12 17v.5" /><circle cx="12" cy="12" r="9" /></svg>
                <span style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#F59E0B", letterSpacing: ".1em" }}>MISSING INFORMATION</span>
              </div>
              {REQUEST_MISSING.map((m) => (
                <div key={m} style={{ font: "500 12px/1.5 Inter, sans-serif", color: "#AEB5C2" }}>• {m}</div>
              ))}
            </div>
            <Link
              href={`/manager/events/${id}/understand`}
              style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, padding: 15, border: "none", borderRadius: 12, background: "#C8F000", color: "#0D0D12", font: "700 14px Inter, sans-serif", cursor: "pointer", boxShadow: "0 8px 26px rgba(200,240,0,.22)", textDecoration: "none", boxSizing: "border-box" }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"><path d="M5 3l2.5 5L13 10.5 7.5 13 5 18l-2.5-5L-3 10.5" /><path d="M5 3l2.5 5L13 10.5 7.5 13 5 18l-2.5-5L-3 10.5" transform="translate(13 3)" /></svg>
              Generate Event &amp; Build Plan
            </Link>
          </div>
        </div>
      </div>
    </ScreenContainer>
  );
}
