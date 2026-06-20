import { AssetReservationItemStatus, AssetReservationStatus, Prisma, QuoteStatus, TaskPriority } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "../db/prisma";
import { getOrgId } from "../db/org";
import { requirePermission, AuthError } from "../auth/guards";
import { createAuditLog } from "../audit/log";
import { uuid } from "../validation/common";
import { loadWorldSnapshot, type WorldSnapshot } from "../repo";
import { estimateSpacePrice } from "../pricing";
import { normalizeIntake, intakeToRequirementRows } from "../ai/event-intake-contract";
import { matchSpaces, selectMultiSpacePlan } from "../planning/space-matcher";
import { reserveAssetsDryRun } from "../planning/asset-dry-run";
import { computeEventDna } from "../planning/event-dna";
import { computeFeasibility, computeManualWorkSavings } from "../planning/feasibility";
import { generatePlanTasks } from "../planning/tasks";
import { buildQuote, type PlannedQuote } from "../planning/quote";
import type {
  ActiveWindow,
  AssetDryRunResult,
  DnaScore,
  FeasibilityResult,
  PlanningConfig,
  PlanningEvent,
  PlanWindow,
  RequirementMap,
  SelectedSpace,
  SpaceMatch,
} from "../planning/types";

type EventWithPlanningData = NonNullable<Awaited<ReturnType<typeof loadEventForPlanning>>>;

const DEFAULT_CONFIG: PlanningConfig = {
  scoringWeights: {
    capacityFit: 25,
    availability: 20,
    layoutFit: 12,
    adjacency: 15,
    setupFeasibility: 8,
    guestFlow: 10,
    featureFit: 10,
  },
  feasibilityWeights: {
    spaceFit: 30,
    assetReadiness: 25,
    scheduleSafety: 15,
    powerCable: 10,
    staffTask: 10,
    guestReadiness: 10,
  },
  dnaDimensions: [
    { key: "peopleIntensity", label: "People Intensity", shortLabel: "PEOPLE", formula: "guestDensity" },
    { key: "technicalComplexity", label: "Technical Complexity", shortLabel: "TECH", formula: "techCount" },
    { key: "spaceComplexity", label: "Space Complexity", shortLabel: "SPACE", formula: "spaceCount" },
    { key: "assetIntensity", label: "Asset Intensity", shortLabel: "ASSETS", formula: "assetCount" },
    { key: "guestJourney", label: "Guest Journey", shortLabel: "JOURNEY", formula: "registration" },
    { key: "setupRisk", label: "Setup Risk", shortLabel: "SETUP", formula: "setupHours" },
  ],
};

export type SpaceScore = SpaceMatch;
export type DNAScore = DnaScore;

export interface EventPlanResult {
  eventId: string;
  planVersionId: string;
  inputHash: string;
  idempotent: boolean;
  spaceScores: SpaceScore[];
  selectedSpaces: SelectedSpace[];
  assetPlan: AssetDryRunResult;
  assetShortages: AssetDryRunResult["shortages"];
  feasibility: FeasibilityResult;
  feasibilityScore: number;
  dnaScores: DNAScore[];
  quote: PlannedQuote;
  manualWorkSavings: ReturnType<typeof computeManualWorkSavings>;
}

function configFromSnapshot(snapshot: WorldSnapshot): PlanningConfig {
  const scoring = (snapshot.settings["planning.scoring_weights"] ?? {}) as Partial<PlanningConfig["scoringWeights"]>;
  const feasibility = (snapshot.settings["planning.feasibility_weights"] ?? {}) as Partial<PlanningConfig["feasibilityWeights"]>;
  const dna = snapshot.settings["planning.dna_dimensions"] as PlanningConfig["dnaDimensions"] | undefined;
  return {
    scoringWeights: { ...DEFAULT_CONFIG.scoringWeights, ...scoring },
    feasibilityWeights: { ...DEFAULT_CONFIG.feasibilityWeights, ...feasibility },
    dnaDimensions: Array.isArray(dna) && dna.length >= 5 ? dna : DEFAULT_CONFIG.dnaDimensions,
  };
}

function resolveWindow(event: {
  setupStart: Date | null;
  eventStart: Date | null;
  eventEnd: Date | null;
  teardownEnd: Date | null;
  returnBufferMinutes: number | null;
}): PlanWindow {
  if (!event.setupStart || !event.eventStart || !event.eventEnd || !event.teardownEnd) {
    throw new AuthError("Event must have setupStart, eventStart, eventEnd, and teardownEnd before planning", 403);
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

async function loadEventForPlanning(eventId: string, orgId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, orgId, deletedAt: null },
    include: {
      requirements: true,
      request: true,
      tasks: { where: { deletedAt: null } },
      conflicts: true,
      proposals: true,
      publication: true,
      quotes: { include: { items: true }, orderBy: { createdAt: "desc" }, take: 1 },
      planVersions: { orderBy: { version: "desc" }, take: 1 },
    },
  });
}

