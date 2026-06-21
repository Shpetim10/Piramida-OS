// Server-side authorization guards. UI hiding is never security — every
// mutation of operational truth and every read of internal data must pass
// through one of these. They throw AuthError (mapped to 401/403/404 by routes).
//
// Role model is the LOCKED 4-role set: SUPER_ADMIN, ADMIN, EVENT_MANAGER
// (absorbs all staff capabilities), EVENT_ORGANIZER.
import {
  ProfileStatus,
  ProfileType,
  PublicationStatus,
  type RoleCode,
} from "@prisma/client";
import { prisma } from "../db/prisma";
import { getAuthUserId } from "./session";
import { hasPermission, type Permission } from "./permissions";

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 404 = 403,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface AuthProfile {
  id: string;
  orgId: string;
  type: ProfileType;
  status: ProfileStatus;
  contactId: string | null;
  roleCodes: RoleCode[];
}

/** Throws 401 if there is no authenticated Supabase user. */
export async function requireAuth(): Promise<string> {
  const authUserId = await getAuthUserId();
  if (!authUserId) throw new AuthError("Authentication required", 401);
  return authUserId;
}

/** Loads the application Profile (+roles) for the current session, or null. */
export async function getCurrentProfile(): Promise<AuthProfile | null> {
  const authUserId = await getAuthUserId();
  if (!authUserId) return null;
  const profile = await prisma.profile.findFirst({
    where: { authUserId, deletedAt: null },
    select: {
      id: true,
      orgId: true,
      type: true,
      status: true,
      contactId: true,
      profileRoles: { select: { role: { select: { code: true } } } },
    },
  });
  if (!profile) return null;
  return {
    id: profile.id,
    orgId: profile.orgId,
    type: profile.type,
    status: profile.status,
    contactId: profile.contactId,
    roleCodes: profile.profileRoles.map((pr) => pr.role.code),
  };
}

/** Like getCurrentProfile but throws if missing/disabled. */
async function requireProfile(): Promise<AuthProfile> {
  await requireAuth();
  const profile = await getCurrentProfile();
  if (!profile) throw new AuthError("No profile for this account", 403);
  if (profile.status !== ProfileStatus.ACTIVE) throw new AuthError("Profile is not active", 403);
  return profile;
}

/** Requires an active STAFF profile (not an external organizer). */
export async function requireStaff(): Promise<AuthProfile> {
  const profile = await requireProfile();
  if (profile.type !== ProfileType.STAFF) throw new AuthError("Staff access required", 403);
  return profile;
}

export async function requireRole(role: RoleCode): Promise<AuthProfile> {
  const profile = await requireProfile();
  if (!profile.roleCodes.includes(role)) throw new AuthError(`Requires role ${role}`, 403);
  return profile;
}

export async function requireAnyRole(roles: RoleCode[]): Promise<AuthProfile> {
  const profile = await requireProfile();
  if (!roles.some((r) => profile.roleCodes.includes(r))) {
    throw new AuthError(`Requires one of: ${roles.join(", ")}`, 403);
  }
  return profile;
}

/** Requires a specific permission from the RBAC matrix. */
export async function requirePermission(permission: Permission): Promise<AuthProfile> {
  const profile = await requireProfile();
  if (!hasPermission(profile.roleCodes, permission)) {
    throw new AuthError(`Missing permission ${permission}`, 403);
  }
  return profile;
}

// ---------------------------------------------------------------------------
// Ownership / scope guards (organizer + public)
// ---------------------------------------------------------------------------

/** Organizer may only act on requests tied to their own contact/client. */
export async function requireOrganizerOwnsRequest(requestId: string): Promise<AuthProfile> {
  const profile = await requireProfile();
  // Staff with review permission bypass ownership.
  if (profile.type === ProfileType.STAFF && hasPermission(profile.roleCodes, "requests.review")) {
    return profile;
  }
  if (!profile.contactId) throw new AuthError("Not authorized for this request", 403);
  const req = await prisma.eventRequest.findFirst({
    where: { id: requestId, deletedAt: null },
    select: { contactId: true, submittedByProfileId: true, clientId: true },
  });
  if (!req) throw new AuthError("Request not found", 404);
  const owns = req.contactId === profile.contactId || req.submittedByProfileId === profile.id;
  if (!owns) throw new AuthError("Not authorized for this request", 403);
  return profile;
}

/** Organizer may view a proposal only if it was shared with their contact. */
export async function requireOrganizerCanViewProposal(proposalId: string): Promise<AuthProfile> {
  const profile = await requireProfile();
  if (profile.type === ProfileType.STAFF && hasPermission(profile.roleCodes, "proposals.manage")) {
    return profile;
  }
  if (!profile.contactId) throw new AuthError("Not authorized for this proposal", 403);
  const proposal = await prisma.proposal.findFirst({
    where: { id: proposalId, deletedAt: null },
    select: { sharedWithContactId: true, sentAt: true },
  });
  if (!proposal) throw new AuthError("Proposal not found", 404);
  const shared = proposal.sentAt !== null && proposal.sharedWithContactId === profile.contactId;
  if (!shared) throw new AuthError("Not authorized for this proposal", 403);
  return profile;
}

/** Public read of a published event by slug — no auth. Throws 404 otherwise. */
export async function requirePublicPublication(slug: string) {
  const pub = await prisma.eventPublication.findFirst({
    where: { slug, status: PublicationStatus.PUBLISHED, deletedAt: null },
  });
  if (!pub) throw new AuthError("Not found", 404);
  return pub;
}

/** Ticket lookup by exact high-entropy token only (no enumeration). No auth. */
export async function requireTicketToken(token: string) {
  if (!token || token.length < 20) throw new AuthError("Invalid ticket", 404);
  const ticket = await prisma.guestTicket.findUnique({
    where: { token },
    include: { registration: { select: { fullName: true, publicationId: true, status: true } } },
  });
  if (!ticket) throw new AuthError("Ticket not found", 404);
  return ticket;
}

// ---------------------------------------------------------------------------
// Capability predicates (boolean; for conditional logic / UI gating).
// The matching require* mutation path must still call requirePermission.
// ---------------------------------------------------------------------------

async function can(permission: Permission): Promise<boolean> {
  const profile = await getCurrentProfile();
  if (!profile || profile.status !== ProfileStatus.ACTIVE) return false;
  return hasPermission(profile.roleCodes, permission);
}

export const canManageUsers = () => can("profiles.manage");
export const canManageSettings = () => can("settings.manage");
export const canApproveEvent = () => can("requests.review");
export const canPublishEvent = () => can("events.publish");
export const canManageInventory = () => can("inventory.manage");
export const canApplyConflictFix = () => can("conflicts.resolve");
export const canCheckInGuests = () => can("checkin.scan");

/** True for any active staff member who can see internal operations. */
export async function canViewInternalOperations(): Promise<boolean> {
  const profile = await getCurrentProfile();
  if (!profile || profile.status !== ProfileStatus.ACTIVE) return false;
  if (profile.type !== ProfileType.STAFF) return false;
  return (
    hasPermission(profile.roleCodes, "events.plan") ||
    hasPermission(profile.roleCodes, "inventory.scan") ||
    hasPermission(profile.roleCodes, "audit.read")
  );
}
