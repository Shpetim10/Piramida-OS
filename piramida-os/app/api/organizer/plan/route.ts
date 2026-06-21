import { NextRequest } from "next/server";
import { z } from "zod";
import { parseWithGemini } from "@/lib/ai/intake";
import { getCurrentProfile } from "@/lib/auth/guards";
import { ok, apiError, handleApiError } from "@/lib/api/respond";
import { EVENT_VENUES } from "@/lib/data";
import { checkVenueNamesAvailability } from "@/lib/services/availability";

// Organizer "Generate plan" intake.
//
// Runs the messy free-text request through Gemini (lib/ai/intake) to EXTRACT
// structured requirements — event type, expected guests, and per-need counts.
// Per CLAUDE.md the AI only structures text; deterministic client code turns
// the extraction into recommended spaces + a live quote. Falls back to the
// deterministic parser when DEMO_MODE is on or the model call fails.
//
// If startDate + endDate are supplied, the route also checks DB availability
// for every EVENT_VENUES entry and returns unavailableVenueNames so the
// client-side recommender can skip booked spaces.

const planInput = z.object({
  rawText: z.string().trim().min(1, "Describe your event first").max(20000),
  /** ISO date string (YYYY-MM-DD) — required for availability check */
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return apiError("Authentication required", 401);

    const { rawText, startDate, endDate } = planInput.parse(await req.json());
    const result = await parseWithGemini(rawText);

    // Availability check — only when the organizer has provided dates.
    let unavailableVenueNames: string[] = [];
    if (startDate && endDate) {
      try {
        const from = new Date(`${startDate}T00:00:00Z`);
        const until = new Date(`${endDate}T23:59:59Z`);
        if (!isNaN(from.getTime()) && !isNaN(until.getTime()) && from <= until) {
          const allNames = EVENT_VENUES.map((v) => v.name);
          const avail = await checkVenueNamesAvailability(allNames, from, until);
          unavailableVenueNames = allNames.filter((n) => !avail[n]);
        }
      } catch {
        // Availability check failure must never block the plan generation.
      }
    }

    return ok({
      extraction: result.extraction,
      model: result.model,
      confidence: result.confidence,
      latencyMs: result.latencyMs,
      unavailableVenueNames,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
