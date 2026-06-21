import {
  AssetReservationStatus,
  AssetReservationItemStatus,
  AssetMovementStatus,
  AssetStatus,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { getOrgId } from "../db/org";
import { createAuditLog } from "../audit/log";
import { requirePermission, AuthError } from "../auth/guards";
import { createAssetMovementInput, createAssetIssueInput } from "../validation/schemas";
import { uuid } from "../validation/common";
import { assertTransition, ASSET_RESERVATION_TRANSITIONS } from "./state-machines";

// Deterministic equipment reservation + availability.
//
// A reservation window runs from setup_start to teardown_end PLUS the return
// buffer. Serialized assets can never be double-booked across overlapping
// windows; bulk batches are drawn down by quantity. Shortage detection compares
// validated requirements against what the event can actually hold without
// colliding with other events.

const ACTIVE_RES_STATUSES: AssetReservationStatus[] = [
  AssetReservationStatus.SOFT_HOLD,
  AssetReservationStatus.RESERVED,
  AssetReservationStatus.PICKED,
  AssetReservationStatus.IN_TRANSIT,
  AssetReservationStatus.IN_USE,
];

const INACTIVE_ITEM_STATUSES: AssetReservationItemStatus[] = [
  AssetReservationItemStatus.RELEASED,
  AssetReservationItemStatus.CANCELLED,
  AssetReservationItemStatus.SUBSTITUTED,
];

// Validated requirement key -> seed category name.
export const SERIALIZED_REQ_TO_CATEGORY: Record<string, string> = {
  wirelessMicrophones: "Wireless Microphone",
  wiredMicrophones: "Wired Microphone",
  projectors: "Projector",
  screens: "Screen",
  speakers: "Speaker",
};
export const BULK_REQ_TO_CATEGORY: Record<string, string> = {
  chairs: "Chairs",
  tables: "Tables",
};

export interface ReservationWindow {
  setupStart: Date;
  eventStart: Date;
  eventEnd: Date;
  teardownEnd: Date;
  /** teardownEnd + return buffer; used for availability collision checks. */
  availabilityUntil: Date;
}

function resolveWindow(event: {
  setupStart: Date | null;
  eventStart: Date | null;
  eventEnd: Date | null;
  teardownEnd: Date | null;
  returnBufferMinutes: number | null;
}): ReservationWindow {
  if (!event.setupStart || !event.eventStart || !event.eventEnd || !event.teardownEnd) {
    throw new AuthError("Event is missing its schedule (setup/event/teardown times)", 403);
  }
  const buffer = event.returnBufferMinutes ?? 30;
  return {
    setupStart: event.setupStart,
    eventStart: event.eventStart,
    eventEnd: event.eventEnd,
    teardownEnd: event.teardownEnd,
    availabilityUntil: new Date(event.teardownEnd.getTime() + buffer * 60_000),
  };
}

/** Serialized asset ids busy in [from, until] for any OTHER event. */
async function busyAssetIds(orgId: string, from: Date, until: Date, excludeEventId?: string): Promise<Set<string>> {
  const items = await prisma.assetReservationItem.findMany({
    where: {
      orgId,
      assetId: { not: null },
      itemStatus: { notIn: INACTIVE_ITEM_STATUSES },
      windowStart: { lt: until },
      windowEnd: { gt: from },
      reservation: {
        status: { in: ACTIVE_RES_STATUSES },
        deletedAt: null,
        ...(excludeEventId ? { eventId: { not: excludeEventId } } : {}),
      },
    },
    select: { assetId: true },
  });
  return new Set(items.map((i) => i.assetId!).filter(Boolean));
}

export async function checkAssetAvailability(input: {
  categoryId: string;
  from: Date;
  until: Date;
  excludeEventId?: string;
}) {
  const orgId = await getOrgId();
  const assets = await prisma.asset.findMany({
    where: {
      orgId,
      categoryId: input.categoryId,
      deletedAt: null,
      status: { notIn: [AssetStatus.RETIRED, AssetStatus.MAINTENANCE, AssetStatus.MISSING] },
    },
    select: { id: true, name: true },
  });
  const busy = await busyAssetIds(orgId, input.from, input.until, input.excludeEventId);
  const available = assets.filter((a) => !busy.has(a.id));
  return { total: assets.length, available };
}

async function categoryByName(orgId: string, name: string) {
  return prisma.assetCategory.findFirst({ where: { orgId, name, deletedAt: null } });
}

/**
 * Build (or extend) the event's soft-hold reservation from its requirements.
 * Serialized categories draw distinct available units; bulk categories draw
 * quantity from a batch. Returns the reservation plus any unmet shortages.
 */
export async function reserveAssetsForEvent(eventId: string) {
  const actor = await requirePermission("inventory.manage");
  uuid.parse(eventId);
  const orgId = await getOrgId();

  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId, deletedAt: null },
    include: { requirements: true },
  });
  if (!event) throw new AuthError("Event not found", 404);
  const win = resolveWindow(event);

  const shortages: { category: string; required: number; reserved: number }[] = [];

  const reservation = await prisma.$transaction(async (tx) => {
    const res = await tx.assetReservation.create({
      data: {
        orgId,
        eventId,
        status: AssetReservationStatus.SOFT_HOLD,
        setupStart: win.setupStart,
        eventStart: win.eventStart,
        eventEnd: win.eventEnd,
        teardownEnd: win.teardownEnd,
        returnBufferMinutes: event.returnBufferMinutes ?? 30,
      },
    });

    const busy = await busyAssetIds(orgId, win.setupStart, win.availabilityUntil, eventId);

    for (const [key, catName] of Object.entries(SERIALIZED_REQ_TO_CATEGORY)) {
      const required = numericRequirement(event.requirements, key);
      if (required <= 0) continue;
      const category = await categoryByName(orgId, catName);
      if (!category) continue;
      const candidates = await tx.asset.findMany({
        where: {
          orgId,
          categoryId: category.id,
          deletedAt: null,
          status: { notIn: [AssetStatus.RETIRED, AssetStatus.MAINTENANCE, AssetStatus.MISSING] },
        },
        orderBy: { name: "asc" },
        select: { id: true },
      });
      const free = candidates.filter((a) => !busy.has(a.id)).slice(0, required);
      for (const a of free) {
        busy.add(a.id);
        await tx.assetReservationItem.create({
          data: {
            orgId,
            reservationId: res.id,
            assetId: a.id,
            categoryId: category.id,
            quantity: 1,
            itemStatus: AssetReservationItemStatus.SOFT_HOLD,
            windowStart: win.setupStart,
            windowEnd: win.availabilityUntil,
          },
        });
        await tx.asset.update({
          where: { id: a.id },
          data: { status: AssetStatus.SOFT_HOLD },
        });
      }
      if (free.length < required) {
        shortages.push({ category: catName, required, reserved: free.length });
      }
    }

    for (const [key, catName] of Object.entries(BULK_REQ_TO_CATEGORY)) {
      const required = numericRequirement(event.requirements, key);
      if (required <= 0) continue;
      const category = await categoryByName(orgId, catName);
      if (!category) continue;
      const batch = await tx.assetBatch.findFirst({
        where: { orgId, categoryId: category.id, deletedAt: null },
        orderBy: { availableQuantity: "desc" },
      });
      const take = batch ? Math.min(required, batch.availableQuantity) : 0;
      if (batch && take > 0) {
        await tx.assetReservationItem.create({
          data: {
            orgId,
            reservationId: res.id,
            batchId: batch.id,
            categoryId: category.id,
            quantity: take,
            itemStatus: AssetReservationItemStatus.SOFT_HOLD,
            windowStart: win.setupStart,
            windowEnd: win.availabilityUntil,
          },
        });
        await tx.assetBatch.update({
          where: { id: batch.id },
          data: {
            availableQuantity: batch.availableQuantity - take,
            reservedQuantity: batch.reservedQuantity + take,
          },
        });
      }
      if (take < required) {
        shortages.push({ category: catName, required, reserved: take });
      }
    }

    await createAuditLog({
      tx,
      actorProfileId: actor.id,
      action: "RESERVE",
      entityType: "AssetReservation",
      entityId: res.id,
      summary: `Reserved assets for event ${event.code}`,
      after: { shortages },
    });
    return res;
  });

  const full = await prisma.assetReservation.findUnique({
    where: { id: reservation.id },
    include: { items: true },
  });
  return { reservation: full, shortages };
}

