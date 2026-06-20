import { NextRequest } from "next/server";
import { getEvent, updateEvent } from "@/lib/services/events";
import { ok, handleApiError } from "@/lib/api/respond";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const event = await getEvent(eventId);
    return ok(event);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const body = await req.json();
    const event = await updateEvent(eventId, body);
    return ok(event);
  } catch (err) {
    return handleApiError(err);
  }
}
