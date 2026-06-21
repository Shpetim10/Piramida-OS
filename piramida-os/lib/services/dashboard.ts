import { ConflictStatus, EventStatus, AssetReservationStatus, EventRequestStatus } from "@prisma/client";
import { prisma } from "../db/prisma";
import { getOrgId } from "../db/org";

const PIPELINE_STATUSES: EventStatus[] = [
  EventStatus.PLANNING,
  EventStatus.PROPOSED,
  EventStatus.CONFIRMED,
  EventStatus.PUBLISHED,
  EventStatus.LAUNCH_READY,
  EventStatus.LIVE,
];

const ACTIVE_RES_STATUSES: AssetReservationStatus[] = [
  AssetReservationStatus.SOFT_HOLD,
  AssetReservationStatus.RESERVED,
  AssetReservationStatus.PICKED,
  AssetReservationStatus.IN_TRANSIT,
  AssetReservationStatus.IN_USE,
];

const MONTH_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const STAGE_LABEL: Partial<Record<EventStatus, string>> = {
  [EventStatus.PLANNING]: "SIM",
  [EventStatus.PROPOSED]: "PROPOSE",
  [EventStatus.CONFIRMED]: "CONFIRM",
  [EventStatus.PUBLISHED]: "PUB",
  [EventStatus.LAUNCH_READY]: "LAUNCH",
  [EventStatus.LIVE]: "LIVE",
};

const STAGE_COLOR: Partial<Record<EventStatus, string>> = {
  [EventStatus.PLANNING]: "#C8F000",
  [EventStatus.PROPOSED]: "#2A6FDB",
  [EventStatus.CONFIRMED]: "#7A4BD6",
  [EventStatus.PUBLISHED]: "#22C55E",
  [EventStatus.LAUNCH_READY]: "#22C55E",
  [EventStatus.LIVE]: "#22C55E",
};

const SEV_LABEL: Record<string, string> = {
  CRITICAL: "CRIT",
  HIGH: "HIGH",
  MEDIUM: "MED",
  LOW: "LOW",
};

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "#EF4444",
  HIGH: "#EF4444",
  MEDIUM: "#F59E0B",
  LOW: "#2A6FDB",
};

function statusToPipelineStage(status: EventStatus): string {
  switch (status) {
    case EventStatus.DRAFT:
    case EventStatus.PENDING_APPROVAL:
      return "requests";
    case EventStatus.PLANNING:
      return "simulate";
    case EventStatus.PROPOSED:
      return "explain";
    case EventStatus.CONFIRMED:
      return "protect";
    case EventStatus.PUBLISHED:
    case EventStatus.LAUNCH_READY:
    case EventStatus.LIVE:
      return "launch";
    default:
      return "understand";
  }
}

export type DashboardData = {
  kpis: {
    activeEventsCount: number;
    pendingRequestsCount: number;
    unresolvedConflictsCount: number;
    launchReadyCount: number;
    assetsReserved: number;
    assetsTotal: number;
  };
  activeEvents: Array<{
    id: string;
    title: string;
    day: string;
    mon: string;
    stage: string;
    pct: number;
    stageColor: string;
  }>;
  attention: Array<{
    sev: string;
    color: string;
    title: string;
    meta: string;
    action: string;
    href: string;
  }>;
  flagship: {
    eventId: string;
    pipelineStage: string;
  } | null;
};

export async function getDashboardData(selectedEventId?: string): Promise<DashboardData> {
  const orgId = await getOrgId();

  const [
    activeEvents,
    pendingRequestsCount,
    unresolvedConflictsCount,
    launchReadyCount,
    topConflicts,
    assetReservationCount,
    serializedTotal,
    batchTotals,
  ] = await Promise.all([
    prisma.event.findMany({
      where: { orgId, deletedAt: null, status: { in: PIPELINE_STATUSES } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.eventRequest.count({
      where: {
        orgId,
        deletedAt: null,
        status: { in: [EventRequestStatus.RECEIVED, EventRequestStatus.PARSED] },
      },
    }),
    prisma.conflict.count({
      where: { orgId, status: ConflictStatus.OPEN },
    }),
    prisma.event.count({
      where: { orgId, deletedAt: null, status: EventStatus.LAUNCH_READY },
    }),
    prisma.conflict.findMany({
      where: { orgId, status: ConflictStatus.OPEN },
      include: { event: { select: { id: true, title: true } } },
      orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
      take: 4,
    }),
    prisma.assetReservation.count({
      where: { orgId, deletedAt: null, status: { in: ACTIVE_RES_STATUSES } },
    }),
    prisma.asset.count({ where: { orgId, deletedAt: null } }),
    prisma.assetBatch.aggregate({
      where: { orgId, deletedAt: null },
      _sum: { totalQuantity: true },
    }),
  ]);

  const assetsTotal = serializedTotal + (batchTotals._sum.totalQuantity ?? 0);
  const flagship =
    (selectedEventId ? activeEvents.find((e) => e.id === selectedEventId) : null) ??
    activeEvents[0] ??
    null;

  const activeEventsList = activeEvents.slice(0, 3).map((e) => {
    const d = e.eventStart ? new Date(e.eventStart) : null;
    return {
      id: e.id,
      title: e.title,
      day: d ? String(d.getDate()).padStart(2, "0") : "—",
      mon: d ? MONTH_SHORT[d.getMonth()] : "—",
      stage: STAGE_LABEL[e.status] ?? e.status.slice(0, 6),
      pct: e.feasibilityScore != null ? Math.round(e.feasibilityScore) : 0,
      stageColor: STAGE_COLOR[e.status] ?? "#7D8799",
    };
  });

  const attention = topConflicts.map((c) => ({
    sev: SEV_LABEL[c.severity] ?? c.severity,
    color: SEV_COLOR[c.severity] ?? "#7D8799",
    title: c.title,
    meta: c.event.title,
    action: "Resolve",
    href: `/manager/events/${c.event.id}/protect`,
  }));

  return {
    kpis: {
      activeEventsCount: activeEvents.length,
      pendingRequestsCount,
      unresolvedConflictsCount,
      launchReadyCount,
      assetsReserved: assetReservationCount,
      assetsTotal,
    },
    activeEvents: activeEventsList,
    attention,
    flagship: flagship
      ? { eventId: flagship.id, pipelineStage: statusToPipelineStage(flagship.status) }
      : null,
  };
}