function numericRequirement(reqs: { key: string; valueJson: Prisma.JsonValue }[], key: string): number {
  const r = reqs.find((x) => x.key === key);
  if (!r) return 0;
  const v = r.valueJson;
  return typeof v === "number" ? v : 0;
}

const reserveSerializedInput = z.object({
  reservationId: uuid,
  assetId: uuid,
});

export async function reserveSerializedAsset(input: unknown) {
  const actor = await requirePermission("inventory.manage");
  const data = reserveSerializedInput.parse(input);
  const orgId = await getOrgId();
  const reservation = await prisma.assetReservation.findFirst({
    where: { id: data.reservationId, orgId, deletedAt: null },
    include: { event: { select: { id: true } } },
  });
  if (!reservation) throw new AuthError("Reservation not found", 404);

  const until = new Date(reservation.teardownEnd.getTime() + reservation.returnBufferMinutes * 60_000);
  const busy = await busyAssetIds(orgId, reservation.setupStart, until, reservation.eventId);
  if (busy.has(data.assetId)) {
    throw new AuthError("Asset is already reserved for an overlapping window", 403);
  }
  const asset = await prisma.asset.findFirst({ where: { id: data.assetId, orgId, deletedAt: null } });
  if (!asset) throw new AuthError("Asset not found", 404);

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.assetReservationItem.create({
      data: {
        orgId,
        reservationId: data.reservationId,
        assetId: data.assetId,
        categoryId: asset.categoryId,
        quantity: 1,
        itemStatus: AssetReservationItemStatus.SOFT_HOLD,
        windowStart: reservation.setupStart,
        windowEnd: until,
      },
    });
    await tx.asset.update({
      where: { id: data.assetId },
      data: { status: AssetStatus.SOFT_HOLD },
    });
    await createAuditLog({
      tx,
      actorProfileId: actor.id,
      action: "RESERVE",
      entityType: "AssetReservationItem",
      entityId: created.id,
      summary: `Reserved serialized asset ${asset.name}`,
    });
    return created;
  });
  return item;
}

