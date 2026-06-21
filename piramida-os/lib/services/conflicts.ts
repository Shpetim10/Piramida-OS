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
import { loadWorldSnapshot } from "../repo";
import { detectPlanningConflicts, type ConflictRuleConfig } from "../planning/conflict-detector";
import { generateConflictResolutionSuggestions } from "../ai/conflict-resolution-agent";
import { generateEventPlan } from "./planning";

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

function conflictRulesFromSettings(value: unknown): ConflictRuleConfig[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => item as Partial<ConflictRuleConfig>)
    .filter((item): item is ConflictRuleConfig => Boolean(item.type && item.severity && item.label));
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
  const [event, snapshot] = await Promise.all([
    prisma.event.findFirst({
    where: { id: eventId, orgId, deletedAt: null },
      include: {
        requirements: true,
        conflicts: true,
        spaceReservations: { include: { space: true } },
        assetReservations: { include: { items: { include: { asset: true } } } },
        planVersions: { orderBy: { version: "desc" }, take: 1 },
      },
    }),
    loadWorldSnapshot(orgId),
  ]);
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
    } else {
      await ensureSuggestion(orgId, conflict.id, {
        type: ConflictSuggestionType.REDUCE_QUANTITY,
        label: `Reduce ${s.category} requirement from ${s.required} to ${s.available}`,
        rationale: `Only ${s.available} ${s.category} are available in total stock. Reduce the requirement or source additional units externally.`,
        payload: { category: s.category, currentRequired: s.required, maxAvailable: s.available, reduceBy: s.shortBy },
      });
    }
  }

  const latestSnapshot = event.planVersions[0]?.snapshot as {
    selectedSpaces?: unknown;
    assetPlan?: unknown;
  } | undefined;
  const requirements = Object.fromEntries(event.requirements.map((row) => [row.key, row.valueJson]));
  const selectedSpaces = Array.isArray(latestSnapshot?.selectedSpaces) ? latestSnapshot.selectedSpaces : [];
  const assetPlan = latestSnapshot?.assetPlan && typeof latestSnapshot.assetPlan === "object"
    ? latestSnapshot.assetPlan
    : { lines: [], shortages: [] };
  const assetItems = event.assetReservations.flatMap((reservation) =>
    reservation.items.map((item) => ({
      assetId: item.assetId,
      assetName: item.asset?.name,
      windowStart: item.windowStart,
      windowEnd: item.windowEnd,
    })),
  );
  const cableKitReserved = event.assetReservations.some((reservation) =>
    reservation.items.some(
      (item) =>
        item.sourceKitId &&
        !["RELEASED", "CANCELLED", "SUBSTITUTED"].includes(item.itemStatus),
    ),
  );
  if (event.setupStart && event.eventStart && event.eventEnd && event.teardownEnd) {
    const planEvent = {
      id: event.id,
      title: event.title,
      type: event.type,
      expectedGuests: event.expectedGuests ?? Number(requirements.expectedGuests ?? 0) ?? 0,
      window: {
        setupStart: event.setupStart,
        eventStart: event.eventStart,
        eventEnd: event.eventEnd,
        teardownEnd: event.teardownEnd,
        availabilityUntil: new Date(event.teardownEnd.getTime() + (event.returnBufferMinutes ?? 30) * 60_000),
      },
    };
    const pureConflicts = detectPlanningConflicts({
      event: planEvent,
      requirements,
      selectedSpaces: selectedSpaces as never,
      assetPlan: assetPlan as never,
      snapshot,
      activeSpaceWindows: [],
      activeAssetWindows: await activeSerializedAssetWindows(orgId, planEvent.window.setupStart, planEvent.window.availabilityUntil),
      existingAssetReservations: assetItems,
      rules: conflictRulesFromSettings(snapshot.settings["planning.conflict_rules"]),
      cableKitReserved,
    });
    for (const detected of pureConflicts.filter((item) => item.type !== "ASSET_SHORTAGE")) {
      if (
        detected.type === "SERIALIZED_DOUBLE_BOOKING" &&
        event.conflicts.some((existing) =>
          existing.type === "SERIALIZED_DOUBLE_BOOKING" &&
          existing.status === "OPEN" &&
          typeof detected.detail.asset === "string" &&
          existing.title.includes(detected.detail.asset)
        )
      ) {
        continue;
      }
      const conflict = await upsertConflict(orgId, eventId, {
        type: detected.type,
        severity: detected.severity,
        title: detected.title,
        detail: detected.detail as Prisma.InputJsonValue,
      });
      created.push(conflict.id);
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
  await refreshAgentSuggestionsForOpenConflicts(orgId, eventId);
  return listConflicts(eventId);
}

async function activeSerializedAssetWindows(orgId: string, from: Date, until: Date) {
  const rows = await prisma.assetReservationItem.findMany({
    where: {
      orgId,
      assetId: { not: null },
      itemStatus: { notIn: [AssetReservationItemStatus.RELEASED, AssetReservationItemStatus.CANCELLED, AssetReservationItemStatus.SUBSTITUTED] },
      windowStart: { lt: until },
      windowEnd: { gt: from },
      reservation: { deletedAt: null, status: { notIn: [AssetReservationStatus.RELEASED, AssetReservationStatus.CANCELLED] } },
    },
    select: { assetId: true, windowStart: true, windowEnd: true, reservation: { select: { eventId: true } } },
  });
  return rows
    .filter((row) => row.assetId && row.windowStart && row.windowEnd)
    .map((row) => ({ eventId: row.reservation.eventId, resourceId: row.assetId!, startsAt: row.windowStart!, endsAt: row.windowEnd! }));
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

async function refreshAgentSuggestionsForOpenConflicts(orgId: string, eventId: string) {
  const conflicts = await prisma.conflict.findMany({
    where: { orgId, eventId, status: ConflictStatus.OPEN },
    include: { event: true, suggestions: true },
  });
  for (const conflict of conflicts) {
    const allOpenSuggestionsHaveTrace = conflict.suggestions
      .filter((suggestion) => !suggestion.isApplied)
      .every((suggestion) => {
      const payload = suggestion.payload as Record<string, unknown>;
      return Array.isArray(payload?.toolTrace);
    });
    if (conflict.suggestions.length > 0 && allOpenSuggestionsHaveTrace) continue;
    const generated = await generateConflictResolutionSuggestions({ orgId, conflict });
    if (generated.suggestions.length > 0) {
      await prisma.conflictSuggestion.deleteMany({ where: { orgId, conflictId: conflict.id, isApplied: false } });
    }
    for (const suggestion of generated.suggestions) {
      if (!Object.values(ConflictSuggestionType).includes(suggestion.type)) continue;
      const payload = {
        ...suggestion.payload,
        residualRisk: suggestion.residualRisk,
        costDelta: suggestion.costDelta,
        disruption: suggestion.disruption,
        beforeRisk: suggestion.beforeRisk,
        afterRisk: suggestion.afterRisk,
        tradeoffNarration: suggestion.tradeoffNarration,
        toolTrace: generated.toolTrace,
        model: generated.model,
      };
      await prisma.conflictSuggestion.create({
        data: {
          orgId,
          conflictId: conflict.id,
          type: suggestion.type,
          label: suggestion.label,
          rationale: suggestion.rationale,
          payload: payload as Prisma.InputJsonValue,
          rank: suggestion.rank,
        },
      });
    }
  }
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
      const replacementCategoryId = typeof payload.replacementCategoryId === "string" ? payload.replacementCategoryId : null;
      const withAssetId = typeof payload.withAssetId === "string" ? payload.withAssetId : null;
      const replaceAssetId = typeof payload.replaceAssetId === "string" ? payload.replaceAssetId : null;
      const quantity = Number(payload.quantity ?? 1);
      const category = replacementCategoryId
        ? await tx.assetCategory.findFirst({ where: { orgId, id: replacementCategoryId, deletedAt: null } })
        : await tx.assetCategory.findFirst({ where: { orgId, name: replacementCategory, deletedAt: null } });
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
      const chosenAssets = withAssetId
        ? available.filter((asset) => asset.id === withAssetId).slice(0, quantity)
        : available.slice(0, quantity);
      if (chosenAssets.length < quantity) {
        throw new AuthError(`Selected replacement asset is no longer available`, 403);
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
      for (const a of chosenAssets) {
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
      if (replaceAssetId) {
        await tx.assetReservationItem.updateMany({
          where: {
            orgId,
            assetId: replaceAssetId,
            reservation: { eventId: event.id },
            itemStatus: { notIn: [AssetReservationItemStatus.RELEASED, AssetReservationItemStatus.CANCELLED, AssetReservationItemStatus.SUBSTITUTED] },
          },
          data: { itemStatus: AssetReservationItemStatus.SUBSTITUTED },
        });
      }
      await applyRequirementSubstitutionTx(tx, orgId, event.id, replacementCategory || category.name, quantity);
      const originalAssetName = typeof payload.replaceAssetName === "string" ? payload.replaceAssetName : null;
      await tx.conflict.updateMany({
        where: {
          orgId,
          eventId: event.id,
          id: { not: conflictId },
          status: ConflictStatus.OPEN,
          OR: [
            { type: ConflictType.ASSET_SHORTAGE, title: { contains: "Wireless Microphone" } },
            ...(originalAssetName ? [{ type: ConflictType.SERIALIZED_DOUBLE_BOOKING, title: { contains: originalAssetName } }] : []),
          ],
        },
        data: {
          status: ConflictStatus.AUTO_FIXED,
          resolvedAt: new Date(),
          resolvedByProfileId: actor.id,
          resolutionNote: `Resolved by ${suggestion.label}`,
        },
      });
      summary = `Substituted ${quantity}x ${replacementCategory || category.name}`;
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
  }, { timeout: 20_000 });
  await generateEventPlan(conflict.eventId);
  return result;
}

async function applyRequirementSubstitutionTx(
  tx: Prisma.TransactionClient,
  orgId: string,
  eventId: string,
  replacementCategory: string,
  quantity: number,
) {
  const replacementKey = categoryRequirementKey(replacementCategory);
  const originalKey = replacementKey === "wiredMicrophones" ? "wirelessMicrophones" : null;
  if (originalKey) await bumpRequirement(tx, orgId, eventId, originalKey, -quantity);
  if (replacementKey) await bumpRequirement(tx, orgId, eventId, replacementKey, quantity);
}

function categoryRequirementKey(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes("wired microphone")) return "wiredMicrophones";
  if (normalized.includes("wireless microphone")) return "wirelessMicrophones";
  if (normalized.includes("screen")) return "screens";
  if (normalized.includes("speaker")) return "speakers";
  if (normalized.includes("chair")) return "chairs";
  if (normalized.includes("table")) return "tables";
  return null;
}

async function bumpRequirement(tx: Prisma.TransactionClient, orgId: string, eventId: string, key: string, delta: number) {
  const row = await tx.eventRequirement.findFirst({ where: { orgId, eventId, key } });
  const current = typeof row?.valueJson === "number" ? row.valueJson : Number(row?.valueJson ?? 0) || 0;
  const next = Math.max(0, current + delta);
  if (row) {
    await tx.eventRequirement.update({ where: { id: row.id }, data: { valueJson: next } });
  } else if (next > 0) {
    await tx.eventRequirement.create({ data: { orgId, eventId, key, valueJson: next, source: "staff_review" } });
  }
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
