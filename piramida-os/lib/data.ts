// Centralized mock data for the Pyramid OS guest + organizer experiences.
// No backend / Supabase / AI yet — everything here is deterministic demo data.
//
// ROOM SOURCE OF TRUTH: the rooms/spaces below are NOT the old six demo rooms.
// They are derived from the real three.js model dataset in ./pyramid-data.ts
// (floors, space ids, names, colours, capacities). Prices / facilities are
// derived from each room's capacity and clearly marked as demo placeholders.

import { FLOORS, type EventSpace, type Floor } from "./pyramid-data";

export const LIME = "#C8F000";

export type EventType =
  | "conference"
  | "exhibition"
  | "hackathon"
  | "performance"
  | "workshop";

export type EventStatus = "ongoing" | "upcoming" | "past";

export interface PyramidEvent {
  id: string;
  title: string;
  type: EventType;
  status: EventStatus;
  day: string;
  month: string;
  guests: string;
  room: string;
  time?: string;
  attendance?: string;
}

export const EVENT_COLORS: Record<EventType, string> = {
  conference: "#2A6FDB",
  exhibition: "#C0612A",
  hackathon: "#7A4BD6",
  performance: "#C53A6B",
  workshop: "#1F8A5B",
};

export const EVENTS: PyramidEvent[] = [
  { id: "echoes", title: "Echoes — Sound & Light", type: "performance", status: "ongoing", day: "20", month: "JUN", guests: "400", room: "Common Area", time: "Until 23:00" },
  { id: "summit", title: "NextGen Startup Summit 2026", type: "conference", status: "upcoming", day: "18", month: "JUL", guests: "180", room: "Green Room" },
  { id: "biennale", title: "Tirana Design Biennale", type: "exhibition", status: "upcoming", day: "02", month: "AUG", guests: "320", room: "Orange Room" },
  { id: "hack", title: "Balkan AI Hackathon", type: "hackathon", status: "upcoming", day: "12", month: "SEP", guests: "240", room: "Blue · Yellow" },
  { id: "founders", title: "Founders Workshop: 0→1", type: "workshop", status: "upcoming", day: "22", month: "JUL", guests: "60", room: "Yellow Room" },
  { id: "forum", title: "Future of Culture Forum", type: "conference", status: "past", day: "12", month: "MAY", guests: "150", room: "Green Room", attendance: "148" },
  { id: "techtirana", title: "Tech Tirana 2025", type: "conference", status: "past", day: "08", month: "NOV", guests: "260", room: "Green · Blue", attendance: "241" },
  { id: "opendata", title: "Open Data Day", type: "workshop", status: "past", day: "03", month: "MAR", guests: "70", room: "Yellow Room", attendance: "66" },
  { id: "nights", title: "Pyramid Nights: Synth", type: "performance", status: "past", day: "19", month: "DEC", guests: "380", room: "Common Area", attendance: "372" },
];

export const ONGOING_EVENTS = EVENTS.filter((e) => e.status === "ongoing");
export const UPCOMING_EVENTS = EVENTS.filter((e) => e.status === "upcoming");
export const PAST_EVENTS = EVENTS.filter((e) => e.status === "past");
export const LIVE_EVENTS = [...ONGOING_EVENTS, ...UPCOMING_EVENTS];

export function getEvent(id: string): PyramidEvent {
  return EVENTS.find((e) => e.id === id) ?? EVENTS[1];
}

export const EVENT_FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "conference", label: "Conference" },
  { id: "workshop", label: "Workshop" },
  { id: "hackathon", label: "Hackathon" },
  { id: "exhibition", label: "Exhibition" },
  { id: "performance", label: "Performance" },
];

export const HOME_STATS = [
  { value: "240+", label: "Experiences hosted" },
  { value: "38K", label: "Guests welcomed" },
  { value: String(FLOORS.reduce((n, f) => n + f.spaces.filter((s) => s.eventable).length, 0)), label: "Bookable rooms" },
  { value: "3D", label: "Live building twin" },
];

// ---- Pyramid 3D rooms (derived from lib/pyramid-data.ts) ----

