import { NextRequest } from "next/server";
import { parseEventRequestWithAI } from "@/lib/services/event-requests";
import { ok, handleApiError } from "@/lib/api/respond";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const { requestId } = await params;
    const result = await parseEventRequestWithAI(requestId);
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
