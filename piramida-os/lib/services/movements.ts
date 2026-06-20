import { prisma } from "../db/prisma";
import { getOrgId } from "../db/org";
import { createAuditLog } from "../audit/log";
import { requirePermission, AuthError } from "../auth/guards";
import { createAssetMovementInput } from "../validation/schemas";
import { uuid } from "../validation/common";

// Asset movement log — scan/pick/return workflows.
// Each scan creates an immutable movement row. The asset's currentLocationId
// and status are updated atomically in the same transaction.

type MovStatus = "PLANNED" | "PICKED" | "IN_TRANSIT" | "DELIVERED" | "RETURNED" | "CANCELLED";
type AssetStatus = "AVAILABLE" | "SOFT_HOLD" | "RESERVED" | "PICKED" | "IN_TRANSIT" | "IN_USE" | "RETURNED" | "NEEDS_INSPECTION" | "MAINTENANCE" | "MISSING" | "RETIRED";

function resolveAssetStatus(movStatus: MovStatus): AssetStatus | null {
  switch (movStatus) {
    case "PICKED":      return "PICKED";
    case "IN_TRANSIT":  return "IN_TRANSIT";
    case "DELIVERED":   return "IN_USE";
    case "RETURNED":    return "RETURNED";
    default:            return null;
  }
}

export async function logMovement(input: unknown) {
  const actor = await requirePermission("inventory.scan");
  const data = createAssetMovementInput.parse(input);
  const orgId = await getOrgId();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const movement = await prisma.$transaction(async (tx: any) => {
    const movStatus = (data.status ?? "PLANNED") as MovStatus;
    const mov = await tx.assetMovement.create({
      data: {
        orgId,
        assetId: data.assetId ?? null,
        batchId: data.batchId ?? null,
        reservationItemId: data.reservationItemId ?? null,
        quantity: data.quantity ?? null,
        fromLocationId: data.fromLocationId ?? null,
        toLocationId: data.toLocationId ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: movStatus as any,
        scannedByProfileId: actor.id,
        notes: data.notes ?? null,
      },
    });

    // Update the serialized asset's current location when it moves.
    if (data.assetId && data.toLocationId) {
      const newStatus = resolveAssetStatus(movStatus);
      await (tx as typeof prisma).asset.update({
        where: { id: data.assetId },
        data: {
          currentLocationId: data.toLocationId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(newStatus ? { status: newStatus as any } : {}),
        },
      });
    }

    await createAuditLog({
      actorProfileId: actor.id,
      action: "CREATE",
      entityType: "AssetMovement",
      entityId: mov.id,
      summary: `Logged movement — status: ${mov.status}`,
      tx: tx as Parameters<typeof createAuditLog>[0]["tx"],
    });

    return mov;
  });

  return movement;
}

export async function listMovements(opts: { assetId?: string; batchId?: string; limit?: number }) {
  await requirePermission("inventory.scan");
  if (!opts.assetId && !opts.batchId) {
    throw new AuthError("Provide assetId or batchId", 403);
  }
  if (opts.assetId) uuid.parse(opts.assetId);
  if (opts.batchId) uuid.parse(opts.batchId);
  const orgId = await getOrgId();
  return prisma.assetMovement.findMany({
    where: {
      orgId,
      ...(opts.assetId ? { assetId: opts.assetId } : {}),
      ...(opts.batchId ? { batchId: opts.batchId } : {}),
    },
    include: {
      fromLocation: { select: { name: true } },
      toLocation: { select: { name: true } },
    },
    orderBy: { scannedAt: "desc" },
    take: opts.limit ?? 50,
  });
}
