import {
  Prisma,
  ProfileStatus,
  ProfileType,
  RoleCode,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { getOrgId } from "../db/org";
import { createAuditLog } from "../audit/log";
import {
  getCurrentProfile,
  requirePermission,
  AuthError,
} from "../auth/guards";
import { requiredText, emailSchema, phoneSchema, trimmed, uuid } from "../validation/common";

// Profiles, roles and permission assignment.
//
// Role model (locked 2026-06-21): SUPER_ADMIN, ADMIN, EVENT_MANAGER (absorbs
// all staff capabilities), EVENT_ORGANIZER.
// Organizers are external Profiles (type ORGANIZER); all other roles are STAFF.

export const STAFF_ROLE_CODES: RoleCode[] = [
  RoleCode.SUPER_ADMIN,
  RoleCode.ADMIN,
  RoleCode.EVENT_MANAGER,
];

export const ADMIN_ROLE_CODES: RoleCode[] = [RoleCode.SUPER_ADMIN, RoleCode.ADMIN];

export { requireRole, requireAnyRole } from "../auth/guards";

const staffRole = z
  .nativeEnum(RoleCode)
  .refine((r) => r !== RoleCode.EVENT_ORGANIZER, "event_organizer cannot be a staff role");

export const createStaffUserInput = z.object({
  fullName: requiredText(160),
  email: emailSchema,
  phone: phoneSchema.optional(),
  title: trimmed(120).optional(),
  authUserId: uuid.optional(),
  roles: z.array(staffRole).min(1, "At least one staff role is required"),
});
export type CreateStaffUserInput = z.infer<typeof createStaffUserInput>;

/** Resolves the role rows for a set of codes (single org). */
async function rolesByCode(orgId: string, codes: RoleCode[]) {
  const roles = await prisma.role.findMany({
    where: { orgId, code: { in: codes } },
    select: { id: true, code: true },
  });
  const missing = codes.filter((c) => !roles.some((r) => r.code === c));
  if (missing.length) {
    throw new AuthError(`Unknown role(s): ${missing.join(", ")} — run db:seed`, 403);
  }
  return roles;
}

/** The current application user (profile + roles) or null. */
export async function getCurrentUser() {
  return getCurrentProfile();
}

export async function listProfiles(opts?: { type?: ProfileType; includeDeleted?: boolean }) {
  await requirePermission("profiles.manage");
  const orgId = await getOrgId();
  return prisma.profile.findMany({
    where: {
      orgId,
      ...(opts?.type ? { type: opts.type } : {}),
      ...(opts?.includeDeleted ? {} : { deletedAt: null }),
    },
    include: { profileRoles: { include: { role: { select: { code: true, label: true } } } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function getUsersByRole(role: RoleCode) {
  await requirePermission("profiles.manage");
  const orgId = await getOrgId();
  return prisma.profile.findMany({
    where: {
      orgId,
      deletedAt: null,
      profileRoles: { some: { role: { code: role } } },
    },
    orderBy: { fullName: "asc" },
  });
}

/** Admin-only: create an internal staff user. Staff can never self-sign-up. */
export async function createStaffUser(input: unknown) {
  const actor = await requirePermission("profiles.manage");
  const data = createStaffUserInput.parse(input);
  const orgId = await getOrgId();

  if (data.roles.some((r) => ADMIN_ROLE_CODES.includes(r))) {
    // The single ADMIN is provisioned by seed; new staff cannot be made admin here.
    throw new AuthError("Admin/super-admin accounts cannot be created via createStaffUser", 403);
  }

  const roles = await rolesByCode(orgId, data.roles);

  const profile = await prisma.$transaction(async (tx) => {
    const created = await tx.profile.create({
      data: {
        orgId,
        type: ProfileType.STAFF,
        status: ProfileStatus.ACTIVE,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        title: data.title,
        authUserId: data.authUserId,
      },
    });
    await tx.profileRole.createMany({
      data: roles.map((r) => ({ orgId, profileId: created.id, roleId: r.id, assignedBy: actor.id })),
    });
    await createAuditLog({
      tx,
      actorProfileId: actor.id,
      action: "CREATE",
      entityType: "Profile",
      entityId: created.id,
      summary: `Created staff user ${created.email} with roles ${data.roles.join(", ")}`,
      after: { email: created.email, roles: data.roles },
    });
    return created;
  });
  return profile;
}

const updateProfileFields = z
  .object({
    profileId: uuid,
    fullName: requiredText(160).optional(),
    displayName: trimmed(80).nullable().optional(),
    phone: phoneSchema.nullable().optional(),
    title: trimmed(120).nullable().optional(),
  })
  .strict();

export async function updateProfile(input: unknown) {
  const actor = await requirePermission("profiles.manage");
  const { profileId, ...rest } = updateProfileFields.parse(input);
  const orgId = await getOrgId();
  const existing = await prisma.profile.findFirst({ where: { id: profileId, orgId, deletedAt: null } });
  if (!existing) throw new AuthError("Profile not found", 404);

  const updated = await prisma.profile.update({ where: { id: profileId }, data: rest });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "UPDATE",
    entityType: "Profile",
    entityId: profileId,
    summary: `Updated profile ${existing.email}`,
    before: { fullName: existing.fullName, title: existing.title },
    after: rest as Prisma.InputJsonValue,
  });
  return updated;
}

export async function disableProfile(profileId: string) {
  const actor = await requirePermission("profiles.manage");
  uuid.parse(profileId);
  if (profileId === actor.id) throw new AuthError("You cannot disable your own account", 403);
  const orgId = await getOrgId();
  const target = await prisma.profile.findFirst({
    where: { id: profileId, orgId, deletedAt: null },
    include: { profileRoles: { include: { role: { select: { code: true } } } } },
  });
  if (!target) throw new AuthError("Profile not found", 404);
  if (target.profileRoles.some((pr) => ADMIN_ROLE_CODES.includes(pr.role.code))) {
    throw new AuthError("The admin account cannot be disabled", 403);
  }
  const updated = await prisma.profile.update({
    where: { id: profileId },
    data: { status: ProfileStatus.DISABLED },
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "STATUS_CHANGE",
    entityType: "Profile",
    entityId: profileId,
    summary: `Disabled ${target.email}`,
    before: { status: target.status },
    after: { status: ProfileStatus.DISABLED },
  });
  return updated;
}

export async function reactivateProfile(profileId: string) {
  const actor = await requirePermission("profiles.manage");
  uuid.parse(profileId);
  const orgId = await getOrgId();
  const target = await prisma.profile.findFirst({ where: { id: profileId, orgId, deletedAt: null } });
  if (!target) throw new AuthError("Profile not found", 404);
  const updated = await prisma.profile.update({
    where: { id: profileId },
    data: { status: ProfileStatus.ACTIVE },
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "STATUS_CHANGE",
    entityType: "Profile",
    entityId: profileId,
    summary: `Reactivated ${target.email}`,
    before: { status: target.status },
    after: { status: ProfileStatus.ACTIVE },
  });
  return updated;
}

/**
 * Replace a profile's role set. Enforces the role-mixing invariants:
 *  - organizer profiles may only hold EVENT_ORGANIZER
 *  - staff profiles may not hold EVENT_ORGANIZER
 *  - at most one ADMIN may exist org-wide
 */
export async function assignRoles(profileId: string, roleCodes: RoleCode[]) {
  const actor = await requirePermission("profiles.manage");
  uuid.parse(profileId);
  z.array(z.nativeEnum(RoleCode)).min(1).parse(roleCodes);
  const orgId = await getOrgId();

  const profile = await prisma.profile.findFirst({ where: { id: profileId, orgId, deletedAt: null } });
  if (!profile) throw new AuthError("Profile not found", 404);

  const wantsOrganizer = roleCodes.includes(RoleCode.EVENT_ORGANIZER);
  if (profile.type === ProfileType.ORGANIZER && roleCodes.some((r) => r !== RoleCode.EVENT_ORGANIZER)) {
    throw new AuthError("Organizer accounts may only hold the event_organizer role", 403);
  }
  if (profile.type === ProfileType.STAFF && wantsOrganizer) {
    throw new AuthError("Staff accounts cannot hold the event_organizer role", 403);
  }
  if (roleCodes.some((r) => ADMIN_ROLE_CODES.includes(r))) {
    await assertNoOtherAdmin(orgId, profileId);
  }

  const roles = await rolesByCode(orgId, roleCodes);
  await prisma.$transaction(async (tx) => {
    await tx.profileRole.deleteMany({ where: { profileId } });
    await tx.profileRole.createMany({
      data: roles.map((r) => ({ orgId, profileId, roleId: r.id, assignedBy: actor.id })),
    });
    await createAuditLog({
      tx,
      actorProfileId: actor.id,
      action: "UPDATE",
      entityType: "Profile",
      entityId: profileId,
      summary: `Set roles for ${profile.email} to ${roleCodes.join(", ")}`,
      after: { roles: roleCodes },
    });
  });
  return getCurrentRoles(profileId);
}

export async function removeRole(profileId: string, role: RoleCode) {
  const actor = await requirePermission("profiles.manage");
  uuid.parse(profileId);
  const orgId = await getOrgId();
  const roleRow = await prisma.role.findFirst({ where: { orgId, code: role }, select: { id: true } });
  if (!roleRow) throw new AuthError("Role not found", 404);
  await prisma.profileRole.deleteMany({ where: { profileId, roleId: roleRow.id } });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "UPDATE",
    entityType: "Profile",
    entityId: profileId,
    summary: `Removed role ${role}`,
  });
  return getCurrentRoles(profileId);
}

async function getCurrentRoles(profileId: string) {
  const rows = await prisma.profileRole.findMany({
    where: { profileId },
    include: { role: { select: { code: true, label: true } } },
  });
  return rows.map((r) => r.role);
}

async function assertNoOtherAdmin(orgId: string, exceptProfileId: string) {
  const admins = await prisma.profile.findMany({
    where: {
      orgId,
      deletedAt: null,
      id: { not: exceptProfileId },
      profileRoles: { some: { role: { code: { in: ADMIN_ROLE_CODES } } } },
    },
    select: { id: true, email: true },
  });
  if (admins.length > 0) {
    throw new AuthError("Exactly one admin account is allowed", 403);
  }
}

/** Invariant check: returns the single ADMIN profile, throwing if 0 or >1 exist. */
export async function ensureSingleAdmin() {
  const orgId = await getOrgId();
  const admins = await prisma.profile.findMany({
    where: {
      orgId,
      deletedAt: null,
      profileRoles: { some: { role: { code: RoleCode.ADMIN } } },
    },
    select: { id: true, email: true },
  });
  if (admins.length !== 1) {
    throw new Error(`Expected exactly one admin, found ${admins.length}`);
  }
  return admins[0];
}
