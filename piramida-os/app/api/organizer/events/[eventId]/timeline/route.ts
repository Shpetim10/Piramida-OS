import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, handleApiError } from "@/lib/api/respond";
import {
  getOrganizerEventTimeline,
  createOrganizerTimelineItem,
} from "@/lib/organizer/event-management";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  spaceId: z.string().uuid().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  sortOrder: z.number().int().optional(),
  publicVisible: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;
    const items = await getOrganizerEventTimeline(eventId);
    return ok(items);
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
    const body = await req.json();
    const input = createSchema.parse(body);
    const item = await createOrganizerTimelineItem(eventId, input);
    return ok(item, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
