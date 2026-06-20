import { NextRequest } from "next/server";
import { z } from "zod";
import { parseWithGemini } from "@/lib/ai/intake";
import { getCurrentProfile } from "@/lib/auth/guards";
import { ok, apiError, handleApiError } from "@/lib/api/respond";

// Organizer "Generate plan" intake.
//
// Runs the messy free-text request through Gemini (lib/ai/intake) to EXTRACT
// structured requirements — event type, expected guests, and per-need counts.
// Per CLAUDE.md the AI only structures text; deterministic client code turns
// the extraction into recommended spaces + a live quote. Falls back to the
// deterministic parser when DEMO_MODE is on or the model call fails.

const planInput = z.object({
  rawText: z.string().trim().min(1, "Describe your event first").max(20000),
});

export async function POST(req: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return apiError("Authentication required", 401);

    const { rawText } = planInput.parse(await req.json());
    const result = await parseWithGemini(rawText);

    return ok({
      extraction: result.extraction,
      model: result.model,
      confidence: result.confidence,
      latencyMs: result.latencyMs,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