export interface SpaceRef {
  space: EventSpace;
  floor: Floor;
}

/** Every space across every floor of the 3D model, flattened. */
export const ALL_SPACES: SpaceRef[] = FLOORS.flatMap((f) =>
  f.spaces.map((space) => ({ space, floor: f }))
);
/** Only the rooms that can host an event (eventable === true). */
export const BOOKABLE_SPACES: SpaceRef[] = ALL_SPACES.filter((r) => r.space.eventable);

const SPACE_BY_ID = new Map(ALL_SPACES.map((r) => [r.space.id, r] as const));
export function spaceRef(id: string): SpaceRef | undefined {
  return SPACE_BY_ID.get(id);
}
export function floorOfRoom(id: string): Floor["id"] | undefined {
  return SPACE_BY_ID.get(id)?.floor.id;
}

/** Fixed seat/chair capacity straight from the 3D dataset (footprint fallback
 *  for tenant spaces that declare no chair bounds). */
export function spaceCapacity(s: EventSpace): number {
  if (s.maxChairs && s.maxChairs > 0) return s.maxChairs;
  if (s.event?.seats) return s.event.seats;
  if (s.event?.chairs) return s.event.chairs;
  return Math.max(12, Math.round(s.size[0] * s.size[2] * 12));
}

const ROLE_BY_LAYOUT: Record<string, string> = {
  theater: "Keynote / plenary",
  classroom: "Workshop / breakout",
  banquet: "Banquet & dining",
  standing: "Reception / standing",
};

function roleFor(r: SpaceRef): string {
  if (r.space.stairs) return "Stair talk";
  if (!r.space.eventable) return "Tenant space";
  return ROLE_BY_LAYOUT[r.space.event?.layout ?? "classroom"] ?? "Event space";
}

function facilitiesFor(r: SpaceRef): string[] {
  const cap = spaceCapacity(r.space);
  const f: string[] = [];
  if (r.space.stairs) {
    f.push("Tiered step seating", "Presentation screen");
  } else {
    const layout = r.space.event?.layout ?? (r.space.eventable ? "classroom" : "standing");
    if (layout === "theater") f.push("Stage & projection", "Theatre seating");
    else if (layout === "banquet") f.push("Round-table banquet", "Catering access");
    else if (layout === "standing") f.push("Open floor", "Flexible staging");
    else f.push("Modular furniture", "Writable walls");
  }
  f.push(`Capacity up to ${cap}`);
  if (r.space.glassFront) f.push("Glazed atrium frontage");
  if (r.space.eventable) f.push("Step-free access");
  return f;
}

export interface RoomDetail {
  name: string;
  up: string;
  cap: string;
  c: string;
  facilities: string[];
  examples: string[];
}

/** Room detail keyed by REAL 3D room id — covers every space so any block
 *  clicked in the 3D scene resolves to a sidebar card. */
export const ROOM_DETAIL: Record<string, RoomDetail> = Object.fromEntries(
  ALL_SPACES.map((r) => {
    const cap = spaceCapacity(r.space);
    return [
      r.space.id,
      {
        name: r.space.name,
        up: r.space.name.toUpperCase(),
        cap: r.space.eventable ? `Up to ${cap}` : `~${cap}`,
        c: r.space.color,
        facilities: facilitiesFor(r),
        examples: r.space.event?.title ? [r.space.event.title] : [r.floor.name],
      } satisfies RoomDetail,
    ];
  })
);

/** Bookable room ids, in floor order — the explore room shortlist. */
export const EXPLORE_ORDER: string[] = BOOKABLE_SPACES.map((r) => r.space.id);

// ---- Event detail ----

export const AGENDA = [
  { time: "09:00", title: "Doors & QR Registration", room: "Entrance" },
  { time: "09:45", title: "Opening Keynote", room: "Green Room" },
  { time: "10:30", title: "Breakout · Scaling 0→1", room: "Blue Room" },
  { time: "10:30", title: "Breakout · AI in Production", room: "Yellow Room" },
  { time: "12:00", title: "Networking Lunch", room: "Common Area" },
  { time: "13:30", title: "Investor Panel", room: "Green Room" },
  { time: "15:00", title: "Demo Showcase", room: "Orange Room" },
  { time: "17:00", title: "Closing & Drinks", room: "Common Area" },
];

