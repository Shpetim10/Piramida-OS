/**
 * Budget Allocation Engine — DETERMINISTIC
 *
 * Given a gross budget (VAT-inclusive), event type, guest count, and days,
 * this engine selects the optimal venue combination, equipment, services, and
 * staff that fits within the budget. It then flags conflicts and generates
 * recommendations. AI is never involved in the allocation — only in the prose
 * that describes the result.
 *
 * Pricing source: lib/data.ts EVENT_VENUES, ASSETS, SERVICES — zero hard-coded
 * amounts here. Change a price in data.ts; it flows through automatically.
 */

import {
  ASSETS,
  EVENT_VENUES,
  SERVICES,
  STAFF_COST_PER_PERSON,
  VAT_RATE,
  type EventVenue,
} from "@/lib/data";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export const SUPPORTED_EVENT_TYPES = [
  "conference",
  "workshop",
  "hackathon",
  "exhibition",
  "performance",
] as const;

export type SupportedEventType = (typeof SUPPORTED_EVENT_TYPES)[number];

export type BudgetVenueItem = {
  id: string;
  name: string;
  role: "primary" | "breakout" | "support";
  capacity: number;
  pricePerDay: number;
  days: number;
  totalPrice: number;
  color: string;
  reason: string;
};

export type BudgetAssetItem = {
  id: string;
  label: string;
  sub: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
  /** qty requested but not affordable */
  shortfall: number;
};

export type BudgetServiceItem = {
  id: string;
  label: string;
  sub: string;
  price: number;
};

export type BudgetConflict = {
  severity: "low" | "medium" | "high";
  type:
    | "BUDGET_TIGHT"
    | "CAPACITY_WARNING"
    | "ASSET_SHORTAGE_RISK"
    | "SERVICE_OMITTED"
    | "UNDER_SPEC"
    | "VENUE_UNAVAILABLE";
  message: string;
  suggestion: string;
};

export type BudgetPackage = {
  budget: number;
  currency: "EUR";
  eventType: string;
  guestCount: number;
  days: number;
  venues: BudgetVenueItem[];
  assets: BudgetAssetItem[];
  services: BudgetServiceItem[];
  staff: { count: number; pricePerPerson: number; total: number } | null;
  subtotal: number;
  vat: number;
  total: number;
  remainingBudget: number;
  budgetUtilization: number;
  conflicts: BudgetConflict[];
  recommendations: string[];
  tier: "essentials" | "standard" | "full-service";
};

// ---------------------------------------------------------------------------
// Event type profiles — defines priorities and standard quantities
// ---------------------------------------------------------------------------

type EventProfile = {
  breakoutCount: number;
  includeEntrance: boolean;
  includeCorridor: boolean;
  assetPriority: string[];
  servicePriority: string[];
  staffRatio: number;
  assetQuantity: Record<string, (guests: number) => number>;
};

