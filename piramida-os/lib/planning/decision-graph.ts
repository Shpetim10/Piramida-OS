// Pure decision graph builder — produces a grounded node/edge set from a plan snapshot.
// AI may rephrase labels but every node id must be validated against this set.
// Rendering (SVG) is done in the UI layer; this file is data-only.

export interface DecisionNode {
  id: string;
  label: string;
  sub: string;
  type: "root" | "space" | "asset" | "shortage";
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DecisionEdge {
  from: string;
  to: string;
  color?: string;
}

export interface DecisionGraphData {
  nodes: DecisionNode[];
  edges: DecisionEdge[];
  allowedNodeIds: string[];
}

const ROLE_COLORS: Record<string, string> = {
  keynote: "#22C55E",
  breakout: "#2A6FDB",
  coffeeRegistration: "#7A4BD6",
  overflow: "#C9A227",
  support: "#AEB5C2",
};

export function buildDecisionGraph(snapshot: {
  selectedSpaces?: Array<{ name: string; suggestedRole?: string; roleKey?: string; score?: number }>;
  assetPlan?: {
    lines?: Array<{ categoryName: string; required: number; reserved: number }>;
    shortages?: Array<{ category: string; shortBy: number }>;
  };
  guests?: number;
  eventTitle?: string;
}): DecisionGraphData {
  const nodes: DecisionNode[] = [];
  const edges: DecisionEdge[] = [];

  // Root node — the event request
  nodes.push({
    id: "root",
    label: snapshot.eventTitle ?? "Event Request",
    sub: snapshot.guests ? `${snapshot.guests} GUESTS` : "REQUEST",
    type: "root",
    color: "#C8F000",
    x: 40,
    y: 112,
    w: 172,
    h: 46,
  });

  const spaces = snapshot.selectedSpaces ?? [];
  const colStep = 85;
  const spaceBaseY = Math.max(29, Math.round((270 - colStep * (spaces.length - 1)) / 2));

  spaces.forEach((space, i) => {
    const id = `space_${i}`;
    const color = ROLE_COLORS[space.roleKey ?? ""] ?? "#AEB5C2";
    const y = spaceBaseY + i * colStep;
    nodes.push({
      id,
      label: space.name,
      sub: space.suggestedRole ? `→ ${space.suggestedRole.toUpperCase()}` : "ALLOCATED",
      type: "space",
      color,
      x: 250,
      y,
      w: 180,
      h: 46,
    });
    edges.push({ from: "root", to: id, color: "rgba(200,240,0,.3)" });
  });

  // Group asset lines into at most 4 display buckets
  const assetLines = (snapshot.assetPlan?.lines ?? []).filter((l) => l.reserved > 0);
  const shortageSet = new Set((snapshot.assetPlan?.shortages ?? []).map((s) => s.category));

  type AssetGroup = { label: string; sub: string; color: string; sourceSpaceIdx: number };
  const groups: AssetGroup[] = [];

  const audio = assetLines.filter((l) => /mic|speaker|audio/i.test(l.categoryName));
  const visual = assetLines.filter((l) => /projector|screen|display/i.test(l.categoryName));
  const furniture = assetLines.filter((l) => /chair|table/i.test(l.categoryName));
  const other = assetLines.filter((l) => !audio.includes(l) && !visual.includes(l) && !furniture.includes(l));

  if (audio.length > 0) {
    const short = audio.some((l) => shortageSet.has(l.categoryName));
    groups.push({
      label: "Audio Package",
      sub: audio.slice(0, 2).map((l) => `${l.reserved}× ${l.categoryName.split(" ")[0]}`).join(", "),
      color: short ? "#F59E0B" : "#AEB5C2",
      sourceSpaceIdx: 0,
    });
  }
  if (visual.length > 0) {
    groups.push({
      label: "Visual / AV",
      sub: visual.slice(0, 2).map((l) => `${l.reserved}× ${l.categoryName}`).join(", "),
      color: "#AEB5C2",
      sourceSpaceIdx: Math.min(1, spaces.length - 1),
    });
  }
  if (furniture.length > 0) {
    groups.push({
      label: "Furniture",
      sub: `${furniture.reduce((s, l) => s + l.reserved, 0)} items`,
      color: "#AEB5C2",
      sourceSpaceIdx: Math.min(2, spaces.length - 1),
    });
  }
  if (other.length > 0) {
    groups.push({
      label: "Other Equipment",
      sub: `${other.length} categories`,
      color: "#AEB5C2",
      sourceSpaceIdx: Math.min(3, spaces.length - 1),
    });
  }

  const assetBaseY = Math.max(29, Math.round((270 - colStep * (groups.length - 1)) / 2));
  groups.forEach((g, i) => {
    const id = `asset_${i}`;
    const y = assetBaseY + i * colStep;
    nodes.push({
      id,
      label: g.label,
      sub: g.sub,
      type: "asset",
      color: g.color,
      x: 470,
      y,
      w: 148,
      h: 46,
    });
    const sourceId = spaces.length > 0 ? `space_${Math.max(0, g.sourceSpaceIdx)}` : "root";
    edges.push({ from: sourceId, to: id });
  });

  // Shortage nodes — shown as warning leaf nodes
  const shortages = snapshot.assetPlan?.shortages ?? [];
  if (shortages.length > 0) {
    const id = "shortage_summary";
    const spaceRef = spaces.length > 0 ? `space_0` : "root";
    nodes.push({
      id,
      label: "Shortages",
      sub: shortages.map((s) => `${s.category} −${s.shortBy}`).join(", ").slice(0, 32),
      type: "shortage",
      color: "#EF4444",
      x: 250,
      y: spaceBaseY + spaces.length * colStep + 12,
      w: 180,
      h: 42,
    });
    edges.push({ from: spaceRef, to: id, color: "rgba(239,68,68,.4)" });
  }

  const allowedNodeIds = nodes.map((n) => n.id);
  return { nodes, edges, allowedNodeIds };
}
