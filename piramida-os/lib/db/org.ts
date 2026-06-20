import { prisma } from "./prisma";

// Pyramid OS is single-organization (Pyramid of Tirana). Every org-owned row
// still carries org_id (per CLAUDE.md), so services resolve the one org here
// instead of trusting an org id from the client. Cached for the process.

let cachedOrgId: string | null = null;

export async function getOrgId(): Promise<string> {
  if (cachedOrgId) return cachedOrgId;
  const org = await prisma.organization.findFirst({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!org) {
    throw new Error("No organization found — run `npm run db:seed` first.");
  }
  cachedOrgId = org.id;
  return org.id;
}

/** Test/seed seam: forget the cached org id. */
export function resetOrgCache(): void {
  cachedOrgId = null;
}
