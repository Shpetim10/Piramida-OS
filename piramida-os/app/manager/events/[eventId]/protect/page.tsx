import { detectConflicts } from "@/lib/services/conflicts";
import { detectAssetShortages } from "@/lib/services/reservations";
import { getEvent } from "@/lib/services/events";
import { explainConflict } from "@/lib/ai/explainer";
import { getLaunchReadiness } from "@/lib/services/launch-readiness";
import { getSetting } from "@/lib/services/settings";
import { buildTwinOverlays, type TwinRoomPosition } from "@/lib/manager/twin-overlays";
import { ProtectClient } from "./ProtectClient";

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "#EF4444",
  HIGH: "#EF4444",
  MEDIUM: "#F59E0B",
  LOW: "#2A6FDB",
};

const IMPACT_TEXT: Record<string, string> = {
  CRITICAL: "Critical — must fix before launch",
  HIGH: "High — blocks launch gate",
  MEDIUM: "Medium — warning gate",
  LOW: "Low — advisory only",
};

const IMPACT_COLOR: Record<string, string> = {
  CRITICAL: "#EF4444",
  HIGH: "#EF4444",
  MEDIUM: "#F59E0B",
  LOW: "#22C55E",
};

const FALLBACK_ROOM_POSITIONS: TwinRoomPosition[] = [
  { slug: "main-corridor", name: "Main Corridor", x: 236, y: 150, w: 128, h: 48, color: "#7A4BD6" },
  { slug: "green-room", name: "Green Room", x: 182, y: 218, w: 112, h: 58, color: "#22C55E" },
  { slug: "yellow-room", name: "Yellow Room", x: 306, y: 218, w: 112, h: 58, color: "#C9A227" },
  { slug: "blue-room", name: "Blue Room", x: 128, y: 300, w: 158, h: 54, color: "#2A6FDB" },
  { slug: "orange-room", name: "Orange Room", x: 314, y: 300, w: 158, h: 54, color: "#C0612A" },
  { slug: "entrance", name: "Entrance", x: 262, y: 360, w: 76, h: 24, color: "#AEB5C2" },
];

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  const [event, conflicts, shortages, readiness, roomPositions] = await Promise.all([
    getEvent(eventId).catch(() => null),
    detectConflicts(eventId),
    detectAssetShortages(eventId).catch(() => []),
    getLaunchReadiness(eventId).catch(() => null),
    getSetting<TwinRoomPosition[]>("twin.room_positions").catch(() => null),
  ]);

  // Build inventory planner rows from requirements + reservation data.
  const inventoryRows = event
    ? await buildInventoryRows(event, shortages)
    : [];

  // Enrich conflicts with AI explanations (non-blocking; fallback to DB title).
  const conflictRows = await Promise.all(
    conflicts.map(async (c) => {
      const explain = await explainConflict({
        type: c.type,
        severity: c.severity,
        title: c.title,
        detail: (c.detail ?? {}) as Record<string, unknown>,
        suggestionLabel: c.suggestions[0]?.label,
      }).catch(() => c.title);
      return {
        id: c.id,
        sev: c.severity,
        sc: SEV_COLOR[c.severity] ?? "#7D8799",
        title: c.title,
        explain,
        rec: c.suggestions[0]?.rationale ?? "",
        impact: IMPACT_TEXT[c.severity] ?? "Advisory",
        ic: IMPACT_COLOR[c.severity] ?? "#7D8799",
        suggestions: c.suggestions.filter((s) => !s.isApplied).map((s) => {
          const payload = (s.payload ?? {}) as Record<string, unknown>;
          return {
            id: s.id,
            type: s.type,
            label: s.label,
            rationale: s.rationale ?? "",
            rank: s.rank ?? 99,
            residualRisk: String(payload.residualRisk ?? "medium"),
            costDelta: Number(payload.costDelta ?? payload.quoteDelta ?? 0),
            disruption: String(payload.disruption ?? "medium"),
            beforeRisk: String(payload.beforeRisk ?? ""),
            afterRisk: String(payload.afterRisk ?? ""),
            tradeoffNarration: String(payload.tradeoffNarration ?? ""),
            gateDelta: payload.gateDelta as Record<string, string> | undefined,
            quoteDelta: Number(payload.quoteDelta ?? payload.costDelta ?? 0),
            toolTraceCount: Array.isArray(payload.toolTrace) ? payload.toolTrace.length : 0,
            facts: Array.isArray(payload.toolTrace)
              ? payload.toolTrace.slice(0, 4).map((entry) => {
                  const tool = entry as { name?: string; result?: Record<string, unknown> };
                  if (tool.name === "findSubstitutes") return "Substitutes verified";
                  if (tool.name === "reserveDryRun") return String(tool.result?.message ?? "Dry-run checked");
                  if (tool.name === "priceAssets") return "Asset price estimated";
                  if (tool.name === "getPricingRules") return "Pricing rule fetched";
                  return `${tool.name ?? "Tool"} called`;
                })
              : [],
          };
        }).sort((a, b) => a.rank - b.rank),
      };
    }),
  );

  const rooms = roomPositions ?? FALLBACK_ROOM_POSITIONS;
  const planSpaces = (event?.planVersions[0]?.snapshot as { selectedSpaces?: Array<{ name: string }> } | undefined)?.selectedSpaces;
  const allocatedSpaceNames =
    planSpaces?.map((space) => space.name) ??
    event?.spaceReservations.map((reservation) => (reservation as { space?: { name: string } }).space?.name).filter(Boolean) as string[] ??
    [];
  const twinOverlays = buildTwinOverlays({
    rooms,
    conflicts: conflicts.map((conflict) => ({
      id: conflict.id,
      type: conflict.type,
      severity: conflict.severity,
      status: conflict.status,
      title: conflict.title,
      detail: (conflict.detail ?? {}) as Record<string, unknown>,
    })),
    allocatedSpaceNames,
  });

  return (
    <ProtectClient
      inventory={inventoryRows}
      conflicts={conflictRows}
      readinessGates={readiness?.gates ?? []}
      twinRooms={rooms}
      twinSelectedSlugs={twinOverlays.selectedSlugs}
      twinPins={twinOverlays.pins}
      twinFlows={twinOverlays.flows}
    />
  );
}

