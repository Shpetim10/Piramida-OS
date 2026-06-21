import { NextRequest } from "next/server";
import { z } from "zod";
import { EventStatus } from "@prisma/client";
import { ok, handleApiError } from "@/lib/api/respond";
import { updateEventStatus } from "@/lib/services/events";

const schema = z.object({
  status: z.nativeEnum(EventStatus),
  reason: z.string().trim().max(1000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;
    const body = await req.json();
    const { status } = schema.parse(body);
    const event = await updateEventStatus(eventId, status);
    return ok(event);
  } catch (err) {
    return handleApiError(err);
  }
}
