import assert from "node:assert/strict";
import { reserveAssetsDryRun } from "./asset-dry-run";
import { detectPlanningConflicts } from "./conflict-detector";
import { matchSpaces, selectMultiSpacePlan } from "./space-matcher";
import { goldenConfig, goldenEvent, goldenRequirements, goldenSnapshot } from "./golden-fixture";

const snapshot = goldenSnapshot();
snapshot.serializedAssets = snapshot.serializedAssets.concat({
  id: "wired-1",
  categoryId: "cat-wired",
  name: "Wired Mic 01",
  assetTag: "WDMIC-01",
  status: "AVAILABLE",
  condition: "GOOD",
});
snapshot.settings["planning.conflict_rules"] = [
  { type: "SPACE_OVERLAP", severity: "CRITICAL", label: "Space double-booked", triggerParams: {} },
  { type: "ASSET_SHORTAGE", severity: "HIGH", label: "Asset shortage", triggerParams: { checkReplacement: true } },
  { type: "SERIALIZED_DOUBLE_BOOKING", severity: "CRITICAL", label: "Serialized asset conflict", triggerParams: {} },
  { type: "SETUP_TEARDOWN_BUFFER", severity: "MEDIUM", label: "Buffer conflict", triggerParams: { minBufferMinutes: 30 } },
  { type: "POWER_CABLE_RISK", severity: "MEDIUM", label: "Power / cable risk", triggerParams: { riskThreshold: 6 } },
  { type: "GUEST_FLOW_RISK", severity: "LOW", label: "Guest flow bottleneck", triggerParams: { flowRatio: 0.9 } },
];

const scores = matchSpaces({ event: goldenEvent, requirements: goldenRequirements, spaces: snapshot.spaces, activeSpaceWindows: [], config: goldenConfig });
const selectedSpaces = selectMultiSpacePlan(scores, goldenRequirements);
const activeAssetWindows = [{
  eventId: "robotics",
  resourceId: "wmic-4",
  startsAt: goldenEvent.window.setupStart,
  endsAt: goldenEvent.window.availabilityUntil,
}];
const assetPlan = reserveAssetsDryRun({ event: goldenEvent, requirements: goldenRequirements, snapshot, activeAssetWindows });
const conflicts = detectPlanningConflicts({
  event: goldenEvent,
  requirements: goldenRequirements,
  selectedSpaces,
  assetPlan,
  snapshot,
  activeSpaceWindows: [],
  activeAssetWindows,
  existingAssetReservations: [{ assetId: "wmic-4", assetName: "Wireless Mic 04", windowStart: goldenEvent.window.setupStart, windowEnd: goldenEvent.window.availabilityUntil }],
  rules: snapshot.settings["planning.conflict_rules"] as never,
});

assert.ok(conflicts.some((conflict) => conflict.type === "ASSET_SHORTAGE" && String(conflict.title).includes("Wireless Microphone")));
assert.ok(conflicts.some((conflict) => conflict.type === "SERIALIZED_DOUBLE_BOOKING" && String(conflict.title).includes("Wireless Mic 04")));
assert.ok(conflicts.every((conflict) => conflict.severity));

console.log("conflict self-check PASS");
