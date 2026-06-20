import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { getOrgId } from "../db/org";
import { createAuditLog } from "../audit/log";
import { requirePermission, AuthError } from "../auth/guards";
import {
  createAssetCategoryInput,
  createAssetInput,
  createAssetBatchInput,
  createAssetKitInput,
  createAssetKitItemInput,
} from "../validation/schemas";
import { uuid } from "../validation/common";

// Inventory catalog CRUD: categories, serialized assets, bulk batches, kits.
// Reservation/availability logic lives in services/reservations.ts.

// -- Categories -------------------------------------------------------------

export async function listAssetCategories() {
  const orgId = await getOrgId();
  return prisma.assetCategory.findMany({
    where: { orgId, deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function createAssetCategory(input: unknown) {
  const actor = await requirePermission("inventory.manage");
  const data = createAssetCategoryInput.parse(input);
  const orgId = await getOrgId();
  const cat = await prisma.assetCategory.create({
    data: { orgId, ...data } as unknown as Prisma.AssetCategoryUncheckedCreateInput,
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "CREATE",
    entityType: "AssetCategory",
    entityId: cat.id,
    summary: `Created asset category ${cat.name}`,
  });
  return cat;
}

export async function updateAssetCategory(id: string, input: unknown) {
  const actor = await requirePermission("inventory.manage");
  uuid.parse(id);
  const data = createAssetCategoryInput.partial().parse(input);
  const orgId = await getOrgId();
  const existing = await prisma.assetCategory.findFirst({ where: { id, orgId, deletedAt: null } });
  if (!existing) throw new AuthError("Category not found", 404);
  const cat = await prisma.assetCategory.update({
    where: { id },
    data: data as unknown as Prisma.AssetCategoryUncheckedUpdateInput,
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "UPDATE",
    entityType: "AssetCategory",
    entityId: id,
    summary: `Updated category ${cat.name}`,
  });
  return cat;
}

export async function deleteAssetCategory(id: string) {
  const actor = await requirePermission("inventory.manage");
  uuid.parse(id);
  const orgId = await getOrgId();
  const existing = await prisma.assetCategory.findFirst({ where: { id, orgId, deletedAt: null } });
  if (!existing) throw new AuthError("Category not found", 404);
  const cat = await prisma.assetCategory.update({ where: { id }, data: { deletedAt: new Date() } });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "DELETE",
    entityType: "AssetCategory",
    entityId: id,
    summary: `Archived category ${existing.name}`,
  });
  return cat;
}

// -- Serialized assets ------------------------------------------------------

export async function listAssets(opts?: { categoryId?: string }) {
  const orgId = await getOrgId();
  return prisma.asset.findMany({
    where: { orgId, deletedAt: null, ...(opts?.categoryId ? { categoryId: opts.categoryId } : {}) },
    include: { category: { select: { name: true, trackingMode: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createAsset(input: unknown) {
  const actor = await requirePermission("inventory.manage");
  const data = createAssetInput.parse(input);
  const orgId = await getOrgId();
  const asset = await prisma.asset.create({
    data: { orgId, ...data } as unknown as Prisma.AssetUncheckedCreateInput,
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "CREATE",
    entityType: "Asset",
    entityId: asset.id,
    summary: `Created asset ${asset.name}`,
  });
  return asset;
}

export async function updateAsset(id: string, input: unknown) {
  const actor = await requirePermission("inventory.manage");
  uuid.parse(id);
  const data = createAssetInput.partial().parse(input);
  const orgId = await getOrgId();
  const existing = await prisma.asset.findFirst({ where: { id, orgId, deletedAt: null } });
  if (!existing) throw new AuthError("Asset not found", 404);
  const asset = await prisma.asset.update({
    where: { id },
    data: data as unknown as Prisma.AssetUncheckedUpdateInput,
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "UPDATE",
    entityType: "Asset",
    entityId: id,
    summary: `Updated asset ${asset.name}`,
    after: data as Prisma.InputJsonValue,
  });
  return asset;
}

export async function deleteAsset(id: string) {
  const actor = await requirePermission("inventory.manage");
  uuid.parse(id);
  const orgId = await getOrgId();
  const existing = await prisma.asset.findFirst({ where: { id, orgId, deletedAt: null } });
  if (!existing) throw new AuthError("Asset not found", 404);
  const asset = await prisma.asset.update({ where: { id }, data: { deletedAt: new Date() } });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "DELETE",
    entityType: "Asset",
    entityId: id,
    summary: `Archived asset ${existing.name}`,
  });
  return asset;
}

// -- Bulk batches -----------------------------------------------------------

export async function listAssetBatches(opts?: { categoryId?: string }) {
  const orgId = await getOrgId();
  return prisma.assetBatch.findMany({
    where: { orgId, deletedAt: null, ...(opts?.categoryId ? { categoryId: opts.categoryId } : {}) },
    include: { category: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createAssetBatch(input: unknown) {
  const actor = await requirePermission("inventory.manage");
  const data = createAssetBatchInput.parse(input);
  const orgId = await getOrgId();
  const batch = await prisma.assetBatch.create({
    data: {
      orgId,
      ...data,
      availableQuantity: data.availableQuantity ?? data.totalQuantity,
    } as unknown as Prisma.AssetBatchUncheckedCreateInput,
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "CREATE",
    entityType: "AssetBatch",
    entityId: batch.id,
    summary: `Created batch ${batch.name} (${batch.totalQuantity})`,
  });
  return batch;
}

export async function updateAssetBatch(id: string, input: unknown) {
  const actor = await requirePermission("inventory.manage");
  uuid.parse(id);
  const data = createAssetBatchInput.partial().parse(input);
  const orgId = await getOrgId();
  const existing = await prisma.assetBatch.findFirst({ where: { id, orgId, deletedAt: null } });
  if (!existing) throw new AuthError("Batch not found", 404);
  const batch = await prisma.assetBatch.update({
    where: { id },
    data: data as unknown as Prisma.AssetBatchUncheckedUpdateInput,
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "UPDATE",
    entityType: "AssetBatch",
    entityId: id,
    summary: `Updated batch ${batch.name}`,
  });
  return batch;
}

export async function deleteAssetBatch(id: string) {
  const actor = await requirePermission("inventory.manage");
  uuid.parse(id);
  const orgId = await getOrgId();
  const existing = await prisma.assetBatch.findFirst({ where: { id, orgId, deletedAt: null } });
  if (!existing) throw new AuthError("Batch not found", 404);
  const batch = await prisma.assetBatch.update({ where: { id }, data: { deletedAt: new Date() } });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "DELETE",
    entityType: "AssetBatch",
    entityId: id,
    summary: `Archived batch ${existing.name}`,
  });
  return batch;
}

// -- Kits -------------------------------------------------------------------

export async function listAssetKits() {
  const orgId = await getOrgId();
  return prisma.assetKit.findMany({
    where: { orgId, deletedAt: null },
    include: { items: { include: { category: true, asset: true, batch: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createAssetKit(input: unknown) {
  const actor = await requirePermission("inventory.manage");
  const data = createAssetKitInput.parse(input);
  const orgId = await getOrgId();
  const kit = await prisma.assetKit.create({
    data: { orgId, ...data } as unknown as Prisma.AssetKitUncheckedCreateInput,
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "CREATE",
    entityType: "AssetKit",
    entityId: kit.id,
    summary: `Created kit ${kit.name}`,
  });
  return kit;
}

export async function updateAssetKit(id: string, input: unknown) {
  const actor = await requirePermission("inventory.manage");
  uuid.parse(id);
  const data = createAssetKitInput.partial().parse(input);
  const orgId = await getOrgId();
  const existing = await prisma.assetKit.findFirst({ where: { id, orgId, deletedAt: null } });
  if (!existing) throw new AuthError("Kit not found", 404);
  const kit = await prisma.assetKit.update({
    where: { id },
    data: data as unknown as Prisma.AssetKitUncheckedUpdateInput,
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "UPDATE",
    entityType: "AssetKit",
    entityId: id,
    summary: `Updated kit ${kit.name}`,
  });
  return kit;
}

export async function deleteAssetKit(id: string) {
  const actor = await requirePermission("inventory.manage");
  uuid.parse(id);
  const orgId = await getOrgId();
  const existing = await prisma.assetKit.findFirst({ where: { id, orgId, deletedAt: null } });
  if (!existing) throw new AuthError("Kit not found", 404);
  const kit = await prisma.assetKit.update({ where: { id }, data: { deletedAt: new Date() } });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "DELETE",
    entityType: "AssetKit",
    entityId: id,
    summary: `Archived kit ${existing.name}`,
  });
  return kit;
}

export async function addAssetKitItem(input: unknown) {
  const actor = await requirePermission("inventory.manage");
  const data = createAssetKitItemInput.parse(input);
  const orgId = await getOrgId();
  const item = await prisma.assetKitItem.create({ data: { orgId, ...data } });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "UPDATE",
    entityType: "AssetKit",
    entityId: data.kitId,
    summary: `Added kit item`,
  });
  return item;
}

export async function updateAssetKitItem(id: string, input: unknown) {
  await requirePermission("inventory.manage");
  uuid.parse(id);
  const data = z
    .object({ quantity: z.coerce.number().int().positive(), isOptional: z.boolean(), sortOrder: z.coerce.number().int() })
    .partial()
    .parse(input);
  return prisma.assetKitItem.update({ where: { id }, data });
}

export async function removeAssetKitItem(id: string) {
  await requirePermission("inventory.manage");
  uuid.parse(id);
  return prisma.assetKitItem.delete({ where: { id } });
}

/** QR scan resolver: a code maps to exactly one serialized asset or one batch. */
export async function getAssetOrBatchByQr(qrCode: string) {
  const orgId = await getOrgId();
  const asset = await prisma.asset.findFirst({
    where: { orgId, qrCode, deletedAt: null },
    include: { category: true, currentLocation: true },
  });
  if (asset) return { kind: "asset" as const, asset };
  // Batches have no qr column in the locked schema; resolve by metadata.qr.
  const batch = await prisma.assetBatch.findFirst({
    where: { orgId, deletedAt: null, metadata: { path: ["qr"], equals: qrCode } },
    include: { category: true },
  });
  if (batch) return { kind: "batch" as const, batch };
  return null;
}
