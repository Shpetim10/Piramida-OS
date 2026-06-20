import { listPublishedEvents } from "@/lib/services/publications";
import { AuthError } from "@/lib/auth/guards";

export async function GET() {
  try {
    const events = await listPublishedEvents({ upcomingOnly: true });
    return Response.json(events);
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
