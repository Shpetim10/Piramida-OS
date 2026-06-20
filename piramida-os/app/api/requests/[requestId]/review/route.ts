import { NextRequest } from "next/server";
import { markEventRequestReviewed, updateReviewedEventRequest } from "@/lib/services/event-requests";
import { ok, handleApiError } from "@/lib/api/respond";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const { requestId } = await params;
    const request = await markEventRequestReviewed(requestId);
    return ok(request);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const { requestId } = await params;
    const body = await req.json();
    const request = await updateReviewedEventRequest({ id: requestId, ...body });
    return ok(request);
  } catch (err) {
    return handleApiError(err);
  }
}
