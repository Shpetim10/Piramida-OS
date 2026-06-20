// Centralized mock data for the Pyramid OS guest + organizer experiences.
// No backend / Supabase / AI yet — everything here is deterministic demo data.

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
  { value: "6", label: "Explorable rooms" },
  { value: "2.5D", label: "Live building model" },
];

// ---- Explore rooms ----

export interface RoomDetail {
  name: string;
  up: string;
  cap: string;
  c: string;
  facilities: string[];
  examples: string[];
}

export const ROOM_DETAIL: Record<string, RoomDetail> = {
  green: { name: "Green Room", up: "GREEN ROOM", cap: "120–180", c: "#1F8A5B", facilities: ["Stage & lighting rig", "4K projection wall", "Theatre seating", "Backstage green room", "Step-free access"], examples: ["NextGen Startup Summit", "Future of Culture Forum"] },
  blue: { name: "Blue Room", up: "BLUE ROOM", cap: "60–120", c: "#2A6FDB", facilities: ["Classroom & boardroom layouts", "Dual 4K screens", "Acoustic movable walls", "Breakout pods"], examples: ["Balkan AI Hackathon", "Tech Tirana 2025"] },
  yellow: { name: "Yellow Room", up: "YELLOW ROOM", cap: "40–80", c: "#C9A227", facilities: ["Studio pods", "Writable walls", "Modular furniture", "Daylight + blackout"], examples: ["Founders Workshop: 0→1", "Open Data Day"] },
  orange: { name: "Orange Room", up: "ORANGE ROOM", cap: "50–90", c: "#C0612A", facilities: ["Gallery hanging system", "Track lighting", "Demo plinths", "Power floor boxes"], examples: ["Tirana Design Biennale"] },
  common: { name: "Common Area", up: "COMMON AREA", cap: "Up to 250", c: "#7A4BD6", facilities: ["Open atrium", "Coffee & catering bar", "Lounge seating", "Natural skylight"], examples: ["Echoes — Sound & Light", "Pyramid Nights"] },
  entrance: { name: "Entrance", up: "ENTRANCE", cap: "Flow space", c: "#AEB5C2", facilities: ["Registration desks", "QR self check-in", "Cloakroom", "Welcome lounge"], examples: ["Every public event"] },
};

export const EXPLORE_ORDER = ["green", "blue", "yellow", "orange", "common", "entrance"];

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

export const ROOM_PRICE: Record<string, number> = {
  green: 2400,
  blue: 1100,
  yellow: 900,
  orange: 1000,
  common: 1300,
  entrance: 700,
};

export const DURATION_MULT: Record<string, number> = {
  "Half day": 0.6,
  "Full day": 1,
  "2 days": 1.9,
  "3 days": 2.7,
};

export const DURATIONS = ["Half day", "Full day", "2 days", "3 days"];

export interface EquipItem {
  id: string;
  label: string;
  sub: string;
  price: number;
}

export const EQUIPMENT: EquipItem[] = [
  { id: "av", label: "AV Package", sub: "4 mics · screen · projector", price: 1850 },
  { id: "stage", label: "Stage & Lighting", sub: "Rig + operator", price: 950 },
  { id: "livestream", label: "Livestream", sub: "Multi-cam + stream", price: 1200 },
  { id: "recording", label: "Recording", sub: "Edited session videos", price: 700 },
];

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
  { id: "crew", label: "Hosts & Crew", sub: "Setup → teardown", price: 1640 },
];

export const ROOM_NAME: Record<string, string> = {
  green: "Green Room",
  blue: "Blue Room",
  yellow: "Yellow Room",
  orange: "Orange Room",
  common: "Common Area",
  entrance: "Entrance",
};

export const ROOM_ROLE: Record<string, string> = {
  green: "Keynote stage",
  blue: "Breakout A",
  yellow: "Breakout B",
  common: "Networking & catering",
  entrance: "Registration & arrival",
  orange: "Exhibition",
};

export const ROOM_REASON: Record<string, string> = {
  green: "180-seat theatre layout anchors your keynote with clean stage sightlines.",
  blue: "Acoustically isolated 120-cap room for parallel breakout track A.",
  yellow: "Flexible studio pods host breakout track B for up to 80.",
  common: "Open atrium with coffee bar absorbs networking and catering flow.",
  entrance: "Arrival funnel for QR registration and a welcome lounge.",
};

export const EXAMPLE_PROMPTS = [
  { label: "Startup conference · 180 guests", text: "A startup conference for 180 people with a keynote, two breakout rooms and a networking area with coffee.", att: 180 },
  { label: "Design exhibition · 300 guests", text: "A design exhibition for around 300 visitors with gallery space and a few live demo stations.", att: 300 },
  { label: "Founder workshop · 60 guests", text: "A hands-on founder workshop for 60 people, one room, writable walls and lunch.", att: 60 },
];

export const DEFAULT_PROMPT =
  "A startup conference for 180 people with a keynote, two breakout rooms and a networking area with coffee.";

// Deterministic room recommendation based on attendee count.
export function recRooms(attendees: number): string[] {
  if (attendees <= 80) return ["yellow", "entrance"];
  if (attendees <= 140) return ["green", "entrance"];
  if (attendees <= 220) return ["green", "blue", "entrance"];
  return ["green", "blue", "yellow", "common", "entrance"];
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

// ---- Organizer dashboard / requests ----

export const DASH_STATS = [
  { label: "Active Event", value: "1", sub: "In planning", accent: true },
  { label: "Upcoming Events", value: "2", sub: "Approved", accent: false },
  { label: "Past Events", value: "4", sub: "Completed", accent: false },
  { label: "Pending Requests", value: "1", sub: "Awaiting manager", accent: false },
];

export const MY_EVENTS = [
  { title: "NextGen Startup Summit 2026", date: "18 Jul 2026", status: "Planning", guests: "180", color: "#C8F000" },
  { title: "Lumen Product Launch", date: "30 Aug 2026", status: "Approved", guests: "120", color: "#22C55E" },
  { title: "Q3 Investor Day", date: "14 Sep 2026", status: "Published", guests: "90", color: "#2A6FDB" },
  { title: "Lumen Summer Mixer", date: "02 Jun 2026", status: "Completed", guests: "140", color: "#7D8799" },
  { title: "Design Sprint Demo", date: "21 Apr 2026", status: "Completed", guests: "55", color: "#7D8799" },
];

export const REQUESTS = [
  { event: "NextGen Startup Summit 2026", date: "Submitted 18 Jun", status: "Pending manager approval", sc: "#F59E0B", desc: "4 spaces · 180 guests · €10,516 — awaiting Event Manager review." },
  { event: "Lumen Product Launch", date: "Submitted 02 Jun", status: "Approved", sc: "#22C55E", desc: "Green Room + Entrance approved. Reservations confirmed." },
  { event: "Q3 Investor Day", date: "Submitted 21 May", status: "Changes requested", sc: "#EF4444", desc: "Manager suggested moving to Blue Room for better capacity fit." },
];
