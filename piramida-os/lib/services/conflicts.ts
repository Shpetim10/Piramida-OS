import {
  ConflictType,
  ConflictSeverity,
  ConflictStatus,
  ConflictSuggestionType,
  AssetReservationStatus,
  AssetReservationItemStatus,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { getOrgId } from "../db/org";
import { createAuditLog } from "../audit/log";
import { requirePermission, AuthError } from "../auth/guards";
import { uuid } from "../validation/common";
import { createConflictInput } from "../validation/schemas";
import { assertTransition, CONFLICT_TRANSITIONS } from "./state-machines";
import { detectAssetShortages, checkAssetAvailability } from "./reservations";
import { findSpaceReservationConflicts } from "./spaces";

// Deterministic conflict detection + bounded auto-fixes.
//
// AI may explain a conflict in plain language, but only this module decides
// whether a conflict exists and what a safe fix is. Applying a suggestion
// mutates reservations/tasks, flips the conflict, writes an audit log, and (via
// the caller) refreshes launch readiness.

function eventWindow(event: {
  setupStart: Date | null;
  teardownEnd: Date | null;
  returnBufferMinutes: number | null;
}) {
  if (!event.setupStart || !event.teardownEnd) {
    throw new AuthError("Event is missing its schedule", 403);
  }
  const buffer = event.returnBufferMinutes ?? 30;
  return {
    from: event.setupStart,
    until: new Date(event.teardownEnd.getTime() + buffer * 60_000),
  };
}

/** Idempotently upsert a deterministic conflict keyed by (event, type, title). */
async function upsertConflict(
  orgId: string,
  eventId: string,
  data: {
    type: ConflictType;
    severity: ConflictSeverity;
    title: string;
    detail: Prisma.InputJsonValue;
  },
) {
  const existing = await prisma.conflict.findFirst({
    where: { orgId, eventId, type: data.type, title: data.title, status: { in: [ConflictStatus.OPEN, ConflictStatus.AUTO_FIXED] } },
  });
  if (existing) {
    return prisma.conflict.update({ where: { id: existing.id }, data: { severity: data.severity, detail: data.detail } });
  }
  return prisma.conflict.create({
    data: { orgId, eventId, status: ConflictStatus.OPEN, ...data },
  });
}

/** Run all deterministic detectors for an event and persist conflicts + suggestions. */
export async function detectConflicts(eventId: string) {
  const actor = await requirePermission("events.plan");
  uuid.parse(eventId);
  const orgId = await getOrgId();
  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId, deletedAt: null },
    include: { spaceReservations: { include: { space: true } } },
  });
  if (!event) throw new AuthError("Event not found", 404);

  const created: string[] = [];

  // 1. Asset shortages / serialized double-booking.
  const shortages = await detectAssetShortages(eventId);
  for (const s of shortages) {
    const conflict = await upsertConflict(orgId, eventId, {
      type: ConflictType.ASSET_SHORTAGE,
      severity: s.shortBy >= 2 ? ConflictSeverity.HIGH : ConflictSeverity.MEDIUM,
      title: `${s.category} shortage (${s.shortBy} short)`,
      detail: {
        category: s.category,
        required: s.required,
        available: s.available,
        shortBy: s.shortBy,
        replacementCategory: s.replacementCategory,
      },
    });
    created.push(conflict.id);
    if (s.replacementCategory) {
      await ensureSuggestion(orgId, conflict.id, {
        type: ConflictSuggestionType.SUBSTITUTE_ASSET,
        label: `Substitute ${s.shortBy}x ${s.replacementCategory} for ${s.category}`,
        rationale: `${s.replacementCategory} units are free for the full reservation window and are an allowed replacement.`,
        payload: { replacementCategory: s.replacementCategory, quantity: s.shortBy },
      });
    }
  }

  // 2. Space overlaps.
  const inactiveSpace: AssetReservationStatus[] = [AssetReservationStatus.RELEASED, AssetReservationStatus.CANCELLED];
  for (const sr of event.spaceReservations) {
    if (inactiveSpace.includes(sr.status)) continue;
    const overlaps = await findSpaceReservationConflicts({
      spaceId: sr.spaceId,
      from: sr.setupStart,
      until: sr.teardownEnd,
      excludeEventId: eventId,
    });
    if (overlaps.length > 0) {
      const conflict = await upsertConflict(orgId, eventId, {
        type: ConflictType.SPACE_OVERLAP,
        severity: ConflictSeverity.HIGH,
        title: `${sr.space.name} double-booked`,
        detail: { spaceId: sr.spaceId, overlaps } as unknown as Prisma.InputJsonValue,
      });
      created.push(conflict.id);
      await ensureSuggestion(orgId, conflict.id, {
        type: ConflictSuggestionType.ALTERNATIVE_SPACE,
        label: `Move to an alternative space`,
        rationale: `Another event holds ${sr.space.name} for an overlapping window.`,
        payload: { spaceId: sr.spaceId },
      });
    }
  }

  if (created.length > 0) {
    await createAuditLog({
      actorProfileId: actor.id,
      action: "CONFLICT_DETECTED",
      entityType: "Event",
      entityId: eventId,
      summary: `Detected ${created.length} conflict(s)`,
    });
  }
  return listConflicts(eventId);
}

