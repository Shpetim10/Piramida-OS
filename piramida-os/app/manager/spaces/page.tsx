import { prisma } from "@/lib/db/prisma";
import { getOrgId } from "@/lib/db/org";
import { getSetting } from "@/lib/services/settings";
import { SpacesClient, type SpaceRow, type TwinRoomPosition } from "./SpacesClient";

export const dynamic = "force-dynamic";

const FALLBACK_ROOMS: TwinRoomPosition[] = [
  { slug: "main-corridor", name: "Main Corridor", x: 236, y: 150, w: 128, h: 48, color: "#7A4BD6" },
  { slug: "green-room", name: "Green Room", x: 182, y: 218, w: 112, h: 58, color: "#22C55E" },
  { slug: "yellow-room", name: "Yellow Room", x: 306, y: 218, w: 112, h: 58, color: "#C9A227" },
  { slug: "blue-room", name: "Blue Room", x: 128, y: 300, w: 158, h: 54, color: "#2A6FDB" },
  { slug: "orange-room", name: "Orange Room", x: 314, y: 300, w: 158, h: 54, color: "#C0612A" },
  { slug: "entrance", name: "Entrance", x: 262, y: 360, w: 76, h: 24, color: "#AEB5C2" },
];

const ACTIVE_STATUSES = ["SOFT_HOLD", "RESERVED", "PICKED", "IN_TRANSIT", "IN_USE"] as const;

function slugify(n: string): string {
  return n.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default async function ManagerSpacesPage() {
  let spaces: SpaceRow[] = [];
  let rooms: TwinRoomPosition[] = FALLBACK_ROOMS;

  try {
    const orgId = await getOrgId();
    const [rawSpaces, savedRooms] = await Promise.all([
      prisma.space.findMany({
        where: { orgId, deletedAt: null },
        include: {
          reservations: {
            where: {
              deletedAt: null,
              status: { in: ACTIVE_STATUSES as unknown as ("SOFT_HOLD" | "RESERVED" | "PICKED" | "IN_TRANSIT" | "IN_USE")[] },
            },
            orderBy: { eventStart: "asc" },
            take: 1,
            include: {
              event: { select: { id: true, title: true, expectedGuests: true } },
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      getSetting<TwinRoomPosition[]>("twin.room_positions").catch(() => null),
    ]);

    if (savedRooms) rooms = savedRooms;

    spaces = rawSpaces.map((s) => {
      const res = s.reservations[0] ?? null;
      const hasReservation = !!res;
      const event = res?.event ?? null;

      const utilPct =
        hasReservation && event?.expectedGuests && s.capacity
          ? Math.min(100, Math.round((event.expectedGuests / s.capacity) * 100))
          : 0;

      const twinSlug = rooms.find((r) => r.slug === slugify(s.name))?.slug ?? null;

      return {
        id: s.id,
        name: s.name,
        capacity: s.capacity ?? null,
        reservationStatus: hasReservation ? "Reserved" : "Free",
        reservationEvent: event?.title ?? "No reservation",
        reservationWhen: res?.eventStart
          ? new Date(res.eventStart).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "Available",
        utilPct,
        twinSlug,
      };
    });
  } catch {
    // Not authenticated or DB unavailable — show empty
  }

  return <SpacesClient spaces={spaces} rooms={rooms} />;
}
