import { NextRequest } from "next/server";
import { simulatePlanChange } from "@/lib/services/planning";
import { ok, handleApiError } from "@/lib/api/respond";

export async function POST(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const body = (await req.json().catch(() => ({}))) as { expectedGuests?: number };
    const result = await simulatePlanChange(eventId, { expectedGuests: body.expectedGuests });
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