function requirementsFromEvent(event: EventWithPlanningData): RequirementMap {
  const reqs: RequirementMap = {};
  for (const row of event.requirements) reqs[row.key] = row.valueJson;
  if (Object.keys(reqs).length > 0) {
    reqs.expectedGuests = reqs.expectedGuests ?? event.expectedGuests ?? 0;
    return reqs;
  }

  if (event.request?.extractedJson) {
    const intake = normalizeIntake(event.request.extractedJson);
    const flattened: RequirementMap = {
      eventType: intake.eventType,
      expectedGuests: intake.expectedGuests,
      datePreference: intake.datePreference,
      setupHours: intake.setupHours,
      teardownHours: intake.teardownHours,
      ...intake.needs,
    };
    return flattened;
  }

  return { expectedGuests: event.expectedGuests ?? 0 };
}

async function ensureRequirementRows(event: EventWithPlanningData, orgId: string, requirements: RequirementMap) {
  if (event.requirements.length > 0) return;
  if (!event.request?.extractedJson) return;
  const intake = normalizeIntake(event.request.extractedJson);
  const rows = intakeToRequirementRows(intake);
  await prisma.eventRequirement.createMany({
    data: rows.map((row) => ({
      orgId,
      eventId: event.id,
      key: row.key,
      valueJson: row.valueJson,
      source: row.source,
    })),
  });
  void requirements;
}

function planningEvent(event: EventWithPlanningData, requirements: RequirementMap): PlanningEvent {
  const window = resolveWindow(event);
  return {
    id: event.id,
    title: event.title,
    type: event.type,
    expectedGuests: Number(requirements.expectedGuests ?? event.expectedGuests ?? 0),
    window,
  };
}

async function activeSpaceWindows(orgId: string, event: PlanningEvent): Promise<ActiveWindow[]> {
  const rows = await prisma.spaceReservation.findMany({
    where: {
      orgId,
      deletedAt: null,
      status: { notIn: [AssetReservationStatus.RELEASED, AssetReservationStatus.CANCELLED] },
      setupStart: { lt: event.window.teardownEnd },
      teardownEnd: { gt: event.window.setupStart },
    },
    select: { eventId: true, spaceId: true, setupStart: true, teardownEnd: true },
  });
  return rows.map((row) => ({ eventId: row.eventId, resourceId: row.spaceId, startsAt: row.setupStart, endsAt: row.teardownEnd }));
}

async function activeAssetWindows(orgId: string, event: PlanningEvent): Promise<ActiveWindow[]> {
  const rows = await prisma.assetReservationItem.findMany({
    where: {
      orgId,
      assetId: { not: null },
      itemStatus: { notIn: [AssetReservationItemStatus.RELEASED, AssetReservationItemStatus.CANCELLED, AssetReservationItemStatus.SUBSTITUTED] },
      windowStart: { lt: event.window.availabilityUntil },
      windowEnd: { gt: event.window.setupStart },
      reservation: {
        deletedAt: null,
        status: { notIn: [AssetReservationStatus.RELEASED, AssetReservationStatus.CANCELLED] },
      },
    },
    select: { assetId: true, windowStart: true, windowEnd: true, reservation: { select: { eventId: true } } },
  });
  return rows
    .filter((row) => row.assetId && row.windowStart && row.windowEnd)
    .map((row) => ({ eventId: row.reservation.eventId, resourceId: row.assetId!, startsAt: row.windowStart!, endsAt: row.windowEnd! }));
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner) => {
    if (inner instanceof Date) return inner.toISOString();
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      return Object.fromEntries(Object.entries(inner as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)));
    }
    return inner;
  });
}

function inputHash(input: unknown) {
  return createHash("sha256").update(stableJson(input)).digest("hex");
}

