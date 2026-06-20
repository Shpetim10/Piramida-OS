"use client";

import Link from "next/link";
import { ScreenContainer } from "@/components/manager/ScreenContainer";
import { REQUEST_LIST } from "@/lib/manager/data";

export default function Page() {
  return (
    <ScreenContainer>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <p style={{ font: "400 14px/1.5 Inter, sans-serif", color: "#AEB5C2", margin: 0, maxWidth: 480 }}>
          Two organizer requests awaiting review. Open one to see the AI-structured understanding before generating an event.
        </p>
        <div style={{ textAlign: "right" }}>
          <div style={{ font: "800 22px/1 Inter, sans-serif", color: "#F59E0B" }}>{REQUEST_LIST.length}</div>
          <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>PENDING</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {REQUEST_LIST.map((r) => (
          <Link
            key={r.id}
            href={`/manager/requests/${r.id}`}
            style={{ display: "flex", alignItems: "center", gap: 14, padding: 18, border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", textDecoration: "none" }}
          >
            <div style={{ width: 42, height: 42, borderRadius: "50%", background: `linear-gradient(135deg,${r.c},#1D2230)`, display: "flex", alignItems: "center", justifyContent: "center", font: "700 14px Inter, sans-serif", color: "#fff", flex: "none" }}>
              {r.initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "600 14px Inter, sans-serif", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.organizer} · {r.company}
              </div>
              <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 3 }}>
                SUBMITTED {r.submitted} · ORGANIZER
              </div>
            </div>
            <span style={{ font: "600 10px 'JetBrains Mono', monospace", letterSpacing: ".06em", color: r.status === "RAW REQUEST" ? "#0D0D12" : "#fff", background: r.status === "RAW REQUEST" ? "#C8F000" : "#1A1F2B", padding: "5px 9px", borderRadius: 7, flex: "none" }}>
              {r.status}
            </span>
            <div style={{ textAlign: "right", flex: "none", width: 56 }}>
              <div style={{ font: "800 18px/1 Inter, sans-serif", color: "#fff" }}>{r.guests}</div>
              <div style={{ font: "600 8px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em", marginTop: 3 }}>GUESTS</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" stroke="#7D8799" strokeWidth="2" fill="none" strokeLinecap="round" style={{ flex: "none" }}><path d="M9 6l6 6-6 6" /></svg>
          </Link>
        ))}
      </div>
    </ScreenContainer>
  );
}
