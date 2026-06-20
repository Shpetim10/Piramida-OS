import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getOrgId } from "@/lib/db/org";
import { requirePermission, AuthError } from "@/lib/auth/guards";
import { ok, handleApiError } from "@/lib/api/respond";
import { ProfileType } from "@prisma/client";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ profileId: string }> }) {
  try {
    await requirePermission("profiles.manage");
    const { profileId } = await params;
    const orgId = await getOrgId();
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, orgId, type: ProfileType.STAFF, deletedAt: null },
      include: { profileRoles: { include: { role: true } } },
    });
    if (!profile) throw new AuthError("Staff not found", 404);
    return ok(profile);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ profileId: string }> }) {
  try {
    await requirePermission("profiles.manage");
    const { profileId } = await params;
    const orgId = await getOrgId();
    const body = await req.json();

    const existing = await prisma.profile.findFirst({ where: { id: profileId, orgId, type: ProfileType.STAFF } });
    if (!existing) throw new AuthError("Staff not found", 404);

    const profile = await prisma.profile.update({
      where: { id: profileId },
      data: {
        fullName: body.fullName ?? existing.fullName,
        phone: body.phone ?? existing.phone,
        title: body.title ?? existing.title,
        status: body.status ?? existing.status,
      },
    });
    return ok(profile);
  } catch (err) {
    return handleApiError(err);
  }
}
