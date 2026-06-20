import { NextRequest } from "next/server";
import { getEventRequest } from "@/lib/services/event-requests";
import { ok, handleApiError } from "@/lib/api/respond";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const { requestId } = await params;
    const request = await getEventRequest(requestId);
    return ok(request);
  } catch (err) {
    return handleApiError(err);
  }
}
