/**
 * lib/ai/tools — Gemini function-calling tool layer.
 *
 * Defines FunctionDeclarations for every tool Gemini may call, plus thin
 * handler wrappers that call the repo / pricing / services. The handlers are
 * the ONLY path through which the model may obtain operational facts.
 *
 * Constraint: handlers are READ-ONLY. They never mutate the DB.
 * The model may reason about what applyReservation would do, but the actual
 * commit goes through a separate, deterministic server action.
 */
import { Type, type Tool } from "@google/genai";
import {
  loadWorldSnapshot,
  getSpaceReservationWindows,
  getAssetReservationWindows,
  type WorldSnapshot,
} from "@/lib/repo";
import { estimateSpacePrice, type ReservationWindow } from "@/lib/pricing";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export interface AiRunLog {
  model: string;
  toolName: string;
  inputHash: string;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
}

import { createHash } from "node:crypto";

function hashInput(input: unknown): string {
  return createHash("sha1").update(JSON.stringify(input)).digest("hex").slice(0, 16);
}

// ---------------------------------------------------------------------------
// Tool function declarations (Gemini schema format)
// ---------------------------------------------------------------------------

export const TOOL_DECLARATIONS: Tool = {
  functionDeclarations: [
    {
      name: "checkAvailability",
      description:
        "Returns all active reservation windows that overlap with the given time range for a space or serialized asset. Read-only. Use to verify availability before suggesting a space or asset.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          resourceType: { type: Type.STRING, enum: ["space", "asset"] },
          resourceId:   { type: Type.STRING, description: "UUID of the space or serialized asset" },
          from:         { type: Type.STRING, description: "ISO 8601 datetime — window start (setup_start)" },
          to:           { type: Type.STRING, description: "ISO 8601 datetime — window end (teardown_end)" },
        },
        required: ["resourceType", "resourceId", "from", "to"],
      },
    },
    {
      name: "listSpaces",
      description:
        "Returns all spaces in the venue with capacity, features, and adjacency data. Optionally filter by kind or minimum capacity.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          kind:        { type: Type.STRING, description: "Filter by SpaceKind e.g. ROOM, CORRIDOR, ENTRANCE" },
          minCapacity: { type: Type.NUMBER, description: "Minimum seated capacity" },
          publicOnly:  { type: Type.BOOLEAN },
        },
        required: [],
      },
    },
    {
      name: "listAssets",
      description:
        "Returns serialized assets for a given category with current status. Use to see which specific units are available.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          categoryId: { type: Type.STRING, description: "UUID of the asset category" },
          status:     { type: Type.STRING, description: "Filter by AssetStatus e.g. AVAILABLE" },
        },
        required: ["categoryId"],
      },
    },
    {
      name: "getInventoryAvailability",
      description:
        "Returns how many units of a bulk category are available for reservation in the given window (excluding already-reserved quantities).",
      parameters: {
        type: Type.OBJECT,
        properties: {
          categoryId: { type: Type.STRING },
          from:       { type: Type.STRING, description: "ISO 8601" },
          to:         { type: Type.STRING, description: "ISO 8601" },
          quantity:   { type: Type.NUMBER, description: "Requested quantity — availability check includes this demand" },
        },
        required: ["categoryId", "from", "to", "quantity"],
      },
    },
    {
      name: "findSubstitutes",
      description:
        "Returns available replacement assets / categories when the primary category has a shortage. Reads replacement_category_id from the category row.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          categoryId: { type: Type.STRING, description: "Primary (unavailable) category UUID" },
          quantity:   { type: Type.NUMBER, description: "Required quantity" },
          from:       { type: Type.STRING, description: "ISO 8601" },
          to:         { type: Type.STRING, description: "ISO 8601" },
        },
        required: ["categoryId", "quantity", "from", "to"],
      },
    },
    {
      name: "getPricingRules",
      description:
        "Returns active pricing rules for a given scope and optional target. Use to show estimated cost to the organizer — never to set a committed price.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          scope:    { type: Type.STRING, enum: ["space", "asset_category", "kit", "modifier"] },
          targetId: { type: Type.STRING, description: "UUID of the space / category / kit (omit for modifiers)" },
        },
        required: ["scope"],
      },
    },
    {
      name: "reserveDryRun",
      description:
        "Validates whether the requested space or assets can be reserved for the given window WITHOUT committing anything. Returns a feasibility verdict and list of conflicts.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          resourceType: { type: Type.STRING, enum: ["space", "asset"] },
          resourceIds:  { type: Type.ARRAY, items: { type: Type.STRING }, description: "UUIDs of spaces or assets" },
          from:         { type: Type.STRING, description: "ISO 8601 — setup_start" },
          to:           { type: Type.STRING, description: "ISO 8601 — teardown_end" },
        },
        required: ["resourceType", "resourceIds", "from", "to"],
      },
    },
    {
      name: "getSpaceInfo",
      description:
        "Returns full metadata for a space (capacity, features, adjacency, area) and a live price estimate for the event window. This is the tool the 3D room-explore panel calls.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          spaceId:   { type: Type.STRING, description: "UUID of the space" },
          eventFrom: { type: Type.STRING, description: "ISO 8601 — setup_start" },
          eventTo:   { type: Type.STRING, description: "ISO 8601 — teardown_end" },
          eventType: { type: Type.STRING, description: "EventType enum e.g. CONFERENCE — used for modifier pricing" },
        },
        required: ["spaceId", "eventFrom", "eventTo"],
      },
    },
    {
      name: "priceSpace",
      description:
        "Returns a detailed price estimate for a space over the given window. Does NOT commit a price — for display / proposal copy only.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          spaceId:   { type: Type.STRING },
          from:      { type: Type.STRING, description: "ISO 8601 — setup_start" },
          to:        { type: Type.STRING, description: "ISO 8601 — teardown_end" },
          eventType: { type: Type.STRING },
        },
        required: ["spaceId", "from", "to"],
      },
    },
    {
      name: "priceAssets",
      description:
        "Returns a line-item price estimate for a list of asset categories / kits with quantities. Does NOT commit a price.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            description: "Asset categories or kits to price",
            items: {
              type: Type.OBJECT,
              properties: {
                type:      { type: Type.STRING, enum: ["category", "kit"] },
                id:        { type: Type.STRING, description: "UUID of the category or kit" },
                quantity:  { type: Type.NUMBER },
              },
              required: ["type", "id", "quantity"],
            },
          },
          eventType: { type: Type.STRING },
        },
        required: ["items"],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Handler implementations (read-only)
