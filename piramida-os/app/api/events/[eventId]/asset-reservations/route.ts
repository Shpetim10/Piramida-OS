import { NextRequest } from "next/server";
import { reserveAssetsForEvent } from "@/lib/services/reservations";
import { prisma } from "@/lib/db/prisma";
import { getOrgId } from "@/lib/db/org";
import { requirePermission } from "@/lib/auth/guards";
import { ok, handleApiError } from "@/lib/api/respond";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    await requirePermission("events.plan");
    const { eventId } = await params;
    const orgId = await getOrgId();
    const reservations = await prisma.assetReservation.findMany({
      where: { orgId, eventId, deletedAt: null },
      include: {
        items: {
          include: {
            asset: { select: { id: true, name: true, assetTag: true, qrCode: true } },
            batch: { select: { id: true, name: true } },
            category: { select: { id: true, name: true, trackingMode: true } },
          },
        },
      },
    });
    return ok(reservations);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const reservation = await reserveAssetsForEvent(eventId);
    return ok(reservation, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
