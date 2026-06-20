"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

interface TicketData {
  token: string;
  status: string;
  guestName: string;
  issuedAt: string;
}

export default function TicketPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/public/tickets/${encodeURIComponent(token)}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        if (!r.ok) return r.json().then((d: { error?: string }) => Promise.reject(d.error ?? "Failed"));
        return r.json();
      })
      .then((data: TicketData | null) => { if (data) setTicket(data); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const isCheckedIn = ticket?.status === "CHECKED_IN";
  const isCancelled = ticket?.status === "CANCELLED";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {loading && (
          <div style={{ textAlign: "center", font: "500 14px Inter, sans-serif", color: "#7D8799" }}>
            Loading ticket…
          </div>
        )}

        {notFound && (
          <div style={{ textAlign: "center" }}>
            <div style={{ font: "700 20px Inter, sans-serif", color: "#fff", marginBottom: 10 }}>Ticket not found</div>
            <Link href="/events" style={{ color: "#C8F000", font: "600 13px Inter, sans-serif" }}>Browse events →</Link>
          </div>
        )}

        {ticket && (
          <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 24, background: "#151821", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ padding: "28px 28px 20px", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 18 }}>
                <svg width="28" height="28" viewBox="0 0 34 34" fill="none">
                  <polygon points="17,4 31,29 3,29" stroke="#C8F000" strokeWidth="1.7" />
                  <polygon points="17,4 24,16.5 10,16.5" fill="#C8F000" />
                </svg>
                <div>
                  <div style={{ font: "800 14px/1 Inter, sans-serif", color: "#fff" }}>Pyramid OS</div>
                  <div style={{ font: "600 8px/1 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 3, letterSpacing: ".2em" }}>PYRAMID OF TIRANA</div>
                </div>
              </div>
              <div style={{ font: "700 22px/1.1 Inter, sans-serif", color: "#fff", marginBottom: 4 }}>
                {ticket.guestName}
              </div>
              <div style={{ font: "500 13px Inter, sans-serif", color: "#7D8799" }}>
                Issued {new Date(ticket.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            </div>

            {/* QR placeholder */}
            <div style={{ padding: "28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              {/* QR visual placeholder — real QR image added in Step 2 (email) */}
              <div
                style={{
                  width: 180,
                  height: 180,
                  borderRadius: 16,
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Corner squares for QR finder pattern */}
                {[
                  { top: 10, left: 10 },
                  { top: 10, right: 10 },
                  { bottom: 10, left: 10 },
                ].map((pos, i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      width: 36,
                      height: 36,
                      border: "5px solid #0D0D12",
                      borderRadius: 4,
                      ...pos,
                    }}
                  />
                ))}
                <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".06em", textAlign: "center" }}>
                  QR TICKET
                </div>
              </div>

              {/* Status badge */}
              <div style={{
                padding: "8px 18px",
                borderRadius: 100,
                background: isCheckedIn ? "rgba(34,197,94,.12)" : isCancelled ? "rgba(239,68,68,.12)" : "rgba(200,240,0,.12)",
                color: isCheckedIn ? "#22C55E" : isCancelled ? "#EF4444" : "#C8F000",
                font: "700 12px 'JetBrains Mono', monospace",
                letterSpacing: ".08em",
              }}>
                {isCheckedIn ? "CHECKED IN" : isCancelled ? "CANCELLED" : "REGISTERED"}
              </div>

              {/* Token */}
              <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#39414F", wordBreak: "break-all", textAlign: "center", maxWidth: 260 }}>
                {token}
              </div>
            </div>

            <div style={{ padding: "0 28px 24px", textAlign: "center" }}>
              <Link href="/events" style={{ font: "600 13px Inter, sans-serif", color: "#7D8799", textDecoration: "none" }}>
                ← Back to events
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
