// Local, deterministic mock data for the Manager Command Center.
// No Supabase / AI yet — everything here simulates manager/admin data locally.
// Ported verbatim from the "Manager Command Center" Claude Design source.

export const LIME = "#D6FF00";

// The flagship event the operational pipeline (Understand → Launch) focuses on.
export const FOCUS_EVENT_ID = "summit";
export const FOCUS_EVENT_NAME = "NextGen Startup Summit";

// ---------- Pyramid Twin geometry & palettes ----------
export interface TwinRoom {
  id: string;
  name: string;
  cap: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const TWIN_ROOMS: TwinRoom[] = [
  { id: "common", name: "Common Area", cap: "250", x: 236, y: 150, w: 128, h: 48 },
  { id: "green", name: "Green Room", cap: "180", x: 182, y: 218, w: 112, h: 58 },
  { id: "yellow", name: "Yellow Room", cap: "80", x: 306, y: 218, w: 112, h: 58 },
  { id: "blue", name: "Blue Room", cap: "120", x: 128, y: 300, w: 158, h: 54 },
  { id: "orange", name: "Orange Room", cap: "90", x: 314, y: 300, w: 158, h: 54 },
  { id: "entrance", name: "Entrance", cap: "—", x: 262, y: 360, w: 76, h: 24 },
];

export function roomColor(id: string): string {
  return (
    {
      green: "#22C55E",
      blue: "#2A6FDB",
      yellow: "#C9A227",
      orange: "#C0612A",
      common: "#7A4BD6",
      entrance: "#AEB5C2",
    }[id] || "#7D8799"
  );
}

export function zoneLabel(id: string): string {
  return (
    {
      green: "STAGE + 180 SEATS",
      blue: "CLASSROOM ×120",
      yellow: "PODS ×80",
      common: "CATERING + LOUNGE",
      orange: "—",
      entrance: "2 QR DESKS",
    }[id] || ""
  );
}

export function occMap(): Record<string, number> {
  return { green: 96, blue: 68, yellow: 54, common: 62, entrance: 40, orange: 0 };
}

export function occColor(p: number): string {
  if (p >= 90) return "#EF4444";
  if (p >= 70) return "#D6FF00";
  if (p > 0) return "#22C55E";
  return "#39414F";
}

export const ROOM_CAP: Record<string, number> = {
  green: 180,
  blue: 120,
  yellow: 80,
  common: 250,
  orange: 90,
  entrance: 0,
};

export const ROLE_BY_ROOM: Record<string, string> = {
  green: "Keynote stage",
  blue: "Breakout A",
  yellow: "Breakout B",
  common: "Networking",
  entrance: "Registration",
  orange: "Overflow",
};

export interface RoomMeta {
  name: string;
  cap: string;
  role: string;
  conf: number;
  reason: string;
  alt: string;
}

export const ROOM_META: Record<string, RoomMeta> = {
  green: {
    name: "Green Room",
    cap: "180",
    role: "Keynote stage",
    conf: 96,
    reason:
      "180-seat theatre layout gives clean sightlines to the main stage; the 4K projection wall and lighting rig are already permanently rigged, so the keynote and investor panel need zero structural setup.",
    alt: "Common Area (loses fixed sightlines)",
  },
  blue: {
    name: "Blue Room",
    cap: "120",
    role: "Breakout A",
    conf: 91,
    reason:
      'Acoustically isolated and seats 120 — ideal for the "Scaling 0→1" track running in parallel with the keynote without sound bleed.',
    alt: "Yellow Room (tighter at 80)",
  },
  yellow: {
    name: "Yellow Room",
    cap: "80",
    role: "Breakout B",
    conf: 88,
    reason:
      'Studio pods and writable walls suit the hands-on "AI in Production" workshop track for up to 80 participants.',
    alt: "Orange Room (gallery layout, less flexible)",
  },
  common: {
    name: "Common Area",
    cap: "250",
    role: "Networking + catering",
    conf: 94,
    reason:
      "The open atrium with a built-in coffee bar absorbs the full 180-guest lunch and networking flow without choking circulation between sessions.",
    alt: "Entrance lobby (too small for catering)",
  },
  entrance: {
    name: "Entrance",
    cap: "flow",
    role: "Registration & arrival",
    conf: 97,
    reason:
      "Natural arrival funnel for QR self-check-in; cloakroom and welcome lounge sit immediately adjacent, keeping the 09:00 inflow moving.",
    alt: "No viable alternative",
  },
  orange: {
    name: "Orange Room",
    cap: "90",
    role: "Not allocated",
    conf: 34,
    reason:
      "Gallery hanging system and demo plinths are built for exhibitions, not conference sessions — low fit for this event. Kept free as overflow.",
    alt: "Leave unallocated",
  },
};

export const DEFAULT_ALLOC = ["green", "blue", "yellow", "common", "entrance"];

export function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

// ---------- Dashboard ----------
export const KPI_DEF = [
  { label: "Active Events", value: "3", sub: "in pipeline", tone: LIME },
  { label: "Pending Requests", value: "2", sub: "awaiting review", tone: "#F59E0B" },
  { label: "Unresolved Conflicts", value: "4", sub: "4 need action", tone: "#EF4444" },
  { label: "Launch-Ready", value: "1", sub: "cleared to publish", tone: "#22C55E" },
  { label: "Assets Reserved", value: "184", unit: "/220", sub: "84% committed", tone: "#fff" },
  { label: "Staff Workload", value: "74", unit: "%", sub: "12 of 16 assigned", tone: "#fff" },
];

export const ATTENTION = [
  { sev: "HIGH", c: "#EF4444", title: "Projector double-booked in Blue Room", meta: "Summit breakout A overlaps Hackathon load-in", action: "Resolve", to: "protect" },
  { sev: "MED", c: "#F59E0B", title: "Wireless microphones short by 2", meta: "6 requested · 4 available for 18 Jul", action: "Recommendation", to: "protect" },
  { sev: "REVIEW", c: "#2A6FDB", title: "Lumen Product Launch quote ready", meta: "Awaiting manager approval · €8,240", action: "Open", to: "requests" },
  { sev: "INFO", c: LIME, title: "Summit cleared 9 of 10 launch gates", meta: "Client signature pending", action: "Launch", to: "launch" },
];

export const PIPE_STEPS = [
  { id: "requests", label: "Request", state: "done" },
  { id: "understand", label: "Understand", state: "done" },
  { id: "simulate", label: "Simulate", state: "active" },
  { id: "protect", label: "Protect", state: "attention" },
  { id: "explain", label: "Explain", state: "pending" },
  { id: "launch", label: "Launch", state: "pending" },
];

export const PIPE_COLOR: Record<string, string> = {
  done: "#22C55E",
  active: LIME,
  attention: "#F59E0B",
  pending: "#39414F",
};

export const ACTIVE_EVENTS = [
  { day: "18", mon: "JUL", title: "NextGen Startup Summit", stage: "SIM", pct: 62, c: LIME },
  { day: "02", mon: "AUG", title: "Tirana Design Biennale", stage: "LAUNCH", pct: 92, c: "#22C55E" },
  { day: "30", mon: "AUG", title: "Lumen Product Launch", stage: "PROTECT", pct: 48, c: "#F59E0B" },
];

// ---------- Requests ----------
export const REQUEST_TABS = [
  { id: "summit", label: "NextGen Startup Summit", c: "#F59E0B" },
  { id: "lumen", label: "Lumen Product Launch", c: "#2A6FDB" },
];

export const REQUEST_RAW =
  '"We\'re running our flagship startup summit for around 180 people. We need a main stage for the keynote and investor panel, plus two breakout rooms running in parallel, and a networking area with coffee and lunch. AV, a livestream of the keynote, and QR registration at the door. Full day, 18 July."';

export const REQUEST_ATTACH = [
  { name: "summit-brief-2026.pdf", size: "2.4 MB" },
  { name: "past-summit-photos.zip", size: "18 MB" },
];

export const REQUEST_FIELDS = [
  { k: "EVENT TYPE", v: "Conference" },
  { k: "ATTENDEES", v: "180" },
  { k: "DATE", v: "18 Jul 2026" },
  { k: "DURATION", v: "Full day" },
  { k: "TRACKS", v: "1 main + 2" },
  { k: "FORMAT", v: "In-person" },
];

export const REQUEST_CHIPS = [
  "Keynote stage",
  "2 breakout rooms",
  "Networking area",
  "Catering · coffee + lunch",
  "AV package",
  "Keynote livestream",
  "QR registration",
  "Cloakroom",
];

export const REQUEST_MISSING = [
  "Exact catering headcount and dietary split not specified",
  "Livestream — public or gated to registered guests?",
];

export const REQUEST_LIST = [
  { id: "summit", organizer: "Sara Kelmendi", company: "Lumen Labs", submitted: "18 JUN", initials: "SK", c: "#C53A6B", status: "RAW REQUEST", guests: "180" },
  { id: "lumen", organizer: "Marco Reinhardt", company: "Adriatic Ventures", submitted: "16 JUN", initials: "AV", c: "#2A6FDB", status: "PARSED", guests: "120" },
];

// ---------- Events ----------
export const STAGE_COLOR: Record<string, string> = {
  Simulate: LIME,
  Protect: "#F59E0B",
  Launch: "#22C55E",
  Understand: "#7A4BD6",
  Completed: "#7D8799",
};

export const EVENTS_LIST = [
  { id: "summit", title: "NextGen Startup Summit 2026", type: "Conference", tc: "#2A6FDB", date: "18 Jul 2026", guests: "180", rooms: "Green +3", stage: "Simulate", ready: 62 },
  { id: "biennale", title: "Tirana Design Biennale", type: "Exhibition", tc: "#C0612A", date: "02 Aug 2026", guests: "320", rooms: "Orange · Common", stage: "Launch", ready: 92 },
  { id: "lumen", title: "Lumen Product Launch", type: "Launch", tc: "#C53A6B", date: "30 Aug 2026", guests: "120", rooms: "Green · Entrance", stage: "Protect", ready: 48 },
  { id: "hack", title: "Balkan AI Hackathon", type: "Hackathon", tc: "#7A4BD6", date: "12 Sep 2026", guests: "240", rooms: "Blue · Yellow", stage: "Understand", ready: 28 },
  { id: "forum", title: "Future of Culture Forum", type: "Conference", tc: "#2A6FDB", date: "12 May 2026", guests: "150", rooms: "Green Room", stage: "Completed", ready: 100 },
];

// ---------- Understand ----------
export const SUMMARY_CELLS = [
  { k: "EVENT", v: "NextGen Summit" },
  { k: "TYPE", v: "Conference" },
  { k: "ATTENDEES", v: "180 guests" },
  { k: "DATE", v: "18 Jul 2026" },
  { k: "DURATION", v: "Full day" },
  { k: "ORGANIZER", v: "Lumen Labs" },
];

export const REQUIREMENTS = [
  { label: "Keynote stage for 180", map: "→ GREEN ROOM" },
  { label: "2 parallel breakout tracks", map: "→ BLUE · YELLOW" },
  { label: "Networking + catering area", map: "→ COMMON AREA" },
  { label: "QR registration & cloakroom", map: "→ ENTRANCE" },
  { label: "AV, livestream & stage rig", map: "→ ASSETS" },
];

export const DNA_DEF = [
  { k: "People Intensity", s: "PEOPLE", v: 78 },
  { k: "Technical Complexity", s: "TECH", v: 64 },
  { k: "Space Complexity", s: "SPACE", v: 72 },
  { k: "Asset Intensity", s: "ASSETS", v: 58 },
  { k: "Guest Journey", s: "JOURNEY", v: 80 },
  { k: "Setup Risk", s: "SETUP", v: 42 },
  { k: "Brand Value", s: "BRAND", v: 88 },
  { k: "Operational Risk", s: "OPS RISK", v: 46 },
];

export const UNDERSTAND_ANALYSIS =
  "This is a high-brand, multi-track conference. Parallel breakouts during the keynote raise guest-journey complexity, so circulation and signage matter as much as room size. The single operational risk is audio: 6 wireless channels requested against 4 available. Everything else maps cleanly to existing Pyramid capability — recommend proceeding to simulation.";

// ---------- Simulate ----------
export const LAYER_DEF = [
  { id: "allocation", label: "Allocation" },
  { id: "occupancy", label: "Occupancy" },
  { id: "flow", label: "Guest Flow" },
  { id: "setup", label: "Setup Zones" },
];

export const LAYER_META: Record<string, [string, string]> = {
  allocation: ["ROOM ALLOCATION", "5 rooms illuminated"],
  occupancy: ["LIVE OCCUPANCY", "Load per room"],
  flow: ["GUEST FLOW", "Routes from entrance"],
  setup: ["SETUP ZONES", "Layout per room"],
};

// ---------- Protect ----------
export const PLANNER = [
  { cat: "Wireless Microphones", req: 6, res: 4, avail: 4, short: true },
  { cat: "Wired Microphones", req: 2, res: 2, avail: 10, short: false },
  { cat: "Projectors (4K)", req: 3, res: 2, avail: 3, short: true },
  { cat: "LED Screens", req: 1, res: 1, avail: 2, short: false },
  { cat: "Stage Lighting Rig", req: 1, res: 1, avail: 1, short: false },
  { cat: "Chairs", req: 300, res: 300, avail: 520, short: false },
  { cat: "Power Distros", req: 6, res: 5, avail: 6, short: false },
  { cat: "Two-way Radios", req: 12, res: 12, avail: 20, short: false },
];

export const CONFLICTS = [
  { id: "projector", sev: "HIGH", sc: "#EF4444", title: "Projector double-booked · Blue Room", explain: "Blue Room’s 4K projector is reserved for the Summit breakout at 10:30 but also held for Balkan AI Hackathon load-in testing the same morning.", rec: "Shift Hackathon load-in to 14:00 and assign the portable LED wall to its test slot. Summit keeps the fixed projector.", impact: "Medium", ic: "#F59E0B" },
  { id: "mics", sev: "MED", sc: "#F59E0B", title: "Wireless microphones short by 2", explain: "6 wireless channels are requested for the keynote and two breakouts; only 4 are available on 18 Jul.", rec: "Replace the 2 breakout-room wireless mics with wired lectern mics — rooms are static-podium format, so mobility isn’t needed.", impact: "Low", ic: "#22C55E" },
  { id: "power", sev: "MED", sc: "#F59E0B", title: "Power draw exceeds circuit · Common Area", explain: "Catering hot-plates plus the stage rig on the same circuit in Common Area exceed the 32A limit at peak lunch.", rec: "Redistribute catering equipment to circuit B via the floor box; balances draw to 71% per circuit.", impact: "Low", ic: "#22C55E" },
  { id: "reg", sev: "LOW", sc: "#2A6FDB", title: "Registration queue overlaps cloakroom", explain: "A single entrance desk at 09:00 creates a projected 8-minute queue crossing the cloakroom line.", rec: "Open the second QR desk from 08:45–09:30 and split arrivals A–M / N–Z.", impact: "Low", ic: "#22C55E" },
];

// ---------- Explain ----------
export const SCENARIOS: Record<string, { label: string; impacts: { area: string; arrow: string; c: string; detail: string }[] }> = {
  guests: {
    label: "Reduce to 120 guests",
    impacts: [
      { area: "Spaces", arrow: "↓", c: "#22C55E", detail: "Yellow Room released — single breakout track absorbs demand. Frees a 40–80 space." },
      { area: "Assets", arrow: "↓", c: "#22C55E", detail: "Microphone shortage clears — only 4 channels needed. Conflict auto-resolves." },
      { area: "Cost", arrow: "↓", c: "#22C55E", detail: "Proposal drops ~€1,900 (one fewer room + reduced catering headcount)." },
    ],
  },
  drop: {
    label: "Drop Yellow Room",
    impacts: [
      { area: "Guest Journey", arrow: "↑", c: "#F59E0B", detail: "Both breakout tracks merge into Blue Room — capacity tightens to standing-room at peak." },
      { area: "Assets", arrow: "↓", c: "#22C55E", detail: "One projector and 2 mics freed; projector conflict with Hackathon eases." },
      { area: "Setup Risk", arrow: "↓", c: "#22C55E", detail: "One fewer room to dress — load-in window shortens by ~90 min." },
    ],
  },
  half: {
    label: "Switch to Half day",
    impacts: [
      { area: "Schedule", arrow: "↕", c: "#F59E0B", detail: "Investor panel and demo showcase must be cut or compressed — agenda re-flows." },
      { area: "Staff", arrow: "↓", c: "#22C55E", detail: "Crew hours drop from full-day to 5h — 4 roles become part-shift." },
      { area: "Cost", arrow: "↓", c: "#22C55E", detail: "Room and service costs scale to 0.6× — proposal drops ~€3,400." },
    ],
  },
};

export const AUDIT = [
  { what: "Generated room allocation from request", who: "AI Engine", when: "18 Jun · 14:02", c: LIME },
  { what: "Confirmed Green Room as keynote stage", who: "Erida Krasniqi", when: "18 Jun · 15:20", c: "#fff" },
  { what: "Flagged wireless microphone shortage", who: "AI Engine", when: "18 Jun · 15:21", c: "#F59E0B" },
  { what: "Applied wired-mic substitution", who: "Erida Krasniqi", when: "19 Jun · 09:10", c: "#22C55E" },
  { what: "Approved updated proposal v3", who: "Sara Kelmendi", when: "19 Jun · 11:48", c: "#2A6FDB" },
];

// ---------- Launch ----------
export const LAUNCH_STATES = [
  { id: "ready", label: "Ready" },
  { id: "warning", label: "Warning" },
  { id: "blocked", label: "Blocked" },
];

export const LAUNCH_CONF: Record<string, { color: string; title: string; sub: string; score: number; up: string }> = {
  ready: { color: LIME, title: "Event ready for launch", sub: "Nine of ten gates are green. Two advisories remain — both safe to launch with. The Pyramid is go.", score: 92, up: "CLEARED" },
  warning: { color: "#F59E0B", title: "Launch warning", sub: "Several gates need a second look before publish. Launching now carries operational risk worth resolving first.", score: 74, up: "CAUTION" },
  blocked: { color: "#EF4444", title: "Launch blocked", sub: "Critical gates are unmet — client approval and asset commitments are missing. Publishing is disabled until cleared.", score: 41, up: "BLOCKED" },
};

export const GATE_BASE = [
  { k: "Space", note: "Green, Blue, Yellow & Common reserved and confirmed." },
  { k: "Assets", note: "AV, stage & lighting committed; mic substitution applied." },
  { k: "Staff", note: "12 of 16 roles assigned across setup → teardown." },
  { k: "Power", note: "Circuit load balanced across distros A and B." },
  { k: "Safety", note: "Capacity, exits and stewarding plan signed off." },
  { k: "Registration", note: "QR check-in live; two desks at the entrance." },
  { k: "Proposal", note: "Quote €10,516 finalized and versioned." },
  { k: "Client Approval", note: "Final signature pending from Lumen Labs." },
  { k: "Guest Experience", note: "Wayfinding, catering and flow rehearsed." },
  { k: "Conflicts", note: "Open conflicts tracked in Protect." },
];

export const GATE_STATE_MAP: Record<string, string[]> = {
  ready: ["ready", "warning", "ready", "ready", "ready", "ready", "ready", "warning", "ready", "warning"],
  warning: ["ready", "warning", "warning", "warning", "ready", "ready", "ready", "warning", "warning", "warning"],
  blocked: ["ready", "blocked", "warning", "warning", "ready", "warning", "ready", "blocked", "warning", "blocked"],
};

export const GATE_COLOR: Record<string, string> = { ready: "#22C55E", warning: "#F59E0B", blocked: "#EF4444" };
export const GATE_ICON: Record<string, "check" | "warn" | "x"> = { ready: "check", warning: "warn", blocked: "x" };

// ---------- Tasks ----------
export const TASKS = [
  { t: "Confirm Green Room stage rig & lighting cues", ev: "Summit", role: "Technician", due: "15 Jul", st: "progress", who: "AP" },
  { t: "Lock catering headcount & dietary split", ev: "Summit", role: "Operations", due: "12 Jul", st: "todo", who: "ML" },
  { t: "Resolve projector double-booking", ev: "Summit", role: "Operations", due: "10 Jul", st: "blocked", who: "EK" },
  { t: "Source 2 wired microphones", ev: "Summit", role: "Inventory", due: "11 Jul", st: "progress", who: "DN" },
  { t: "Publish registration page", ev: "Summit", role: "Event Manager", due: "05 Jul", st: "done", who: "EK" },
  { t: "Approve proposal v3", ev: "Lumen Launch", role: "Event Manager", due: "08 Jul", st: "todo", who: "EK" },
  { t: "Assign door & crowd security", ev: "Biennale", role: "Operations", due: "28 Jul", st: "todo", who: "ML" },
  { t: "Test livestream encoder & failover", ev: "Summit", role: "Technician", due: "16 Jul", st: "blocked", who: "AP" },
  { t: "Finalize floor-plan print run", ev: "Biennale", role: "Event Manager", due: "25 Jul", st: "done", who: "EK" },
];

export const TASK_ROLES = ["all", "Event Manager", "Operations", "Inventory", "Technician"];
export const AVATAR_COLOR: Record<string, string> = { EK: "#D6FF00", ML: "#2A6FDB", AP: "#C0612A", DN: "#7A4BD6" };
export const TASK_COLUMNS = [
  { id: "todo", label: "To Do", color: "#7D8799" },
  { id: "progress", label: "In Progress", color: "#2A6FDB" },
  { id: "blocked", label: "Blocked", color: "#EF4444" },
  { id: "done", label: "Done", color: "#22C55E" },
];

// ---------- Spaces ----------
export const SPACES = [
  { id: "green", name: "Green Room", cap: "120–180", now: "Summit · Keynote stage", when: "18 Jul", status: "Reserved", util: 84 },
  { id: "blue", name: "Blue Room", cap: "60–120", now: "Summit · Breakout A", when: "18 Jul", status: "Reserved", util: 68 },
  { id: "yellow", name: "Yellow Room", cap: "40–80", now: "Summit · Breakout B", when: "18 Jul", status: "Reserved", util: 54 },
  { id: "common", name: "Common Area", cap: "up to 250", now: "Summit · Catering & networking", when: "18 Jul", status: "Reserved", util: 62 },
  { id: "orange", name: "Orange Room", cap: "50–90", now: "No reservation", when: "Available", status: "Free", util: 0 },
  { id: "entrance", name: "Entrance", cap: "flow space", now: "Summit · Registration", when: "18 Jul", status: "Reserved", util: 40 },
];

export const SPACES_OCC: Record<string, number> = { green: 84, blue: 68, yellow: 54, common: 62, entrance: 40, orange: 0 };

// ---------- Inventory ----------
export const INV_SUMMARY = [
  { label: "Overall Health", value: "88", unit: "%", sub: "across 6 categories", tone: "#22C55E" },
  { label: "Shortages", value: "2", unit: "", sub: "mics · projectors", tone: "#EF4444" },
  { label: "Reserved", value: "184", unit: "/220", sub: "committed to events", tone: LIME },
  { label: "Conflicts", value: "4", unit: "", sub: "flagged in Protect", tone: "#F59E0B" },
];

export const INV_CATS = [
  { cat: "Audio", items: "Mics · mixers · speakers", health: 72, status: "Watch", sc: "#F59E0B", note: "Wireless mics short by 2 for 18 Jul — wired substitution staged." },
  { cat: "Visual", items: "Projectors · LED · screens", health: 80, status: "Watch", sc: "#F59E0B", note: "One 4K projector double-reserved; resolution pending in Protect." },
  { cat: "Staging", items: "Decks · lighting · truss", health: 96, status: "Healthy", sc: "#22C55E", note: "Full keynote rig available and pre-installed in Green Room." },
  { cat: "Furniture", items: "Chairs · tables · lounge", health: 100, status: "Healthy", sc: "#22C55E", note: "520 chairs free against 300 reserved — ample headroom." },
  { cat: "Power", items: "Distros · cabling · UPS", health: 84, status: "Healthy", sc: "#22C55E", note: "5 of 6 distros committed; load rebalance recommended." },
  { cat: "Comms", items: "Radios · headsets", health: 100, status: "Healthy", sc: "#22C55E", note: "20 radios available, 12 reserved for event crew." },
];

// ---------- Nav header labels (kicker, title) per screen ----------
export const SCREEN_LABELS: Record<string, [string, string]> = {
  dashboard: ["OPERATIONS", "Command Dashboard"],
  requests: ["INTAKE", "Request Review"],
  events: ["PORTFOLIO", "Events"],
  understand: ["PIPELINE · 01", "Understand"],
  simulate: ["PIPELINE · 02", "Simulate"],
  protect: ["PIPELINE · 03", "Protect"],
  explain: ["PIPELINE · 04", "Explain"],
  launch: ["PIPELINE · 05", "Launch"],
  tasks: ["OPERATIONS", "Tasks"],
  spaces: ["OPERATIONS", "Spaces"],
  inventory: ["OPERATIONS", "Inventory Overview"],
};
