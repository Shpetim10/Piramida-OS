import { NextRequest } from "next/server";
import { applyConflictSuggestion } from "@/lib/services/conflicts";
import { ok, handleApiError } from "@/lib/api/respond";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string; conflictId: string; suggestionId: string }> },
) {
  try {
    const { conflictId, suggestionId } = await params;
    const result = await applyConflictSuggestion(conflictId, suggestionId);
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
