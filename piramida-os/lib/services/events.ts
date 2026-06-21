import { EventStatus, Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { getOrgId } from "../db/org";
import { createAuditLog } from "../audit/log";
import { requirePermission, AuthError } from "../auth/guards";
import {
  createEventInput,
  updateEventInput,
  createEventRequirementInput,
} from "../validation/schemas";
import { uuid } from "../validation/common";
import { assertTransition, EVENT_TRANSITIONS } from "./state-machines";
import { findRoomById, findRoomBySpaceName } from "../pyramid-data";

// Events, requirements, and plan version snapshots/diffs. The plan snapshot is
// the source for Change Impact (event_plan_diffs): each call captures the full
// deterministic plan state so two versions can be compared field-by-field.

export async function listEvents(opts?: { status?: EventStatus }) {
  await requirePermission("events.plan");
  const orgId = await getOrgId();
  return prisma.event.findMany({
    where: { orgId, deletedAt: null, ...(opts?.status ? { status: opts.status } : {}) },
    include: { client: { select: { name: true } }, publication: { select: { slug: true, status: true } } },
    orderBy: { createdAt: "desc" },
  });
}

// -- Live events (3D pyramid live pins) -------------------------------------

/** One live event, resolved onto a pyramid 3D room block. There may be several
 *  per event when an event reserves multiple spaces. */
export interface LiveEventMarker {
  eventId: string;
  title: string;
  status: EventStatus;
  eventStart: Date;
  eventEnd: Date;
  expectedGuests: number | null;
  spaceId: string;
  spaceName: string;
  /** numeric pyramid floor (e.g. 0, -1, 1) or null when it can't be resolved */
  floorNumber: number | null;
  /** the pyramid 3D room id this event lights up, e.g. "k0-12" */
  roomId: string;
}

/**
 * Live events to render as pins on the 3D pyramid. An event counts as live when
 * its status is LIVE *and* the timeline window contains `now` — the window is the
 * source of truth, so a stale LIVE flag outside its window is not shown.
 *
 * Each live event is mapped onto a pyramid room block via Space.modelNodeId
 * (canonical), falling back to matching the space name to a pyramid room name.
 * Events whose space can't be mapped are logged and skipped (never throw), so a
 * missing mapping degrades to "no pin" rather than crashing the view.
 *
 * Read-only and org-scoped (no staff permission) so it can feed the public
 * /explore pyramid. Returns only coarse, guest-safe fields.
 */
export async function getLiveEvents(now: Date = new Date()): Promise<LiveEventMarker[]> {
  const orgId = await getOrgId();
  const events = await prisma.event.findMany({
    where: {
      orgId,
      deletedAt: null,
      status: EventStatus.LIVE,
      eventStart: { lte: now },
      eventEnd: { gte: now },
    },
    select: {
      id: true,
      title: true,
      status: true,
      eventStart: true,
      eventEnd: true,
      expectedGuests: true,
      spaceReservations: {
        where: { deletedAt: null },
        select: {
          spaceId: true,
          space: { select: { name: true, floor: true, modelNodeId: true } },
        },
      },
    },
  });

  const markers: LiveEventMarker[] = [];
  for (const ev of events) {
    if (!ev.eventStart || !ev.eventEnd) continue;
    for (const res of ev.spaceReservations) {
      const spaceName = res.space.name;
      // 1) modelNodeId is the canonical pyramid room id.
      let roomId = res.space.modelNodeId ?? null;
      let floorNumber = res.space.floor ?? null;
      if (roomId) {
        if (floorNumber == null) {
          const found = findRoomById(roomId);
          if (found && typeof found.floor.id === "number") floorNumber = found.floor.id;
        }
      } else {
        // 2) fall back to matching the space name to a pyramid room name.
        const match = findRoomBySpaceName(spaceName);
        if (match) {
          roomId = match.room.id;
          if (floorNumber == null && typeof match.floor.id === "number") floorNumber = match.floor.id;
        }
      }
      if (!roomId) {
        console.warn(
          `[getLiveEvents] No pyramid room for space "${spaceName}" (event "${ev.title}"); skipping live pin.`,
        );
        continue;
      }
      markers.push({
        eventId: ev.id,
        title: ev.title,
        status: ev.status,
        eventStart: ev.eventStart,
        eventEnd: ev.eventEnd,
        expectedGuests: ev.expectedGuests ?? null,
        spaceId: res.spaceId,
        spaceName,
        floorNumber,
        roomId,
      });
    }
  }
  return markers;
}

export async function getEvent(id: string) {
  await requirePermission("events.plan");
  uuid.parse(id);
  const orgId = await getOrgId();
  return prisma.event.findFirst({
    where: { id, orgId, deletedAt: null },
    include: {
      client: true,
      requirements: true,
      spaceReservations: { include: { space: { select: { name: true } } } },
      assetReservations: { include: { items: { include: { category: true } } } },
      conflicts: { include: { suggestions: true } },
      tasks: true,
      quotes: { include: { items: true } },
      proposals: true,
      publication: true,
      planVersions: { orderBy: { version: "desc" }, take: 5 },
      request: {
        select: {
          rawText: true,
          clarifications: true,
          extractedJson: true,
          missingFields: true,
          confidence: true,
          contact: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
}

export async function createEvent(input: unknown) {
  const actor = await requirePermission("events.plan");
  const data = createEventInput.parse(input);
  const orgId = await getOrgId();
  const year = new Date().getFullYear();
  const event = await prisma.event.create({
    data: {
      orgId,
      clientId: data.clientId,
      requestId: data.requestId,
      code: data.code,
      title: data.title,
      type: data.type,
      visibility: data.visibility,
      expectedGuests: data.expectedGuests,
      eventStart: data.eventStart,
      eventEnd: data.eventEnd,
      setupStart: data.setupStart,
      teardownEnd: data.teardownEnd,
      returnBufferMinutes: data.returnBufferMinutes ?? 30,
      summary: data.summary,
      status: EventStatus.DRAFT,
    },
  });
  void year;
  await createAuditLog({
    actorProfileId: actor.id,
    action: "CREATE",
    entityType: "Event",
    entityId: event.id,
    summary: `Created event ${event.code}`,
  });
  return event;
}

export async function updateEvent(id: string, input: unknown) {
  const actor = await requirePermission("events.plan");
  uuid.parse(id);
  const data = updateEventInput.parse(input);
  const orgId = await getOrgId();
  const existing = await prisma.event.findFirst({ where: { id, orgId, deletedAt: null } });
  if (!existing) throw new AuthError("Event not found", 404);
  const event = await prisma.event.update({ where: { id }, data });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "UPDATE",
    entityType: "Event",
    entityId: id,
    summary: `Updated event ${event.code}`,
    after: data as Prisma.InputJsonValue,
  });
  return event;
}

export async function updateEventStatus(id: string, status: EventStatus) {
  const actor = await requirePermission("events.plan");
  uuid.parse(id);
  const orgId = await getOrgId();
  const existing = await prisma.event.findFirst({ where: { id, orgId, deletedAt: null } });
  if (!existing) throw new AuthError("Event not found", 404);
  assertTransition("Event", EVENT_TRANSITIONS, existing.status, status);
  const event = await prisma.event.update({ where: { id }, data: { status } });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "STATUS_CHANGE",
    entityType: "Event",
    entityId: id,
    summary: `Event ${event.code}: ${existing.status} -> ${status}`,
    before: { status: existing.status },
    after: { status },
  });
  return event;
}

export async function cancelEvent(id: string) {
  return updateEventStatus(id, EventStatus.CANCELLED);
}

export async function archiveEvent(id: string) {
  return updateEventStatus(id, EventStatus.ARCHIVED);
}

// -- Requirements -----------------------------------------------------------

export async function createEventRequirement(input: unknown) {
  const actor = await requirePermission("events.plan");
  const data = createEventRequirementInput.parse(input);
  const orgId = await getOrgId();
  const req = await prisma.eventRequirement.create({
    data: {
      orgId,
      eventId: data.eventId,
      key: data.key,
      valueJson: data.valueJson as Prisma.InputJsonValue,
      source: data.source ?? "staff",
    },
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "CREATE",
    entityType: "EventRequirement",
    entityId: req.id,
    summary: `Added requirement ${data.key}`,
  });
  return req;
}

export async function updateEventRequirement(id: string, valueJson: Prisma.InputJsonValue) {
  await requirePermission("events.plan");
  uuid.parse(id);
  return prisma.eventRequirement.update({ where: { id }, data: { valueJson } });
}

export async function deleteEventRequirement(id: string) {
  await requirePermission("events.plan");
  uuid.parse(id);
  return prisma.eventRequirement.delete({ where: { id } });
}

// -- Plan snapshots + diffs -------------------------------------------------

export interface PlanSnapshot {
  expectedGuests: number | null;
  feasibilityScore: number | null;
  spaces: string[];
  assetItems: { assetId: string | null; batchId: string | null; categoryId: string | null; quantity: number }[];
  conflicts: { id: string; type: string; status: string; severity: string }[];
  tasks: { id: string; title: string; status: string }[];
}

async function buildSnapshot(orgId: string, eventId: string): Promise<PlanSnapshot> {
  const [event, spaceRes, assetRes, conflicts, tasks] = await Promise.all([
    prisma.event.findFirst({ where: { id: eventId, orgId }, select: { expectedGuests: true, feasibilityScore: true } }),
    prisma.spaceReservation.findMany({ where: { orgId, eventId, deletedAt: null }, include: { space: { select: { name: true } } } }),
    prisma.assetReservation.findMany({ where: { orgId, eventId, deletedAt: null }, include: { items: true } }),
    prisma.conflict.findMany({ where: { orgId, eventId } }),
    prisma.task.findMany({ where: { orgId, eventId, deletedAt: null } }),
  ]);
  return {
    expectedGuests: event?.expectedGuests ?? null,
    feasibilityScore: event?.feasibilityScore ?? null,
    spaces: spaceRes.map((r) => r.space.name),
    assetItems: assetRes.flatMap((r) =>
      r.items.map((i) => ({ assetId: i.assetId, batchId: i.batchId, categoryId: i.categoryId, quantity: i.quantity })),
    ),
    conflicts: conflicts.map((c) => ({ id: c.id, type: c.type, status: c.status, severity: c.severity })),
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, status: t.status })),
  };
}

