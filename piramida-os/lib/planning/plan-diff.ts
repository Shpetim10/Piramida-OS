// Pure plan diff — compares two plan version snapshots and returns a typed diff.
// Used by the Change Impact UI (180→240 scenario) and the NL copilot.
// All arithmetic is deterministic; no AI involved.

export interface PlanSnapshotLike {
  selectedSpaces?: Array<{ name: string; suggestedRole?: string }>;
  assetPlan?: {
    lines?: Array<{ categoryName: string; required: number; reserved: number }>;
    shortages?: Array<{ category: string; required: number; reserved: number; shortBy: number }>;
  };
  feasibility?: { score: number };
  quote?: { total: number; currency: string };
}

export interface AssetLineDelta {
  name: string;
  fromReserved: number;
  toReserved: number;
  delta: number;
}

export interface PlanDiff {
  guestsDelta: number;
  spacesAdded: string[];
  spacesRemoved: string[];
  shortagesAdded: string[];
  shortagesRemoved: string[];
  quoteTotal: { from: number; to: number; delta: number; currency: string };
  feasibilityScore: { from: number; to: number; delta: number };
  assetLines: AssetLineDelta[];
}

export function computePlanDiff(
  a: PlanSnapshotLike,
  b: PlanSnapshotLike,
  opts?: { guestsDelta?: number },
): PlanDiff {
  const namesA = new Set((a.selectedSpaces ?? []).map((s) => s.name));
  const namesB = new Set((b.selectedSpaces ?? []).map((s) => s.name));

  const shortageNamesA = new Set((a.assetPlan?.shortages ?? []).map((s) => s.category));
  const shortageNamesB = new Set((b.assetPlan?.shortages ?? []).map((s) => s.category));

  const quoteTotalA = a.quote?.total ?? 0;
  const quoteTotalB = b.quote?.total ?? 0;
  const currency = b.quote?.currency ?? a.quote?.currency ?? "ALL";

  const feasA = a.feasibility?.score ?? 0;
  const feasB = b.feasibility?.score ?? 0;

  // Per-category asset line deltas
  const lineMapA = new Map<string, number>();
  for (const l of a.assetPlan?.lines ?? []) lineMapA.set(l.categoryName, l.reserved);
  const lineMapB = new Map<string, number>();
  for (const l of b.assetPlan?.lines ?? []) lineMapB.set(l.categoryName, l.reserved);

  const allCats = new Set([...lineMapA.keys(), ...lineMapB.keys()]);
  const assetLines: AssetLineDelta[] = [];
  for (const cat of allCats) {
    const from = lineMapA.get(cat) ?? 0;
    const to = lineMapB.get(cat) ?? 0;
    if (from !== to) assetLines.push({ name: cat, fromReserved: from, toReserved: to, delta: to - from });
  }

  return {
    guestsDelta: opts?.guestsDelta ?? 0,
    spacesAdded: [...namesB].filter((n) => !namesA.has(n)),
    spacesRemoved: [...namesA].filter((n) => !namesB.has(n)),
    shortagesAdded: [...shortageNamesB].filter((n) => !shortageNamesA.has(n)),
    shortagesRemoved: [...shortageNamesA].filter((n) => !shortageNamesB.has(n)),
    quoteTotal: { from: quoteTotalA, to: quoteTotalB, delta: quoteTotalB - quoteTotalA, currency },
    feasibilityScore: { from: feasA, to: feasB, delta: feasB - feasA },
    assetLines,
  };
}
