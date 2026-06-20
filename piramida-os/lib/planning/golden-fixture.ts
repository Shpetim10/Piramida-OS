import type { WorldSnapshot } from "@/lib/repo";
import type { PlanningConfig, PlanningEvent, RequirementMap } from "./types";

export const goldenRequirements: RequirementMap = {
  eventType: "conference",
  expectedGuests: 180,
  mainStage: true,
  breakoutRooms: 2,
  coffeeArea: true,
  registrationDesk: true,
  publicGuestRegistration: true,
  screens: 1,
  projectors: 1,
  wirelessMicrophones: 4,
  wiredMicrophones: 0,
  chairs: 180,
  tables: 15,
  speakers: 2,
  livestream: true,
  setupHours: 2,
};

export const goldenEvent: PlanningEvent = {
  id: "event-golden",
  title: "Golden Startup Summit",
  type: "CONFERENCE",
  expectedGuests: 180,
  window: {
    setupStart: new Date("2026-07-15T07:00:00.000Z"),
    eventStart: new Date("2026-07-15T09:00:00.000Z"),
    eventEnd: new Date("2026-07-15T17:00:00.000Z"),
    teardownEnd: new Date("2026-07-15T19:00:00.000Z"),
    availabilityUntil: new Date("2026-07-15T19:30:00.000Z"),
  },
};

export const goldenConfig: PlanningConfig = {
  scoringWeights: { capacityFit: 25, availability: 20, layoutFit: 12, adjacency: 15, setupFeasibility: 8, guestFlow: 10, featureFit: 10 },
  feasibilityWeights: { spaceFit: 30, assetReadiness: 25, scheduleSafety: 15, powerCable: 10, staffTask: 10, guestReadiness: 10 },
  dnaDimensions: [
    { key: "peopleIntensity", label: "People Intensity", shortLabel: "PEOPLE", formula: "guestDensity" },
    { key: "technicalComplexity", label: "Technical Complexity", shortLabel: "TECH", formula: "techCount" },
    { key: "spaceComplexity", label: "Space Complexity", shortLabel: "SPACE", formula: "spaceCount" },
    { key: "assetIntensity", label: "Asset Intensity", shortLabel: "ASSETS", formula: "assetCount" },
    { key: "guestJourney", label: "Guest Journey", shortLabel: "JOURNEY", formula: "registration" },
  ],
};

