import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getOrgId } from "@/lib/db/org";
import { requirePermission, AuthError } from "@/lib/auth/guards";
import { createAuditLog } from "@/lib/audit/log";
import { ok, handleApiError } from "@/lib/api/respond";
import { AssetReservationStatus } from "@prisma/client";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    await requirePermission("events.plan");
    const { eventId } = await params;
    const orgId = await getOrgId();
    const reservations = await prisma.spaceReservation.findMany({
      where: { orgId, eventId, deletedAt: null },
      include: { space: { select: { id: true, name: true, kind: true, capacity: true } } },
    });
    return ok(reservations);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const actor = await requirePermission("events.plan");
    const { eventId } = await params;
    const orgId = await getOrgId();
    const body = await req.json();

    const event = await prisma.event.findFirst({ where: { id: eventId, orgId, deletedAt: null } });
    if (!event) throw new AuthError("Event not found", 404);

    const reservation = await prisma.spaceReservation.create({
      data: {
        orgId,
        eventId,
        spaceId: body.spaceId,
        status: AssetReservationStatus.SOFT_HOLD,
        setupStart: new Date(body.setupStart ?? event.setupStart!),
        eventStart: new Date(body.eventStart ?? event.eventStart!),
        eventEnd: new Date(body.eventEnd ?? event.eventEnd!),
        teardownEnd: new Date(body.teardownEnd ?? event.teardownEnd!),
        notes: body.notes,
      },
    });
    await createAuditLog({
      actorProfileId: actor.id,
      action: "RESERVE",
      entityType: "SpaceReservation",
      entityId: reservation.id,
      summary: `Space reservation created for event ${eventId}`,
    });
    return ok(reservation, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
