import assert from "node:assert/strict";
import { ConflictStatus, ConflictSuggestionType, ConflictType } from "@prisma/client";
import { setAuthUserIdOverride } from "@/lib/auth/session";
import { DEMO_EVENT_STARTUP, DEMO_PROFILE_EVENT_MGR } from "@/lib/demo/seed-ids";
import { prisma } from "@/lib/db/prisma";
import { applyConflictSuggestion, detectConflicts } from "@/lib/services/conflicts";
import { generateEventPlan } from "@/lib/services/planning";
import { getLaunchReadiness } from "@/lib/services/launch-readiness";

async function resetDemoConflictState(eventId: string) {
  await prisma.assetReservationItem.deleteMany({
    where: { reservation: { eventId }, sourceKitId: { not: null } },
  });
  await prisma.conflictSuggestion.updateMany({
    where: { conflict: { eventId } },
    data: { isApplied: false, appliedAt: null, appliedByProfileId: null },
  });
  await prisma.conflict.updateMany({
    where: { eventId },
    data: { status: ConflictStatus.OPEN, resolvedAt: null, resolvedByProfileId: null, resolutionNote: null },
  });
}

async function main() {
  process.env.DEMO_MODE ??= "true";
  setAuthUserIdOverride(DEMO_PROFILE_EVENT_MGR);

  const eventId = DEMO_EVENT_STARTUP;
  await resetDemoConflictState(eventId);

  await generateEventPlan(eventId);
  let conflicts = await detectConflicts(eventId);

  const before = await getLaunchReadiness(eventId);
  const conflictsGateBefore = before.gates.find((gate) => gate.key === "conflicts");
  assert.ok(conflictsGateBefore, "conflicts gate missing");

  const micConflict =
    conflicts.find((conflict) => conflict.type === ConflictType.SERIALIZED_DOUBLE_BOOKING) ??
    conflicts.find((conflict) => conflict.type === ConflictType.ASSET_SHORTAGE && conflict.title.toLowerCase().includes("wireless"));
  assert.ok(micConflict, "expected wireless mic conflict in seed");
  assert.equal(micConflict.status, ConflictStatus.OPEN);

  const micSuggestion =
    micConflict.suggestions.find((suggestion) => suggestion.type === ConflictSuggestionType.SUBSTITUTE_ASSET && !suggestion.isApplied) ??
    micConflict.suggestions.find((suggestion) => !suggestion.isApplied);
  assert.ok(micSuggestion, "expected ranked substitute suggestion");

  const micPayload = (micSuggestion.payload ?? {}) as Record<string, unknown>;
  assert.ok(Array.isArray(micPayload.toolTrace), "expected tool-traced suggestion payload");

  const micResult = await applyConflictSuggestion(micConflict.id, micSuggestion.id);
  assert.equal(micResult.status, ConflictStatus.AUTO_FIXED, "mic fix should return AUTO_FIXED conflict");

  const afterMic = await getLaunchReadiness(eventId);
  const assetsGate = afterMic.gates.find((gate) => gate.key === "assets");
  const conflictsGateAfterMic = afterMic.gates.find((gate) => gate.key === "conflicts");
  assert.ok(assetsGate, "assets gate missing");
  assert.equal(assetsGate.status, "go", "assets gate should flip to GO after mic substitution");
  assert.ok(
    conflictsGateAfterMic && (conflictsGateAfterMic.status === "go" || conflictsGateAfterMic.status === "warning"),
    "conflicts gate should improve after mic fix",
  );

  conflicts = await detectConflicts(eventId);
  const powerConflict = conflicts.find((conflict) => conflict.type === ConflictType.POWER_CABLE_RISK && conflict.status === ConflictStatus.OPEN);
  assert.ok(powerConflict, "expected POWER_CABLE_RISK after planning");

  const powerBefore = await getLaunchReadiness(eventId);
  const powerGateBefore = powerBefore.gates.find((gate) => gate.key === "power");
  assert.ok(powerGateBefore, "power gate missing");
  assert.equal(powerGateBefore.status, "warning", "power gate should start WARNING");

  const cableSuggestion = powerConflict.suggestions.find(
    (suggestion) => suggestion.type === ConflictSuggestionType.ADD_CABLE_KIT && !suggestion.isApplied,
  );
  assert.ok(cableSuggestion, "expected ADD_CABLE_KIT suggestion for power conflict");

  const cableResult = await applyConflictSuggestion(powerConflict.id, cableSuggestion.id);
  assert.equal(cableResult.status, ConflictStatus.AUTO_FIXED, "cable kit fix should return AUTO_FIXED conflict");

  const afterCable = await getLaunchReadiness(eventId);
  const powerGateAfter = afterCable.gates.find((gate) => gate.key === "power");
  assert.ok(powerGateAfter, "power gate missing after cable fix");
  assert.equal(powerGateAfter.status, "go", "power gate should flip WARNING->GO after Cable Kit A");

  console.log("apply-fix self-check PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
