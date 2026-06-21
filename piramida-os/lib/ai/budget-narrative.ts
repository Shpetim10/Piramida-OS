/**
 * Budget Narrative — AI-generated event package description.
 *
 * The AI's ONLY job here is to write a compelling headline, narrative, and
 * highlights from the facts the deterministic allocator has already computed.
 * It may not invent prices, availability, capacities, or any operational fact.
 *
 * Falls back to deterministic copy when DEMO_MODE is set or the Gemini call
 * fails, so the feature always works regardless of AI availability.
 */

import { GoogleGenAI } from "@google/genai";
import type { BudgetPackage } from "@/lib/planning/budget-allocator";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEMO_MODE = process.env.DEMO_MODE === "true";

export type BudgetNarrative = {
  headline: string;
  narrative: string;
  highlights: string[];
  model: string;
};

const NARRATIVE_SCHEMA = {
  type: "object" as const,
  properties: {
    headline: { type: "string" },
    narrative: { type: "string" },
    highlights: { type: "array", items: { type: "string" } },
  },
  required: ["headline", "narrative", "highlights"],
};

export async function generateBudgetNarrative(
  pkg: BudgetPackage,
): Promise<BudgetNarrative> {
  const fallback = deterministicNarrative(pkg);
  if (DEMO_MODE || !GEMINI_API_KEY) {
    return { ...fallback, model: "deterministic" };
  }

  try {
    const client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const venueLines = pkg.venues
      .map((v) => `• ${v.name} (${v.capacity} cap · ${v.role})`)
      .join("\n");
    const assetLines = pkg.assets
      .map((a) => `• ${a.label} × ${a.qty}`)
      .join("\n");
    const serviceLines = pkg.services.map((s) => `• ${s.label}`).join("\n");
    const staffLine = pkg.staff
      ? `• ${pkg.staff.count} event staff members`
      : "";
    const utilPct = Math.round(pkg.budgetUtilization * 100);

    const prompt = `You write short, compelling event package summaries for the Pyramid of Tirana — Albania's iconic multi-floor pyramid venue.

The organizer's package:
  Event type: ${pkg.eventType}
  Guests: ${pkg.guestCount}
  Duration: ${pkg.days} day(s)
  Budget: €${pkg.budget.toLocaleString()} (${utilPct}% utilised · €${Math.round(pkg.total).toLocaleString()} spent)
  Tier: ${pkg.tier}

Venues:
${venueLines}

Equipment:
${assetLines}

Services:
${serviceLines}
${staffLine}

Write:
1. headline — one punchy line, max 10 words, no quotes
2. narrative — 2-3 sentences describing the experience. Enthusiastic but factual. Don't invent details not listed above.
3. highlights — exactly 4 short bullets, max 7 words each

JSON only: { "headline": "...", "narrative": "...", "highlights": ["...", "...", "...", "..."] }`;

    const result = await client.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: NARRATIVE_SCHEMA,
      },
    });

    const text = result.text ?? "";
    const parsed = JSON.parse(text) as Partial<BudgetNarrative>;

    return {
      headline:
        typeof parsed.headline === "string" ? parsed.headline : fallback.headline,
      narrative:
        typeof parsed.narrative === "string"
          ? parsed.narrative
          : fallback.narrative,
      highlights: Array.isArray(parsed.highlights)
        ? (parsed.highlights as string[]).slice(0, 4)
        : fallback.highlights,
      model: "gemini-2.0-flash-lite",
    };
  } catch {
    return { ...fallback, model: "deterministic-fallback" };
  }
}

// ---------------------------------------------------------------------------
// Deterministic fallback narrative — always factual, never invented
// ---------------------------------------------------------------------------

function deterministicNarrative(pkg: BudgetPackage): BudgetNarrative {
  const primary = pkg.venues.find((v) => v.role === "primary");
  const breakouts = pkg.venues.filter((v) => v.role === "breakout");
  const hasSupport = pkg.venues.some((v) => v.role === "support");
  const utilPct = Math.round(pkg.budgetUtilization * 100);
  const typeLabel =
    pkg.eventType.charAt(0).toUpperCase() + pkg.eventType.slice(1);

  const headline = `A ${pkg.tier === "full-service" ? "full-service" : pkg.tier === "standard" ? "well-equipped" : "focused"} ${pkg.eventType} for ${pkg.guestCount} guests`;

  const narrative =
    `Your €${pkg.budget.toLocaleString()} budget assembles a ${pkg.tier} ${typeLabel.toLowerCase()} at the Pyramid of Tirana. ` +
    (primary
      ? `${primary.name} anchors the experience, seating up to ${primary.capacity} guests${breakouts.length > 0 ? ` with ${breakouts.length} breakout room${breakouts.length > 1 ? "s" : ""} for parallel tracks` : ""}. `
      : "") +
    (pkg.assets.length > 0
      ? `The package includes a full ${pkg.assets.length}-item equipment kit${hasSupport ? " and dedicated support spaces for registration and networking" : ""}.`
      : "");

  const highlights: string[] = [
    `${pkg.guestCount} guests · ${pkg.venues.length} space${pkg.venues.length !== 1 ? "s" : ""}`,
    `${pkg.assets.length} equipment item${pkg.assets.length !== 1 ? "s" : ""} included`,
    pkg.services.length > 0
      ? pkg.services.map((s) => s.label).join(" + ")
      : "Core AV & furniture setup",
    `${utilPct}% of €${pkg.budget.toLocaleString()} budget used`,
  ];

  return { headline, narrative: narrative.trim(), highlights, model: "deterministic" };
}
