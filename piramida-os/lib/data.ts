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

// DEMO PLACEHOLDER: per-day room rate derived from capacity (the 3D dataset has
// no price field). Not an operational pricing source.
export const ROOM_PRICE: Record<string, number> = Object.fromEntries(
  ALL_SPACES.map((r) => [r.space.id, Math.round((500 + spaceCapacity(r.space) * 16) / 50) * 50])
);

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

export const ASSETS: AssetItem[] = [
  { id: "wirelessMicrophones", label: "Wireless microphones", sub: "Handheld / lapel", unit: 120, needKey: "wirelessMicrophones", max: 12 },
  { id: "wiredMicrophones", label: "Wired microphones", sub: "Podium / stage", unit: 60, needKey: "wiredMicrophones", max: 12 },
  { id: "screens", label: "Screens", sub: "Projection / LED", unit: 250, needKey: "screens", max: 6 },
  { id: "projectors", label: "Projectors", sub: "4K projector", unit: 300, needKey: "projectors", max: 6 },
  { id: "speakers", label: "Speakers", sub: "PA speakers", unit: 180, needKey: "speakers", max: 12 },
  { id: "chairs", label: "Chairs", sub: "Stackable seating", unit: 4, needKey: "chairs", max: 500 },
  { id: "tables", label: "Tables", sub: "Trestle / round", unit: 18, needKey: "tables", max: 80 },
];

// Optional guest-facing event staff (hosts, ushers, registration). Priced per
// head. Setup/teardown crew is the venue's responsibility and NOT billed here.
export const STAFF_COST_PER_PERSON = 95;

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
  { id: "catering", label: "Catering", sub: "Coffee + lunch / head", perHead: 14 },
  { id: "registration", label: "Registration & QR", sub: "Desks + check-in", price: 450 },
  { id: "security", label: "Security", sub: "Door + crowd", price: 600 },
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
