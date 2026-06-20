import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getOrgId } from "@/lib/db/org";
import { requirePermission } from "@/lib/auth/guards";
import { ok, handleApiError } from "@/lib/api/respond";
import { ProfileType, ProfileStatus } from "@prisma/client";

export async function GET() {
  try {
    await requirePermission("profiles.manage");
    const orgId = await getOrgId();
    const staff = await prisma.profile.findMany({
      where: { orgId, type: ProfileType.STAFF, deletedAt: null },
      include: {
        profileRoles: { include: { role: { select: { code: true, label: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });
    return ok(staff);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission("profiles.manage");
    const orgId = await getOrgId();
    const body = await req.json();

    const existing = await prisma.profile.findFirst({ where: { orgId, email: body.email } });
    if (existing) return ok({ error: "Email already exists" }, 409 as const);

    const profile = await prisma.profile.create({
      data: {
        orgId,
        type: ProfileType.STAFF,
        status: ProfileStatus.INVITED,
        fullName: body.fullName,
        email: body.email,
        phone: body.phone ?? null,
        title: body.title ?? null,
      },
    });

    if (body.roleIds && Array.isArray(body.roleIds)) {
      for (const roleId of body.roleIds) {
        await prisma.profileRole.upsert({
          where: { profileId_roleId: { profileId: profile.id, roleId } },
          update: {},
          create: { orgId, profileId: profile.id, roleId },
        });
      }
    }

    return ok(profile, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
