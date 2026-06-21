import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, handleApiError } from "@/lib/api/respond";
import { cancelOrganizerEvent } from "@/lib/organizer/event-management";

const schema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;
    const body = await req.json().catch(() => ({}));
    const { reason } = schema.parse(body);
    const event = await cancelOrganizerEvent(eventId, reason);
    return ok(event);
  } catch (err) {
    return handleApiError(err);
  }
}
