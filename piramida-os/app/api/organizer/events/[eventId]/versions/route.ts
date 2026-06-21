import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api/respond";
import { getOrganizerEventVersions } from "@/lib/organizer/event-management";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;
    const versions = await getOrganizerEventVersions(eventId);
    return ok(versions);
  } catch (err) {
    return handleApiError(err);
  }
}
