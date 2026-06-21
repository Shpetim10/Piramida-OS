import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, handleApiError } from "@/lib/api/respond";
import {
  getOrganizerEventSummary,
  editOrganizerEvent,
} from "@/lib/organizer/event-management";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().trim().max(4000).optional(),
  expectedGuests: z.number().int().positive().optional(),
  extraCostItems: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(200),
        unitPrice: z.number().nonnegative(),
        quantity: z.number().int().positive().optional(),
      }),
    )
    .optional(),
  extraCostNotes: z.string().trim().max(2000).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;
    const event = await getOrganizerEventSummary(eventId);
    return ok(event);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;
    const body = await req.json();
    const input = patchSchema.parse(body);
    const result = await editOrganizerEvent(eventId, input);
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
