import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api/respond";
import { getOrganizerEventBills } from "@/lib/organizer/event-management";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;
    const bills = await getOrganizerEventBills(eventId);
    return ok(bills);
  } catch (err) {
    return handleApiError(err);
  }
}
