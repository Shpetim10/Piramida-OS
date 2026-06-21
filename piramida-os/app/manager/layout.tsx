import { ManagerShell } from "@/components/manager/ManagerShell";
import { requireStaffPage } from "@/lib/auth/page-guards";
import { prisma } from "@/lib/db/prisma";
import { getAuthUserId } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function roleLabel(code: string): string {
  const map: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    ADMIN: "Admin",
    EVENT_MANAGER: "Event Manager",
    EVENT_ORGANIZER: "Organizer",
  };
  return map[code] ?? code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  await requireStaffPage("/manager");

  let currentUser: { name: string; initials: string; title: string } = {
    name: "Staff",
    initials: "S",
    title: "Staff",
  };

  try {
    const authUserId = await getAuthUserId();
    if (authUserId) {
      const profile = await prisma.profile.findFirst({
        where: { authUserId, deletedAt: null },
        select: {
          fullName: true,
          displayName: true,
          title: true,
          profileRoles: { select: { role: { select: { code: true } } }, take: 1 },
        },
      });
      if (profile) {
        const name = profile.displayName ?? profile.fullName;
        const firstRole = profile.profileRoles[0]?.role.code ?? "";
        currentUser = {
          name,
          initials: initials(name),
          title: profile.title ?? roleLabel(firstRole),
        };
      }
    }
  } catch {
    // Fall back to defaults if auth/db unavailable
  }

  return <ManagerShell currentUser={currentUser}>{children}</ManagerShell>;
}
