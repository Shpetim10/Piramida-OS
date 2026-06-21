import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, handleApiError } from "@/lib/api/respond";
import {
  getOrganizerEventProposal,
  organizerApproveProposal,
  organizerRequestProposalChanges,
} from "@/lib/organizer/event-management";

const respondSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("request_changes"), note: z.string().trim().min(1).max(4000) }),
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;
    const proposal = await getOrganizerEventProposal(eventId);
    return ok(proposal ?? null);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;
    const body = respondSchema.parse(await req.json());

    if (body.action === "approve") {
      const result = await organizerApproveProposal(eventId);
      return ok(result);
    } else {
      const result = await organizerRequestProposalChanges(eventId, body.note);
      return ok(result);
    }
  } catch (err) {
    return handleApiError(err);
  }
}
