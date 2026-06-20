import type { AssetDryRunResult, FeasibilityResult, PlanningConfig, SelectedSpace } from "./types";

export function computeFeasibility(input: {
  selectedSpaces: SelectedSpace[];
  assetPlan: AssetDryRunResult;
  openConflictCount: number;
  taskCount: number;
  hasProposal: boolean;
  isPublished: boolean;
  config: PlanningConfig;
}): FeasibilityResult {
  const components = {
    spaceFit: input.selectedSpaces.length >= 4 ? 100 : input.selectedSpaces.length > 0 ? 72 : 0,
    assetReadiness: input.assetPlan.shortages.length === 0 ? 100 : Math.max(0, 100 - input.assetPlan.shortages.reduce((sum, item) => sum + item.shortBy, 0) * 12),
    scheduleSafety: input.openConflictCount === 0 ? 100 : Math.max(0, 100 - input.openConflictCount * 18),
    powerCable: input.assetPlan.lines.some((line) => line.sourceKitId) ? 92 : 72,
    staffTask: input.taskCount > 0 ? 88 : 55,
    guestReadiness: input.isPublished ? 100 : input.hasProposal ? 76 : 48,
  };
  const weights = input.config.feasibilityWeights;
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0) || 100;
  const score = Math.round(
    Object.entries(components).reduce((sum, [key, value]) => sum + value * (weights[key as keyof typeof weights] ?? 0), 0) / totalWeight,
  );
  return { score, components };
}

export function computeManualWorkSavings(input: {
  selectedSpaces: SelectedSpace[];
  assetPlan: AssetDryRunResult;
  dnaCount: number;
}) {
  const assetLines = input.assetPlan.lines.length;
  const complexity = input.selectedSpaces.length * 2 + assetLines + input.dnaCount;
  return {
    stepsSaved: 8 + complexity * 3,
    hoursSaved: Math.round((2.5 + complexity * 0.35) * 10) / 10,
    drivers: [
      `${input.selectedSpaces.length} space suggestions scored`,
      `${assetLines} asset/category lines dry-run`,
      `${input.dnaCount} DNA dimensions computed`,
    ],
  };
}
