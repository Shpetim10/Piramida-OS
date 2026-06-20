import { ProfileStatus, ProfileType, RoleCode } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { getOrgId } from "../db/org";
import { createAuditLog } from "../audit/log";
import { requirePermission, AuthError } from "../auth/guards";
import { requiredText, emailSchema, phoneSchema, trimmed, uuid } from "../validation/common";

// External organizer lifecycle.
//
// The data model represents an organizer as a Profile(type=ORGANIZER) linked to
// a Contact and Client (no separate organizer_profiles table — locked schema).
// Self-signup creates everything in PENDING_APPROVAL; an admin approves before
// the organizer can submit event requests. Approval flips the profile to ACTIVE
// and grants EVENT_ORGANIZER; rejection disables it.

export const signupOrganizerInput = z.object({
  organizationName: requiredText(200),
  contactName: requiredText(160),
  contactEmail: emailSchema,
  phone: phoneSchema.optional(),
  website: z.url("Invalid URL").max(300).optional(),
  organizationDescription: trimmed(2000).optional(),
  reasonForAccess: trimmed(2000).optional(),
  authUserId: uuid.optional(), // Supabase auth.users.id once Auth is wired
});
export type SignupOrganizerInput = z.infer<typeof signupOrganizerInput>;

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "—" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** PUBLIC: external organizer self-signup. Starts PENDING_APPROVAL. */
export async function signupOrganizer(input: unknown) {
  const data = signupOrganizerInput.parse(input);
  const orgId = await getOrgId();

  const existing = await prisma.profile.findFirst({
    where: { orgId, email: data.contactEmail },
    select: { id: true, status: true },
  });
  if (existing) {
    throw new AuthError("An account with this email already exists", 403);
  }

  const { firstName, lastName } = splitName(data.contactName);

  const profile = await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        orgId,
        name: data.organizationName,
        website: data.website,
        notes: data.organizationDescription,
        status: "prospect",
      },
    });
    const contact = await tx.contact.create({
      data: {
        orgId,
        clientId: client.id,
        firstName,
        lastName,
        email: data.contactEmail,
        phone: data.phone,
        isPrimary: true,
      },
    });
    const created = await tx.profile.create({
      data: {
        orgId,
        type: ProfileType.ORGANIZER,
        status: ProfileStatus.PENDING_APPROVAL,
        fullName: data.contactName,
        email: data.contactEmail,
        phone: data.phone,
        contactId: contact.id,
        authUserId: data.authUserId,
      },
    });
    await createAuditLog({
      tx,
      actorProfileId: created.id,
      action: "CREATE",
      entityType: "Profile",
      entityId: created.id,
      summary: `Organizer signup: ${data.organizationName} (${data.contactEmail})`,
      after: { organizationName: data.organizationName, reasonForAccess: data.reasonForAccess },
    });
    return created;
  });
  return profile;
}

export async function listPendingOrganizers() {
  await requirePermission("profiles.manage");
  const orgId = await getOrgId();
  return prisma.profile.findMany({
    where: { orgId, type: ProfileType.ORGANIZER, status: ProfileStatus.PENDING_APPROVAL, deletedAt: null },
    include: { contact: { include: { client: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function getOrganizerProfile(profileId: string) {
  await requirePermission("profiles.manage");
  uuid.parse(profileId);
  const orgId = await getOrgId();
  return prisma.profile.findFirst({
    where: { id: profileId, orgId, type: ProfileType.ORGANIZER },
    include: { contact: { include: { client: true } } },
  });
}

export async function approveOrganizer(profileId: string) {
  const actor = await requirePermission("profiles.manage");
  uuid.parse(profileId);
  const orgId = await getOrgId();

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, orgId, type: ProfileType.ORGANIZER },
  });
  if (!profile) throw new AuthError("Organizer not found", 404);

  const organizerRole = await prisma.role.findFirst({
    where: { orgId, code: RoleCode.EVENT_ORGANIZER },
    select: { id: true },
  });
  if (!organizerRole) throw new AuthError("event_organizer role missing — run db:seed", 403);

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.profile.update({
      where: { id: profileId },
      data: { status: ProfileStatus.ACTIVE },
    });
    await tx.profileRole.upsert({
      where: { profileId_roleId: { profileId, roleId: organizerRole.id } },
      update: {},
      create: { orgId, profileId, roleId: organizerRole.id, assignedBy: actor.id },
    });
    if (p.contactId) {
      await tx.client.updateMany({
        where: { contacts: { some: { id: p.contactId } } },
        data: { status: "active" },
      });
    }
    await createAuditLog({
      tx,
      actorProfileId: actor.id,
      action: "APPROVE",
      entityType: "Profile",
      entityId: profileId,
      summary: `Approved organizer ${profile.email}`,
      before: { status: profile.status },
      after: { status: ProfileStatus.ACTIVE },
    });
    return p;
  });
  return updated;
}

export async function rejectOrganizer(profileId: string, reason: string) {
  const actor = await requirePermission("profiles.manage");
  uuid.parse(profileId);
  const cleanReason = requiredText(2000).parse(reason);
  const orgId = await getOrgId();

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, orgId, type: ProfileType.ORGANIZER },
  });
  if (!profile) throw new AuthError("Organizer not found", 404);

  const updated = await prisma.profile.update({
    where: { id: profileId },
    data: { status: ProfileStatus.DISABLED },
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "REJECT",
    entityType: "Profile",
    entityId: profileId,
    summary: `Rejected organizer ${profile.email}: ${cleanReason}`,
    before: { status: profile.status },
    after: { status: ProfileStatus.DISABLED, reason: cleanReason },
  });
  return updated;
}

/** True only for an ACTIVE organizer that holds the EVENT_ORGANIZER role. */
export async function canOrganizerSubmitRequests(profileId: string): Promise<boolean> {
  const orgId = await getOrgId();
  const profile = await prisma.profile.findFirst({
    where: { id: profileId, orgId, type: ProfileType.ORGANIZER, status: ProfileStatus.ACTIVE, deletedAt: null },
    include: { profileRoles: { include: { role: { select: { code: true } } } } },
  });
  if (!profile) return false;
  return profile.profileRoles.some((pr) => pr.role.code === RoleCode.EVENT_ORGANIZER);
}