export const SPEAKERS = [
  { name: "Dr. Elira Hoxha", role: "AI Research Lead · DeepBalkan", ini: "EH", c: "#1F8A5B" },
  { name: "Marco Reinhardt", role: "Partner · Adriatic Ventures", ini: "MR", c: "#2A6FDB" },
  { name: "Sara Kelmendi", role: "Founder · Lumen Labs", ini: "SK", c: "#C53A6B" },
  { name: "Andi Prifti", role: "CTO · Nordic Pay", ini: "AP", c: "#C0612A" },
];

// ---- Create event: pricing + planning ----

// DEMO (but realistic Tirana) per-day room rate derived from capacity — the 3D
// dataset has no price field. Tuned to believable Tirana market levels: a small
// meeting room (~24 cap) ≈ €310/day, a large hall (~72 cap) ≈ €640/day. Not an
// operational pricing source.
export const ROOM_PRICE: Record<string, number> = Object.fromEntries(
  ALL_SPACES.map((r) => [r.space.id, Math.round((140 + spaceCapacity(r.space) * 7) / 10) * 10])
);

// Albania's standard VAT — applied to the quote subtotal.
export const VAT_RATE = 0.2;

export const MIN_DURATION_DAYS = 1;
export const MAX_DURATION_DAYS = 14;

export type DayType = "half" | "full";
export const HALF_DAY_WEIGHT = 0.55;
export const FULL_DAY_WEIGHT = 1;

// A full day bills at the base room rate; a half day at 0.55x. The space
// multiplier is the sum of each scheduled day's weight, so mixed half/full and
// non-contiguous schedules price correctly.
export function dayWeight(type: DayType): number {
  return type === "half" ? HALF_DAY_WEIGHT : FULL_DAY_WEIGHT;
}

// Individually-priced assets. Quantities are pre-filled from the AI extraction
// (needKey maps to an EventIntake need) and freely editable by the organizer.
export interface AssetItem {
  id: string;
  label: string;
  sub: string;
  unit: number; // € per unit
  needKey: string;
  max: number;
}

// Per-day rental rates, at realistic Tirana AV-hire levels.
export const ASSETS: AssetItem[] = [
  { id: "wirelessMicrophones", label: "Wireless microphones", sub: "Handheld / lapel", unit: 30, needKey: "wirelessMicrophones", max: 12 },
  { id: "wiredMicrophones", label: "Wired microphones", sub: "Podium / stage", unit: 15, needKey: "wiredMicrophones", max: 12 },
  { id: "screens", label: "Screens", sub: "Projection / LED", unit: 120, needKey: "screens", max: 6 },
  { id: "projectors", label: "Projectors", sub: "4K projector", unit: 90, needKey: "projectors", max: 6 },
  { id: "speakers", label: "Speakers", sub: "PA speakers", unit: 60, needKey: "speakers", max: 12 },
  { id: "chairs", label: "Chairs", sub: "Stackable seating", unit: 2, needKey: "chairs", max: 500 },
  { id: "tables", label: "Tables", sub: "Trestle / round", unit: 8, needKey: "tables", max: 80 },
];

// Optional guest-facing event staff (hosts, ushers, registration). Priced per
// head per day at a realistic Tirana day rate. Setup/teardown crew is the
// venue's responsibility and NOT billed here.
export const STAFF_COST_PER_PERSON = 45;

export function suggestedStaff(guests: number): number {
  return Math.max(2, Math.ceil(guests / 50));
}

export interface ServiceItem {
  id: string;
  label: string;
  sub: string;
  price?: number;
  perHead?: number;
}

export const SERVICES: ServiceItem[] = [
  { id: "catering", label: "Catering", sub: "Coffee + lunch / head", perHead: 12 },
  { id: "registration", label: "Registration & QR", sub: "Desks + check-in", price: 250 },
  { id: "security", label: "Security", sub: "Door + crowd", price: 350 },
];

export const ROOM_NAME: Record<string, string> = Object.fromEntries(
  ALL_SPACES.map((r) => [r.space.id, r.space.name])
);

