import { GoogleGenAI } from "@google/genai";
import { deterministicExtract, eventExtractionSchema, type EventExtraction } from "../services/event-requests";
import {
  EVENT_TYPE_IDS,
  INTAKE_NEED_FIELDS,
  normalizeIntake,
} from "./event-intake-contract";

// Gemini intake: structured extraction from messy organizer text.
// Model: gemini-3.1-flash-lite with responseSchema for determinism.
// Falls back to deterministicExtract when DEMO_MODE=true or the call fails.
// AI may never assert operational facts — it only structures free text.

const DEMO_MODE = process.env.DEMO_MODE === "true";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const INTAKE_RESPONSE_SCHEMA = {
  type: "object" as const,
  properties: {
    eventType: { type: "string", enum: EVENT_TYPE_IDS },
    expectedGuests: { type: "number" },
    datePreference: { type: "string" },
    setupHours: { type: "number" },
    teardownHours: { type: "number" },
    needs: {
      type: "object" as const,
      properties: Object.fromEntries(
        INTAKE_NEED_FIELDS.map((field) => [
          field.key,
          { type: field.kind === "boolean" ? "boolean" : "number" },
        ]),
      ),
      required: INTAKE_NEED_FIELDS.map((field) => field.key),
    },
    missingFields: { type: "array", items: { type: "string" } },
    confidence: { type: "number" },
    clarifyingQuestions: { type: "array", items: { type: "string" } },
    suggestedNeeds: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          key: { type: "string", enum: INTAKE_NEED_FIELDS.map((field) => field.key) },
          value: { type: "string" },
          reason: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["key", "value", "reason", "confidence"],
      },
    },
  },
  required: ["eventType", "expectedGuests", "needs", "missingFields", "confidence"],
};

const SYSTEM_PROMPT = `You are a structured extraction engine for an event venue management system.
Extract structured event requirements from the organizer's free-form request text.
Be conservative — only extract what is explicitly stated or strongly implied.
Event type must be one of the supplied event_types ids.
Render needs from the supplied need field list; do not invent keys.
For missingFields, list any required planning details that are absent (e.g. "exact event date", "event end time", "expected end time").
If confidence is low or fields are missing, propose 1-3 clarifyingQuestions a staffer should ask.
For strongly implied needs, add suggestedNeeds with a short reason so staff can confirm.
Return numbers as integers where they represent counts.
Do not invent details not present in the text.`;

export interface IntakeResult {
  extraction: EventExtraction;
  model: string;
  latencyMs: number;
  confidence: number;
  validationPassed: boolean;
}

export async function parseWithGemini(rawText: string): Promise<IntakeResult> {
  if (DEMO_MODE || !GEMINI_API_KEY) {
    const started = Date.now();
    const extraction = deterministicExtract(rawText);
    return { extraction, model: "deterministic-fallback", latencyMs: Date.now() - started, confidence: extraction.confidence, validationPassed: true };
  }

  const started = Date.now();
  try {
    let result = await runGeminiIntake(rawText, false);
    if (result.extraction.thinkingLevel === "high") {
      result = await runGeminiIntake(rawText, true);
    }
    const latencyMs = Date.now() - started;
    return { ...result, latencyMs };
  } catch (err) {
    console.warn("[intake] Gemini call failed, falling back:", err);
    const fallback = deterministicExtract(rawText);
    return { extraction: fallback, model: "deterministic-fallback", latencyMs: Date.now() - started, confidence: fallback.confidence, validationPassed: true };
  }
}

async function runGeminiIntake(rawText: string, highThinking: boolean): Promise<IntakeResult> {
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${SYSTEM_PROMPT}

event_types:
${EVENT_TYPE_IDS.join(", ")}

need_fields:
${INTAKE_NEED_FIELDS.map((field) => `- ${field.key} (${field.kind}): ${field.label}`).join("\n")}

thinking_level: ${highThinking ? "HIGH" : "LOW"}

Organizer request:
${rawText}`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: INTAKE_RESPONSE_SCHEMA,
      thinkingConfig: {
        thinkingLevel: highThinking ? "HIGH" : "LOW",
      } as never,
    },
  });

  const raw = response.text;
  if (!raw) throw new Error("Empty response from Gemini");
  const parsed = coerceGeminiSuggestedNeedValues(JSON.parse(raw));
  const validated = eventExtractionSchema.safeParse(parsed);
  if (!validated.success) {
    console.warn("[intake] Gemini output failed Zod validation, falling back:", validated.error.issues);
    const fallback = deterministicExtract(rawText);
    return { extraction: fallback, model: "deterministic-fallback", latencyMs: 0, confidence: 0.7, validationPassed: false };
  }
  const extraction = normalizeIntake({ ...validated.data, thinkingLevel: highThinking ? "high" : "lite" });
  return {
    extraction,
    model: highThinking ? "gemini-3.1-flash-lite:thinking-high" : "gemini-3.1-flash-lite",
    latencyMs: 0,
    confidence: extraction.confidence,
    validationPassed: true,
  };
}

function coerceGeminiSuggestedNeedValues(value: unknown): unknown {
  if (!value || typeof value !== "object" || !("suggestedNeeds" in value)) return value;
  const record = value as { suggestedNeeds?: Array<{ key?: string; value?: unknown }> };
  record.suggestedNeeds = record.suggestedNeeds?.map((suggestion) => {
    const field = INTAKE_NEED_FIELDS.find((need) => need.key === suggestion.key);
    if (!field) return suggestion;
    if (field.kind === "boolean" && typeof suggestion.value === "string") {
      return { ...suggestion, value: suggestion.value.toLowerCase() === "true" };
    }
    if (field.kind === "number" && typeof suggestion.value === "string") {
      return { ...suggestion, value: Number.parseInt(suggestion.value, 10) || 0 };
    }
    return suggestion;
  });
  return value;
}
