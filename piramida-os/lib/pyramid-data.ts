// ---------------------------------------------------------------------------
// Data model for the Pyramid of Tirana event manager — 2026 architectural state.
//
// Everything visual is derived from this data. The interior is organised as
// modular, brightly-coloured rectangular blocks arranged RADIALLY around a
// central OPEN circular atrium. Each block's footprint (`size`) is its STATIC
// bounding box — adding furniture never resizes it, and the furniture itself
// is a FIXED size, so each room declares min/max chair counts to avoid overflow.
//
// Only rooms with `eventable: true` can host an event.
// ---------------------------------------------------------------------------

export type Layout = "theater" | "classroom" | "banquet" | "standing";

export interface EventInfo {
  title: string;
  layout: Layout;
  /** number of chairs — drives the 3D furniture, change this and the room updates */
  chairs: number;
  /** banquet round tables (each seats ~8); ignored for other layouts */
  tables?: number;
  date?: string;
  status: "scheduled" | "draft" | "live";
  /** show a presentation screen/stage (e.g. the floor-0 stair talk) */
  screen?: boolean;
  /** fixed seating capacity for chair-less events (e.g. seating on the steps) */
  seats?: number;
}

export interface EventSpace {
  id: string;
  /** tenant / room name */
  name: string;
  /** hex colour of the cube, matching the app's colour-coded tenants */
  color: string;
  /** angular position around the pyramid centre, in degrees */
  angle: number;
  /** radial distance from centre */
  radius: number;
  /**
   * Cube footprint [w, h, d]. This is the STATIC bounding box of the room —
   * adding interior assets (chairs/desks) must never mutate it.
   */
  size: [number, number, number];
  /** large glazed entry/cutout facing the central atrium (e.g. Floor 0 main hub) */
  glassFront?: boolean;
  /** rendered as a climbable staircase (Floor 0 stair-talk space) */
  stairs?: boolean;
  /** only `eventable` spaces can host an event */
  eventable?: boolean;
  /** optional brand logo for the pin head (path under public/logos/…). Empty → initials fallback. */
  logo?: string;
  /** optional tenant website — when set, the pin becomes an external link. */
  url?: string;
  /** chair bounds — the slider/nudges are clamped to these so chairs never overflow */
  minChairs?: number;
  maxChairs?: number;
  event?: EventInfo;
}

export interface Floor {
  /** -1 .. 3, or "park" */
  id: number | "park";
  /** short hexagon label, e.g. "0" */
  label: string;
  /** descriptive name */
  name: string;
  /** dominant accent colour for the floor */
  color: string;
  /** vertical level used to highlight the matching exterior terrace (0 = ground) */
  terrace: number;
  spaces: EventSpace[];
}

// ---------------------------------------------------------------------------
// Shared 2026 palette.
// ---------------------------------------------------------------------------
export const C = {
  pink: "#ee5fa0",
  red: "#e94e3c",
  blue: "#3aa6e0",
  cyan: "#1fc1c8",
  teal: "#159ba0",
  green: "#5fbf6f",
  yellow: "#f2c23a",
  orange: "#ee7d3a",
  purple: "#8e44c4",
  lightBlue: "#8fd0f2",
  burgundy: "#7d1f2e",
  white: "#e9eef4",
  concrete: "#cdd2d8",
} as const;

/** Park exterior-seating palette. */
export const PARK_BLOCK_COLORS = [C.pink, C.red, C.blue, C.cyan, C.green, C.yellow, C.orange];

// ---------------------------------------------------------------------------
// Authoring helpers
// ---------------------------------------------------------------------------

type RawSpace = Omit<EventSpace, "id">;

const mk = (prefix: string, list: RawSpace[]): EventSpace[] =>
  list.map((s, i) => ({ ...s, id: `${prefix}-${i}` }));

const ev = (title: string, layout: Layout, chairs: number, extra: Partial<EventInfo> = {}): EventInfo => ({
  title,
  layout,
  chairs,
  status: "scheduled",
  ...extra,
});