async function computePlan(eventId: string) {
  const orgId = await getOrgId();
  const [event, snapshot] = await Promise.all([
    loadEventForPlanning(eventId, orgId),
    loadWorldSnapshot(orgId),
  ]);
  if (!event) throw new AuthError("Event not found", 404);
  const requirements = requirementsFromEvent(event);
  const planEvent = planningEvent(event, requirements);
  const config = configFromSnapshot(snapshot);
  const [spaceWindows, assetWindows] = await Promise.all([
    activeSpaceWindows(orgId, planEvent),
    activeAssetWindows(orgId, planEvent),
  ]);

  const spaceScores = matchSpaces({ event: planEvent, requirements, spaces: snapshot.spaces, activeSpaceWindows: spaceWindows, config });
  const selectedSpaces = selectMultiSpacePlan(spaceScores, requirements);
  const assetPlan = reserveAssetsDryRun({ event: planEvent, requirements, snapshot, activeAssetWindows: assetWindows });
  const dnaScores = computeEventDna(requirements, config);
  const quote = buildQuote({ event: planEvent, selectedSpaces, assetPlan, snapshot });
  const tasks = generatePlanTasks({ event: planEvent, requirements, selectedSpaces });
  const openConflictCount = event.conflicts.filter((conflict) => conflict.status === "OPEN").length;
  const feasibility = computeFeasibility({
    selectedSpaces,
    assetPlan,
    openConflictCount,
    taskCount: tasks.length,
    hasProposal: event.proposals.length > 0,
    isPublished: event.publication !== null,
    config,
  });
  const manualWorkSavings = computeManualWorkSavings({ selectedSpaces, assetPlan, dnaCount: dnaScores.length });
  const hash = inputHash({
    event: { id: event.id, type: event.type, guests: planEvent.expectedGuests, window: planEvent.window },
    requirements,
    pricingRules: snapshot.pricingRules,
    settings: {
      scoring: config.scoringWeights,
      feasibility: config.feasibilityWeights,
      dna: config.dnaDimensions,
      billing: snapshot.settings["planning.billing_policy"],
    },
    spaces: snapshot.spaces,
    assetWindows,
    spaceWindows,
  });

  return { orgId, event, snapshot, requirements, planEvent, spaceScores, selectedSpaces, assetPlan, dnaScores, quote, tasks, feasibility, manualWorkSavings, inputHash: hash };
}