async function buildInventoryRows(
  event: Awaited<ReturnType<typeof getEvent>>,
  shortages: Awaited<ReturnType<typeof detectAssetShortages>>,
) {
  if (!event) return [];

  const REQ_LABELS: Record<string, string> = {
    wirelessMicrophones: "Wireless Microphones",
    wiredMicrophones: "Wired Microphones",
    projectors: "Projectors",
    screens: "Screens",
    speakers: "Speakers",
    chairs: "Chairs",
    tables: "Tables",
  };

  const rows = [];
  const activeReservationItems = event.assetReservations
    .filter((r) => !["RELEASED", "CANCELLED"].includes(r.status))
    .flatMap((r) => r.items.filter((i) => !["RELEASED", "CANCELLED", "SUBSTITUTED"].includes(i.itemStatus)));

  for (const [key, label] of Object.entries(REQ_LABELS)) {
    const req = event.requirements.find((r) => r.key === key);
    if (!req) continue;
    const required = typeof req.valueJson === "number" ? req.valueJson : 0;
    if (required <= 0) continue;

    const reserved = activeReservationItems
      .filter((i) => i.quantity > 0 && i.category?.name === label)
      .reduce((sum, item) => sum + item.quantity, 0);
    const shortage = shortages.find((s) => s.category.toLowerCase().includes(label.split(" ")[0].toLowerCase()));
    const avail = shortage ? shortage.available : required;
    const short = shortage ? shortage.shortBy > 0 : false;

    rows.push({ cat: label, req: required, res: Math.min(reserved, required), avail, short });
  }

  return rows;
}
