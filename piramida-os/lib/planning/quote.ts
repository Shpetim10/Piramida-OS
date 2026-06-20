import { priceAssets, priceSpace, type ReservationWindow } from "@/lib/pricing";
import type { WorldSnapshot } from "@/lib/repo";
import type { AssetDryRunResult, PlanningEvent, SelectedSpace } from "./types";

export type PlannedQuoteItem = {
  label: string;
  category: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  sourceRef: string;
  breakdown: string[];
};

export type PlannedQuote = {
  currency: string;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  items: PlannedQuoteItem[];
};

function pricingWindow(event: PlanningEvent): ReservationWindow {
  return {
    setupStart: event.window.setupStart,
    eventStart: event.window.eventStart,
    eventEnd: event.window.eventEnd,
    teardownEnd: event.window.teardownEnd,
  };
}

function modifierBuckets(modifiers: Array<{ label: string; amount: number }>) {
  return modifiers.reduce(
    (acc, modifier) => {
      if (modifier.amount < 0) acc.discount += Math.abs(modifier.amount);
      else if (modifier.label.toLowerCase().includes("vat") || modifier.label.toLowerCase().includes("tax")) acc.tax += modifier.amount;
      return acc;
    },
    { tax: 0, discount: 0 },
  );
}

export function buildQuote(input: {
  event: PlanningEvent;
  selectedSpaces: SelectedSpace[];
  assetPlan: AssetDryRunResult;
  snapshot: WorldSnapshot;
}): PlannedQuote {
  const context = { eventType: input.event.type };
  const window = pricingWindow(input.event);
  const items: PlannedQuoteItem[] = [];
  let subtotal = 0;
  let taxTotal = 0;
  let discountTotal = 0;
  let currency = "ALL";

  for (const selected of input.selectedSpaces) {
    const space = input.snapshot.spaces.find((item) => item.id === selected.spaceId);
    if (!space) continue;
    const priced = priceSpace(space, window, input.snapshot, context);
    currency = priced.currency;
    const buckets = modifierBuckets(priced.modifiers);
    subtotal += priced.subtotal;
    taxTotal += buckets.tax;
    discountTotal += buckets.discount;
    items.push({
      label: `${priced.spaceName} · ${selected.suggestedRole}`,
      category: "space",
      quantity: priced.billedHours,
      unitPrice: priced.billedHours > 0 ? Math.round(priced.total / priced.billedHours) : priced.total,
      lineTotal: priced.total,
      sourceRef: JSON.stringify({ type: "space", spaceId: selected.spaceId, subtotal: priced.subtotal, modifiers: priced.modifiers }),
      breakdown: priced.breakdown.concat(priced.modifiers.map((modifier) => `${modifier.label}: ${modifier.amount.toLocaleString()} ${priced.currency}`)),
    });
  }

  const assetItems = input.assetPlan.lines
    .filter((line) => line.reserved > 0)
    .map((line) =>
      line.sourceKitId
        ? { type: "kit" as const, id: line.sourceKitId, quantity: line.reserved }
        : { type: "category" as const, id: line.categoryId, quantity: line.reserved },
    );
  const assetsPrice = priceAssets(assetItems, input.snapshot, context);
  currency = assetsPrice.currency;
  subtotal += assetsPrice.subtotal;
  const assetBuckets = modifierBuckets(assetsPrice.modifiers);
  taxTotal += assetBuckets.tax;
  discountTotal += assetBuckets.discount;

  for (const line of assetsPrice.lines) {
    items.push({
      label: line.label,
      category: line.kitId ? "kit" : "asset",
      quantity: line.quantity,
      unitPrice: line.unitAmount,
      lineTotal: line.total,
      sourceRef: JSON.stringify({ type: line.kitId ? "kit" : "asset_category", categoryId: line.categoryId, kitId: line.kitId, rateType: line.rateType }),
      breakdown: [`${line.label}: ${line.quantity} x ${line.unitAmount.toLocaleString()} ${currency} = ${line.total.toLocaleString()} ${currency}`],
    });
  }
  for (const modifier of assetsPrice.modifiers) {
    items.push({
      label: modifier.label,
      category: "modifier",
      quantity: 1,
      unitPrice: modifier.amount,
      lineTotal: modifier.amount,
      sourceRef: JSON.stringify({ type: "modifier", scope: "assets" }),
      breakdown: [`${modifier.label}: ${modifier.amount.toLocaleString()} ${currency}`],
    });
  }

  const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return { currency, subtotal, taxTotal, discountTotal, total, items };
}
