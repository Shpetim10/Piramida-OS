import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getOrgId } from "@/lib/db/org";
import { requirePermission } from "@/lib/auth/guards";
import { ok, apiError, handleApiError } from "@/lib/api/respond";
import { ProfileType, ProfileStatus } from "@prisma/client";
import { createSupabaseAdminClient } from "@/lib/auth/supabase-admin";

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

    if (!body.fullName?.trim()) return apiError("Full name is required", 400);
    if (!body.email?.trim()) return apiError("Email is required", 400);

    const existing = await prisma.profile.findFirst({ where: { orgId, email: body.email } });
    if (existing) return apiError("Email already exists", 409);

    // Send Supabase invite email — creates an auth user and emails a magic link.
    const supabase = createSupabaseAdminClient();
    let authUserId: string | undefined;
    if (supabase) {
      const redirectTo = `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/auth/confirm`;
      const { data: invited, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(
        body.email.trim(),
        { data: { full_name: body.fullName.trim() }, redirectTo },
      );
      if (inviteErr) {
        console.error("[staff invite] Supabase invite error:", inviteErr.message);
        return apiError(`Could not send invite email: ${inviteErr.message}`, 500);
      }
      authUserId = invited.user.id;
    } else {
      console.warn("[staff invite] Supabase admin client unavailable — skipping invite email");
    }

    const profile = await prisma.profile.create({
      data: {
        orgId,
        type: ProfileType.STAFF,
        status: ProfileStatus.INVITED,
        fullName: body.fullName.trim(),
        email: body.email.trim(),
        phone: body.phone ?? null,
        title: body.title ?? null,
        authUserId: authUserId ?? null,
      },
    });

    const roleIds: string[] = [];

    if (body.roleCode) {
      const role = await prisma.role.findFirst({ where: { orgId, code: body.roleCode } });
      if (role) roleIds.push(role.id);
    }

    if (body.roleIds && Array.isArray(body.roleIds)) {
      roleIds.push(...body.roleIds);
    }

    for (const roleId of roleIds) {
      await prisma.profileRole.upsert({
        where: { profileId_roleId: { profileId: profile.id, roleId } },
        update: {},
        create: { orgId, profileId: profile.id, roleId },
      });
    }

    return ok(profile, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
