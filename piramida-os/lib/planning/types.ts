import type { RepoCategory, RepoSpace } from "@/lib/repo";

export type RequirementMap = Record<string, unknown>;

export type PlanWindow = {
  setupStart: Date;
  eventStart: Date;
  eventEnd: Date;
  teardownEnd: Date;
  availabilityUntil: Date;
};

export type PlanningEvent = {
  id: string;
  title: string;
  type: string;
  expectedGuests: number;
  window: PlanWindow;
};

export type ActiveWindow = {
  eventId: string;
  resourceId: string;
  startsAt: Date;
  endsAt: Date;
};

export type PlanningConfig = {
  scoringWeights: {
    capacityFit: number;
    availability: number;
    layoutFit: number;
    adjacency: number;
    setupFeasibility: number;
    guestFlow: number;
    featureFit: number;
  };
  feasibilityWeights: {
    spaceFit: number;
    assetReadiness: number;
    scheduleSafety: number;
    powerCable: number;
    staffTask: number;
    guestReadiness: number;
  };
  dnaDimensions: Array<{
    key: string;
    label: string;
    shortLabel: string;
    formula: string;
  }>;
};

export type SpaceMatch = {
  spaceId: string;
  name: string;
  kind: string;
  capacity: number | null;
  areaSqm: number | null;
  features: Record<string, unknown>;
  adjacentSpaceIds: string[];
  score: number;
  breakdown: Record<string, number>;
  reasons: string[];
  available: boolean;
  suggestedRole: string;
  roleKey: "keynote" | "breakout" | "coffeeRegistration" | "overflow" | "support";
};

export type SelectedSpace = SpaceMatch & {
  roleIndex: number;
};

export type AssetDryRunLine = {
  requirementKey: string;
  categoryId: string;
  categoryName: string;
  trackingMode: string;
  required: number;
  reserved: number;
  serializedAssetIds: string[];
  batchId: string | null;
  sourceKitId: string | null;
  shortage: number;
};

export type AssetDryRunResult = {
  lines: AssetDryRunLine[];
  shortages: Array<{ category: string; required: number; reserved: number; shortBy: number; replacementCategoryId: string | null }>;
};

export type GeneratedTask = {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueAt: Date | null;
  spaceId?: string;
  source: string;
  dependsOnTitle?: string;
};

export type DnaScore = {
  key: string;
  label: string;
  shortLabel: string;
  value: number;
};

export type FeasibilityResult = {
  score: number;
  components: Record<string, number>;
};

export type ManualWorkSavings = {
  stepsSaved: number;
  hoursSaved: number;
  drivers: string[];
};

export type SpaceWithScoreInput = RepoSpace & {
  activeWindows?: ActiveWindow[];
};

export type CategoryLookup = RepoCategory & {
  availableSerializedIds?: string[];
};
