import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api/respond";
import { getOrganizerEventGuests } from "@/lib/organizer/event-management";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;
    const guests = await getOrganizerEventGuests(eventId);
    return ok(guests);
  } catch (err) {
    return handleApiError(err);
  }
}