export function goldenSnapshot(): WorldSnapshot {
  const spaces = [
    { id: "green", name: "Green Room", kind: "ROOM", capacity: 200, standingCapacity: null, comfortFlow: null, areaSqm: 400, publicVisible: true, features: { stage: true, naturalLight: true }, adjacentSpaceIds: ["entrance", "blue", "yellow"] },
    { id: "blue", name: "Blue Room", kind: "ROOM", capacity: 80, standingCapacity: null, comfortFlow: null, areaSqm: 160, publicVisible: true, features: { naturalLight: true }, adjacentSpaceIds: ["green", "entrance"] },
    { id: "yellow", name: "Yellow Room", kind: "ROOM", capacity: 80, standingCapacity: null, comfortFlow: null, areaSqm: 160, publicVisible: true, features: {}, adjacentSpaceIds: ["green", "entrance"] },
    { id: "entrance", name: "Entrance", kind: "ENTRANCE", capacity: null, standingCapacity: 120, comfortFlow: 120, areaSqm: 100, publicVisible: true, features: { naturalLight: true }, adjacentSpaceIds: ["green", "blue", "yellow"] },
    { id: "orange", name: "Orange Room", kind: "ROOM", capacity: 120, standingCapacity: null, comfortFlow: null, areaSqm: 240, publicVisible: true, features: { builtInAv: true }, adjacentSpaceIds: [] },
  ];
  const categories = [
    { id: "cat-wireless", name: "Wireless Microphone", trackingMode: "SERIALIZED", unit: null, defaultSetupMinutes: 15, defaultTeardownMinutes: 10, defaultReturnBufferMinutes: 30, replacementCategoryId: "cat-wired" },
    { id: "cat-wired", name: "Wired Microphone", trackingMode: "SERIALIZED", unit: null, defaultSetupMinutes: 15, defaultTeardownMinutes: 10, defaultReturnBufferMinutes: 30, replacementCategoryId: null },
    { id: "cat-projector", name: "Projector", trackingMode: "SERIALIZED", unit: null, defaultSetupMinutes: 30, defaultTeardownMinutes: 20, defaultReturnBufferMinutes: 30, replacementCategoryId: null },
    { id: "cat-screen", name: "Screen", trackingMode: "SERIALIZED", unit: null, defaultSetupMinutes: 30, defaultTeardownMinutes: 20, defaultReturnBufferMinutes: 30, replacementCategoryId: null },
    { id: "cat-speaker", name: "Speaker", trackingMode: "SERIALIZED", unit: null, defaultSetupMinutes: 20, defaultTeardownMinutes: 15, defaultReturnBufferMinutes: 30, replacementCategoryId: null },
    { id: "cat-reg", name: "Registration Desk", trackingMode: "SERIALIZED", unit: null, defaultSetupMinutes: 20, defaultTeardownMinutes: 15, defaultReturnBufferMinutes: 30, replacementCategoryId: null },
    { id: "cat-chairs", name: "Chairs", trackingMode: "BULK", unit: "pcs", defaultSetupMinutes: 60, defaultTeardownMinutes: 45, defaultReturnBufferMinutes: 30, replacementCategoryId: null },
    { id: "cat-tables", name: "Tables", trackingMode: "BULK", unit: "pcs", defaultSetupMinutes: 60, defaultTeardownMinutes: 45, defaultReturnBufferMinutes: 30, replacementCategoryId: null },
  ];
  return {
    orgId: "org",
    spaces,
    categories,
    serializedAssets: [
      ...[1, 2, 3, 4].map((n) => ({ id: `wmic-${n}`, categoryId: "cat-wireless", name: `Wireless Mic ${n}`, assetTag: `WMIC-${n}`, status: "AVAILABLE", condition: "GOOD" })),
      { id: "projector-1", categoryId: "cat-projector", name: "Projector 1", assetTag: "PROJ-1", status: "AVAILABLE", condition: "GOOD" },
      { id: "screen-1", categoryId: "cat-screen", name: "Screen 1", assetTag: "SCR-1", status: "AVAILABLE", condition: "GOOD" },
      { id: "speaker-1", categoryId: "cat-speaker", name: "Speaker 1", assetTag: "SPK-1", status: "AVAILABLE", condition: "GOOD" },
      { id: "speaker-2", categoryId: "cat-speaker", name: "Speaker 2", assetTag: "SPK-2", status: "AVAILABLE", condition: "GOOD" },
      { id: "reg-1", categoryId: "cat-reg", name: "Registration Desk", assetTag: "REG-1", status: "AVAILABLE", condition: "GOOD" },
    ],
    batches: [
      { id: "batch-chairs", categoryId: "cat-chairs", name: "Chairs", totalQuantity: 220, availableQuantity: 220 },
      { id: "batch-tables", categoryId: "cat-tables", name: "Tables", totalQuantity: 30, availableQuantity: 30 },
    ],
    kits: [],
    pricingRules: [
      { id: "green-base", scope: "space", targetId: "green", label: "Green Room base", matchJson: {}, rateType: "per_hour", amount: 15000, currency: "ALL", minBillableHours: 4, priority: 0 },
      { id: "blue-base", scope: "space", targetId: "blue", label: "Blue Room base", matchJson: {}, rateType: "per_hour", amount: 6000, currency: "ALL", minBillableHours: 4, priority: 0 },
      { id: "yellow-base", scope: "space", targetId: "yellow", label: "Yellow Room base", matchJson: {}, rateType: "per_hour", amount: 6000, currency: "ALL", minBillableHours: 4, priority: 0 },
      { id: "entrance-base", scope: "space", targetId: "entrance", label: "Entrance base", matchJson: {}, rateType: "per_hour", amount: 5000, currency: "ALL", minBillableHours: 4, priority: 0 },
      { id: "stage", scope: "space", targetId: null, label: "Stage surcharge", matchJson: { feature: "stage" }, rateType: "per_hour", amount: 3000, currency: "ALL", minBillableHours: null, priority: 10 },
      { id: "wmic", scope: "asset_category", targetId: "cat-wireless", label: "Wireless Mic", matchJson: {}, rateType: "per_unit_per_event", amount: 2000, currency: "ALL", minBillableHours: null, priority: 0 },
      { id: "chairs", scope: "asset_category", targetId: "cat-chairs", label: "Chairs", matchJson: {}, rateType: "per_unit_per_event", amount: 300, currency: "ALL", minBillableHours: null, priority: 0 },
      { id: "conference", scope: "modifier", targetId: null, label: "Conference type uplift (+10%)", matchJson: { event_type: "CONFERENCE" }, rateType: "percent", amount: 10, currency: "ALL", minBillableHours: null, priority: 100 },
      { id: "vat", scope: "modifier", targetId: null, label: "VAT (20%)", matchJson: {}, rateType: "percent", amount: 20, currency: "ALL", minBillableHours: null, priority: 200 },
    ],
    settings: {
      currency: "ALL",
      "planning.billing_policy": { setupBilling: "discounted", setupDiscountPct: 50, minBillableHours: 4, hourRounding: "ceil" },
    },
    loadedAt: new Date("2026-06-20T00:00:00.000Z"),
  };
}
