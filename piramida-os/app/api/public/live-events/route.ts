import { getLiveEvents } from "@/lib/services/events";
import { ok, handleApiError } from "@/lib/api/respond";

// Live events for the 3D pyramid LIVE pins. Read-only, org-scoped, guest-safe
// (coarse fields only) so client-rendered pyramids (organizer create, guest
// event map) can fetch it without staff auth. Never cached — it's time-based.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const events = await getLiveEvents();
    return ok(events);
  } catch (err) {
    return handleApiError(err);
  }
}
