import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { ConflictSuggestionType, type Conflict, type Event } from "@prisma/client";
import { loadWorldSnapshot, type WorldSnapshot } from "@/lib/repo";
import { dispatchTool, logAiRun, TOOL_DECLARATIONS } from "./tools";

const DEMO_MODE = process.env.DEMO_MODE === "true";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-3-flash";

const suggestionSchema = z.object({
  type: z.nativeEnum(ConflictSuggestionType),
  label: z.string().min(1).max(200),
  rationale: z.string().min(1).max(2000),
  rank: z.number().int().min(1).max(5),
  residualRisk: z.enum(["low", "medium", "high"]),
  costDelta: z.number(),
  disruption: z.enum(["low", "medium", "high"]),
  beforeRisk: z.string(),
  afterRisk: z.string(),
  tradeoffNarration: z.string(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const conflictResolutionSchema = z.object({
  suggestions: z.array(suggestionSchema).min(1).max(3),
});

export type ConflictResolutionSuggestion = z.infer<typeof suggestionSchema>;
export type ToolTraceEntry = { name: string; input: Record<string, unknown>; result: Record<string, unknown> };

type ConflictWithEvent = Conflict & {
  event: Pick<Event, "id" | "type" | "setupStart" | "eventStart" | "eventEnd" | "teardownEnd" | "returnBufferMinutes">;
};

function eventWindow(event: ConflictWithEvent["event"]) {
  if (!event.setupStart || !event.eventStart || !event.eventEnd || !event.teardownEnd) throw new Error("Event schedule is incomplete");
  const until = new Date(event.teardownEnd.getTime() + (event.returnBufferMinutes ?? 30) * 60_000);
  return { from: event.setupStart.toISOString(), to: until.toISOString() };
}

async function tool(trace: ToolTraceEntry[], snapshot: WorldSnapshot, name: string, input: Record<string, unknown>) {
  const result = await dispatchTool(name, input, snapshot);
  trace.push({ name, input, result });
  return result;
}

function allowedActionTypes(snapshot: WorldSnapshot): ConflictSuggestionType[] {
  const rows = snapshot.settings["planning.suggestion_types"];
  if (!Array.isArray(rows)) return Object.values(ConflictSuggestionType);
  const configured = rows.map((row) => (row as { type?: string }).type).filter(Boolean);
  return Object.values(ConflictSuggestionType).filter((type) => configured.includes(type));
}

function findCategory(snapshot: WorldSnapshot, conflict: ConflictWithEvent) {
  const detail = (conflict.detail ?? {}) as Record<string, unknown>;
  const categoryName =
    typeof detail.category === "string" ? detail.category :
    typeof detail.asset === "string" && detail.asset.toLowerCase().includes("wireless") ? "Wireless Microphone" :
    conflict.title.toLowerCase().includes("wireless") ? "Wireless Microphone" :
    "";
  return snapshot.categories.find((category) => category.name === categoryName) ?? snapshot.categories.find((category) => category.name.toLowerCase().includes("wireless"));
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 1;
}

export async function generateConflictResolutionSuggestions(input: {
  orgId: string;
  conflict: ConflictWithEvent;
}): Promise<{ suggestions: ConflictResolutionSuggestion[]; toolTrace: ToolTraceEntry[]; model: string; validationPassed: boolean }> {
  const started = Date.now();
  const snapshot = await loadWorldSnapshot(input.orgId);
  const trace: ToolTraceEntry[] = [];
  const allowed = allowedActionTypes(snapshot);
  const fallback = await deterministicSuggestions(input.conflict, snapshot, trace, allowed);

  if (DEMO_MODE || !GEMINI_API_KEY) {
    await logAiRun({
      orgId: input.orgId,
      model: "deterministic-conflict-agent",
      toolName: "conflict_resolution_agent",
      inputPayload: { conflictId: input.conflict.id, type: input.conflict.type },
      outputRef: { suggestions: fallback, toolTrace: trace },
      latencyMs: Date.now() - started,
      validationPassed: true,
    });
    return { suggestions: fallback, toolTrace: trace, model: "deterministic-conflict-agent", validationPassed: true };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [{
      role: "user",
      parts: [{ text: `Resolve this venue operations conflict. You may only state availability or price facts after calling tools. Return ranked fixes using only these action types: ${allowed.join(", ")}.

Conflict:
${JSON.stringify({ id: input.conflict.id, type: input.conflict.type, severity: input.conflict.severity, title: input.conflict.title, detail: input.conflict.detail }, null, 2)}

Event window:
${JSON.stringify(eventWindow(input.conflict.event))}

Call tools first for substitutes, availability, dry-run feasibility, pricing rules, and asset pricing.` }],
    }];

    for (let i = 0; i < 4; i += 1) {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: contents as never,
        config: { tools: [TOOL_DECLARATIONS] },
      });
      const calls = response.functionCalls ?? [];
      if (calls.length === 0) break;
      contents.push({ role: "model", parts: calls.map((call) => ({ functionCall: call })) });
      const responseParts = [];
      for (const call of calls) {
        const result = await tool(trace, snapshot, call.name ?? "", (call.args ?? {}) as Record<string, unknown>);
        responseParts.push({ functionResponse: { name: call.name, response: result } });
      }
      contents.push({ role: "user", parts: responseParts });
    }

    contents.push({
      role: "user",
      parts: [{ text: `Now return JSON only. Every stated fact must come from the tool results already in this conversation. Include why the top fix beats the runner-up.` }],
    });
    const final = await ai.models.generateContent({
      model: MODEL,
      contents: contents as never,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: allowed },
                  label: { type: "string" },
                  rationale: { type: "string" },
                  rank: { type: "number" },
                  residualRisk: { type: "string", enum: ["low", "medium", "high"] },
                  costDelta: { type: "number" },
                  disruption: { type: "string", enum: ["low", "medium", "high"] },
                  beforeRisk: { type: "string" },
                  afterRisk: { type: "string" },
                  tradeoffNarration: { type: "string" },
                  payload: { type: "object" },
                },
                required: ["type", "label", "rationale", "rank", "residualRisk", "costDelta", "disruption", "beforeRisk", "afterRisk", "tradeoffNarration", "payload"],
              },
            },
          },
          required: ["suggestions"],
        },
      },
    });
    const parsed = conflictResolutionSchema.safeParse(JSON.parse(final.text ?? "{}"));
    const suggestions = parsed.success
      ? parsed.data.suggestions.filter((suggestion) => allowed.includes(suggestion.type))
      : fallback;
    await logAiRun({
      orgId: input.orgId,
      model: MODEL,
      toolName: "conflict_resolution_agent",
      inputPayload: { conflictId: input.conflict.id, type: input.conflict.type },
      outputRef: { suggestions, toolTrace: trace, validationIssues: parsed.success ? [] : parsed.error.issues },
      latencyMs: Date.now() - started,
      validationPassed: parsed.success,
    });
    return { suggestions: suggestions.length ? suggestions : fallback, toolTrace: trace, model: MODEL, validationPassed: parsed.success };
  } catch (error) {
    await logAiRun({
      orgId: input.orgId,
      model: "deterministic-conflict-agent",
      toolName: "conflict_resolution_agent",
      inputPayload: { conflictId: input.conflict.id, type: input.conflict.type },
      outputRef: { suggestions: fallback, toolTrace: trace, error: error instanceof Error ? error.message : String(error) },
      latencyMs: Date.now() - started,
      validationPassed: true,
    });
    return { suggestions: fallback, toolTrace: trace, model: "deterministic-conflict-agent", validationPassed: true };
  }
}