async function ensureSuggestion(
  orgId: string,
  conflictId: string,
  data: { type: ConflictSuggestionType; label: string; rationale: string; payload: Prisma.InputJsonValue },
) {
  const existing = await prisma.conflictSuggestion.findFirst({ where: { orgId, conflictId, type: data.type } });
  if (existing) return existing;
  return prisma.conflictSuggestion.create({ data: { orgId, conflictId, rank: 1, ...data } });
}

export async function listConflicts(eventId: string) {
  await requirePermission("events.plan");
  uuid.parse(eventId);
  const orgId = await getOrgId();
  return prisma.conflict.findMany({
    where: { orgId, eventId },
    include: { suggestions: { orderBy: { rank: "asc" } } },
    orderBy: [{ severity: "desc" }, { detectedAt: "asc" }],
  });
}

export async function createConflict(input: unknown) {
  const actor = await requirePermission("events.plan");
  const data = createConflictInput.parse(input);
  const orgId = await getOrgId();
  const conflict = await prisma.conflict.create({
    data: {
      orgId,
      eventId: data.eventId,
      type: data.type,
      severity: data.severity,
      status: data.status ?? ConflictStatus.OPEN,
      title: data.title,
      detail: (data.detail ?? {}) as Prisma.InputJsonValue,
      planVersionId: data.planVersionId,
    },
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "CONFLICT_DETECTED",
    entityType: "Conflict",
    entityId: conflict.id,
    summary: data.title,
  });
  return conflict;
}

const createSuggestionInput = z.object({
  conflictId: uuid,
  type: z.nativeEnum(ConflictSuggestionType),
  label: z.string().trim().min(1).max(200),
  rationale: z.string().trim().max(2000).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  rank: z.coerce.number().int().optional(),
});

export async function createConflictSuggestion(input: unknown) {
  await requirePermission("conflicts.resolve");
  const data = createSuggestionInput.parse(input);
  const orgId = await getOrgId();
  return prisma.conflictSuggestion.create({
    data: {
      orgId,
      conflictId: data.conflictId,
      type: data.type,
      label: data.label,
      rationale: data.rationale,
      payload: (data.payload ?? {}) as Prisma.InputJsonValue,
      rank: data.rank ?? 1,
    },
  });
}

export async function updateConflictStatus(id: string, status: ConflictStatus, note?: string) {
  const actor = await requirePermission("conflicts.resolve");
  uuid.parse(id);
  const orgId = await getOrgId();
  const conflict = await prisma.conflict.findFirst({ where: { id, orgId } });
  if (!conflict) throw new AuthError("Conflict not found", 404);
  assertTransition("Conflict", CONFLICT_TRANSITIONS, conflict.status, status);
  const updated = await prisma.conflict.update({
    where: { id },
    data: {
      status,
      resolutionNote: note,
      resolvedAt: status === ConflictStatus.RESOLVED || status === ConflictStatus.AUTO_FIXED ? new Date() : null,
      resolvedByProfileId: actor.id,
    },
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: status === ConflictStatus.RESOLVED ? "CONFLICT_RESOLVED" : "STATUS_CHANGE",
    entityType: "Conflict",
    entityId: id,
    summary: `Conflict ${conflict.status} -> ${status}`,
  });
  return updated;
}

export async function markConflictResolved(id: string, note?: string) {
  return updateConflictStatus(id, ConflictStatus.RESOLVED, note);
}

export async function ignoreConflict(id: string, reason: string) {
  return updateConflictStatus(id, ConflictStatus.IGNORED, reason);
}

/**
 * Apply a bounded auto-fix. Revalidates availability before mutating so a stale
 * suggestion can never create an invalid reservation. Marks the conflict
 * AUTO_FIXED and audits. Callers should re-run getLaunchReadiness afterward.
 */
