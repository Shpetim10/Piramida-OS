import { NextRequest } from "next/server";
import { getLaunchReadiness } from "@/lib/services/launch-readiness";
import { ok, handleApiError } from "@/lib/api/respond";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const result = await getLaunchReadiness(eventId);
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
