import Link from "next/link";
import { ScreenContainer } from "@/components/manager/ScreenContainer";
import { listEvents } from "@/lib/services/events";
import { LIME } from "@/lib/manager/data";

const STAGE_COLOR: Record<string, string> = {
  DRAFT: "#7D8799",
  PENDING_APPROVAL: "#F59E0B",
  PLANNING: LIME,
  PROPOSED: "#2A6FDB",
  CONFIRMED: "#7A4BD6",
  PUBLISHED: "#22C55E",
  LAUNCH_READY: "#22C55E",
  LIVE: "#22C55E",
  COMPLETED: "#7D8799",
  ARCHIVED: "#7D8799",
  CANCELLED: "#EF4444",
};

function statusLabel(status: string) {
  return status.replace("_", " ");
}

export default async function ManagerEventsPage() {
  let events: Awaited<ReturnType<typeof listEvents>> = [];
  try {
    events = await listEvents();
  } catch {
    // Not authenticated — fall through to empty list
  }

  const inPipeline = events.filter((e) =>
    ["PLANNING", "PROPOSED", "CONFIRMED", "PUBLISHED", "LAUNCH_READY", "LIVE"].includes(e.status),
  );

  return (
    <ScreenContainer>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <p style={{ font: "400 14px/1.5 Inter, sans-serif", color: "#AEB5C2", margin: "0 0 10px", maxWidth: 480 }}>
            Every event in the Pyramid, with its current position in the operational pipeline and live readiness.
          </p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 8, border: "1px solid rgba(200,240,0,.25)", background: "rgba(200,240,0,.06)" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#C8F000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
            <span style={{ font: "600 10px 'JetBrains Mono', monospace", color: "#C8F000", letterSpacing: ".08em" }}>Press a button to generate plan</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 18 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ font: "800 22px/1 Inter, sans-serif", color: "#fff" }}>{events.length}</div>
            <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>TOTAL</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ font: "800 22px/1 Inter, sans-serif", color: LIME }}>{inPipeline.length}</div>
            <div style={{ font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>IN PIPELINE</div>
          </div>
        </div>
      </div>

      {events.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#7D8799", font: "500 14px Inter, sans-serif" }}>
          No events found — run <code>npm run db:seed</code> to populate demo data.
        </div>
      ) : (
        <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.7fr 1fr 1fr", gap: 12, padding: "13px 20px", borderBottom: "1px solid rgba(255,255,255,.07)", font: "600 9px 'JetBrains Mono', monospace", color: "#7D8799", letterSpacing: ".1em" }}>
            <div>EVENT</div>
            <div>DATE</div>
            <div>GUESTS</div>
            <div>STATUS</div>
            <div style={{ textAlign: "right" }}>SCORE</div>
          </div>

          {events.map((e) => {
            const stageColor = STAGE_COLOR[e.status] ?? "#7D8799";
            const isCompleted = ["COMPLETED", "ARCHIVED", "CANCELLED"].includes(e.status);
            const score = e.feasibilityScore != null ? Math.round(e.feasibilityScore) : null;
            return (
              <Link
                key={e.id}
                href={`/manager/events/${e.id}`}
                style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.7fr 1fr 1fr", gap: 12, alignItems: "center", padding: "15px 20px", borderBottom: "1px solid rgba(255,255,255,.05)", cursor: "pointer", textDecoration: "none" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: stageColor, flex: "none" }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ font: "600 13px Inter, sans-serif", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</div>
                    <div style={{ font: "500 10px 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 2 }}>{e.type} · {e.code}</div>
                  </div>
                </div>
                <div style={{ font: "500 12px Inter, sans-serif", color: "#AEB5C2" }}>
                  {e.eventStart ? new Date(e.eventStart).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                </div>
                <div style={{ font: "500 12px Inter, sans-serif", color: "#AEB5C2" }}>{e.expectedGuests ?? "—"}</div>
                <div>
                  <span style={{ display: "inline-block", font: "700 9px 'JetBrains Mono', monospace", letterSpacing: ".06em", color: isCompleted ? "#7D8799" : "#0D0D12", background: isCompleted ? "#1A1F2B" : stageColor, padding: "5px 9px", borderRadius: 7 }}>
                    {statusLabel(e.status)}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 9, justifyContent: "flex-end" }}>
                  {score != null ? (
                    <>
                      <div style={{ width: 64, height: 5, borderRadius: 3, background: "#0F1218", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${score}%`, background: stageColor, borderRadius: 3 }} />
                      </div>
                      <span style={{ font: "700 12px 'JetBrains Mono', monospace", color: "#fff", width: 34, textAlign: "right" }}>{score}%</span>
                    </>
                  ) : (
                    <span style={{ font: "600 11px 'JetBrains Mono', monospace", color: "#39414F" }}>—</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </ScreenContainer>
  );
}