const reserveBatchInput = z.object({
  reservationId: uuid,
  batchId: uuid,
  quantity: z.coerce.number().int().positive(),
});

export async function reserveBatchQuantity(input: unknown) {
  const actor = await requirePermission("inventory.manage");
  const data = reserveBatchInput.parse(input);
  const orgId = await getOrgId();
  const reservation = await prisma.assetReservation.findFirst({ where: { id: data.reservationId, orgId, deletedAt: null } });
  if (!reservation) throw new AuthError("Reservation not found", 404);

  return prisma.$transaction(async (tx) => {
    const batch = await tx.assetBatch.findFirst({ where: { id: data.batchId, orgId, deletedAt: null } });
    if (!batch) throw new AuthError("Batch not found", 404);
    if (batch.availableQuantity < data.quantity) {
      throw new AuthError(`Only ${batch.availableQuantity} of ${batch.name} available`, 403);
    }
    const until = new Date(reservation.teardownEnd.getTime() + reservation.returnBufferMinutes * 60_000);
    const item = await tx.assetReservationItem.create({
      data: {
        orgId,
        reservationId: data.reservationId,
        batchId: data.batchId,
        categoryId: batch.categoryId,
        quantity: data.quantity,
        itemStatus: AssetReservationItemStatus.SOFT_HOLD,
        windowStart: reservation.setupStart,
        windowEnd: until,
      },
    });
    await tx.assetBatch.update({
      where: { id: batch.id },
      data: {
        availableQuantity: batch.availableQuantity - data.quantity,
        reservedQuantity: batch.reservedQuantity + data.quantity,
      },
    });
    await createAuditLog({
      tx,
      actorProfileId: actor.id,
      action: "RESERVE",
      entityType: "AssetReservationItem",
      entityId: item.id,
      summary: `Reserved ${data.quantity}x ${batch.name}`,
    });
    return item;
  });
}

export async function confirmSoftHold(reservationId: string) {
  const actor = await requirePermission("inventory.manage");
  uuid.parse(reservationId);
  const orgId = await getOrgId();
  const reservation = await prisma.assetReservation.findFirst({ where: { id: reservationId, orgId, deletedAt: null } });
  if (!reservation) throw new AuthError("Reservation not found", 404);
  assertTransition("AssetReservation", ASSET_RESERVATION_TRANSITIONS, reservation.status, AssetReservationStatus.RESERVED);

  const updated = await prisma.$transaction(async (tx) => {
    // Capture serialized items before the bulk update so we know which assets to advance.
    const softHoldSerializedItems = await tx.assetReservationItem.findMany({
      where: { reservationId, assetId: { not: null }, itemStatus: AssetReservationItemStatus.SOFT_HOLD },
      select: { assetId: true },
    });

    const r = await tx.assetReservation.update({
      where: { id: reservationId },
      data: { status: AssetReservationStatus.RESERVED },
    });
    await tx.assetReservationItem.updateMany({
      where: { reservationId, itemStatus: AssetReservationItemStatus.SOFT_HOLD },
      data: { itemStatus: AssetReservationItemStatus.RESERVED },
    });

    for (const item of softHoldSerializedItems) {
      if (item.assetId) {
        await tx.asset.update({
          where: { id: item.assetId },
          data: { status: AssetStatus.RESERVED },
        });
      }
    }

    await createAuditLog({
      tx,
      actorProfileId: actor.id,
      action: "STATUS_CHANGE",
      entityType: "AssetReservation",
      entityId: reservationId,
      summary: "Confirmed soft hold -> reserved",
    });
    return r;
  });
  return updated;
}

