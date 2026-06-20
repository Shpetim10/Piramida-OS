import { NextRequest } from "next/server";
import { listConflicts, detectConflicts } from "@/lib/services/conflicts";
import { ok, handleApiError } from "@/lib/api/respond";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const conflicts = await listConflicts(eventId);
    return ok(conflicts);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const conflicts = await detectConflicts(eventId);
    return ok(conflicts);
  } catch (err) {
    return handleApiError(err);
  }
}