export const ROOM_ROLE: Record<string, string> = Object.fromEntries(
  ALL_SPACES.map((r) => [r.space.id, roleFor(r)])
);

export const ROOM_REASON: Record<string, string> = Object.fromEntries(
  ALL_SPACES.map((r) => {
    const cap = spaceCapacity(r.space);
    return [
      r.space.id,
      `${r.space.name} on ${r.floor.name} fits ~${cap} guests — a strong match for ${roleFor(r).toLowerCase()}.`,
    ];
  })
);

export const EXAMPLE_PROMPTS = [
  { label: "Startup conference · 180 guests", text: "A startup conference for 180 people with a keynote, two breakout rooms and a networking area with coffee.", att: 180 },
  { label: "Design exhibition · 300 guests", text: "A design exhibition for around 300 visitors with gallery space and a few live demo stations.", att: 300 },
  { label: "Founder workshop · 60 guests", text: "A hands-on founder workshop for 60 people, one room, writable walls and lunch.", att: 60 },
];

export const DEFAULT_PROMPT =
  "A startup conference for 180 people with a keynote, two breakout rooms and a networking area with coffee.";

// Deterministic room recommendation over the FULL 3D room set. Picks bookable
// rooms from the single best-fitting floor (the one with the most bookable
// rooms, so multi-room events stay on one level), largest capacity first, until
// their combined capacity covers the attendee count. Returns real 3D room ids.
export function recRooms(attendees: number): string[] {
  const byFloor = new Map<Floor["id"], SpaceRef[]>();
  for (const r of BOOKABLE_SPACES) {
    const list = byFloor.get(r.floor.id) ?? [];
    list.push(r);
    byFloor.set(r.floor.id, list);
  }

  let best: SpaceRef[] | null = null;
  for (const rooms of byFloor.values()) {
    if (!best || rooms.length > best.length) best = rooms;
  }
  if (!best) return [];

  const ranked = [...best].sort((a, b) => spaceCapacity(b.space) - spaceCapacity(a.space));
  const picked: string[] = [];
  let cum = 0;
  for (const r of ranked) {
    picked.push(r.space.id);
    cum += spaceCapacity(r.space);
    if (picked.length >= 2 && cum >= attendees) break;
  }
  return picked;
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

// ---------------------------------------------------------------------------
// Event venues — the REAL bookable event spaces.
//
// These are the Pyramid's actual event halls (Green / Orange / Blue / Yellow)
// plus the transitional/support areas events spill into (Entrance, Main
// Corridor), per the brief. They are deliberately SEPARATE from the tenant
// businesses in the 3D dataset above — those are companies housed in the
// building, not rentable event rooms. Each hall carries a `modelSpaceId` so the
// 3D map can still light up a real cube for it. Hardcoded but real.
// ---------------------------------------------------------------------------

export interface EventVenue {
  id: string;
  name: string;
  color: string;
  capacity: number;
  kind: "hall" | "support";
  /** realistic Tirana per-day rate */
  pricePerDay: number;
  /** an existing eventable 3D cube id this venue highlights on the map (halls only) */
  modelSpaceId?: string;
  blurb: string;
}

export const EVENT_VENUES: EventVenue[] = [
  { id: "green", name: "Green Room", color: "#5fbf6f", capacity: 200, kind: "hall", pricePerDay: 600, modelSpaceId: "km1-3", blurb: "Main keynote / plenary hall" },
  { id: "orange", name: "Orange Room", color: "#ee7d3a", capacity: 120, kind: "hall", pricePerDay: 400, modelSpaceId: "km1-6", blurb: "Mid-size hall / parallel track" },
  { id: "blue", name: "Blue Room", color: "#3aa6e0", capacity: 80, kind: "hall", pricePerDay: 250, modelSpaceId: "km1-0", blurb: "Breakout / workshop room" },
  { id: "yellow", name: "Yellow Room", color: "#f2c23a", capacity: 80, kind: "hall", pricePerDay: 250, modelSpaceId: "km1-2", blurb: "Breakout / workshop room" },
  { id: "entrance", name: "Entrance", color: "#9fb2c0", capacity: 120, kind: "support", pricePerDay: 120, blurb: "Registration & welcome desk" },
  { id: "corridor", name: "Main Corridor", color: "#aab9a4", capacity: 80, kind: "support", pricePerDay: 100, blurb: "Coffee, networking & wayfinding" },
];

const HALLS = EVENT_VENUES.filter((v) => v.kind === "hall");
const VENUE_BY_ID = new Map(EVENT_VENUES.map((v) => [v.id, v] as const));
export const getVenue = (id: string): EventVenue | undefined => VENUE_BY_ID.get(id);

// ---------------------------------------------------------------------------
// Two reasoned, RIGHT-SIZED solutions: Value vs Premium.
//
// Value  = the smallest hall that actually fits (lowest cost, no oversizing).
// Premium = the next size up (flagship Green Room when sensible) + full service.
// Plus any breakout rooms the brief asked for and the support spaces (Entrance
// for registration, Main Corridor for coffee) the needs imply. Deterministic.
// ---------------------------------------------------------------------------

export type SolutionRole = "keynote" | "breakout" | "support";

export interface SolutionRoom {
  /** venue id */
  id: string;
  name: string;
  role: SolutionRole;
  capacity: number;
  /** per-day rate */
  price: number;
  kind: EventVenue["kind"];
  /** 3D cube id to highlight (halls only) */
  modelSpaceId?: string;
  reason: string;
}

export interface Solution {
  id: "A" | "B";
  /** "Value" | "Premium" */
  tier: "Value" | "Premium";
  /** short, human label e.g. "Value · Blue Room" */
  label: string;
  /** venue ids in this plan */
  rooms: string[];
  /** 3D cube ids for the map highlight (halls only) */
  mapRooms: string[];
  picks: SolutionRoom[];
  /** combined hall seating */
  capacity: number;
  fits: boolean;
  /** deterministic "from" estimate, VAT included */
  estimatedCost: number;
  strengths: string[];
  /** one-line comparative argument versus the other solution */
  tradeoff: string;
}

/** Standard AV bundle assumed for the "from" estimate (1 screen, 1 projector,
 *  2 speakers, 2 wireless mics) at the realistic per-day rates above. */
function avBundleCost(): number {
  const unit = (id: string) => ASSETS.find((a) => a.id === id)?.unit ?? 0;
  return unit("screens") + unit("projectors") + 2 * unit("speakers") + 2 * unit("wirelessMicrophones");
}

const CATERING_PER_HEAD = SERVICES.find((s) => s.id === "catering")?.perHead ?? 12;

function toRoom(v: EventVenue, role: SolutionRole, reason: string): SolutionRoom {
  return { id: v.id, name: v.name, role, capacity: v.capacity, price: v.pricePerDay, kind: v.kind, modelSpaceId: v.modelSpaceId, reason };
}

function buildSolution(id: "A" | "B", tier: "Value" | "Premium", keynote: EventVenue, breakouts: EventVenue[], support: EventVenue[], attendees: number): Solution {
  const picks: SolutionRoom[] = [
    toRoom(keynote, "keynote", `${keynote.name} (~${keynote.capacity} seats) — ${keynote.blurb.toLowerCase()}.`),
    ...breakouts.map((b) => toRoom(b, "breakout", `${b.name} (~${b.capacity}) for a parallel session.`)),
    ...support.map((s) => toRoom(s, "support", `${s.name} — ${s.blurb.toLowerCase()}.`)),
  ];

  // The plenary seating is the KEYNOTE hall — breakouts are concurrent, not
  // additive (so a 50-guest event never reads as "280 seats").
  const capacity = keynote.capacity;
  const fits = capacity >= attendees;
  const roomCost = picks.reduce((t, p) => t + p.price, 0);
  const estimatedCost = Math.round((roomCost + CATERING_PER_HEAD * attendees + avBundleCost()) * (1 + VAT_RATE));

  const strengths: string[] = [
    `${capacity} seats in ${keynote.name}${fits ? "" : " — tight for this headcount"}`,
  ];
  if (breakouts.length) strengths.push(`${breakouts.length} breakout room${breakouts.length > 1 ? "s" : ""} for parallel tracks`);
  if (tier === "Value") {
    strengths.push("Right-sized — the leanest rooms that fit, lowest cost");
    if (breakouts.length === 0) strengths.push("A single hall to set up and staff");
  } else {
    if (keynote.capacity > attendees * 1.15) strengths.push("Room to grow — comfortable headroom over your headcount");
    if (support.some((s) => s.id === "entrance")) strengths.push("Dedicated registration entrance + coffee/networking corridor");
  }

  return {
    id,
    tier,
    label: `${tier} · ${keynote.name}`,
    rooms: picks.map((p) => p.id),
    mapRooms: picks.filter((p) => p.modelSpaceId).map((p) => p.modelSpaceId as string),
    picks,
    capacity,
    fits,
    estimatedCost,
    strengths,
    tradeoff: "",
  };
}

/**
 * Two right-sized options for the headcount: a lean Value plan and a roomier
 * Premium plan, drawn from the real EVENT_VENUES (never the tenant businesses).
 * `needs` adds breakout rooms + the support spaces the brief implies.
 */
export function recommendSolutions(
  attendees: number,
  needs?: { breakoutRooms?: number; registrationDesk?: boolean; publicGuestRegistration?: boolean; coffeeArea?: boolean },
): Solution[] {
  const byCapAsc = [...HALLS].sort((a, b) => a.capacity - b.capacity);
  const largest = byCapAsc[byCapAsc.length - 1];

  // Value keynote: smallest hall that fits (or the largest if nothing fits).
  const valueHall = byCapAsc.find((h) => h.capacity >= attendees) ?? largest;
  // Premium keynote: a STRICTLY larger hall when one exists (otherwise the same,
  // and we differentiate by adding an extra hall below).
  const premiumHall = byCapAsc.find((h) => h.capacity > valueHall.capacity) ?? valueHall;

  const breakoutN = needs?.breakoutRooms && needs.breakoutRooms > 0 ? needs.breakoutRooms : 0;
  const pickBreakouts = (keynoteId: string, n: number): EventVenue[] =>
    byCapAsc.filter((h) => h.id !== keynoteId).slice(0, n);
  // When Premium can't go bigger (Value already uses the largest hall), give it
  // an extra breakout/expo hall so it's still a meaningfully roomier plan.
  const premiumBreakoutN = premiumHall.id === valueHall.id ? breakoutN + 1 : breakoutN;

  const wantsReg = !!(needs?.registrationDesk || needs?.publicGuestRegistration);
  const wantsCoffee = !!needs?.coffeeArea;
  const entrance = getVenue("entrance")!;
  const corridor = getVenue("corridor")!;
  const valueSupport = [wantsReg ? entrance : null, wantsCoffee ? corridor : null].filter(Boolean) as EventVenue[];
  const premiumSupport = [entrance, corridor]; // Premium always includes full guest flow

  const value = buildSolution("A", "Value", valueHall, pickBreakouts(valueHall.id, breakoutN), valueSupport, attendees);
  const premium = buildSolution("B", "Premium", premiumHall, pickBreakouts(premiumHall.id, premiumBreakoutN), premiumSupport, attendees);

  // Comparative trade-off lines.
  const diff = premium.estimatedCost - value.estimatedCost;
  value.tradeoff =
    diff > 0
      ? `About €${fmt(diff)} cheaper — the lean, right-sized choice for ${attendees} guests.`
      : `The lean, right-sized choice for ${attendees} guests.`;
  premium.tradeoff =
    premium.capacity > value.capacity
      ? `~€${fmt(Math.abs(diff))} more for a ${premium.capacity}-seat hall and the full registration + coffee flow.`
      : `~€${fmt(Math.abs(diff))} more for an extra hall and the full registration + coffee flow.`;

  // If the two plans came out identical (same rooms), present just one.
  if (value.rooms.join() === premium.rooms.join()) {
    value.tradeoff = value.fits ? "The best fit for this headcount." : "The largest hall available — tight for this headcount.";
    return [value];
  }
  return [value, premium];
}
