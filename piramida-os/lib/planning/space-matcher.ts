import type { RepoSpace } from "@/lib/repo";
import type { ActiveWindow, PlanningConfig, PlanningEvent, RequirementMap, SelectedSpace, SpaceMatch } from "./types";

function numberReq(reqs: RequirementMap, key: string): number {
  const value = reqs[key];
  return typeof value === "number" ? value : Number(value ?? 0) || 0;
}

function boolReq(reqs: RequirementMap, key: string): boolean {
  return reqs[key] === true || reqs[key] === "true";
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function capacityFit(capacity: number | null, target: number, role: SpaceMatch["roleKey"]): number {
  if (role === "coffeeRegistration") return capacity ? Math.min(100, Math.round((capacity / Math.max(target * 0.5, 1)) * 100)) : 85;
  if (!capacity) return role === "support" ? 55 : 20;
  if (capacity < target) return Math.max(10, Math.round((capacity / Math.max(target, 1)) * 55));
  const ratio = capacity / Math.max(target, 1);
  if (ratio <= 1.35) return 100;
  if (ratio <= 1.8) return 86;
  if (ratio <= 2.6) return 68;
  return 46;
}

function roleForSpace(space: RepoSpace, reqs: RequirementMap): SpaceMatch["roleKey"] {
  const name = space.name.toLowerCase();
  if (space.kind === "ENTRANCE" || name.includes("entrance")) return "coffeeRegistration";
  if (space.features.stage && boolReq(reqs, "mainStage")) return "keynote";
  if (space.kind === "ROOM" && numberReq(reqs, "breakoutRooms") > 0 && (space.capacity ?? 0) < 120) return "breakout";
  if (space.kind === "ROOM") return "overflow";
  return "support";
}

function targetGuestsForRole(role: SpaceMatch["roleKey"], eventGuests: number): number {
  if (role === "breakout") return Math.ceil(eventGuests * 0.45);
  if (role === "coffeeRegistration") return Math.ceil(eventGuests * 0.35);
  if (role === "overflow") return Math.ceil(eventGuests * 0.25);
  return eventGuests;
}

function featureFit(space: RepoSpace, role: SpaceMatch["roleKey"], reqs: RequirementMap): number {
  let score = 50;
  if (role === "keynote") {
    if (space.features.stage) score += 35;
    if (space.features.builtInAv || space.features.builtInScreen) score += 10;
  }
  if (role === "breakout") {
    if (space.kind === "ROOM") score += 25;
    if ((space.capacity ?? 0) >= targetGuestsForRole(role, numberReq(reqs, "expectedGuests"))) score += 10;
    if (space.features.naturalLight) score += 5;
  }
  if (role === "coffeeRegistration") {
    if (space.kind === "ENTRANCE") score += 35;
    if (space.comfortFlow) score += 10;
    if (space.features.naturalLight) score += 5;
  }
  return Math.min(100, score);
}

function adjacencyFit(space: RepoSpace, spacesById: Map<string, RepoSpace>, role: SpaceMatch["roleKey"]): number {
  const adjacent = space.adjacentSpaceIds.map((id) => spacesById.get(id)).filter(Boolean) as RepoSpace[];
  if (role === "coffeeRegistration") {
    if (adjacent.some((s) => s.features.stage || s.name.toLowerCase().includes("green"))) return 95;
    return Math.min(90, 55 + adjacent.length * 12);
  }
  if (role === "breakout") {
    if (adjacent.some((s) => s.features.stage || s.name.toLowerCase().includes("green"))) return 92;
    if (adjacent.some((s) => s.kind === "CORRIDOR")) return 82;
  }
  if (role === "keynote") {
    if (adjacent.some((s) => s.kind === "ENTRANCE" || s.kind === "CORRIDOR")) return 90;
  }
  return Math.min(100, 45 + adjacent.length * 15);
}

export function matchSpaces(input: {
  event: PlanningEvent;
  requirements: RequirementMap;
  spaces: RepoSpace[];
  activeSpaceWindows: ActiveWindow[];
  config: PlanningConfig;
}): SpaceMatch[] {
  const spacesById = new Map(input.spaces.map((space) => [space.id, space]));
  const guests = input.event.expectedGuests;
  const weights = input.config.scoringWeights;
  const weightTotal = Object.values(weights).reduce((total, value) => total + value, 0) || 100;

  return input.spaces
    .filter((space) => !["STORAGE", "TECH_ZONE"].includes(space.kind))
    .map((space) => {
      const roleKey = roleForSpace(space, input.requirements);
      const unavailable = input.activeSpaceWindows.some(
        (win) => win.resourceId === space.id && win.eventId !== input.event.id && overlaps(input.event.window.setupStart, input.event.window.teardownEnd, win.startsAt, win.endsAt),
      );
      const target = targetGuestsForRole(roleKey, guests);
      const breakdown = {
        capacityFit: capacityFit(space.capacity ?? space.standingCapacity, target, roleKey),
        availability: unavailable ? 0 : 100,
        layoutFit: space.kind === "ROOM" ? 88 : space.kind === "ENTRANCE" ? 92 : 60,
        adjacency: adjacencyFit(space, spacesById, roleKey),
        setupFeasibility: space.areaSqm ? Math.min(100, Math.round(space.areaSqm / 3)) : 65,
        guestFlow: space.comfortFlow ? Math.min(100, space.comfortFlow) : roleKey === "coffeeRegistration" ? 88 : 65,
        featureFit: featureFit(space, roleKey, input.requirements),
      };
      const score = Math.round(
        Object.entries(breakdown).reduce((total, [key, value]) => total + value * (weights[key as keyof typeof weights] ?? 0), 0) / weightTotal,
      );
      const adjacentNames = space.adjacentSpaceIds.map((id) => spacesById.get(id)?.name).filter(Boolean);
      const reasons = [
        `${space.name} metadata: ${space.areaSqm ?? "unknown"} sqm, capacity ${space.capacity ?? space.standingCapacity ?? "flow"}, features ${Object.entries(space.features).filter(([, v]) => Boolean(v)).map(([k]) => k).join(", ") || "none"}.`,
        adjacentNames.length ? `Adjacency supports flow via ${adjacentNames.join(", ")}.` : "No adjacency metadata is available.",
      ];
      if (roleKey === "keynote" && space.features.stage) reasons.push("Stage feature matches the requested keynote/main-stage requirement.");
      if (roleKey === "coffeeRegistration") reasons.push("Entrance role fits registration, coffee arrival, and QR guest flow.");
      if (roleKey === "breakout") reasons.push("Room size and adjacency fit parallel breakout sessions near the keynote path.");
      if (unavailable) reasons.push("Availability penalty: overlapping active reservation in this event window.");

      return {
        spaceId: space.id,
        name: space.name,
        kind: space.kind,
        capacity: space.capacity ?? space.standingCapacity,
        areaSqm: space.areaSqm,
        features: space.features,
        adjacentSpaceIds: space.adjacentSpaceIds,
        score,
        breakdown,
        reasons,
        available: !unavailable,
        suggestedRole:
          roleKey === "keynote" ? "Keynote stage" :
          roleKey === "breakout" ? "Breakout room" :
          roleKey === "coffeeRegistration" ? "Coffee & registration" :
          roleKey === "overflow" ? "Overflow / spillover" : "Support space",
        roleKey,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function selectMultiSpacePlan(matches: SpaceMatch[], requirements: RequirementMap): SelectedSpace[] {
  const selected: SelectedSpace[] = [];
  const add = (space: SpaceMatch | undefined) => {
    if (space && !selected.some((item) => item.spaceId === space.spaceId)) {
      selected.push({ ...space, roleIndex: selected.length });
    }
  };

  if (boolReq(requirements, "mainStage")) add(matches.find((space) => space.available && space.roleKey === "keynote"));
  if (boolReq(requirements, "coffeeArea") || boolReq(requirements, "registrationDesk")) {
    add(matches.find((space) => space.available && space.roleKey === "coffeeRegistration"));
  }

  const breakoutRooms = numberReq(requirements, "breakoutRooms");
  for (let i = 0; i < breakoutRooms; i += 1) {
    add(matches.filter((space) => space.available && space.roleKey === "breakout")[i]);
  }

  const guests = numberReq(requirements, "expectedGuests");
  const covered = selected.reduce((total, space) => total + (space.capacity ?? 0), 0);
  if (guests > 0 && covered < guests * 1.15) {
    add(matches.find((space) => space.available && space.roleKey === "overflow"));
  }

  return selected;
}