// ---------------------------------------------------------------------------

type ToolInput = Record<string, unknown>;
type ToolResult = Record<string, unknown>;

export async function dispatchTool(
  name: string,
  input: ToolInput,
  snapshot: WorldSnapshot,
): Promise<ToolResult> {
  const t0 = Date.now();
  try {
    const result = await callHandler(name, input, snapshot);
    void t0; // latency available if needed for ai_runs logging
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }
}

async function callHandler(
  name: string,
  input: ToolInput,
  snapshot: WorldSnapshot,
): Promise<ToolResult> {
  switch (name) {
    case "checkAvailability": {
      const { resourceType, resourceId, from, to } = input as {
        resourceType: string; resourceId: string; from: string; to: string;
      };
      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (resourceType === "space") {
        const windows = await getSpaceReservationWindows(resourceId, fromDate, toDate);
        return { available: windows.length === 0, reservationWindows: windows };
      } else {
        const windows = await getAssetReservationWindows(resourceId, fromDate, toDate);
        return { available: windows.length === 0, reservationWindows: windows };
      }
    }

    case "listSpaces": {
      const { kind, minCapacity, publicOnly } = input as {
        kind?: string; minCapacity?: number; publicOnly?: boolean;
      };
      let spaces = snapshot.spaces;
      if (kind) spaces = spaces.filter((s) => s.kind === kind);
      if (minCapacity) spaces = spaces.filter((s) => (s.capacity ?? 0) >= minCapacity);
      if (publicOnly) spaces = spaces.filter((s) => s.publicVisible);
      return {
        spaces: spaces.map((s) => ({
          id: s.id,
          name: s.name,
          kind: s.kind,
          capacity: s.capacity,
          areaSqm: s.areaSqm,
          features: s.features,
          adjacentSpaceCount: s.adjacentSpaceIds.length,
        })),
      };
    }

    case "listAssets": {
      const { categoryId, status } = input as { categoryId: string; status?: string };
      let assets = snapshot.serializedAssets.filter((a) => a.categoryId === categoryId);
      if (status) assets = assets.filter((a) => a.status === status);
      return { assets };
    }

    case "getInventoryAvailability": {
      const { categoryId, from, to, quantity } = input as {
        categoryId: string; from: string; to: string; quantity: number;
      };
      const fromDate = new Date(from);
      const toDate = new Date(to);
      const category = snapshot.categories.find((item) => item.id === categoryId);
      if (category?.trackingMode === "SERIALIZED") {
        const candidates = snapshot.serializedAssets.filter((asset) => asset.categoryId === categoryId && !["RETIRED", "MAINTENANCE", "MISSING"].includes(asset.status));
        const busy = await prisma.assetReservationItem.findMany({
          where: {
            orgId: snapshot.orgId,
            assetId: { in: candidates.map((asset) => asset.id) },
            itemStatus: { notIn: ["RELEASED", "CANCELLED", "SUBSTITUTED"] },
            windowStart: { lte: toDate },
            windowEnd: { gte: fromDate },
          },
          select: { assetId: true },
        });
        const busyIds = new Set(busy.map((item) => item.assetId).filter(Boolean));
        const netAvailable = candidates.filter((asset) => !busyIds.has(asset.id)).length;
        return {
          totalAvailable: candidates.length,
          reservedInWindow: busyIds.size,
          netAvailable,
          requestedQuantity: quantity,
          canFulfill: netAvailable >= quantity,
          shortage: Math.max(0, quantity - netAvailable),
        };
      }
      const batches = snapshot.batches.filter((b) => b.categoryId === categoryId);
      const totalAvail = batches.reduce((t, b) => t + b.availableQuantity, 0);

      // Count how many are already reserved in this window
      const reserved = await prisma.assetReservationItem.aggregate({
        where: {
          orgId: snapshot.orgId,
          itemStatus: { notIn: ["RELEASED", "CANCELLED", "SUBSTITUTED"] },
          windowStart: { lte: toDate },
          windowEnd: { gte: fromDate },
          asset: { categoryId },
        },
        _sum: { quantity: true },
      });
      const reservedQty = reserved._sum.quantity ?? 0;
      const netAvailable = totalAvail - reservedQty;
      return {
        totalAvailable: totalAvail,
        reservedInWindow: reservedQty,
        netAvailable,
        requestedQuantity: quantity,
        canFulfill: netAvailable >= quantity,
        shortage: Math.max(0, quantity - netAvailable),
      };
    }

    case "findSubstitutes": {
      const { categoryId, quantity, from, to } = input as {
        categoryId: string; quantity: number; from: string; to: string;
      };
      const category = snapshot.categories.find((c) => c.id === categoryId);
      if (!category?.replacementCategoryId) {
        return { substitutes: [], message: "No replacement category configured for this asset type." };
      }
      // Recursively check availability for the replacement category
      const subResult = await callHandler("getInventoryAvailability", {
        categoryId: category.replacementCategoryId,
        from, to, quantity,
      }, snapshot) as { netAvailable: number; canFulfill: boolean };

      const repCategory = snapshot.categories.find((c) => c.id === category.replacementCategoryId);
      return {
        substitutes: subResult.canFulfill ? [{
          categoryId: category.replacementCategoryId,
          name: repCategory?.name ?? "Unknown",
          availableQuantity: subResult.netAvailable,
          canFulfillRequest: true,
        }] : [],
        canFulfill: subResult.canFulfill,
      };
    }

    case "getPricingRules": {
      const { scope, targetId } = input as { scope: string; targetId?: string };
      const rules = snapshot.pricingRules.filter(
        (r) => r.scope === scope && (targetId ? r.targetId === targetId : true),
      );
      return { rules };
    }

    case "reserveDryRun": {
      const { resourceType, resourceIds, from, to } = input as {
        resourceType: string; resourceIds: string[]; from: string; to: string;
      };
      const fromDate = new Date(from);
      const toDate = new Date(to);
      const conflicts: Array<{ resourceId: string; conflictsWith: unknown[] }> = [];

      for (const id of resourceIds) {
        const windows = resourceType === "space"
          ? await getSpaceReservationWindows(id, fromDate, toDate)
          : await getAssetReservationWindows(id, fromDate, toDate);
        if (windows.length > 0) {
          conflicts.push({ resourceId: id, conflictsWith: windows });
        }
      }
      return {
        feasible: conflicts.length === 0,
        conflicts,
        message: conflicts.length === 0
          ? "All resources available for this window."
          : `${conflicts.length} resource(s) have overlapping reservations.`,
      };
    }

    case "getSpaceInfo": {
      const { spaceId, eventFrom, eventTo, eventType } = input as {
        spaceId: string; eventFrom: string; eventTo: string; eventType?: string;
      };
      const space = snapshot.spaces.find((s) => s.id === spaceId);
      if (!space) return { error: `Space ${spaceId} not found` };

      const window: ReservationWindow = {
        setupStart: new Date(eventFrom),
        eventStart: new Date(eventFrom),
        eventEnd: new Date(eventTo),
        teardownEnd: new Date(eventTo),
      };
      const price = estimateSpacePrice(spaceId, window, snapshot, { eventType });
      const adjacentNames = space.adjacentSpaceIds
        .map((id) => snapshot.spaces.find((s) => s.id === id)?.name)
        .filter(Boolean);

      return {
        space: {
          id: space.id,
          name: space.name,
          kind: space.kind,
          capacity: space.capacity,
          areaSqm: space.areaSqm,
          features: space.features,
          adjacentSpaces: adjacentNames,
        },
        priceEstimate: price,
      };
    }

    case "priceSpace": {
      const { spaceId, from, to, eventType } = input as {
        spaceId: string; from: string; to: string; eventType?: string;
      };
      const space = snapshot.spaces.find((s) => s.id === spaceId);
      if (!space) return { error: `Space ${spaceId} not found` };
      const window: ReservationWindow = {
        setupStart: new Date(from),
        eventStart: new Date(from),
        eventEnd: new Date(to),
        teardownEnd: new Date(to),
      };
      const estimate = estimateSpacePrice(spaceId, window, snapshot, { eventType });
      return { estimate };
    }

    case "priceAssets": {
      const { items, eventType } = input as {
        items: Array<{ type: string; id: string; quantity: number }>;
        eventType?: string;
      };
      const { priceAssets } = await import("@/lib/pricing");
      const estimate = priceAssets(
        items.map((i) => ({ type: i.type as "category" | "kit", id: i.id, quantity: i.quantity })),
        snapshot,
        { eventType },
      );
      return { estimate };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ---------------------------------------------------------------------------
// ai_runs logger (call this after each Gemini response turn)
// ---------------------------------------------------------------------------

export async function logAiRun(opts: {
  orgId: string;
  model: string;
  toolName: string;
  inputPayload: unknown;
  outputRef?: unknown;
  latencyMs: number;
  validationPassed: boolean;
  errorMessage?: string;
}) {
  const inputHash = hashInput(opts.inputPayload);
  try {
    await prisma.aiRun.create({
      data: {
        orgId: opts.orgId,
        model: opts.model,
        promptType: opts.toolName,
        inputHash,
        outputRef: opts.outputRef ? (opts.outputRef as Prisma.InputJsonValue) : Prisma.JsonNull,
        latencyMs: opts.latencyMs,
        validationPassed: opts.validationPassed,
      },
    });
  } catch {
    // Non-blocking — AI run logging must never break the request path
  }
}

// ---------------------------------------------------------------------------
// DEMO_MODE snapshot factory (returns snapshot without hitting DB)
// Used when DEMO_MODE=true and no DB is connected — safe for CI/preview.
// ---------------------------------------------------------------------------
export function demoSnapshot(orgId: string): WorldSnapshot {
  return {
    orgId,
    spaces: [],
    categories: [],
    serializedAssets: [],
    batches: [],
    kits: [],
    pricingRules: [],
    settings: { currency: "ALL", demo_mode: true },
    loadedAt: new Date(),
  };
}

export async function getOrDemoSnapshot(orgId: string): Promise<WorldSnapshot> {
  if (process.env.DEMO_MODE === "true" && !process.env.DATABASE_URL) {
    return demoSnapshot(orgId);
  }
  try {
    return await loadWorldSnapshot(orgId);
  } catch {
    return demoSnapshot(orgId);
  }
}
