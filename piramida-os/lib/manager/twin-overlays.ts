import { ConflictSeverity, ConflictStatus, ConflictType } from "@prisma/client";

export const TWIN_VIEWBOX = { width: 600, height: 470 };

export interface TwinRoomPosition {
  slug: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
}

export interface TwinPin {
  conflictId: string;
  xPct: number;
  yPct: number;
  color: string;
  severity: string;
  title: string;
}

export interface TwinFlow {
  conflictId: string;
  x1Pct: number;
  y1Pct: number;
  x2Pct: number;
  y2Pct: number;
  color: string;
  label?: string;
}

export interface ConflictTwinInput {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  status: ConflictStatus;
  title: string;
  detail: Record<string, unknown>;
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "#EF4444",
  HIGH: "#EF4444",
  MEDIUM: "#F59E0B",
  LOW: "#2A6FDB",
};

export function slugifyRoomName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function toPct(x: number, y: number) {
  return {
    xPct: (x / TWIN_VIEWBOX.width) * 100,
    yPct: (y / TWIN_VIEWBOX.height) * 100,
  };
}

function roomCenter(room: TwinRoomPosition) {
  return { x: room.x + room.w / 2, y: room.y + room.h / 2 };
}

function findRoom(rooms: TwinRoomPosition[], hint?: string | null): TwinRoomPosition | undefined {
  if (!hint) return undefined;
  const slug = slugifyRoomName(hint);
  return rooms.find(
    (room) =>
      room.slug === slug ||
      slugifyRoomName(room.name) === slug ||
      room.name.toLowerCase() === hint.toLowerCase() ||
      room.name.toLowerCase().includes(hint.toLowerCase()) ||
      hint.toLowerCase().includes(room.name.toLowerCase()),
  );
}

function syntheticTechStorage(green: TwinRoomPosition): TwinRoomPosition {
  return {
    slug: "tech-storage",
    name: "Tech Storage",
    x: Math.max(8, green.x - 40),
    y: green.y + Math.round(green.h * 0.25),
    w: 32,
    h: 36,
    color: "#525B6B",
  };
}

function resolveConflictRoom(conflict: ConflictTwinInput, rooms: TwinRoomPosition[]): TwinRoomPosition | undefined {
  const detail = conflict.detail;
  const fromDetail =
    findRoom(rooms, typeof detail.spaceName === "string" ? detail.spaceName : null) ??
    findRoom(rooms, typeof detail.space === "string" ? detail.space : null);

  if (fromDetail) return fromDetail;

  const assetText = [
    typeof detail.asset === "string" ? detail.asset : "",
    typeof detail.category === "string" ? detail.category : "",
    typeof detail.kit === "string" ? detail.kit : "",
    conflict.title,
  ]
    .join(" ")
    .toLowerCase();

  if (assetText.includes("registration") || assetText.includes("guest") || assetText.includes("flow")) {
    return findRoom(rooms, "Entrance");
  }
  if (assetText.includes("power") || assetText.includes("cable")) {
    return findRoom(rooms, "Main Corridor") ?? findRoom(rooms, "Green Room");
  }
  if (assetText.includes("projector") || assetText.includes("screen") || assetText.includes("breakout")) {
    return findRoom(rooms, "Blue Room") ?? findRoom(rooms, "Yellow Room");
  }
  if (assetText.includes("wireless") || assetText.includes("wired") || assetText.includes("mic") || assetText.includes("keynote")) {
    return findRoom(rooms, "Green Room");
  }

  return findRoom(rooms, "Green Room") ?? rooms[0];
}

function flowForConflict(conflict: ConflictTwinInput, rooms: TwinRoomPosition[]): TwinFlow | null {
  const target = resolveConflictRoom(conflict, rooms);
  if (!target) return null;

  const green = findRoom(rooms, "Green Room") ?? target;
  const source =
    findRoom(rooms, "Tech Storage") ??
    (conflict.type === ConflictType.POWER_CABLE_RISK
      ? findRoom(rooms, "Main Corridor") ?? green
      : syntheticTechStorage(green));

  const from = roomCenter(source);
  const to = roomCenter(target);
  const start = toPct(from.x, from.y);
  const end = toPct(to.x, to.y);

  const label =
    conflict.type === ConflictType.POWER_CABLE_RISK
      ? typeof conflict.detail.kit === "string"
        ? conflict.detail.kit
        : "Cable route"
      : typeof conflict.detail.asset === "string"
        ? conflict.detail.asset
        : "Substitute path";

  return {
    conflictId: conflict.id,
    x1Pct: start.xPct,
    y1Pct: start.yPct,
    x2Pct: end.xPct,
    y2Pct: end.yPct,
    color: "#F59E0B",
    label,
  };
}

export function buildTwinOverlays(input: {
  rooms: TwinRoomPosition[];
  conflicts: ConflictTwinInput[];
  allocatedSpaceNames?: string[];
}): { pins: TwinPin[]; flows: TwinFlow[]; selectedSlugs: string[] } {
  const open = input.conflicts.filter((conflict) => conflict.status === ConflictStatus.OPEN);
  const selectedSlugs = (input.allocatedSpaceNames ?? [])
    .map((name) => slugifyRoomName(name))
    .filter((slug) => input.rooms.some((room) => room.slug === slug));

  const pins = open
    .map((conflict) => {
      const room = resolveConflictRoom(conflict, input.rooms);
      if (!room) return null;
      const center = roomCenter(room);
      const pct = toPct(center.x, center.y);
      return {
        conflictId: conflict.id,
        xPct: pct.xPct,
        yPct: pct.yPct,
        color: SEV_COLOR[conflict.severity] ?? "#EF4444",
        severity: conflict.severity,
        title: conflict.title,
      };
    })
    .filter(Boolean) as TwinPin[];

  const flowTypes: ConflictType[] = [
    ConflictType.ASSET_SHORTAGE,
    ConflictType.SERIALIZED_DOUBLE_BOOKING,
    ConflictType.POWER_CABLE_RISK,
  ];
  const flows = open
    .filter((conflict) => flowTypes.includes(conflict.type))
    .map((conflict) => flowForConflict(conflict, input.rooms))
    .filter(Boolean) as TwinFlow[];

  return { pins, flows, selectedSlugs };
}

export function twinRoomsFromPositions(positions: TwinRoomPosition[]) {
  return positions.map((room) => ({
    id: room.slug,
    name: room.name,
    cap: "",
    x: room.x,
    y: room.y,
    w: room.w,
    h: room.h,
  }));
}
