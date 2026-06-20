import assert from "node:assert/strict";
import { estimateSpacePrice } from "@/lib/pricing";
import { reserveAssetsDryRun } from "./asset-dry-run";
import { buildQuote } from "./quote";
import { matchSpaces, selectMultiSpacePlan } from "./space-matcher";
import { goldenConfig, goldenEvent, goldenRequirements, goldenSnapshot } from "./golden-fixture";

const snapshot = goldenSnapshot();
const scores = matchSpaces({
  event: goldenEvent,
  requirements: goldenRequirements,
  spaces: snapshot.spaces,
  activeSpaceWindows: [],
  config: goldenConfig,
});
const selected = selectMultiSpacePlan(scores, goldenRequirements);
const selectedNames = selected.map((space) => space.name);

assert.deepEqual(selectedNames.slice(0, 4), ["Green Room", "Entrance", "Blue Room", "Yellow Room"]);
assert.ok(scores.find((space) => space.name === "Green Room")?.reasons.some((reason) => reason.includes("features stage")));

const changedWeights = {
  ...goldenConfig,
  scoringWeights: { ...goldenConfig.scoringWeights, featureFit: 40, capacityFit: 5 },
};
const changedScores = matchSpaces({
  event: goldenEvent,
  requirements: goldenRequirements,
  spaces: snapshot.spaces,
  activeSpaceWindows: [],
  config: changedWeights,
});
assert.notEqual(
  scores.find((space) => space.name === "Green Room")?.score,
  changedScores.find((space) => space.name === "Green Room")?.score,
);

const assetPlan = reserveAssetsDryRun({
  event: goldenEvent,
  requirements: goldenRequirements,
  snapshot,
  activeAssetWindows: [],
});
assert.equal(assetPlan.shortages.length, 0);

const quote = buildQuote({ event: goldenEvent, selectedSpaces: selected, assetPlan, snapshot });
const greenEstimate = estimateSpacePrice("green", goldenEvent.window, snapshot, { eventType: goldenEvent.type });
const greenQuoteLine = quote.items.find((item) => item.sourceRef.includes('"spaceId":"green"'));
assert.equal(greenQuoteLine?.lineTotal, greenEstimate?.total);

const repriced = goldenSnapshot();
repriced.pricingRules = repriced.pricingRules.map((rule) => rule.id === "green-base" ? { ...rule, amount: rule.amount + 1000 } : rule);
const repricedQuote = buildQuote({ event: goldenEvent, selectedSpaces: selected, assetPlan, snapshot: repriced });
const repricedGreen = estimateSpacePrice("green", goldenEvent.window, repriced, { eventType: goldenEvent.type });
assert.notEqual(repricedQuote.total, quote.total);
assert.equal(
  repricedQuote.items.find((item) => item.sourceRef.includes('"spaceId":"green"'))?.lineTotal,
  repricedGreen?.total,
);

console.log("planning self-check PASS");