export const FLOORS: Floor[] = [
  // -------------------------------------------------------------------------
  // PARK — exterior programme. Not bookable through the event editor.
  // -------------------------------------------------------------------------
  {
    id: "park",
    label: "P",
    name: "Parku / Park",
    color: "#7cc36b",
    terrace: -1,
    spaces: mk("park", [
      { name: "Open-air Stage", color: "#7cc36b", angle: 0, radius: 4.5, size: [2.6, 0.8, 2.0] },
      { name: "Pop-up Market", color: "#9bd17f", angle: 140, radius: 4.5, size: [1.8, 0.7, 1.8] },
      { name: "Amphitheatre", color: "#5fae57", angle: 235, radius: 4.5, size: [2.2, 0.9, 2.2] },
    ]),
  },

  // -------------------------------------------------------------------------
  // FLOOR -1 — Lower level. EVERY room here is bookable.
  // -------------------------------------------------------------------------
  {
    id: -1,
    label: "-1",
    name: "Kati -1 / Lower level",
    color: "#8e6fd6",
    terrace: 0,
    spaces: mk("km1", [
      {
        name: "Ecole 42",
        color: C.lightBlue,
        angle: 180,
        radius: 5.0,
        size: [2.4, 1.5, 2.0],
        eventable: true,
        minChairs: 8,
        maxChairs: 56,
        event: ev("42 Piscine — Coding Bootcamp", "classroom", 36, { date: "2026-06-22" }),
      },
      {
        name: "Studio (Purple)",
        color: C.purple,
        angle: 225,
        radius: 5.0,
        size: [2.2, 1.4, 1.9],
        eventable: true,
        minChairs: 6,
        maxChairs: 40,
        event: ev("Open Studio", "classroom", 18, { status: "draft" }),
      },
      {
        name: "Workshop (Yellow)",
        color: C.yellow,
        angle: 160,
        radius: 2.7,
        size: [1.7, 1.3, 1.5],
        eventable: true,
        minChairs: 6,
        maxChairs: 24,
        event: ev("Maker Workshop", "classroom", 20, { date: "2026-06-24" }),
      },
      {
        name: "Lab (Green)",
        color: C.green,
        angle: 20,
        radius: 2.7,
        size: [1.7, 1.3, 1.5],
        eventable: true,
        minChairs: 6,
        maxChairs: 24,
        event: ev("Research Lab", "classroom", 18, { date: "2026-06-26" }),
      },
      {
        name: "Mane Foundation",
        color: C.burgundy,
        angle: 0,
        radius: 5.0,
        size: [2.4, 1.6, 2.0],
        eventable: true,
        minChairs: 10,
        maxChairs: 60,
        event: ev("Mane Foundation Forum", "theater", 60, { date: "2026-06-30", status: "live" }),
      },
      {
        name: "Universiteti",
        color: "#5b6fb0",
        angle: 270,
        radius: 5.0,
        size: [2.2, 1.5, 1.9],
        eventable: true,
        minChairs: 10,
        maxChairs: 56,
        event: ev("University Lecture", "theater", 56, { date: "2026-06-21" }),
      },
      {
        name: "GOCAT Gallery",
        color: "#c79a3a",
        angle: 315,
        radius: 5.0,
        size: [2.2, 1.5, 1.9],
        eventable: true,
        minChairs: 6,
        maxChairs: 40,
        event: ev("GOCAT Exhibition", "classroom", 24, { date: "2026-06-27" }),
      },
      {
        name: "SDA Lab",
        color: "#4f9d8a",
        angle: 135,
        radius: 5.0,
        size: [2.0, 1.4, 1.8],
        eventable: true,
        minChairs: 8,
        maxChairs: 40,
        event: ev("SDA Data Lab", "classroom", 24, { date: "2026-06-23" }),
      },
      // Central staircase — doubles as a 50-person stair-talk (screen, no chairs).
      {
        name: "Stairs",
        color: C.concrete,
        angle: 70,
        radius: 4,
        size: [2.4, 1.2, 2.0],
        stairs: true,
        eventable: true,
        minChairs: 0,
        maxChairs: 0,
        event: ev("Stair Talk", "standing", 0, { screen: true, seats: 50, date: "2026-06-24", status: "scheduled" }),
      },
    ]),
  },

  // -------------------------------------------------------------------------
  // FLOOR 0 — Main hub / ground. Only Main Hub, Green Hub, Eco Lab and Artisan
  // Shop are bookable, plus the central STAIRS space (50-person stair-talk).
  // The other blocks are tenants you can view but not book.
  // -------------------------------------------------------------------------
  {
    id: 0,
    label: "0",
    name: "Kati 0 / Ground floor",
    color: "#e0633a",
    terrace: 1,
    spaces: mk("k0", [
      { name: "Micro-Folie", color: C.cyan, angle: 0, radius: 5.0, size: [2.1, 1.4, 1.8] },
      { name: "British Chamber of Commerce Albania", color: "#27b4c0", angle: 30, radius: 5.0, size: [2.0, 1.4, 1.7] },
      { name: "Artisan Shop", color: C.teal, angle: 330, radius: 5.0, size: [2.0, 1.4, 1.7], eventable: true, minChairs: 6, maxChairs: 30, event: ev("Artisan Workshop", "classroom", 18, { date: "2026-07-01" }) },
      { name: "National Youth Agency", color: "#1aa6ac", angle: 60, radius: 5.0, size: [2.0, 1.4, 1.7] },
      { name: "Green Hub", color: C.green, angle: 90, radius: 5.0, size: [2.0, 1.4, 1.7], eventable: true, minChairs: 8, maxChairs: 36, event: ev("Green Hub Workshop", "classroom", 28, { date: "2026-07-02" }) },
      { name: "Eco Lab", color: "#3fa85b", angle: 120, radius: 5.0, size: [1.9, 1.4, 1.6], eventable: true, minChairs: 6, maxChairs: 30, event: ev("Sustainability Lab", "classroom", 20, { date: "2026-07-03" }) },
      { name: "Education USA", color: C.blue, angle: 150, radius: 5.0, size: [2.1, 1.4, 1.8] },
      { name: "BANa'S", color: C.purple, angle: 180, radius: 5.0, size: [2.1, 1.4, 1.8] },
      { name: "ICTS LAB", color: C.white, angle: 210, radius: 5.0, size: [1.9, 1.3, 1.6] },
      { name: "Liburnetik", color: C.lightBlue, angle: 240, radius: 5.0, size: [1.9, 1.3, 1.6] },
      { name: "Red Hall", color: C.red, angle: 270, radius: 5.0, size: [2.2, 1.5, 1.8] },
      {
        name: "Main Hub",
        color: C.orange,
        angle: 300,
        radius: 5.0,
        size: [2.6, 1.6, 2.2],
        glassFront: true,
        eventable: true,
        minChairs: 12,
        maxChairs: 72,
        event: ev("Tech Conference 2026", "theater", 60, { date: "2026-06-20", status: "live" }),
      },
    ]),
  },

  // -------------------------------------------------------------------------
  // FLOOR 1 — TUMO. EVERY room here is bookable.
  // -------------------------------------------------------------------------
  {
    id: 1,
    label: "1",
    name: "Kati 1 / TUMO",
    color: "#3aa6e0",
    terrace: 2,
    spaces: mk("k1", [
      {
        name: "TUMO Lab",
        color: C.blue,
        angle: 0,
        radius: 3.4,
        size: [2.0, 1.3, 1.8],
        eventable: true,
        minChairs: 8,
        maxChairs: 40,
        event: ev("TUMO Learning Lab", "classroom", 36, { date: "2026-06-23" }),
      },
      {
        name: "TUMO Studio",
        color: C.orange,
        angle: 120,
        radius: 3.4,
        size: [2.0, 1.3, 1.8],
        eventable: true,
        minChairs: 8,
        maxChairs: 48,
        event: ev("TUMO Media Studio", "theater", 44, { date: "2026-06-24" }),
      },
      {
        name: "TUMO Hub",
        color: C.green,
        angle: 240,
        radius: 3.4,
        size: [2.0, 1.3, 1.8],
        eventable: true,
        minChairs: 8,
        maxChairs: 36,
        event: ev("TUMO Workshop", "classroom", 30, { date: "2026-06-25" }),
      },
    ]),
  },

  // -------------------------------------------------------------------------
  // FLOOR 2 — Tech / creative hub. Tenant classrooms, not bookable here.
  // -------------------------------------------------------------------------
  {
    id: 2,
    label: "2",
    name: "Kati 2 / Tech & Creative Hub",
    color: "#f2c23a",
    terrace: 3,
    spaces: mk("k2", [
      { name: "Robotikë / Robotics", color: C.purple, angle: 0, radius: 1.9, size: [1.3, 1.0, 1.3] },
      { name: "Fotografi / Photography", color: C.blue, angle: 345, radius: 3.7, size: [1.4, 1.0, 1.4] },
      { name: "Dizajn Grafik / Graphic Design", color: C.lightBlue, angle: 15, radius: 3.7, size: [1.4, 1.0, 1.4] },
      { name: "Animacion / Animation", color: "#f4b43a", angle: 55, radius: 3.7, size: [1.4, 1.0, 1.4] },
      { name: "Programim / Programming", color: C.green, angle: 100, radius: 3.7, size: [1.4, 1.0, 1.4] },
      { name: "Zhvillues / Game Development", color: C.pink, angle: 135, radius: 3.7, size: [1.4, 1.0, 1.4] },
      { name: "Modelim 3D / 3D Modeling", color: C.yellow, angle: 180, radius: 3.7, size: [1.4, 1.0, 1.4] },
      { name: "Vizatim / Drawing", color: C.pink, angle: 225, radius: 3.7, size: [1.4, 1.0, 1.4] },
      { name: "Sound (Purple)", color: C.purple, angle: 265, radius: 3.7, size: [1.4, 1.0, 1.4] },
      { name: "Film (Red)", color: C.red, angle: 290, radius: 3.7, size: [1.4, 1.0, 1.4] },
      { name: "Motion (Orange)", color: C.orange, angle: 315, radius: 3.7, size: [1.4, 1.0, 1.4] },
    ]),
  },

  // -------------------------------------------------------------------------
  // FLOOR 3 — Top level. Two tenant rooms, not bookable here.
  // -------------------------------------------------------------------------
  {
    id: 3,
    label: "3",
    name: "Kati 3 / Top level",
    color: "#b5179e",
    terrace: 4,
    spaces: mk("k3", [
      { name: "Startup Albania", color: C.pink, angle: 180, radius: 3.0, size: [2.4, 1.5, 2.2] },
      { name: "Qelq Studio — Glass Hub", color: C.purple, angle: 0, radius: 3.0, size: [2.4, 1.5, 2.2] },
    ]),
  },
];

