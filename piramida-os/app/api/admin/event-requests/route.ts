import { listEventRequests } from "@/lib/services/event-requests";
import { ok, handleApiError } from "@/lib/api/respond";

// Admin / staff-reviewer read of every event request in the org, including the
// organizer's captured Q&A (clarifications) and AI extraction. Scoping +
// permission (requests.review) is enforced inside listEventRequests.
export async function GET() {
  try {
    const requests = await listEventRequests();
    return ok(requests);
  } catch (err) {
    return handleApiError(err);
  }
}
