import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/db/org";
import { loadWorldSnapshot } from "@/lib/repo";

/**
 * GET /api/health
 *
 * Validates that the DB is reachable, an org exists, and the WorldSnapshot
 * loads (spaces, categories, assets, pricing rules). Returns a summary for
 * the demo setup verification step.
 */
export async function GET() {
  const t0 = Date.now();
  try {
    const orgId = await getOrgId();
    const snapshot = await loadWorldSnapshot(orgId);

    const checks = {
      db: "OK",
      org: orgId,
      spaces: snapshot.spaces.length,
      categories: snapshot.categories.length,
      serializedAssets: snapshot.serializedAssets.length,
      batches: snapshot.batches.length,
      kits: snapshot.kits.length,
      pricingRules: snapshot.pricingRules.length,
      settings: Object.keys(snapshot.settings).length,
      latencyMs: Date.now() - t0,
    };

    // Warn if seed data is missing
    const warnings: string[] = [];
    if (snapshot.spaces.length === 0) warnings.push("No spaces found — run db:seed");
    if (snapshot.pricingRules.length === 0) warnings.push("No pricing rules — run db:seed");
    if (!snapshot.settings["planning.scoring_weights"]) warnings.push("planning.scoring_weights AppSetting missing — run db:seed");

    return NextResponse.json({ status: "OK", checks, warnings }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { status: "ERROR", error: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - t0 },
      { status: 503 },
    );
  }
}
