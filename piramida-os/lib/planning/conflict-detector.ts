import type { WorldSnapshot } from "@/lib/repo";
import type { ActiveWindow, AssetDryRunResult, PlanningEvent, RequirementMap, SelectedSpace } from "./types";

export type ConflictRuleConfig = {
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  label: string;
  triggerParams?: Record<string, unknown>;
};

export type DetectedConflict = {
  key: string;
  type: "SPACE_OVERLAP" | "ASSET_SHORTAGE" | "SERIALIZED_DOUBLE_BOOKING" | "SETUP_TEARDOWN_BUFFER" | "POWER_CABLE_RISK" | "GUEST_FLOW_RISK";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  detail: Record<string, unknown>;
  predictive: boolean;
};

function ruleFor(rules: ConflictRuleConfig[], type: DetectedConflict["type"]) {
  return rules.find((rule) => rule.type === type);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function numberReq(reqs: RequirementMap, key: string): number {
  const value = reqs[key];
  return typeof value === "number" ? value : Number(value ?? 0) || 0;
}

export function detectPlanningConflicts(input: {
  event: PlanningEvent;
  requirements: RequirementMap;
  selectedSpaces: SelectedSpace[];
  assetPlan: AssetDryRunResult;
  snapshot: WorldSnapshot;
  activeSpaceWindows: ActiveWindow[];
  activeAssetWindows: ActiveWindow[];
  existingAssetReservations?: Array<{ assetId: string | null; assetName?: string | null; windowStart: Date | null; windowEnd: Date | null }>;
  rules: ConflictRuleConfig[];
  cableKitReserved?: boolean;
}): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];

  for (const shortage of input.assetPlan.shortages) {
    const rule = ruleFor(input.rules, "ASSET_SHORTAGE");
    conflicts.push({
      key: `asset-shortage:${shortage.category}`,
      type: "ASSET_SHORTAGE",
      severity: shortage.shortBy >= 2 ? "HIGH" : rule?.severity ?? "MEDIUM",
      title: `${shortage.category} shortage (${shortage.shortBy} short)`,
      detail: {
        category: shortage.category,
        required: shortage.required,
        reserved: shortage.reserved,
        available: shortage.reserved,
        shortBy: shortage.shortBy,
        replacementCategoryId: shortage.replacementCategoryId,
      },
      predictive: false,
    });
  }

  for (const selected of input.selectedSpaces) {
    const overlapsForSpace = input.activeSpaceWindows.filter(
      (win) => win.eventId !== input.event.id && win.resourceId === selected.spaceId && overlaps(input.event.window.setupStart, input.event.window.teardownEnd, win.startsAt, win.endsAt),
    );
    if (overlapsForSpace.length > 0) {
      const rule = ruleFor(input.rules, "SPACE_OVERLAP");
      conflicts.push({
        key: `space-overlap:${selected.spaceId}`,
        type: "SPACE_OVERLAP",
        severity: rule?.severity ?? "HIGH",
        title: `${selected.name} double-booked`,
        detail: { spaceId: selected.spaceId, spaceName: selected.name, overlaps: overlapsForSpace },
        predictive: false,
      });
    }
  }

  for (const item of input.existingAssetReservations ?? []) {
    if (!item.assetId || !item.windowStart || !item.windowEnd) continue;
    const overlapsForAsset = input.activeAssetWindows.filter(
      (win) => win.eventId !== input.event.id && win.resourceId === item.assetId && overlaps(item.windowStart!, item.windowEnd!, win.startsAt, win.endsAt),
    );
    if (overlapsForAsset.length > 0) {
      const rule = ruleFor(input.rules, "SERIALIZED_DOUBLE_BOOKING");
      conflicts.push({
        key: `serialized-double-booking:${item.assetId}`,
        type: "SERIALIZED_DOUBLE_BOOKING",
        severity: rule?.severity ?? "CRITICAL",
        title: `${item.assetName ?? "Serialized asset"} double-booked`,
        detail: { assetId: item.assetId, asset: item.assetName, overlaps: overlapsForAsset },
        predictive: false,
      });
    }
  }

  const setupMinutes = (input.event.window.eventStart.getTime() - input.event.window.setupStart.getTime()) / 60_000;
  const bufferRule = ruleFor(input.rules, "SETUP_TEARDOWN_BUFFER");
  const minBuffer = Number(bufferRule?.triggerParams?.minBufferMinutes ?? 30);
  if (setupMinutes < minBuffer) {
    conflicts.push({
      key: "setup-buffer",
      type: "SETUP_TEARDOWN_BUFFER",
      severity: bufferRule?.severity ?? "MEDIUM",
      title: "Setup buffer is tight",
      detail: { setupMinutes, minBufferMinutes: minBuffer },
      predictive: true,
    });
  }

  const powerRule = ruleFor(input.rules, "POWER_CABLE_RISK");
  const techLoad =
    numberReq(input.requirements, "wirelessMicrophones") +
    numberReq(input.requirements, "wiredMicrophones") +
    numberReq(input.requirements, "projectors") +
    numberReq(input.requirements, "screens") +
    numberReq(input.requirements, "speakers");
  const powerThreshold = Number(powerRule?.triggerParams?.riskThreshold ?? 4);
  const hasCableKit =
    input.cableKitReserved ??
    input.assetPlan.lines.some((line) => line.sourceKitId && line.reserved > 0);
  if (techLoad >= powerThreshold && !hasCableKit) {
    conflicts.push({
      key: "power-cable-risk",
      type: "POWER_CABLE_RISK",
      severity: powerRule?.severity ?? "MEDIUM",
      title: "Power and cable load needs a safety kit",
      detail: { techLoad, riskThreshold: powerThreshold, kit: "Cable Kit A" },
      predictive: true,
    });
  }

  const flowRule = ruleFor(input.rules, "GUEST_FLOW_RISK");
  const flowThreshold = Number(flowRule?.triggerParams?.flowRatio ?? 0.9);
  const keynote = input.selectedSpaces.find((space) => space.roleKey === "keynote");
  if (keynote?.capacity && input.event.expectedGuests / keynote.capacity >= flowThreshold) {
    conflicts.push({
      key: `guest-flow:${keynote.spaceId}`,
      type: "GUEST_FLOW_RISK",
      severity: flowRule?.severity ?? "LOW",
      title: "Crowd flow pressure near keynote space",
      detail: { spaceId: keynote.spaceId, spaceName: keynote.name, expectedGuests: input.event.expectedGuests, capacity: keynote.capacity, flowRatio: input.event.expectedGuests / keynote.capacity },
      predictive: true,
    });
  }

  return conflicts;
}