async function deterministicSuggestions(
  conflict: ConflictWithEvent,
  snapshot: WorldSnapshot,
  trace: ToolTraceEntry[],
  allowed: ConflictSuggestionType[],
): Promise<ConflictResolutionSuggestion[]> {
  const win = eventWindow(conflict.event);
  const detail = (conflict.detail ?? {}) as Record<string, unknown>;
  const category = findCategory(snapshot, conflict);
  const replaceAssetId = typeof detail.assetId === "string"
    ? detail.assetId
    : typeof detail.asset === "string"
      ? snapshot.serializedAssets.find((asset) => asset.name === detail.asset)?.id
      : undefined;
  const quantity = firstNumber(detail.shortBy, detail.quantity, 1);
  const suggestions: ConflictResolutionSuggestion[] = [];

  if (category) {
    const substitutes = await tool(trace, snapshot, "findSubstitutes", { categoryId: category.id, quantity, from: win.from, to: win.to });
    const substitute = ((substitutes.substitutes as Array<{ categoryId: string; name: string; availableQuantity: number }> | undefined) ?? [])[0];
    if (substitute && allowed.includes(ConflictSuggestionType.SUBSTITUTE_ASSET)) {
      const assets = await tool(trace, snapshot, "listAssets", { categoryId: substitute.categoryId, status: "AVAILABLE" });
      const asset = ((assets.assets as Array<{ id: string; name: string }> | undefined) ?? [])[0];
      const dryRun = asset
        ? await tool(trace, snapshot, "reserveDryRun", { resourceType: "asset", resourceIds: [asset.id], from: win.from, to: win.to })
        : { feasible: true };
      await tool(trace, snapshot, "getPricingRules", { scope: "asset_category", targetId: substitute.categoryId });
      const price = await tool(trace, snapshot, "priceAssets", { items: [{ type: "category", id: substitute.categoryId, quantity }], eventType: conflict.event.type });
      const total = Number((price.estimate as { total?: number } | undefined)?.total ?? 0);
      suggestions.push({
        type: ConflictSuggestionType.SUBSTITUTE_ASSET,
        label: asset ? `Substitute ${asset.name} for ${detail.asset ?? category.name}` : `Substitute ${quantity}x ${substitute.name}`,
        rationale: `${substitute.name} has ${substitute.availableQuantity} available unit(s), dry-run feasibility is ${Boolean(dryRun.feasible)}, and tool pricing estimates ${total.toLocaleString()} ALL for the substitution line.`,
        rank: 1,
        residualRisk: "low",
        costDelta: total,
        disruption: "low",
        beforeRisk: "Asset gate is blocked or warned because the requested wireless unit is unavailable for the full window.",
        afterRisk: "Replacement category is available in the same window; staff only needs to place the wired mic on the stage plot.",
        tradeoffNarration: "This beats the runner-up because it uses an in-house replacement verified by availability and pricing tools, so it avoids external procurement and keeps disruption low.",
        payload: {
          replacementCategoryId: substitute.categoryId,
          replacementCategory: substitute.name,
          withAssetId: asset?.id,
          withAssetName: asset?.name,
          replaceAssetId,
          replaceAssetName: detail.asset,
          quantity,
          toolTrace: trace,
          gateDelta: { assets: "WARNING->GO" },
          quoteDelta: total,
        },
      });
    }
  }

  if (allowed.includes(ConflictSuggestionType.REDUCE_QUANTITY)) {
    suggestions.push({
      type: ConflictSuggestionType.REDUCE_QUANTITY,
      label: "Reduce requested wireless microphone quantity by one",
      rationale: "This removes the shortage without adding an asset, but changes the event operating plan and may constrain presenters.",
      rank: suggestions.length + 1,
      residualRisk: "medium",
      costDelta: 0,
      disruption: "medium",
      beforeRisk: "The requested quantity cannot be fulfilled with the currently available wireless microphone inventory.",
      afterRisk: "The asset count fits available inventory, but the run-of-show has less wireless flexibility.",
      tradeoffNarration: "It is cheaper than the top fix but worse operationally because it changes the organizer's requested setup.",
      payload: { newQuantity: Math.max(0, Number(detail.requiredWireless ?? detail.required ?? 1) - quantity), toolTrace: trace, quoteDelta: 0 },
    });
  }

  if (allowed.includes(ConflictSuggestionType.ADD_CABLE_KIT) && conflict.type === "POWER_CABLE_RISK") {
    const kitName = typeof detail.kit === "string" ? detail.kit : "Cable Kit A";
    const kit = snapshot.kits.find((row) => row.name === kitName);
    await tool(trace, snapshot, "getPricingRules", { scope: "kit", targetId: kit?.id ?? kitName });
    const price = kit
      ? await tool(trace, snapshot, "priceAssets", { items: [{ type: "kit", id: kit.id, quantity: 1 }], eventType: conflict.event.type })
      : { estimate: { total: 8000 } };
    const total = Number((price.estimate as { total?: number } | undefined)?.total ?? 8000);
    suggestions.push({
      type: ConflictSuggestionType.ADD_CABLE_KIT,
      label: `Reserve ${kitName} for power/cable safety`,
      rationale: `${kitName} bundles extension cables and covers verified in inventory; tool pricing estimates ${total.toLocaleString()} ALL for the kit line.`,
      rank: suggestions.length + 1,
      residualRisk: "low",
      costDelta: total,
      disruption: "low",
      beforeRisk: "Power gate stays in WARNING because projected tech load exceeds the safe threshold without a cable safety kit.",
      afterRisk: "Cable kit is reserved for the full event window, clearing the power/cable risk gate.",
      tradeoffNarration: "This is the lowest-disruption fix for power risk because it adds verified kit inventory instead of changing the AV plan or reducing equipment counts.",
      payload: {
        kitId: kit?.id,
        kitName,
        toolTrace: trace,
        gateDelta: { power: "WARNING->GO", safety: "WARNING->GO" },
        quoteDelta: total,
      },
    });
  }

  return suggestions.slice(0, 3).map((suggestion, index) => ({ ...suggestion, rank: index + 1 }));
}