export async function releaseAssetReservation(id: string) {
  const actor = await requirePermission("inventory.manage");
  uuid.parse(id);
  const orgId = await getOrgId();
  const reservation = await prisma.assetReservation.findFirst({
    where: { id, orgId, deletedAt: null },
    include: { items: true },
  });
  if (!reservation) throw new AuthError("Reservation not found", 404);
  assertTransition("AssetReservation", ASSET_RESERVATION_TRANSITIONS, reservation.status, AssetReservationStatus.RELEASED);

  await prisma.$transaction(async (tx) => {
    // Return bulk quantity to its batch, and release serialized assets back to AVAILABLE.
    for (const item of reservation.items) {
      if (INACTIVE_ITEM_STATUSES.includes(item.itemStatus)) continue;

      if (item.batchId) {
        const batch = await tx.assetBatch.findUnique({ where: { id: item.batchId } });
        if (batch) {
          await tx.assetBatch.update({
            where: { id: item.batchId },
            data: {
              availableQuantity: batch.availableQuantity + item.quantity,
              reservedQuantity: Math.max(0, batch.reservedQuantity - item.quantity),
            },
          });
        }
      }

      if (item.assetId) {
        await tx.asset.update({
          where: { id: item.assetId },
          data: { status: AssetStatus.AVAILABLE },
        });
      }
    }
    await tx.assetReservationItem.updateMany({
      where: { reservationId: id, itemStatus: { notIn: INACTIVE_ITEM_STATUSES } },
      data: { itemStatus: AssetReservationItemStatus.RELEASED },
    });
    await tx.assetReservation.update({ where: { id }, data: { status: AssetReservationStatus.RELEASED } });
    await createAuditLog({
      tx,
      actorProfileId: actor.id,
      action: "RELEASE",
      entityType: "AssetReservation",
      entityId: id,
      summary: "Released reservation and returned bulk quantity",
    });
  });
  return prisma.assetReservation.findUnique({ where: { id }, include: { items: true } });
}

/**
 * Compare validated requirements to what the event can actually hold without
 * colliding with other events. A serialized unit reserved by another overlapping
 * event does not count toward this event's availability.
 */
export async function detectAssetShortages(eventId: string) {
  const orgId = await getOrgId();
  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId, deletedAt: null },
    include: { requirements: true },
  });
  if (!event) throw new AuthError("Event not found", 404);
  const win = resolveWindow(event);

  const shortages: {
    category: string;
    required: number;
    available: number;
    shortBy: number;
    replacementCategory: string | null;
  }[] = [];

  for (const [key, catName] of Object.entries(SERIALIZED_REQ_TO_CATEGORY)) {
    const required = numericRequirement(event.requirements, key);
    if (required <= 0) continue;
    const category = await prisma.assetCategory.findFirst({
      where: { orgId, name: catName, deletedAt: null },
      include: { replacementCategory: { select: { name: true } } },
    });
    if (!category) continue;
    const { available } = await checkAssetAvailability({
      categoryId: category.id,
      from: win.setupStart,
      until: win.availabilityUntil,
      excludeEventId: eventId,
    });
    if (available.length < required) {
      shortages.push({
        category: catName,
        required,
        available: available.length,
        shortBy: required - available.length,
        replacementCategory: category.replacementCategory?.name ?? null,
      });
    }
  }

  for (const [key, catName] of Object.entries(BULK_REQ_TO_CATEGORY)) {
    const required = numericRequirement(event.requirements, key);
    if (required <= 0) continue;
    const category = await prisma.assetCategory.findFirst({
      where: { orgId, name: catName, deletedAt: null },
    });
    if (!category) continue;
    const batches = await prisma.assetBatch.findMany({
      where: { orgId, categoryId: category.id, deletedAt: null },
      select: { id: true, totalQuantity: true },
    });
    const totalQuantity = batches.reduce((sum, b) => sum + b.totalQuantity, 0);
    const batchIds = batches.map((b) => b.id);
    const reservedByOthers = batchIds.length > 0
      ? await prisma.assetReservationItem.aggregate({
          where: {
            orgId,
            batchId: { in: batchIds },
            itemStatus: { notIn: INACTIVE_ITEM_STATUSES },
            windowStart: { lt: win.availabilityUntil },
            windowEnd: { gt: win.setupStart },
            reservation: {
              status: { in: ACTIVE_RES_STATUSES },
              deletedAt: null,
              eventId: { not: eventId },
            },
          },
          _sum: { quantity: true },
        })
      : { _sum: { quantity: null } };
    const reservedByOthersQty = reservedByOthers._sum.quantity ?? 0;
    const available = Math.max(0, totalQuantity - reservedByOthersQty);
    if (available < required) {
      shortages.push({
        category: catName,
        required,
        available,
        shortBy: required - available,
        replacementCategory: null,
      });
    }
  }

  return shortages;
}

