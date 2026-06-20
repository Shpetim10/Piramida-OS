import { NextRequest } from "next/server";
import { createProposalPreview, shareProposalWithOrganizer } from "@/lib/services/quotes";
import { prisma } from "@/lib/db/prisma";
import { getOrgId } from "@/lib/db/org";
import { requirePermission } from "@/lib/auth/guards";
import { ok, handleApiError } from "@/lib/api/respond";

/**
 * GET  /api/events/[eventId]/proposal  — return the latest proposal (or null)
 * POST /api/events/[eventId]/proposal  — draft a new proposal from the event's latest quote
 * PATCH /api/events/[eventId]/proposal — share the proposal with the organizer (status → SENT)
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    await requirePermission("proposals.manage");
    const { eventId } = await params;
    const orgId = await getOrgId();
    const proposal = await prisma.proposal.findFirst({
      where: { orgId, eventId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return ok(proposal ?? null);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const orgId = await getOrgId();
    const quote = await prisma.quote.findFirst({
      where: { orgId, eventId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!quote) return ok({ error: "Calculate a quote first before creating a proposal" }, 400);
    const proposal = await createProposalPreview(eventId, quote.id);
    return ok(proposal, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const orgId = await getOrgId();
    const proposal = await prisma.proposal.findFirst({
      where: { orgId, eventId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!proposal) return ok({ error: "No proposal found" }, 404);
    const updated = await shareProposalWithOrganizer(proposal.id);
    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
