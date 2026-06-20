import { NextRequest } from "next/server";
import { rejectEventRequest } from "@/lib/services/event-requests";
import { ok, handleApiError } from "@/lib/api/respond";

export async function POST(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const { requestId } = await params;
    const body = await req.json().catch(() => ({}));
    const reason: string = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "Rejected by admin";
    const request = await rejectEventRequest(requestId, reason);
    return ok(request);
  } catch (err) {
    return handleApiError(err);
  }
}