const PROFILES: Record<string, EventProfile> = {
  conference: {
    breakoutCount: 2,
    includeEntrance: true,
    includeCorridor: true,
    assetPriority: [
      "screens",
      "projectors",
      "wirelessMicrophones",
      "speakers",
      "chairs",
      "tables",
      "wiredMicrophones",
    ],
    servicePriority: ["registration", "catering", "security"],
    staffRatio: 50,
    assetQuantity: {
      screens: () => 1,
      projectors: () => 1,
      wirelessMicrophones: (g) => (g >= 100 ? 4 : 2),
      speakers: () => 2,
      chairs: (g) => Math.min(g, 220),
      tables: (g) => Math.max(5, Math.ceil(g / 12)),
      wiredMicrophones: () => 1,
    },
  },
  workshop: {
    breakoutCount: 0,
    includeEntrance: false,
    includeCorridor: false,
    assetPriority: [
      "projectors",
      "screens",
      "chairs",
      "tables",
      "wirelessMicrophones",
      "speakers",
    ],
    servicePriority: ["catering", "registration"],
    staffRatio: 25,
    assetQuantity: {
      projectors: () => 1,
      screens: () => 1,
      chairs: (g) => Math.min(g, 80),
      tables: (g) => Math.ceil(g / 5),
      wirelessMicrophones: () => 1,
      speakers: () => 2,
    },
  },
  hackathon: {
    breakoutCount: 1,
    includeEntrance: true,
    includeCorridor: false,
    assetPriority: [
      "tables",
      "chairs",
      "screens",
      "projectors",
      "wirelessMicrophones",
      "speakers",
    ],
    servicePriority: ["catering", "registration", "security"],
    staffRatio: 40,
    assetQuantity: {
      tables: (g) => Math.ceil(g / 4),
      chairs: (g) => Math.min(g, 240),
      screens: () => 2,
      projectors: () => 1,
      wirelessMicrophones: () => 2,
      speakers: () => 2,
    },
  },
  exhibition: {
    breakoutCount: 0,
    includeEntrance: true,
    includeCorridor: true,
    assetPriority: [
      "speakers",
      "screens",
      "chairs",
      "tables",
      "wirelessMicrophones",
    ],
    servicePriority: ["security", "catering", "registration"],
    staffRatio: 80,
    assetQuantity: {
      speakers: () => 2,
      screens: () => 2,
      chairs: (g) => Math.ceil(g * 0.3),
      tables: (g) => Math.ceil(g * 0.1),
      wirelessMicrophones: () => 1,
    },
  },
  performance: {
    breakoutCount: 0,
    includeEntrance: true,
    includeCorridor: false,
    assetPriority: [
      "speakers",
      "wirelessMicrophones",
      "wiredMicrophones",
      "screens",
      "chairs",
    ],
    servicePriority: ["security", "registration", "catering"],
    staffRatio: 80,
    assetQuantity: {
      speakers: () => 2,
      wirelessMicrophones: () => 2,
      wiredMicrophones: () => 2,
      screens: () => 1,
      chairs: (g) => Math.min(g, 200),
    },
  },
};

// ---------------------------------------------------------------------------
// Main allocator
// ---------------------------------------------------------------------------