async function persistQuote(tx: Prisma.TransactionClient, orgId: string, event: EventWithPlanningData, quote: PlannedQuote) {
  let existing = await tx.quote.findFirst({ where: { orgId, eventId: event.id, status: QuoteStatus.DRAFT }, orderBy: { createdAt: "desc" } });
  if (!existing) {
    existing = await tx.quote.create({
      data: { orgId, eventId: event.id, clientId: event.clientId, status: QuoteStatus.DRAFT, currency: quote.currency },
    });
  }
  await tx.quoteItem.deleteMany({ where: { quoteId: existing.id } });
  await tx.quoteItem.createMany({
    data: quote.items.map((item, index) => ({
      orgId,
      quoteId: existing!.id,
      label: item.label,
      category: item.category,
      quantity: new Prisma.Decimal(item.quantity),
      unitPrice: new Prisma.Decimal(item.unitPrice),
      lineTotal: new Prisma.Decimal(item.lineTotal),
      sourceRef: JSON.stringify({ ref: item.sourceRef, breakdown: item.breakdown }),
      sortOrder: index,
    })),
  });
  return tx.quote.update({
    where: { id: existing.id },
    data: {
      currency: quote.currency,
      subtotal: new Prisma.Decimal(quote.subtotal),
      taxTotal: new Prisma.Decimal(quote.taxTotal),
      discountTotal: new Prisma.Decimal(quote.discountTotal),
      total: new Prisma.Decimal(quote.total),
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
}

async function persistTasks(tx: Prisma.TransactionClient, orgId: string, eventId: string, tasks: ReturnType<typeof generatePlanTasks>) {
  const existing = await tx.task.findMany({ where: { orgId, eventId, source: "planning-engine", deletedAt: null } });
  const byTitle = new Map(existing.map((task) => [task.title, task]));
  const persisted = [];
  for (const task of tasks) {
    const current = byTitle.get(task.title);
    if (current) {
      persisted.push(await tx.task.update({
        where: { id: current.id },
        data: {
          description: task.description,
          priority: task.priority as TaskPriority,
          dueAt: task.dueAt,
          spaceId: task.spaceId,
        },
      }));
    } else {
      persisted.push(await tx.task.create({
        data: {
          orgId,
          eventId,
          title: task.title,
          description: task.description,
          priority: task.priority as TaskPriority,
          dueAt: task.dueAt,
          spaceId: task.spaceId,
          source: task.source,
        },
      }));
    }
  }
  return persisted;
}

export async function scoreSpaces(eventId: string): Promise<SpaceScore[]> {
  await requirePermission("events.plan");
  uuid.parse(eventId);
  return (await computePlan(eventId)).spaceScores;
}

export async function computeDNAScores(requirements: Array<{ key: string; valueJson: Prisma.JsonValue }>): Promise<DNAScore[]> {
  const orgId = await getOrgId();
  const snapshot = await loadWorldSnapshot(orgId);
  const config = configFromSnapshot(snapshot);
  const reqs: RequirementMap = {};
  for (const row of requirements) reqs[row.key] = row.valueJson;
  return computeEventDna(reqs, config);
}

export async function generateEventPlan(eventId: string): Promise<EventPlanResult> {
  const actor = await requirePermission("events.plan");
  uuid.parse(eventId);
  const computed = await computePlan(eventId);
  await ensureRequirementRows(computed.event, computed.orgId, computed.requirements);

  const latest = computed.event.planVersions[0];
  const latestSnapshot = latest?.snapshot as { inputHash?: string } | null | undefined;
  if (latest && latestSnapshot?.inputHash === computed.inputHash) {
    return {
      eventId,
      planVersionId: latest.id,
      inputHash: computed.inputHash,
      idempotent: true,
      spaceScores: computed.spaceScores,
      selectedSpaces: computed.selectedSpaces,
      assetPlan: computed.assetPlan,
      assetShortages: computed.assetPlan.shortages,
      feasibility: computed.feasibility,
      feasibilityScore: computed.feasibility.score,
      dnaScores: computed.dnaScores,
      quote: computed.quote,
      manualWorkSavings: computed.manualWorkSavings,
    };
  }

  const version = (latest?.version ?? 0) + 1;
  const planVersion = await prisma.$transaction(async (tx) => {
    await persistQuote(tx, computed.orgId, computed.event, computed.quote);
    await persistTasks(tx, computed.orgId, eventId, computed.tasks);
    await tx.event.update({ where: { id: eventId }, data: { feasibilityScore: computed.feasibility.score } });
    const created = await tx.eventPlanVersion.create({
      data: {
        orgId: computed.orgId,
        eventId,
        version,
        reason: "Deterministic planning engine run",
        createdById: actor.id,
        snapshot: {
          inputHash: computed.inputHash,
          selectedSpaces: computed.selectedSpaces,
          spaceScores: computed.spaceScores,
          assetPlan: computed.assetPlan,
          dnaScores: computed.dnaScores,
          feasibility: computed.feasibility,
          quote: computed.quote,
          manualWorkSavings: computed.manualWorkSavings,
        } as unknown as Prisma.InputJsonValue,
      },
    });
    await tx.event.update({ where: { id: eventId }, data: { currentPlanVersionId: created.id } });
    await createAuditLog({
      tx,
      actorProfileId: actor.id,
      action: "PLAN_GENERATED",
      entityType: "Event",
      entityId: eventId,
      summary: `Generated plan v${version}: ${computed.selectedSpaces.length} spaces, ${computed.assetPlan.shortages.length} shortages, quote ${computed.quote.total} ${computed.quote.currency}`,
      after: { inputHash: computed.inputHash, feasibility: computed.feasibility.score, quoteTotal: computed.quote.total },
    });
    return created;
  }, { timeout: 60_000 });

  return {
    eventId,
    planVersionId: planVersion.id,
    inputHash: computed.inputHash,
    idempotent: false,
    spaceScores: computed.spaceScores,
    selectedSpaces: computed.selectedSpaces,
    assetPlan: computed.assetPlan,
    assetShortages: computed.assetPlan.shortages,
    feasibility: computed.feasibility,
    feasibilityScore: computed.feasibility.score,
    dnaScores: computed.dnaScores,
    quote: computed.quote,
    manualWorkSavings: computed.manualWorkSavings,
  };
}

export async function getSpaceInfo(input: { eventId: string; spaceId: string }) {
  await requirePermission("events.plan");
  uuid.parse(input.eventId);
  uuid.parse(input.spaceId);
  const computed = await computePlan(input.eventId);
  const space = computed.snapshot.spaces.find((item) => item.id === input.spaceId);
  if (!space) throw new AuthError("Space not found", 404);
  const price = estimateSpacePrice(input.spaceId, {
    setupStart: computed.planEvent.window.setupStart,
    eventStart: computed.planEvent.window.eventStart,
    eventEnd: computed.planEvent.window.eventEnd,
    teardownEnd: computed.planEvent.window.teardownEnd,
  }, computed.snapshot, { eventType: computed.planEvent.type });
  const match = computed.spaceScores.find((item) => item.spaceId === input.spaceId);
  return {
    space,
    match,
    price,
    quoteLine: computed.quote.items.find((item) => {
      try {
        const parsed = JSON.parse(item.sourceRef) as { type?: string; spaceId?: string };
        return parsed.type === "space" && parsed.spaceId === input.spaceId;
      } catch {
        return false;
      }
    }) ?? null,
  };
}
