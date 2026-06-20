/**
 * lib/pricing — Deterministic pricing engine.
 *
 * Reads pricing_rules rows from the WorldSnapshot. Zero hard-coded amounts.
 * Adding / changing a price is a data change in pricing_rules, not code.
 *
 * AI must NEVER call these functions directly — it calls priceSpace / priceAssets
 * via the tool layer, which returns a read-only estimate. Only confirmed
 * reservations trigger committed invoice lines (separate billing module, out of MVP).
 */
import type { RepoPricingRule, RepoSpace, WorldSnapshot } from "@/lib/repo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReservationWindow {
  setupStart: Date;
  eventStart: Date;
  eventEnd: Date;
  teardownEnd: Date;
}

export interface SpacePriceEstimate {
  spaceId: string;
  spaceName: string;
  currency: string;
  baseAmount: number;
  featureSurcharges: Array<{ label: string; amount: number }>;
  subtotal: number;
  modifiers: Array<{ label: string; amount: number; isPercent: boolean }>;
  total: number;
  breakdown: string[];
  billedHours: number;
}

export interface AssetLineItem {
  label: string;
  categoryId: string | null;
  kitId: string | null;
  quantity: number;
  unitAmount: number;
  total: number;
  rateType: string;
}

export interface AssetsPriceEstimate {
  currency: string;
  lines: AssetLineItem[];
  subtotal: number;
  modifiers: Array<{ label: string; amount: number; isPercent: boolean }>;
  total: number;
}