export function allocateBudget(input: {
  budget: number;
  eventType: string;
  guestCount: number;
  days: number;
  /** Venue names (from EVENT_VENUES) that are already booked on the requested dates */
  unavailableVenueNames?: string[];
}): BudgetPackage {
  const { budget, guestCount, days } = input;
  const eventType: string = SUPPORTED_EVENT_TYPES.includes(
    input.eventType as SupportedEventType,
  )
    ? input.eventType
    : "conference";
  const profile = PROFILES[eventType];

  const unavailableSet = new Set(input.unavailableVenueNames ?? []);

  // Budget is gross (VAT-inclusive); all line items are priced pre-VAT.
  const preTaxBudget = budget / (1 + VAT_RATE);
  let remaining = preTaxBudget;

  // ── Step 1: Primary venue ──────────────────────────────────────────────
  const allHalls = EVENT_VENUES.filter((v) => v.kind === "hall").sort(
    (a, b) => a.capacity - b.capacity,
  );
  // Prefer halls that are free on the requested dates; fall back to all halls
  // if every hall is booked (planner still shows a package, conflicts surface it).
  const halls = allHalls.filter((h) => !unavailableSet.has(h.name));
  const hallsToUse = halls.length > 0 ? halls : allHalls;
  const primaryHall =
    hallsToUse.find((h) => h.capacity >= guestCount) ?? hallsToUse[hallsToUse.length - 1];
  const primaryCost = primaryHall.pricePerDay * days;

  const venues: BudgetVenueItem[] = [];

  if (remaining >= primaryCost) {
    venues.push(
      toVenueItem(
        primaryHall,
        days,
        "primary",
        `${primaryHall.name} seats up to ${primaryHall.capacity} — ${primaryHall.blurb}.`,
      ),
    );
    remaining -= primaryCost;
  } else {
    // Cannot even afford primary hall — add it anyway and let conflicts surface
    venues.push(
      toVenueItem(
        primaryHall,
        days,
        "primary",
        `${primaryHall.name} seats up to ${primaryHall.capacity} — ${primaryHall.blurb}.`,
      ),
    );
    remaining = 0;
  }

  // ── Step 2: Breakout rooms ─────────────────────────────────────────────
  if (profile.breakoutCount > 0) {
    const candidates = hallsToUse
      .filter((h) => h.id !== primaryHall.id)
      .slice(0, profile.breakoutCount);
    for (const hall of candidates) {
      const cost = hall.pricePerDay * days;
      if (remaining >= cost) {
        venues.push(
          toVenueItem(
            hall,
            days,
            "breakout",
            `${hall.name} — parallel session room.`,
          ),
        );
        remaining -= cost;
      }
    }
  }

  // ── Step 3: Support spaces ─────────────────────────────────────────────
  const entrance = EVENT_VENUES.find((v) => v.id === "entrance")!;
  const corridor = EVENT_VENUES.find((v) => v.id === "corridor")!;

  if (profile.includeEntrance) {
    const cost = entrance.pricePerDay * days;
    if (remaining >= cost) {
      venues.push(
        toVenueItem(entrance, days, "support", "Registration & welcome area."),
      );
      remaining -= cost;
    }
  }
  if (profile.includeCorridor) {
    const cost = corridor.pricePerDay * days;
    if (remaining >= cost) {
      venues.push(
        toVenueItem(
          corridor,
          days,
          "support",
          "Coffee, networking & wayfinding.",
        ),
      );
      remaining -= cost;
    }
  }

  // ── Step 4: Assets ────────────────────────────────────────────────────
  const assetDefs = new Map(ASSETS.map((a) => [a.id, a]));
  const assets: BudgetAssetItem[] = [];

  for (const assetId of profile.assetPriority) {
    const def = assetDefs.get(assetId);
    if (!def) continue;
    const reqQty = profile.assetQuantity[assetId]?.(guestCount) ?? 0;
    if (reqQty <= 0) continue;

    const fullCost = def.unit * reqQty * days;
    if (remaining >= fullCost) {
      assets.push({
        id: def.id,
        label: def.label,
        sub: def.sub,
        qty: reqQty,
        unitPrice: def.unit,
        totalPrice: fullCost,
        shortfall: 0,
      });
      remaining -= fullCost;
    } else if (remaining >= def.unit * days) {
      const affordableQty = Math.floor(remaining / (def.unit * days));
      const cost = def.unit * affordableQty * days;
      assets.push({
        id: def.id,
        label: def.label,
        sub: def.sub,
        qty: affordableQty,
        unitPrice: def.unit,
        totalPrice: cost,
        shortfall: reqQty - affordableQty,
      });
      remaining -= cost;
    } else {
      assets.push({
        id: def.id,
        label: def.label,
        sub: def.sub,
        qty: 0,
        unitPrice: def.unit,
        totalPrice: 0,
        shortfall: reqQty,
      });
    }
  }

  // ── Step 5: Services ──────────────────────────────────────────────────
  const svcDefs = new Map(SERVICES.map((s) => [s.id, s]));
  const services: BudgetServiceItem[] = [];

  for (const svcId of profile.servicePriority) {
    const def = svcDefs.get(svcId);
    if (!def) continue;
    const cost = def.perHead ? def.perHead * guestCount : (def.price ?? 0);
    if (remaining >= cost) {
      services.push({ id: def.id, label: def.label, sub: def.sub, price: cost });
      remaining -= cost;
    }
  }

  // ── Step 6: Staff ──────────────────────────────────────────────────────
  let staff: BudgetPackage["staff"] = null;
  const idealStaff = Math.max(2, Math.ceil(guestCount / profile.staffRatio));
  const maxAffordable = Math.floor(remaining / (STAFF_COST_PER_PERSON * days));

  if (maxAffordable >= 2) {
    const count = Math.min(idealStaff, maxAffordable);
    const total = count * STAFF_COST_PER_PERSON * days;
    staff = { count, pricePerPerson: STAFF_COST_PER_PERSON, total };
    remaining -= total;
  }

  // ── Totals ─────────────────────────────────────────────────────────────
  const subtotal = preTaxBudget - remaining;
  const vat = subtotal * VAT_RATE;
  const total = subtotal + vat;
  const budgetUtilization = Math.min(1.05, total / budget);

  // ── Conflicts ──────────────────────────────────────────────────────────
  const conflicts = detectConflicts({
    budget,
    total,
    primaryHall,
    guestCount,
    days,
    assets,
    services,
    remaining,
  });

  // Prepend unavailability conflicts so they appear first and most prominently.
  if (unavailableSet.size > 0) {
    const names = [...unavailableSet].join(", ");
    const plural = unavailableSet.size > 1;
    conflicts.unshift({
      severity: "high",
      type: "VENUE_UNAVAILABLE",
      message: `${names} ${plural ? "are" : "is"} already booked on your dates.`,
      suggestion: `Alternative ${plural ? "venues have" : "venue has"} been selected automatically. Consider different dates if you need ${plural ? "those specific spaces" : "that specific space"}.`,
    });
  }

  // ── Tier ───────────────────────────────────────────────────────────────
  const tier: BudgetPackage["tier"] =
    services.length >= 2 && staff !== null && venues.length >= 3
      ? "full-service"
      : services.length >= 1 || assets.length >= 3
        ? "standard"
        : "essentials";

  // ── Recommendations ────────────────────────────────────────────────────
  const recommendations = buildRecommendations({
    venues,
    assets,
    services,
    staff,
    guestCount,
    primaryHall,
    remaining,
    budget,
    days,
    profile,
  });

  return {
    budget,
    currency: "EUR",
    eventType,
    guestCount,
    days,
    venues,
    assets: assets.filter((a) => a.qty > 0),
    services,
    staff,
    subtotal,
    vat,
    total,
    remainingBudget: remaining,
    budgetUtilization,
    conflicts,
    recommendations,
    tier,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toVenueItem(
  venue: EventVenue,
  days: number,
  role: BudgetVenueItem["role"],
  reason: string,
): BudgetVenueItem {
  return {
    id: venue.id,
    name: venue.name,
    role,
    capacity: venue.capacity,
    pricePerDay: venue.pricePerDay,
    days,
    totalPrice: venue.pricePerDay * days,
    color: venue.color,
    reason,
  };
}

function detectConflicts(ctx: {
  budget: number;
  total: number;
  primaryHall: EventVenue;
  guestCount: number;
  days: number;
  assets: BudgetAssetItem[];
  services: BudgetServiceItem[];
  remaining: number;
}): BudgetConflict[] {
  const {
    budget,
    total,
    primaryHall,
    guestCount,
    days,
    assets,
    services,
    remaining,
  } = ctx;
  const conflicts: BudgetConflict[] = [];
  const utilization = total / budget;

  // Over-budget guard
  if (utilization > 1.0) {
    conflicts.push({
      severity: "high",
      type: "BUDGET_TIGHT",
      message: `Package exceeds budget by €${Math.round(total - budget)}.`,
      suggestion:
        "Reduce guest count, drop a breakout room, or increase budget.",
    });
  } else if (utilization > 0.95) {
    conflicts.push({
      severity: "medium",
      type: "BUDGET_TIGHT",
      message: `${Math.round(utilization * 100)}% of budget used — minimal headroom.`,
      suggestion:
        "Hold back 10% as a contingency for last-minute additions.",
    });
  }

  // Capacity check
  if (primaryHall.capacity < guestCount) {
    const upgrade = EVENT_VENUES.filter(
      (v) => v.kind === "hall" && v.capacity >= guestCount,
    ).sort((a, b) => a.pricePerDay - b.pricePerDay)[0];
    const extraCost = upgrade
      ? (upgrade.pricePerDay - primaryHall.pricePerDay) * days * (1 + VAT_RATE)
      : 0;
    conflicts.push({
      severity: "high",
      type: "CAPACITY_WARNING",
      message: `${primaryHall.name} (${primaryHall.capacity} seats) is below your ${guestCount}-guest target.`,
      suggestion: upgrade
        ? `Upgrade to ${upgrade.name} (${upgrade.capacity} seats) for ~€${Math.round(extraCost)} more.`
        : "Consider splitting across multiple rooms or reducing headcount.",
    });
  } else if (primaryHall.capacity < guestCount * 1.1) {
    conflicts.push({
      severity: "low",
      type: "CAPACITY_WARNING",
      message: `${primaryHall.name} has only ${primaryHall.capacity - guestCount} extra seats of headroom.`,
      suggestion:
        "Plan your exact headcount — no walk-ins or last-minute additions.",
    });
  }

  // Missing registration for larger events
  const hasRegistration = services.some((s) => s.id === "registration");
  if (!hasRegistration && guestCount >= 30) {
    conflicts.push({
      severity: "medium",
      type: "SERVICE_OMITTED",
      message: `Guest registration & QR check-in omitted due to budget constraints.`,
      suggestion: `Add €250 to your budget to include QR check-in and a registration desk.`,
    });
  }

  // Wireless mic shortage for stage events
  const mics = assets.find((a) => a.id === "wirelessMicrophones");
  if (mics && mics.qty < 2 && guestCount >= 50) {
    conflicts.push({
      severity: "low",
      type: "ASSET_SHORTAGE_RISK",
      message: `Only ${mics.qty} wireless mic — Q&A sessions will be limited to the stage.`,
      suggestion: `Add a second mic for €${30 * days} to enable roaming audience Q&A.`,
    });
  }

  // Chair shortage
  const chairsItem = assets.find((a) => a.id === "chairs");
  if (chairsItem && chairsItem.qty < guestCount * 0.8) {
    const missing = guestCount - chairsItem.qty;
    conflicts.push({
      severity: "medium",
      type: "ASSET_SHORTAGE_RISK",
      message: `${chairsItem.qty} chairs allocated for ${guestCount} guests — ${missing} guests will stand.`,
      suggestion: `Add ${missing} more chairs for ~€${missing * 2 * days} to seat everyone.`,
    });
  }

  // Very low utilization = under-specced for the event
  if (remaining / (budget / (1 + VAT_RATE)) > 0.35 && budget > 1000) {
    conflicts.push({
      severity: "low",
      type: "UNDER_SPEC",
      message: `Large unspent balance — this package may under-deliver for your guests.`,
      suggestion: `Consider adding catering, extra staff, or signage to use budget productively.`,
    });
  }

  return conflicts;
}

function buildRecommendations(ctx: {
  venues: BudgetVenueItem[];
  assets: BudgetAssetItem[];
  services: BudgetServiceItem[];
  staff: BudgetPackage["staff"] | null;
  guestCount: number;
  primaryHall: EventVenue;
  remaining: number;
  budget: number;
  days: number;
  profile: EventProfile;
}): string[] {
  const {
    venues,
    assets,
    services,
    staff,
    guestCount,
    remaining,
    budget,
    days,
  } = ctx;
  const recs: string[] = [];
  const remainingGross = remaining * (1 + VAT_RATE);

  if (remainingGross > budget * 0.12) {
    recs.push(
      `~€${Math.round(remainingGross)} unspent — invest in event photography, custom signage, or a speaker gift.`,
    );
  }

  if (!services.some((s) => s.id === "catering")) {
    recs.push(
      "Catering (coffee + lunch) is the highest-impact attendee satisfaction add-on.",
    );
  }

  if (venues.every((v) => v.role !== "support") && guestCount >= 60) {
    recs.push(
      "A dedicated registration area at the Entrance improves first impressions significantly.",
    );
  }

  if (guestCount > 100 && !services.some((s) => s.id === "security")) {
    recs.push(
      "Events over 100 guests benefit from a security team for smooth entry and crowd flow.",
    );
  }

  if (!staff && guestCount >= 40) {
    recs.push(
      `Budget ~€${Math.max(2, Math.ceil(guestCount / 50)) * STAFF_COST_PER_PERSON * days} for event staff to manage guest flow and support speakers.`,
    );
  }

  const shortfallAssets = assets.filter((a) => a.shortfall > 0);
  if (shortfallAssets.length > 0) {
    const names = shortfallAssets.map((a) => a.label.toLowerCase()).join(", ");
    recs.push(
      `Full ${names} quantities could not fit budget — partial kit provided. Expand budget to close the gap.`,
    );
  }

  return recs.slice(0, 4);
}
