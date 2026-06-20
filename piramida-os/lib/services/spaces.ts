import { AssetReservationStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { getOrgId } from "../db/org";
import { createAuditLog } from "../audit/log";
import { requirePermission, AuthError } from "../auth/guards";
import {
  createSpaceInput,
  updateSpaceInput,
  createLocationInput,
  updateLocationInput,
} from "../validation/schemas";
import { dateSchema, uuid, trimmed } from "../validation/common";
import { assertTransition, ASSET_RESERVATION_TRANSITIONS } from "./state-machines";

// Spaces, adjacencies, storage/scan locations, and space reservations with
// deterministic overlap detection. A reservation occupies a space for its full
// setup->teardown window; two active reservations conflict when those windows
// overlap.

const ACTIVE_RESERVATION_STATUSES: AssetReservationStatus[] = [
  AssetReservationStatus.SOFT_HOLD,
  AssetReservationStatus.RESERVED,
  AssetReservationStatus.PICKED,
  AssetReservationStatus.IN_TRANSIT,
  AssetReservationStatus.IN_USE,
];

export async function listSpaces(opts?: { publicOnly?: boolean }) {
  const orgId = await getOrgId();
  return prisma.space.findMany({
    where: { orgId, deletedAt: null, ...(opts?.publicOnly ? { publicVisible: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getSpace(id: string) {
  uuid.parse(id);
  const orgId = await getOrgId();
  return prisma.space.findFirst({
    where: { id, orgId, deletedAt: null },
    include: {
      locations: true,
      adjacenciesFrom: { include: { toSpace: { select: { id: true, name: true } } } },
    },
  });
}

export async function createSpace(input: unknown) {
  const actor = await requirePermission("settings.manage");
  const data = createSpaceInput.parse(input);
  const orgId = await getOrgId();
  const space = await prisma.space.create({
    data: { orgId, ...data } as unknown as Prisma.SpaceUncheckedCreateInput,
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "CREATE",
    entityType: "Space",
    entityId: space.id,
    summary: `Created space ${space.name}`,
  });
  return space;
}

export async function updateSpace(id: string, input: unknown) {
  const actor = await requirePermission("settings.manage");
  uuid.parse(id);
  const data = updateSpaceInput.parse(input);
  const orgId = await getOrgId();
  const existing = await prisma.space.findFirst({ where: { id, orgId, deletedAt: null } });
  if (!existing) throw new AuthError("Space not found", 404);
  const space = await prisma.space.update({
    where: { id },
    data: data as unknown as Prisma.SpaceUncheckedUpdateInput,
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "UPDATE",
    entityType: "Space",
    entityId: id,
    summary: `Updated space ${space.name}`,
    after: data as Prisma.InputJsonValue,
  });
  return space;
}

export async function archiveSpace(id: string) {
  const actor = await requirePermission("settings.manage");
  uuid.parse(id);
  const orgId = await getOrgId();
  const existing = await prisma.space.findFirst({ where: { id, orgId, deletedAt: null } });
  if (!existing) throw new AuthError("Space not found", 404);
  const space = await prisma.space.update({ where: { id }, data: { deletedAt: new Date() } });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "DELETE",
    entityType: "Space",
    entityId: id,
    summary: `Archived space ${existing.name}`,
  });
  return space;
}

// -- Locations --------------------------------------------------------------

export async function listLocations(opts?: { publicOnly?: boolean }) {
  const orgId = await getOrgId();
  return prisma.location.findMany({
    where: { orgId, deletedAt: null, ...(opts?.publicOnly ? { publicVisible: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createLocation(input: unknown) {
  const actor = await requirePermission("settings.manage");
  const data = createLocationInput.parse(input);
  const orgId = await getOrgId();
  const location = await prisma.location.create({
    data: { orgId, ...data } as unknown as Prisma.LocationUncheckedCreateInput,
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "CREATE",
    entityType: "Location",
    entityId: location.id,
    summary: `Created location ${location.name}`,
  });
  return location;
}

export async function updateLocation(id: string, input: unknown) {
  const actor = await requirePermission("settings.manage");
  uuid.parse(id);
  const data = updateLocationInput.parse(input);
  const orgId = await getOrgId();
  const existing = await prisma.location.findFirst({ where: { id, orgId, deletedAt: null } });
  if (!existing) throw new AuthError("Location not found", 404);
  const location = await prisma.location.update({
    where: { id },
    data: data as unknown as Prisma.LocationUncheckedUpdateInput,
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "UPDATE",
    entityType: "Location",
    entityId: id,
    summary: `Updated location ${location.name}`,
  });
  return location;
}

// -- Space reservations + availability --------------------------------------

const createSpaceReservationInput = z
  .object({
    eventId: uuid,
    spaceId: uuid,
    setupStart: dateSchema,
    eventStart: dateSchema,
    eventEnd: dateSchema,
    teardownEnd: dateSchema,
    status: z.nativeEnum(AssetReservationStatus).optional(),
    notes: trimmed(2000).optional(),
  })
  .refine((d) => d.setupStart <= d.eventStart && d.eventStart < d.eventEnd && d.eventEnd <= d.teardownEnd, {
    message: "Window must be setupStart <= eventStart < eventEnd <= teardownEnd",
    path: ["teardownEnd"],
  });

export interface SpaceConflict {
  reservationId: string;
  eventId: string;
  setupStart: Date;
  teardownEnd: Date;
}

/** Returns active reservations on a space whose window overlaps [from, until]. */
export async function findSpaceReservationConflicts(input: {
  spaceId: string;
  from: Date;
  until: Date;
  excludeEventId?: string;
}): Promise<SpaceConflict[]> {
  const orgId = await getOrgId();
  const rows = await prisma.spaceReservation.findMany({
    where: {
      orgId,
      spaceId: input.spaceId,
      deletedAt: null,
      status: { in: ACTIVE_RESERVATION_STATUSES },
      ...(input.excludeEventId ? { eventId: { not: input.excludeEventId } } : {}),
      // overlap: existing.setupStart < until AND existing.teardownEnd > from
      setupStart: { lt: input.until },
      teardownEnd: { gt: input.from },
    },
    select: { id: true, eventId: true, setupStart: true, teardownEnd: true },
  });
  return rows.map((r) => ({
    reservationId: r.id,
    eventId: r.eventId,
    setupStart: r.setupStart,
    teardownEnd: r.teardownEnd,
  }));
}

export async function checkSpaceAvailability(spaceId: string, from: Date, until: Date) {
  uuid.parse(spaceId);
  const conflicts = await findSpaceReservationConflicts({ spaceId, from, until });
  return { available: conflicts.length === 0, conflicts };
}

export async function createSpaceReservation(input: unknown) {
  const actor = await requirePermission("events.plan");
  const data = createSpaceReservationInput.parse(input);
  const orgId = await getOrgId();

  const conflicts = await findSpaceReservationConflicts({
    spaceId: data.spaceId,
    from: data.setupStart,
    until: data.teardownEnd,
    excludeEventId: data.eventId,
  });
  if (conflicts.length > 0) {
    throw new AuthError("Space is already reserved for an overlapping window", 403);
  }

  const reservation = await prisma.spaceReservation.create({
    data: {
      orgId,
      eventId: data.eventId,
      spaceId: data.spaceId,
      status: data.status ?? AssetReservationStatus.SOFT_HOLD,
      setupStart: data.setupStart,
      eventStart: data.eventStart,
      eventEnd: data.eventEnd,
      teardownEnd: data.teardownEnd,
      notes: data.notes,
    },
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "RESERVE",
    entityType: "SpaceReservation",
    entityId: reservation.id,
    summary: `Reserved space for event ${data.eventId}`,
    after: { spaceId: data.spaceId, status: reservation.status },
  });
  return reservation;
}

export async function releaseSpaceReservation(id: string) {
  const actor = await requirePermission("events.plan");
  uuid.parse(id);
  const orgId = await getOrgId();
  const existing = await prisma.spaceReservation.findFirst({ where: { id, orgId, deletedAt: null } });
  if (!existing) throw new AuthError("Reservation not found", 404);
  assertTransition(
    "SpaceReservation",
    ASSET_RESERVATION_TRANSITIONS,
    existing.status,
    AssetReservationStatus.RELEASED,
  );
  const reservation = await prisma.spaceReservation.update({
    where: { id },
    data: { status: AssetReservationStatus.RELEASED },
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "RELEASE",
    entityType: "SpaceReservation",
    entityId: id,
    summary: `Released space reservation`,
    before: { status: existing.status },
    after: { status: AssetReservationStatus.RELEASED },
  });
  return reservation;
}