export const getFloor = (id: Floor["id"]) => FLOORS.find((f) => f.id === id);
export const getSpace = (floorId: Floor["id"], spaceId: string) =>
  getFloor(floorId)?.spaces.find((s) => s.id === spaceId);

/** Locate a pyramid room (and its floor) by its node id, e.g. "k0-12". Used to
 *  resolve a DB Space.modelNodeId back to a 3D block + floor number. */
export function findRoomById(roomId: string): { room: EventSpace; floor: Floor } | undefined {
  for (const floor of FLOORS) {
    const room = floor.spaces.find((s) => s.id === roomId);
    if (room) return { room, floor };
  }
  return undefined;
}

/** Fallback mapping for live events when a DB Space has no modelNodeId: match the
 *  space name to a pyramid room name (case/space-insensitive). Returns the room
 *  and the floor it lives on so callers can derive a floor number. */
export function findRoomBySpaceName(name: string): { room: EventSpace; floor: Floor } | undefined {
  const target = name.trim().toLowerCase();
  for (const floor of FLOORS) {
    const room = floor.spaces.find((s) => s.name.trim().toLowerCase() === target);
    if (room) return { room, floor };
  }
  return undefined;
}

/**
 * Which floors contain any of the given space ids — in FLOORS order, deduped.
 * Used to steer the map straight to the floor(s) holding recommended rooms.
 */
export const floorsForSpaces = (ids: string[]): Floor["id"][] => {
  if (ids.length === 0) return [];
  const want = new Set(ids);
  return FLOORS.filter((f) => f.spaces.some((s) => want.has(s.id))).map((f) => f.id);
};
