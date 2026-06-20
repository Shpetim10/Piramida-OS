import type { WorldSnapshot } from "@/lib/repo";
import type { ActiveWindow, AssetDryRunResult, PlanningEvent, RequirementMap } from "./types";

const REQUIREMENT_TO_CATEGORY: Record<string, string> = {
  wirelessMicrophones: "Wireless Microphone",
  wiredMicrophones: "Wired Microphone",
  projectors: "Projector",
  screens: "Screen",
  speakers: "Speaker",
  registrationDesk: "Registration Desk",
  chairs: "Chairs",
  tables: "Tables",
};

function numberReq(reqs: RequirementMap, key: string): number {
  if (key === "registrationDesk") return reqs.registrationDesk ? 1 : 0;
  const value = reqs[key];
  return typeof value === "number" ? value : Number(value ?? 0) || 0;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function reserveAssetsDryRun(input: {
  event: PlanningEvent;
  requirements: RequirementMap;
  snapshot: WorldSnapshot;
  activeAssetWindows: ActiveWindow[];
}): AssetDryRunResult {
  const lines: AssetDryRunResult["lines"] = [];
  const shortages: AssetDryRunResult["shortages"] = [];
  const busy = new Set(
    input.activeAssetWindows
      .filter((win) => win.eventId !== input.event.id && overlaps(input.event.window.setupStart, input.event.window.availabilityUntil, win.startsAt, win.endsAt))
      .map((win) => win.resourceId),
  );

  for (const [requirementKey, categoryName] of Object.entries(REQUIREMENT_TO_CATEGORY)) {
    const required = numberReq(input.requirements, requirementKey);
    if (required <= 0) continue;
    const category = input.snapshot.categories.find((item) => item.name === categoryName);
    if (!category) continue;

    if (category.trackingMode === "SERIALIZED") {
      const candidates = input.snapshot.serializedAssets
        .filter((asset) => asset.categoryId === category.id && !["RETIRED", "MAINTENANCE", "MISSING"].includes(asset.status))
        .filter((asset) => !busy.has(asset.id))
        .slice(0, required);
      candidates.forEach((asset) => busy.add(asset.id));
      lines.push({
        requirementKey,
        categoryId: category.id,
        categoryName,
        trackingMode: category.trackingMode,
        required,
        reserved: candidates.length,
        serializedAssetIds: candidates.map((asset) => asset.id),
        batchId: null,
        sourceKitId: null,
        shortage: Math.max(0, required - candidates.length),
      });
      if (candidates.length < required) {
        shortages.push({
          category: categoryName,
          required,
          reserved: candidates.length,
          shortBy: required - candidates.length,
          replacementCategoryId: category.replacementCategoryId,
        });
      }
    } else {
      const batch = input.snapshot.batches
        .filter((item) => item.categoryId === category.id)
        .sort((a, b) => b.availableQuantity - a.availableQuantity)[0];
      const reserved = Math.min(required, batch?.availableQuantity ?? 0);
      lines.push({
        requirementKey,
        categoryId: category.id,
        categoryName,
        trackingMode: category.trackingMode,
        required,
        reserved,
        serializedAssetIds: [],
        batchId: batch?.id ?? null,
        sourceKitId: null,
        shortage: Math.max(0, required - reserved),
      });
      if (reserved < required) {
        shortages.push({
          category: categoryName,
          required,
          reserved,
          shortBy: required - reserved,
          replacementCategoryId: category.replacementCategoryId,
        });
      }
    }
  }

  const cableKit = input.snapshot.kits.find((kit) => kit.name === "Cable Kit A");
  const techLoad =
    numberReq(input.requirements, "wirelessMicrophones") +
    numberReq(input.requirements, "wiredMicrophones") +
    numberReq(input.requirements, "projectors") +
    numberReq(input.requirements, "screens") +
    numberReq(input.requirements, "speakers");
  if (cableKit && techLoad >= 4) {
    lines.push({
      requirementKey: "cableKit",
      categoryId: "",
      categoryName: cableKit.name,
      trackingMode: "KIT",
      required: 1,
      reserved: 1,
      serializedAssetIds: [],
      batchId: null,
      sourceKitId: cableKit.id,
      shortage: 0,
    });
  }

  return { lines, shortages };
}
