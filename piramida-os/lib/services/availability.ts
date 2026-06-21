/**
 * Venue availability — deterministic DB check.
 *
 * Maps venue names (from lib/data.ts EVENT_VENUES) to Space records in the DB,
 * then checks space_reservations for any active booking whose window overlaps
 * [from, until). Overlap logic: existing.setupStart < until AND existing.teardownEnd > from.
 *
 * Falls back to "all available" when the DB has no Space rows yet (unseeded demo),
 * so neither planner breaks before seed data is loaded.
 */

import { AssetReservationStatus } from "@prisma/client";
import { prisma } from "../db/prisma";
import { getOrgId } from "../db/org";

const ACTIVE_STATUSES: AssetReservationStatus[] = [
  AssetReservationStatus.SOFT_HOLD,
  AssetReservationStatus.RESERVED,
  AssetReservationStatus.PICKED,
  AssetReservationStatus.IN_TRANSIT,
  AssetReservationStatus.IN_USE,
];

export type VenueAvailability = Record<string, boolean>;

/**
 * Check which of the given venue names are free during [from, until).
 * Returns a map of { venueName → isAvailable }.
 * Names not found in the DB are treated as available (graceful degradation).
 */
export async function checkVenueNamesAvailability(
  venueNames: string[],
  from: Date,
  until: Date,
): Promise<VenueAvailability> {
  if (venueNames.length === 0) return {};

  const orgId = await getOrgId();

  const spaces = await prisma.space.findMany({
    where: { orgId, deletedAt: null, name: { in: venueNames } },
    select: { id: true, name: true },
  });

  // No spaces seeded yet — treat everything as available so planners still work
  if (spaces.length === 0) {
    return Object.fromEntries(venueNames.map((n) => [n, true]));
  }

  const bookedRows = await prisma.spaceReservation.findMany({
    where: {
      orgId,
      spaceId: { in: spaces.map((s) => s.id) },
      deletedAt: null,
      status: { in: ACTIVE_STATUSES },
      setupStart: { lt: until },
      teardownEnd: { gt: from },
    },
    select: { spaceId: true },
  });

  const bookedSpaceIds = new Set(bookedRows.map((r) => r.spaceId));
  const nameById = new Map(spaces.map((s) => [s.id, s.name]));
  const bookedNames = new Set(
    [...bookedSpaceIds]
      .map((id) => nameById.get(id))
      .filter((n): n is string => n !== undefined),
  );

  // Names absent from the DB are treated as available
  return Object.fromEntries(venueNames.map((n) => [n, !bookedNames.has(n)]));
}