export interface BillingPolicy {
  setupBilling: "free" | "discounted" | "full";
  setupDiscountPct: number;
  minBillableHours: number;
  hourRounding: "ceil" | "floor" | "round";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function billableHours(window: ReservationWindow, policy: BillingPolicy): number {
  const setupMs = window.eventStart.getTime() - window.setupStart.getTime();
  const eventMs = window.eventEnd.getTime() - window.eventStart.getTime();
  const teardownMs = window.teardownEnd.getTime() - window.eventEnd.getTime();

  const setupH = setupMs / 3_600_000;
  const eventH = eventMs / 3_600_000;
  const teardownH = teardownMs / 3_600_000;

  let billable = eventH + teardownH;
  if (policy.setupBilling === "full") billable += setupH;
  else if (policy.setupBilling === "discounted") billable += setupH * (1 - policy.setupDiscountPct / 100);
  // "free" → 0 for setup

  billable = Math.max(billable, policy.minBillableHours);

  switch (policy.hourRounding) {
    case "ceil":  return Math.ceil(billable);
    case "floor": return Math.floor(billable);
    default:      return Math.round(billable);
  }
}

function readBillingPolicy(snapshot: WorldSnapshot): BillingPolicy {
  const raw = snapshot.settings["planning.billing_policy"] as Record<string, unknown> | null;
  return {
    setupBilling: (raw?.setupBilling as BillingPolicy["setupBilling"]) ?? "discounted",
    setupDiscountPct: typeof raw?.setupDiscountPct === "number" ? raw.setupDiscountPct : 50,
    minBillableHours: typeof raw?.minBillableHours === "number" ? raw.minBillableHours : 4,
    hourRounding: (raw?.hourRounding as BillingPolicy["hourRounding"]) ?? "ceil",
  };
}

function applyModifiers(
  subtotal: number,
  modifierRules: RepoPricingRule[],
  context: { eventType?: string },
): { modifiers: Array<{ label: string; amount: number; isPercent: boolean }>; total: number } {
  const modifiers: Array<{ label: string; amount: number; isPercent: boolean }> = [];
  let total = subtotal;

  for (const rule of modifierRules) {
    // Check match_json conditions
    const mj = rule.matchJson;
    if (mj.event_type && mj.event_type !== context.eventType) continue;

    if (rule.rateType === "percent") {
      const delta = Math.round((total * rule.amount) / 100);
      modifiers.push({ label: rule.label, amount: delta, isPercent: true });
      total += delta;
    } else if (rule.rateType === "flat") {
      modifiers.push({ label: rule.label, amount: rule.amount, isPercent: false });
      total += rule.amount;
    }
  }
  return { modifiers, total };
}

// ---------------------------------------------------------------------------
// Price a space reservation window
// ---------------------------------------------------------------------------

export function priceSpace(
  space: RepoSpace,
  window: ReservationWindow,
  snapshot: WorldSnapshot,
  context: { eventType?: string } = {},
): SpacePriceEstimate {
  const policy = readBillingPolicy(snapshot);
  const hours = billableHours(window, policy);
  const currency = snapshot.settings["currency"] as string ?? "ALL";

  // Base rate rule: scope='space', targetId=space.id, no feature match_json
  const baseRule = snapshot.pricingRules.find(
    (r) => r.scope === "space" && r.targetId === space.id && !r.matchJson.feature,
  );
  const hourlyRate = baseRule?.amount ?? 0;
  const baseAmount = Math.round(hourlyRate * hours);
  const breakdown: string[] = [];
  if (baseRule) breakdown.push(`${baseRule.label}: ${hours}h × ${hourlyRate.toLocaleString()} ${currency} = ${baseAmount.toLocaleString()} ${currency}`);

  // Feature surcharges: scope='space', no targetId, matchJson.feature exists
  const featureRules = snapshot.pricingRules.filter(
    (r) => r.scope === "space" && !r.targetId && r.matchJson.feature,
  );
  const featureSurcharges: SpacePriceEstimate["featureSurcharges"] = [];
  for (const rule of featureRules) {
    const featureFlag = rule.matchJson.feature as string;
    if (!space.features[featureFlag]) continue;
    const surcharge = Math.round(rule.amount * hours);
    featureSurcharges.push({ label: rule.label, amount: surcharge });
    breakdown.push(`${rule.label}: ${hours}h × ${rule.amount.toLocaleString()} ${currency} = ${surcharge.toLocaleString()} ${currency}`);
  }

  const subtotal = baseAmount + featureSurcharges.reduce((t, f) => t + f.amount, 0);

  // Modifiers
  const modifierRules = snapshot.pricingRules.filter((r) => r.scope === "modifier");
  const { modifiers, total } = applyModifiers(subtotal, modifierRules, context);

  return {
    spaceId: space.id,
    spaceName: space.name,
    currency,
    baseAmount,
    featureSurcharges,
    subtotal,
    modifiers,
    total,
    breakdown,
    billedHours: hours,
  };
}

// ---------------------------------------------------------------------------
// Price an asset reservation plan
// ---------------------------------------------------------------------------

export interface AssetPlanItem {
  type: "category" | "kit";
  id: string;        // categoryId or kitId
  quantity: number;
  eventType?: string;
}

export function priceAssets(
  plan: AssetPlanItem[],
  snapshot: WorldSnapshot,
  context: { eventType?: string } = {},
): AssetsPriceEstimate {
  const currency = snapshot.settings["currency"] as string ?? "ALL";
  const lines: AssetLineItem[] = [];

  for (const item of plan) {
    const targetScope = item.type === "category" ? "asset_category" : "kit";
    const rule = snapshot.pricingRules.find(
      (r) => r.scope === targetScope && r.targetId === item.id,
    );
    if (!rule) continue;

    const unitAmount = rule.amount;
    let total = 0;

    switch (rule.rateType) {
      case "per_unit_per_event":
      case "per_unit_per_day":
        total = Math.round(unitAmount * item.quantity);
        break;
      case "per_event":
      case "flat":
        total = Math.round(unitAmount);
        break;
      default:
        total = Math.round(unitAmount * item.quantity);
    }

    const category = item.type === "category"
      ? snapshot.categories.find((c) => c.id === item.id)
      : null;
    const kit = item.type === "kit"
      ? snapshot.kits.find((k) => k.id === item.id)
      : null;

    lines.push({
      label: rule.label,
      categoryId: item.type === "category" ? item.id : null,
      kitId: item.type === "kit" ? item.id : null,
      quantity: item.quantity,
      unitAmount,
      total,
      rateType: rule.rateType,
    });
    void category; void kit;
  }

  const subtotal = lines.reduce((t, l) => t + l.total, 0);
  const modifierRules = snapshot.pricingRules.filter((r) => r.scope === "modifier");
  const { modifiers, total } = applyModifiers(subtotal, modifierRules, context);

  return { currency, lines, subtotal, modifiers, total };
}

// ---------------------------------------------------------------------------
// Quick estimate for a single space (used by the getSpaceInfo tool)
// ---------------------------------------------------------------------------

export function estimateSpacePrice(
  spaceId: string,
  window: ReservationWindow,
  snapshot: WorldSnapshot,
  context: { eventType?: string } = {},
): SpacePriceEstimate | null {
  const space = snapshot.spaces.find((s) => s.id === spaceId);
  if (!space) return null;
  return priceSpace(space, window, snapshot, context);
}
