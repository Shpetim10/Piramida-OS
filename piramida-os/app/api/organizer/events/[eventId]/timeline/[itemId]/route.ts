import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, handleApiError } from "@/lib/api/respond";
import {
  updateOrganizerTimelineItem,
  deleteOrganizerTimelineItem,
} from "@/lib/organizer/event-management";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).optional(),
  spaceId: z.string().uuid().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  sortOrder: z.number().int().optional(),
  publicVisible: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; itemId: string }> },
) {
  try {
    const { eventId, itemId } = await params;
    const body = await req.json();
    const input = patchSchema.parse(body);
    const item = await updateOrganizerTimelineItem(eventId, itemId, input);
    return ok(item);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string; itemId: string }> },
) {
  try {
    const { eventId, itemId } = await params;
    await deleteOrganizerTimelineItem(eventId, itemId);
    return ok({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
