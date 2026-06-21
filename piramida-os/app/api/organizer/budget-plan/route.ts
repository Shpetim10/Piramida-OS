import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/guards";
import { ok, apiError, handleApiError } from "@/lib/api/respond";
import { allocateBudget, SUPPORTED_EVENT_TYPES } from "@/lib/planning/budget-allocator";
import { generateBudgetNarrative } from "@/lib/ai/budget-narrative";
import { EVENT_VENUES } from "@/lib/data";
import { checkVenueNamesAvailability } from "@/lib/services/availability";

const inputSchema = z.object({
  eventType: z.string().min(1),
  budget: z.number().min(100).max(500_000),
  guestCount: z.number().int().min(10).max(5000),
  days: z.number().int().min(1).max(14),
  /** ISO date strings (YYYY-MM-DD) — enables real availability filtering */
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return apiError("Authentication required", 401);

    const body = inputSchema.parse(await req.json());

    const eventType = SUPPORTED_EVENT_TYPES.includes(
      body.eventType as (typeof SUPPORTED_EVENT_TYPES)[number],
    )
      ? body.eventType
      : "conference";

    // Step 1: availability check — filter out booked venues before allocating
    let unavailableVenueNames: string[] = [];
    if (body.startDate && body.endDate) {
      try {
        const from = new Date(`${body.startDate}T00:00:00Z`);
        const until = new Date(`${body.endDate}T23:59:59Z`);
        if (!isNaN(from.getTime()) && !isNaN(until.getTime()) && from <= until) {
          const allNames = EVENT_VENUES.map((v) => v.name);
          const avail = await checkVenueNamesAvailability(allNames, from, until);
          unavailableVenueNames = allNames.filter((n) => !avail[n]);
        }
      } catch {
        // Availability failure must never block allocation.
      }
    }

    // Step 2: deterministic allocation — the source of truth for all facts
    const pkg = allocateBudget({
      budget: body.budget,
      eventType,
      guestCount: body.guestCount,
      days: body.days,
      unavailableVenueNames,
    });

    // Step 3: AI narrative — enhancement only, never gates the response
    const narrative = await generateBudgetNarrative(pkg);

    return ok({ package: pkg, narrative });
  } catch (err) {
    return handleApiError(err);
  }
}