// -- QR scan / movements / issues -------------------------------------------

const QR_ACTION_TO_STATUS: Record<string, AssetStatus> = {
  pick: AssetStatus.PICKED,
  transit: AssetStatus.IN_TRANSIT,
  deploy: AssetStatus.IN_USE,
  return: AssetStatus.RETURNED,
  available: AssetStatus.AVAILABLE,
};

const scanQrInput = z.object({
  qrCode: z.string().trim().min(3).max(120),
  action: z.enum(["pick", "transit", "deploy", "return", "available"]),
  toLocationId: uuid.optional(),
  notes: z.string().trim().max(2000).optional(),
});

/** Scan a serialized asset's QR to advance its lifecycle + log a movement. */
export async function scanAssetQr(input: unknown) {
  const actor = await requirePermission("inventory.scan");
  const data = scanQrInput.parse(input);
  const orgId = await getOrgId();
  const asset = await prisma.asset.findFirst({ where: { orgId, qrCode: data.qrCode, deletedAt: null } });
  if (!asset) throw new AuthError("Unknown asset QR", 404);

  const newStatus = QR_ACTION_TO_STATUS[data.action];
  return prisma.$transaction(async (tx) => {
    const updated = await tx.asset.update({
      where: { id: asset.id },
      data: {
        status: newStatus,
        ...(data.toLocationId ? { currentLocationId: data.toLocationId } : {}),
      },
    });
    const movement = await tx.assetMovement.create({
      data: {
        orgId,
        assetId: asset.id,
        fromLocationId: asset.currentLocationId,
        toLocationId: data.toLocationId ?? asset.currentLocationId,
        status:
          data.action === "return"
            ? AssetMovementStatus.RETURNED
            : data.action === "transit"
              ? AssetMovementStatus.IN_TRANSIT
              : AssetMovementStatus.DELIVERED,
        scannedByProfileId: actor.id,
        notes: data.notes,
      },
    });
    await createAuditLog({
      tx,
      actorProfileId: actor.id,
      action: "UPDATE",
      entityType: "Asset",
      entityId: asset.id,
      summary: `QR scan: ${asset.name} -> ${newStatus}`,
      before: { status: asset.status },
      after: { status: newStatus },
    });
    return { asset: updated, movement };
  });
}

export async function createAssetMovement(input: unknown) {
  const actor = await requirePermission("inventory.scan");
  const data = createAssetMovementInput.parse(input);
  const orgId = await getOrgId();
  const movement = await prisma.assetMovement.create({
    data: { orgId, ...data, scannedByProfileId: actor.id },
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "CREATE",
    entityType: "AssetMovement",
    entityId: movement.id,
    summary: "Recorded asset movement",
  });
  return movement;
}

export async function reportAssetIssue(input: unknown) {
  const actor = await requirePermission("inventory.manage");
  const data = createAssetIssueInput.parse(input);
  const orgId = await getOrgId();
  const issue = await prisma.assetIssue.create({
    data: {
      orgId,
      assetId: data.assetId,
      batchId: data.batchId,
      type: data.type,
      maintenanceStatus: data.maintenanceStatus,
      severity: data.severity,
      description: data.description,
      reportedByProfileId: actor.id,
      assignedToProfileId: data.assignedToProfileId,
      cost: data.cost !== undefined ? new Prisma.Decimal(data.cost) : undefined,
    },
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "CREATE",
    entityType: "AssetIssue",
    entityId: issue.id,
    summary: `Reported asset issue (${data.type})`,
  });
  return issue;
}

export async function resolveAssetIssue(id: string) {
  const actor = await requirePermission("inventory.manage");
  uuid.parse(id);
  const orgId = await getOrgId();
  const issue = await prisma.assetIssue.findFirst({ where: { id, orgId, deletedAt: null } });
  if (!issue) throw new AuthError("Issue not found", 404);
  const updated = await prisma.assetIssue.update({
    where: { id },
    data: { maintenanceStatus: "RESOLVED", resolvedAt: new Date() },
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "UPDATE",
    entityType: "AssetIssue",
    entityId: id,
    summary: "Resolved asset issue",
  });
  return updated;
}
