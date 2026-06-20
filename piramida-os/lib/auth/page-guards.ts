// Redirect-based guards for Server Components (pages/layouts). Unlike the
// throwing guards in ./guards (which API routes map to 401/403), these send an
// unauthenticated or unauthorized visitor to /login or /dashboard so the UI
// never renders a protected surface. UI hiding is NOT security — real mutations
// still pass through requirePermission/requireStaff on the server.
import { redirect } from "next/navigation";
import { ProfileStatus, ProfileType, type RoleCode } from "@prisma/client";
import { getCurrentProfile, type AuthProfile } from "./guards";

const ADMIN_ROLES: RoleCode[] = ["SUPER_ADMIN", "ADMIN"];

export function isAdmin(profile: AuthProfile): boolean {
  return profile.roleCodes.some((r) => ADMIN_ROLES.includes(r));
}

/** Where a profile should land after signing in, by role then type. */
export function landingPathFor(profile: AuthProfile): string {
  if (isAdmin(profile)) return "/admin";
  if (profile.type === ProfileType.STAFF) return "/manager";
  if (profile.type === ProfileType.ORGANIZER) {
    // Unapproved organizers go to the holding page, not the studio.
    return profile.status === ProfileStatus.ACTIVE ? "/organizer" : "/pending-approval";
  }
  return "/dashboard";
}

function loginRedirect(next?: string): string {
  return next ? `/login?next=${encodeURIComponent(next)}` : "/login";
}

/** Any authenticated, ACTIVE profile. Redirects to /login otherwise. */
export async function requireProfilePage(next?: string): Promise<AuthProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect(loginRedirect(next));
  if (profile.status !== ProfileStatus.ACTIVE) {
    redirect("/login?error=Your+account+is+not+active+yet");
  }
  return profile;
}

/** Active STAFF only (internal). Organizers/guests are bounced to /dashboard. */
export async function requireStaffPage(next?: string): Promise<AuthProfile> {
  const profile = await requireProfilePage(next);
  if (profile.type !== ProfileType.STAFF) redirect("/dashboard");
  return profile;
}

/** Active ADMIN / SUPER_ADMIN only. */
export async function requireAdminPage(next?: string): Promise<AuthProfile> {
  const profile = await requireProfilePage(next);
  if (!isAdmin(profile)) redirect("/dashboard");
  return profile;
}

/** Organizer surfaces — the external organizer, or staff (who may oversee). */
export async function requireOrganizerPage(next?: string): Promise<AuthProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect(loginRedirect(next));

  // Staff may oversee organizer surfaces (must still be active).
  if (profile.type === ProfileType.STAFF) {
    if (profile.status !== ProfileStatus.ACTIVE) {
      redirect("/login?error=Your+account+is+not+active+yet");
    }
    return profile;
  }

  // Anything that isn't an organizer (or staff) doesn't belong here.
  if (profile.type !== ProfileType.ORGANIZER) redirect("/dashboard");

  // Organizer gate: only ACTIVE (admin-approved) organizers reach the studio.
  // PENDING_APPROVAL / DISABLED land on the holding page instead.
  if (profile.status !== ProfileStatus.ACTIVE) redirect("/pending-approval");

  return profile;
}
