/**
 * lib/repo — Pure WorldSnapshot loader.
 *
 * No business logic here. Callers get a single consistent snapshot of all
 * venue data for a given org. All planning / pricing / AI tools read from
 * this snapshot — never from inline Prisma queries — so the world state is
 * fetched once per request and the same data is seen by every tool call.
 */
import type {
  Space, AssetCategory, Asset, AssetBatch, AssetKitItem, PricingRule,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

// ---------------------------------------------------------------------------
// Typed shapes returned by the repo (subset of Prisma types + computed helpers)
// ---------------------------------------------------------------------------

export interface RepoSpace {
  id: string;
  name: string;
  kind: string;
  capacity: number | null;
  standingCapacity: number | null;
  comfortFlow: number | null;
  areaSqm: number | null;
  features: Record<string, unknown>;
  publicVisible: boolean;
  adjacentSpaceIds: string[];
}

export interface RepoCategory {
  id: string;
  name: string;
  trackingMode: string;
  unit: string | null;
  defaultSetupMinutes: number;
  defaultTeardownMinutes: number;
  defaultReturnBufferMinutes: number;
  replacementCategoryId: string | null;
}

export interface RepoAsset {
  id: string;
  categoryId: string;
  name: string;
  assetTag: string;
  status: string;
  condition: string;
}

export interface RepoBatch {
  id: string;
  categoryId: string;
  name: string;
  totalQuantity: number;
  availableQuantity: number;
}

export interface RepoKit {
  id: string;
  name: string;
  items: Array<{ batchId: string | null; assetId: string | null; quantity: number }>;
}

export interface RepoPricingRule {
  id: string;
  scope: string;
  targetId: string | null;
  label: string;
  matchJson: Record<string, unknown>;
  rateType: string;
  amount: number;
  currency: string;
  minBillableHours: number | null;
  priority: number;
}

export interface WorldSnapshot {
  orgId: string;
  spaces: RepoSpace[];
  categories: RepoCategory[];
  serializedAssets: RepoAsset[];
  batches: RepoBatch[];
  kits: RepoKit[];
  pricingRules: RepoPricingRule[];
  settings: Record<string, unknown>;
  loadedAt: Date;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loadWorldSnapshot(orgId: string): Promise<WorldSnapshot> {
  const [spaces, adjacencies, categories, assets, batches, kits, settingRows, pricingRows] =
    await Promise.all([
      prisma.space.findMany({
        where: { orgId, deletedAt: null },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.spaceAdjacency.findMany({ where: { orgId } }),
      prisma.assetCategory.findMany({
        where: { orgId, deletedAt: null },
        orderBy: { name: "asc" },
      }),
      prisma.asset.findMany({
        where: { orgId, deletedAt: null },
        orderBy: { name: "asc" },
      }),
      prisma.assetBatch.findMany({
        where: { orgId, deletedAt: null },
        orderBy: { name: "asc" },
      }),
      prisma.assetKit.findMany({
        where: { orgId, deletedAt: null },
        include: { items: true },
      }),
      prisma.appSetting.findMany({ where: { orgId } }),
      prisma.pricingRule.findMany({
        where: { orgId, active: true },
        orderBy: { priority: "asc" },
      }),
    ]);

  // Build adjacency map: spaceId → list of adjacent spaceIds
  const adjMap = new Map<string, string[]>();
  for (const a of adjacencies) {
    const list = adjMap.get(a.fromSpaceId) ?? [];
    list.push(a.toSpaceId);
    adjMap.set(a.fromSpaceId, list);
    // Bidirectional
    const rev = adjMap.get(a.toSpaceId) ?? [];
    rev.push(a.fromSpaceId);
    adjMap.set(a.toSpaceId, rev);
  }

  // Parse AppSettings into a plain record
  const settings: Record<string, unknown> = {};
  for (const row of settingRows) {
    switch (row.valueType) {
      case "NUMBER":
        settings[row.key] = Number(row.value);
        break;
      case "BOOLEAN":
        settings[row.key] = row.value === "true";
        break;
      case "JSON":
        try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = null; }
        break;
      default:
        settings[row.key] = row.value;
    }
  }

  return {
    orgId,
    spaces: spaces.map((s: Space) => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      capacity: s.capacity,
      standingCapacity: s.standingCapacity,
      comfortFlow: s.comfortFlow,
      areaSqm: s.areaSqm,
      features: (s.features ?? {}) as Record<string, unknown>,
      publicVisible: s.publicVisible,
      adjacentSpaceIds: adjMap.get(s.id) ?? [],
    })),
    categories: categories.map((c: AssetCategory) => ({
      id: c.id,
      name: c.name,
      trackingMode: c.trackingMode,
      unit: c.unit,
      defaultSetupMinutes: c.defaultSetupMinutes,
      defaultTeardownMinutes: c.defaultTeardownMinutes,
      defaultReturnBufferMinutes: c.defaultReturnBufferMinutes,
      replacementCategoryId: c.replacementCategoryId,
    })),
    serializedAssets: assets.map((a: Asset) => ({
      id: a.id,
      categoryId: a.categoryId,
      name: a.name,
      assetTag: a.assetTag,
      status: a.status,
      condition: a.condition,
    })),
    batches: batches.map((b: AssetBatch) => ({
      id: b.id,
      categoryId: b.categoryId,
      name: b.name,
      totalQuantity: b.totalQuantity,
      availableQuantity: b.availableQuantity,
    })),
    kits: kits.map((k) => ({
      id: k.id,
      name: k.name,
      items: k.items.map((i: AssetKitItem) => ({
        batchId: i.batchId,
        assetId: i.assetId,
        quantity: i.quantity,
      })),
    })),
    pricingRules: pricingRows.map((r: PricingRule) => ({
      id: r.id,
      scope: r.scope,
      targetId: r.targetId,
      label: r.label,
      matchJson: (r.matchJson ?? {}) as Record<string, unknown>,
      rateType: r.rateType,
      amount: Number(r.amount),
      currency: r.currency,
      minBillableHours: r.minBillableHours ? Number(r.minBillableHours) : null,
      priority: r.priority,
    })),
    settings,
    loadedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Targeted loaders (for route handlers that need one entity without a full snapshot)
// ---------------------------------------------------------------------------

export async function getSpaceById(spaceId: string) {
  return prisma.space.findUnique({
    where: { id: spaceId },
    include: {
      adjacenciesFrom: { select: { toSpaceId: true } },
      adjacenciesTo: { select: { fromSpaceId: true } },
    },
  });
}

export async function getAssetsByCategory(categoryId: string) {
  return prisma.asset.findMany({
    where: { categoryId, deletedAt: null },
    orderBy: { name: "asc" },
  });
}

/** Returns active reservation windows (setup_start → teardown_end) for a space. */
export async function getSpaceReservationWindows(spaceId: string, from: Date, to: Date) {
  return prisma.spaceReservation.findMany({
    where: {
      spaceId,
      status: { notIn: ["RELEASED", "CANCELLED"] },
      OR: [
        { setupStart: { lte: to }, teardownEnd: { gte: from } },
      ],
    },
    select: {
      id: true,
      eventId: true,
      status: true,
      setupStart: true,
      teardownEnd: true,
    },
  });
}

/** Returns active reservation item windows for a serialized asset. */
export async function getAssetReservationWindows(assetId: string, from: Date, to: Date) {
  return prisma.assetReservationItem.findMany({
    where: {
      assetId,
      itemStatus: { notIn: ["RELEASED", "CANCELLED", "SUBSTITUTED"] },
      windowStart: { lte: to },
      windowEnd: { gte: from },
    },
    select: {
      id: true,
      reservationId: true,
      itemStatus: true,
      windowStart: true,
      windowEnd: true,
    },
  });
}
