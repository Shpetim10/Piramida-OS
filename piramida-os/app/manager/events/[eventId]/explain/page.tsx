import { ScreenContainer } from "@/components/manager/ScreenContainer";
import { DecisionGraph } from "@/components/manager/twin";
import { getEvent } from "@/lib/services/events";
import { listAuditLogsByEvent } from "@/lib/audit/log";
import { buildDecisionGraph } from "@/lib/planning/decision-graph";
import { LIME } from "@/lib/manager/data";
import { ChangeImpactPanel } from "./ChangeImpactPanel";

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  const [event, auditLogs] = await Promise.all([
    getEvent(eventId).catch(() => null),
    listAuditLogsByEvent(eventId).catch(() => []),
  ]);

  // Build decision graph from the latest plan version snapshot
  const latestSnapshot = event?.planVersions[0]?.snapshot as Record<string, unknown> | null | undefined;
  const graphData = latestSnapshot
    ? buildDecisionGraph({
        selectedSpaces: latestSnapshot.selectedSpaces as Parameters<typeof buildDecisionGraph>[0]["selectedSpaces"],
        assetPlan: latestSnapshot.assetPlan as Parameters<typeof buildDecisionGraph>[0]["assetPlan"],
        guests: event?.expectedGuests ?? undefined,
        eventTitle: event?.title ?? undefined,
      })
    : null;

  const hasRealGraph = graphData && graphData.nodes.length > 1;

  // Format audit log entries for display
  const auditEntries = auditLogs.slice(0, 10).map((log) => ({
    id: log.id,
    what: log.summary ?? log.action,
    when: new Date(log.createdAt).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
    color: auditColor(log.action),
  }));

  const fromGuests = event?.expectedGuests ?? 180;

  return (
    <ScreenContainer>
      {/* Decision Graph */}
      <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "radial-gradient(700px 360px at 30% 0%,rgba(42,111,219,.07),#101319)", padding: 22, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
          <div style={{ font: "700 15px Inter, sans-serif", color: "#fff" }}>Decision Graph</div>
          <span style={{ font: "600 9px 'JetBrains Mono', monospace", color: hasRealGraph ? LIME : "#7D8799", letterSpacing: ".1em" }}>
            {hasRealGraph ? "LIVE FROM PLAN ENGINE" : "HOW THE PLAN WAS BUILT"}
          </span>
        </div>
        <p style={{ font: "500 12px/1.5 Inter, sans-serif", color: "#7D8799", margin: "0 0 8px" }}>
          Every space and asset traced back to the originating requirement.
          {!hasRealGraph && " Run the planning engine first to see real nodes."}
        </p>
        <div style={{ height: "clamp(260px,32vw,340px)" }}>
          <DecisionGraph data={graphData} />
        </div>
      </div>

      {/* Two columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>
        {/* Change Impact — client component for interactivity */}
        <ChangeImpactPanel eventId={eventId} fromGuests={fromGuests} />

        {/* Audit Timeline */}
        <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, background: "#151821", padding: 22 }}>
          <div style={{ font: "700 14px Inter, sans-serif", color: "#fff", marginBottom: 4 }}>Audit Timeline</div>
          <p style={{ font: "500 12px/1.5 Inter, sans-serif", color: "#7D8799", margin: "0 0 16px" }}>
            What happened, who did it, and when.
          </p>
          {auditEntries.length === 0 ? (
            <div style={{ color: "#39414F", font: "500 12px Inter, sans-serif" }}>No audit events yet — run the planning engine to start the trail.</div>
          ) : (
            <div style={{ position: "relative", paddingLeft: 22 }}>
              <div style={{ position: "absolute", left: 5, top: 4, bottom: 4, width: 1, background: "rgba(255,255,255,.1)" }} />
              {auditEntries.map((a) => (
                <div key={a.id} style={{ position: "relative", paddingBottom: 16 }}>
                  <span style={{ position: "absolute", left: -22, top: 2, width: 11, height: 11, borderRadius: "50%", background: a.color, boxShadow: "0 0 0 3px #151821" }} />
                  <div style={{ font: "600 13px Inter, sans-serif", color: "#fff" }}>{a.what}</div>
                  <div style={{ font: "500 11px 'JetBrains Mono', monospace", color: "#7D8799", marginTop: 3 }}>{a.when}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ScreenContainer>
  );
}

function auditColor(action: string): string {
  if (action.includes("PLAN")) return "#C8F000";
  if (action.includes("CONFLICT") || action.includes("FIX")) return "#F59E0B";
  if (action.includes("PUBLISH") || action.includes("APPROVE")) return "#22C55E";
  if (action.includes("CREATE")) return "#2A6FDB";
  return "#7D8799";
}
