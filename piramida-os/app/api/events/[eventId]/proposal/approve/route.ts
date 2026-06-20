import { NextRequest } from "next/server";
import { approveProposalInternally } from "@/lib/services/quotes";
import { prisma } from "@/lib/db/prisma";
import { getOrgId } from "@/lib/db/org";
import { requirePermission } from "@/lib/auth/guards";
import { ok, handleApiError } from "@/lib/api/respond";

/**
 * POST /api/events/[eventId]/proposal/approve
 * Internal staff approval of the latest proposal for this event.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    await requirePermission("proposals.manage");
    const { eventId } = await params;
    const orgId = await getOrgId();
    const proposal = await prisma.proposal.findFirst({
      where: { orgId, eventId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!proposal) return ok({ error: "No proposal found for this event" }, 404);
    const approved = await approveProposalInternally(proposal.id);
    return ok(approved);
  } catch (err) {
    return handleApiError(err);
  }
}