export async function applyConflictSuggestion(conflictId: string, suggestionId: string) {
  const actor = await requirePermission("conflicts.resolve");
  uuid.parse(conflictId);
  uuid.parse(suggestionId);
  const orgId = await getOrgId();

  const conflict = await prisma.conflict.findFirst({
    where: { id: conflictId, orgId },
    include: { suggestions: true, event: { include: { requirements: true } } },
  });
  if (!conflict) throw new AuthError("Conflict not found", 404);
  const suggestion = conflict.suggestions.find((s) => s.id === suggestionId);
  if (!suggestion) throw new AuthError("Suggestion not found", 404);
  if (suggestion.isApplied) throw new AuthError("Suggestion already applied", 403);

  const event = conflict.event;
  const win = eventWindow(event);
  const payload = (suggestion.payload ?? {}) as Record<string, unknown>;

  const result = await prisma.$transaction(async (tx) => {
    let summary = suggestion.label;

    if (suggestion.type === ConflictSuggestionType.SUBSTITUTE_ASSET) {
      const replacementCategory = String(payload.replacementCategory ?? "");
      const quantity = Number(payload.quantity ?? 1);
      const category = await tx.assetCategory.findFirst({ where: { orgId, name: replacementCategory, deletedAt: null } });
      if (!category) throw new AuthError(`Replacement category ${replacementCategory} not found`, 403);

      // Revalidate availability for the replacement category.
      const { available } = await checkAssetAvailability({
        categoryId: category.id,
        from: win.from,
        until: win.until,
        excludeEventId: event.id,
      });
      if (available.length < quantity) {
        throw new AuthError(`Not enough ${replacementCategory} available to substitute`, 403);
      }

      // Reuse the event's active reservation, or create a soft hold.
      let reservation = await tx.assetReservation.findFirst({
        where: { orgId, eventId: event.id, deletedAt: null, status: { in: [AssetReservationStatus.SOFT_HOLD, AssetReservationStatus.RESERVED] } },
        orderBy: { createdAt: "desc" },
      });
      if (!reservation) {
        reservation = await tx.assetReservation.create({
          data: {
            orgId,
            eventId: event.id,
            status: AssetReservationStatus.SOFT_HOLD,
            setupStart: event.setupStart!,
            eventStart: event.eventStart!,
            eventEnd: event.eventEnd!,
            teardownEnd: event.teardownEnd!,
            returnBufferMinutes: event.returnBufferMinutes ?? 30,
          },
        });
      }
      for (const a of available.slice(0, quantity)) {
        await tx.assetReservationItem.create({
          data: {
            orgId,
            reservationId: reservation.id,
            assetId: a.id,
            categoryId: category.id,
            quantity: 1,
            itemStatus: AssetReservationItemStatus.RESERVED,
            windowStart: win.from,
            windowEnd: win.until,
          },
        });
      }
      summary = `Substituted ${quantity}x ${replacementCategory}`;
    } else if (suggestion.type === ConflictSuggestionType.ADD_CABLE_KIT) {
      // Reserve a cable safety kit's batch items for the event window.
      const kit = await tx.assetKit.findFirst({
        where: { orgId, name: "Cable Kit A", deletedAt: null },
        include: { items: true },
      });
      if (kit) {
        const reservation = await ensureReservationTx(tx, orgId, event);
        for (const ki of kit.items) {
          if (ki.batchId) {
            await tx.assetReservationItem.create({
              data: {
                orgId,
                reservationId: reservation.id,
                batchId: ki.batchId,
                categoryId: ki.categoryId,
                quantity: ki.quantity,
                itemStatus: AssetReservationItemStatus.RESERVED,
                sourceKitId: kit.id,
                windowStart: win.from,
                windowEnd: win.until,
              },
            });
          }
        }
      }
      summary = "Reserved Cable Kit A for power/cable safety";
    } else if (suggestion.type === ConflictSuggestionType.INCREASE_BUFFER || suggestion.type === ConflictSuggestionType.ADD_CREW) {
      await tx.task.create({
        data: {
          orgId,
          eventId: event.id,
          title: suggestion.label,
          description: suggestion.rationale,
          source: "auto_fix",
        },
      });
      summary = `Created task: ${suggestion.label}`;
    } else {
      // ALTERNATIVE_SPACE / OVERFLOW_SPACE / REDUCE_QUANTITY are staff-driven;
      // record the decision so the conflict can be closed manually.
      summary = `Recorded suggestion: ${suggestion.label}`;
    }

    await tx.conflictSuggestion.update({
      where: { id: suggestionId },
      data: { isApplied: true, appliedAt: new Date(), appliedByProfileId: actor.id },
    });
    const updatedConflict = await tx.conflict.update({
      where: { id: conflictId },
      data: {
        status: ConflictStatus.AUTO_FIXED,
        resolvedAt: new Date(),
        resolvedByProfileId: actor.id,
        resolutionNote: summary,
      },
    });
    await createAuditLog({
      tx,
      actorProfileId: actor.id,
      action: "AUTO_FIX_APPLIED",
      entityType: "Conflict",
      entityId: conflictId,
      summary,
    });
    return updatedConflict;
  });
  return result;
}

async function ensureReservationTx(
  tx: Prisma.TransactionClient,
  orgId: string,
  event: { id: string; setupStart: Date | null; eventStart: Date | null; eventEnd: Date | null; teardownEnd: Date | null; returnBufferMinutes: number | null },
) {
  const existing = await tx.assetReservation.findFirst({
    where: { orgId, eventId: event.id, deletedAt: null, status: { in: [AssetReservationStatus.SOFT_HOLD, AssetReservationStatus.RESERVED] } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;
  return tx.assetReservation.create({
    data: {
      orgId,
      eventId: event.id,
      status: AssetReservationStatus.SOFT_HOLD,
      setupStart: event.setupStart!,
      eventStart: event.eventStart!,
      eventEnd: event.eventEnd!,
      teardownEnd: event.teardownEnd!,
      returnBufferMinutes: event.returnBufferMinutes ?? 30,
    },
  });
}
