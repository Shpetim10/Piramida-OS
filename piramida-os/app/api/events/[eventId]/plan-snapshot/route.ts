import { NextRequest } from "next/server";
import { createPlanSnapshot } from "@/lib/services/events";
import { ok, handleApiError } from "@/lib/api/respond";

export async function POST(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const body = await req.json().catch(() => ({}));
    const snapshot = await createPlanSnapshot(eventId, body.reason);
    return ok(snapshot, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
