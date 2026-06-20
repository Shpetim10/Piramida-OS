"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminScreen, useAdminViewport } from "@/components/admin/AdminScreen";

interface ClarificationAnswer {
  question: string;
  answer: string;
}
interface Clarifications {
  answers?: ClarificationAnswer[];
  schedule?: { startDate?: string; duration?: string; endDate?: string } | null;
  configuration?: unknown;
}

interface EventRequestRow {
  id: string;
  title: string | null;
  rawText: string;
  status: string;
  approvalStatus: string;
  confidence: number | null;
  createdAt: string;
  clarifications: Clarifications | null;
  extractedJson: unknown;
  client: { name: string } | null;
  contact: { firstName: string; lastName: string; email: string } | null;
}

const STATUS_TONE: Record<string, string> = {
  APPROVED: "#22C55E",
  REJECTED: "#EF4444",
  PENDING_APPROVAL: "#F59E0B",
};

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: 16,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,.08)",
        background: "#0B0E13",
        color: "#E6E9EF",
        font: "500 12.5px/1.6 'JetBrains Mono', monospace",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        overflowX: "auto",
      }}
    >
      {JSON.stringify(value ?? null, null, 2)}
    </pre>
  );
}

export default function AdminEventRequestsPage() {
  const { isMobile } = useAdminViewport();
  const [requests, setRequests] = useState<EventRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selId, setSelId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/event-requests")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? (data as EventRequestRow[]) : [];
        setRequests(list);
        if (list.length > 0) setSelId(list[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const det = useMemo(() => requests.find((r) => r.id === selId), [requests, selId]);

  if (loading) {
    return (
      <AdminScreen>
        <div style={{ color: "#7D8799", font: "500 14px Inter, sans-serif", padding: 40 }}>Loading event requests…</div>
      </AdminScreen>
    );
  }

  if (requests.length === 0) {
    return (
      <AdminScreen>
        <div style={{ color: "#7D8799", font: "500 14px Inter, sans-serif", padding: 40 }}>
          No event requests have been submitted yet.
        </div>
      </AdminScreen>
    );
  }

  return (
    <AdminScreen>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "0.8fr 1.2fr", gap: 18, alignItems: "start" }}>
        {/* List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {requests.map((r) => {
            const isSel = selId === r.id;
            const tone = STATUS_TONE[r.approvalStatus] ?? "#7D8799";
            const answers = r.clarifications?.answers?.length ?? 0;
            return (
              <button
                key={r.id}
                onClick={() => setSelId(r.id)}
                style={{
                  border: `1px solid ${isSel ? "rgba(200,240,0,.35)" : "rgba(255,255,255,.07)"}`,
                  borderRadius: 14,
                  background: isSel ? "rgba(200,240,0,.05)" : "#151821",
                  padding: 14,
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ font: "700 13px Inter, sans-serif", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.title || "Untitled event request"}
                  </span>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", flex: "none", background: tone, boxShadow: `0 0 7px ${tone}` }} />
                </div>
                <div style={{ font: "500 11px Inter, sans-serif", color: "#7D8799", marginTop: 4 }}>
                  {r.client?.name ?? "—"}
                  {answers > 0 ? ` · ${answers} answered` : ""}
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail */}
        {det && (
          <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, background: "#151821", overflow: "hidden" }}>
            <div style={{ padding: 22, borderBottom: "1px solid rgba(255,255,255,.07)" }}>
              <div style={{ font: "800 18px Inter, sans-serif", color: "#fff", letterSpacing: "-.01em" }}>
                {det.title || "Untitled event request"}
              </div>
              <div style={{ font: "500 12px 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 4 }}>
                {det.client?.name ?? "—"}
                {det.contact ? ` · ${det.contact.firstName} ${det.contact.lastName} · ${det.contact.email}` : ""}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <span style={{ font: "700 9px 'JetBrains Mono', monospace", letterSpacing: ".06em", color: STATUS_TONE[det.approvalStatus] ?? "#AEB5C2", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", padding: "5px 9px", borderRadius: 7 }}>
                  {det.approvalStatus}
                </span>
                <span style={{ font: "700 9px 'JetBrains Mono', monospace", letterSpacing: ".06em", color: "#AEB5C2", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", padding: "5px 9px", borderRadius: 7 }}>
                  {det.status}
                </span>
                <span style={{ font: "700 9px 'JetBrains Mono', monospace", letterSpacing: ".06em", color: "#7D8799", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", padding: "5px 9px", borderRadius: 7 }}>
                  {new Date(det.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </div>
            </div>

            <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em", marginBottom: 9 }}>
                  ORIGINAL REQUEST
                </div>
                <p style={{ font: "400 14px/1.7 Inter, sans-serif", color: "#E6E9EF", margin: 0, textWrap: "pretty" }}>
                  &ldquo;{det.rawText}&rdquo;
                </p>
              </div>

              <div>
                <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".12em", marginBottom: 9 }}>
                  ORGANIZER Q&amp;A · JSON
                </div>
                {det.clarifications && (det.clarifications.answers?.length || det.clarifications.schedule || det.clarifications.configuration) ? (
                  <JsonBlock value={det.clarifications} />
                ) : (
                  <div style={{ font: "400 13px Inter, sans-serif", color: "#7D8799" }}>
                    No clarifications were captured for this request.
                  </div>
                )}
              </div>

              {det.extractedJson != null && (
                <div>
                  <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".12em", marginBottom: 9 }}>
                    AI EXTRACTION · JSON
                  </div>
                  <JsonBlock value={det.extractedJson} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminScreen>
  );
}
