import { NextRequest } from "next/server";
import { calculateQuote, updateQuoteStatus } from "@/lib/services/quotes";
import { prisma } from "@/lib/db/prisma";
import { getOrgId } from "@/lib/db/org";
import { requirePermission } from "@/lib/auth/guards";
import { QuoteStatus } from "@prisma/client";
import { ok, handleApiError } from "@/lib/api/respond";

/**
 * GET  /api/events/[eventId]/quote  — return the current quote (or 404)
 * POST /api/events/[eventId]/quote  — calculate/recalculate the quote from reservations
 * PATCH /api/events/[eventId]/quote — update quote status (e.g. APPROVED, SENT)
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    await requirePermission("quotes.manage");
    const { eventId } = await params;
    const orgId = await getOrgId();
    const quote = await prisma.quote.findFirst({
      where: { orgId, eventId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (!quote) return ok(null);
    return ok(quote);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const quote = await calculateQuote(eventId);
    return ok(quote, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const { status } = await req.json();
    const orgId = await getOrgId();
    const existing = await prisma.quote.findFirst({
      where: { orgId, eventId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!existing) return ok(null);
    const updated = await updateQuoteStatus(existing.id, status as QuoteStatus);
    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
