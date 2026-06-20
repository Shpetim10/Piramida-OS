import { getEvent } from "@/lib/services/events";
import { scoreSpaces } from "@/lib/services/planning";
import { getSetting } from "@/lib/services/settings";
import { AssetReservationStatus } from "@prisma/client";
import { SimulateClient } from "./SimulateClient";

interface RoomPosition {
  slug: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

const FALLBACK_ROOMS: RoomPosition[] = [
  { slug: "main-corridor", name: "Main Corridor", x: 236, y: 150, w: 128, h: 48, color: "#7A4BD6" },
  { slug: "green-room", name: "Green Room", x: 182, y: 218, w: 112, h: 58, color: "#22C55E" },
  { slug: "yellow-room", name: "Yellow Room", x: 306, y: 218, w: 112, h: 58, color: "#C9A227" },
  { slug: "blue-room", name: "Blue Room", x: 128, y: 300, w: 158, h: 54, color: "#2A6FDB" },
  { slug: "orange-room", name: "Orange Room", x: 314, y: 300, w: 158, h: 54, color: "#C0612A" },
  { slug: "entrance", name: "Entrance", x: 262, y: 360, w: 76, h: 24, color: "#AEB5C2" },
];

type PlanSnapshot = {
  selectedSpaces?: Array<{ spaceId: string; name: string; suggestedRole: string; score: number; capacity: number | null; roleKey: string; reasons: string[] }>;
  assetPlan?: {
    lines: Array<{ categoryName?: string; required?: number; reserved?: number; shortage?: number }>;
    shortages: Array<{ category: string; required: number; reserved: number; shortBy: number }>;
  };
  dnaScores?: Array<{ key: string; label: string; shortLabel: string; value: number }>;
  feasibility?: { score: number; components: Record<string, number> };
  quote?: { currency: string; total: number; items: Array<{ label: string; category: string; lineTotal: number; sourceRef: string }> };
  manualWorkSavings?: { stepsSaved: number; hoursSaved: number; drivers: string[] };
};

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  const [event, spaceScores, roomPositions] = await Promise.all([
    getEvent(eventId).catch(() => null),
    scoreSpaces(eventId).catch(() => []),
    getSetting<RoomPosition[]>("twin.room_positions").catch(() => null),
  ]);

  const inactive: AssetReservationStatus[] = [AssetReservationStatus.RELEASED, AssetReservationStatus.CANCELLED];
  const allocatedSpaceIds = (event?.spaceReservations ?? [])
    .filter((r) => !inactive.includes(r.status))
    .map((r) => r.spaceId);
  const latestPlan = event?.planVersions[0]?.snapshot as PlanSnapshot | undefined;

  return (
    <SimulateClient
      eventId={eventId}
      spaceScores={spaceScores}
      allocatedIds={latestPlan?.selectedSpaces?.map((space) => space.spaceId) ?? allocatedSpaceIds}
      guests={event?.expectedGuests ?? 0}
      roomPositions={roomPositions ?? FALLBACK_ROOMS}
      latestPlan={latestPlan ?? null}
    />
  );
}
