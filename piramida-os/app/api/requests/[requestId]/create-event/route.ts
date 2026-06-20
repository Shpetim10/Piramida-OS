import { NextRequest } from "next/server";
import { createEventFromRequest } from "@/lib/services/event-requests";
import { ok, handleApiError } from "@/lib/api/respond";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const { requestId } = await params;
    const event = await createEventFromRequest(requestId);
    return ok(event, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