/** Capture the current plan state as a new immutable version. */
export async function createPlanSnapshot(eventId: string, reason?: string) {
  const actor = await requirePermission("events.plan");
  uuid.parse(eventId);
  const orgId = await getOrgId();
  const event = await prisma.event.findFirst({ where: { id: eventId, orgId, deletedAt: null } });
  if (!event) throw new AuthError("Event not found", 404);

  const last = await prisma.eventPlanVersion.findFirst({
    where: { eventId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;
  const snapshot = await buildSnapshot(orgId, eventId);

  const created = await prisma.$transaction(async (tx) => {
    const pv = await tx.eventPlanVersion.create({
      data: {
        orgId,
        eventId,
        version,
        reason,
        createdById: actor.id,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    });
    await tx.event.update({ where: { id: eventId }, data: { currentPlanVersionId: pv.id } });
    await createAuditLog({
      tx,
      actorProfileId: actor.id,
      action: "PLAN_GENERATED",
      entityType: "Event",
      entityId: eventId,
      summary: `Plan snapshot v${version}${reason ? ` (${reason})` : ""}`,
    });
    return pv;
  });
  return created;
}

/** Field-level diff between two stored plan versions. */
export async function comparePlanVersions(fromVersionId: string, toVersionId: string) {
  await requirePermission("events.plan");
  uuid.parse(fromVersionId);
  uuid.parse(toVersionId);
  const orgId = await getOrgId();
  const [from, to] = await Promise.all([
    prisma.eventPlanVersion.findFirst({ where: { id: fromVersionId, orgId } }),
    prisma.eventPlanVersion.findFirst({ where: { id: toVersionId, orgId } }),
  ]);
  if (!from || !to) throw new AuthError("Plan version not found", 404);

  const a = from.snapshot as unknown as PlanSnapshot;
  const b = to.snapshot as unknown as PlanSnapshot;
  const diff = {
    expectedGuests: a.expectedGuests !== b.expectedGuests ? { from: a.expectedGuests, to: b.expectedGuests } : null,
    feasibilityScore: a.feasibilityScore !== b.feasibilityScore ? { from: a.feasibilityScore, to: b.feasibilityScore } : null,
    spacesAdded: b.spaces.filter((s) => !a.spaces.includes(s)),
    spacesRemoved: a.spaces.filter((s) => !b.spaces.includes(s)),
    assetItemsBefore: a.assetItems.length,
    assetItemsAfter: b.assetItems.length,
    conflictsBefore: a.conflicts.length,
    conflictsAfter: b.conflicts.length,
    tasksBefore: a.tasks.length,
    tasksAfter: b.tasks.length,
  };

  const stored = await prisma.eventPlanDiff.create({
    data: { orgId, fromVersionId, toVersionId, diff: diff as unknown as Prisma.InputJsonValue },
  });
  return { diff, record: stored };
}
