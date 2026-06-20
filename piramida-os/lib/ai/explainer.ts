import { GoogleGenAI } from "@google/genai";

// Gemini explainer: plain-language narration over deterministic tool results.
// Model: gemini-2.0-flash with function calling + thinking_level low.
// AI receives ONLY facts from tool results — never raw DB internals or operational
// truth it could hallucinate. Falls back to template strings in DEMO_MODE or on error.

const DEMO_MODE = process.env.DEMO_MODE === "true";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export interface ConflictForExplainer {
  type: string;
  severity: string;
  title: string;
  detail: Record<string, unknown>;
  suggestionLabel?: string;
}

export interface PlanNarrationInput {
  eventTitle: string;
  expectedGuests: number;
  spacesAllocated: { name: string; role: string; score: number; reasons: string[] }[];
  conflictCount: number;
  feasibilityScore: number;
}

// Deterministic fallback templates — used in DEMO_MODE or on error.
// These read from the input data; they never assert facts not in the input.
function conflictFallback(c: ConflictForExplainer): string {
  const detail = c.detail;
  if (c.type === "ASSET_SHORTAGE") {
    const cat = detail.category as string;
    const req = detail.required as number;
    const avail = detail.available as number;
    const shortBy = detail.shortBy as number;
    const replacement = detail.replacementCategory as string | null;
    let text = `${req} ${cat} units are required but only ${avail} are available for this event window — a shortage of ${shortBy}.`;
    if (replacement) text += ` ${replacement} units are available as a compatible substitute.`;
    return text;
  }
  if (c.type === "SPACE_OVERLAP") {
    return `${c.title}: another event holds an overlapping reservation for this space. The windows must be separated or an alternative space selected.`;
  }
  if (c.type === "POWER_CABLE_RISK") {
    return `Power or cable load risks have been detected. A cable safety kit should be reserved to manage this risk.`;
  }
  return c.title;
}

function planNarrationFallback(input: PlanNarrationInput): string {
  const spaceList = input.spacesAllocated.map((s) => `${s.name} (${s.role})`).join(", ");
  const conflictNote = input.conflictCount > 0
    ? ` ${input.conflictCount} conflict(s) were detected and flagged for resolution.`
    : " No conflicts were detected.";
  return `This is a ${input.expectedGuests}-guest event. The planning engine allocated ${input.spacesAllocated.length} space(s): ${spaceList}. Overall feasibility is ${input.feasibilityScore}%.${conflictNote}`;
}

export async function explainConflict(conflict: ConflictForExplainer): Promise<string> {
  if (DEMO_MODE || !GEMINI_API_KEY) {
    return conflictFallback(conflict);
  }
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const prompt = `You are an event operations advisor. Explain the following conflict to a venue manager in 2-3 clear sentences. Do not invent information — use only the facts provided.

Conflict type: ${conflict.type}
Severity: ${conflict.severity}
Title: ${conflict.title}
Detail: ${JSON.stringify(conflict.detail)}
${conflict.suggestionLabel ? `Suggested fix: ${conflict.suggestionLabel}` : ""}

Write a plain-language explanation of what the conflict means and why the suggested fix resolves it.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    return response.text?.trim() || conflictFallback(conflict);
  } catch (err) {
    console.warn("[explainer] Gemini conflict explain failed:", err);
    return conflictFallback(conflict);
  }
}

export async function narratePlan(input: PlanNarrationInput): Promise<string> {
  if (DEMO_MODE || !GEMINI_API_KEY) {
    return planNarrationFallback(input);
  }
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const spacesJson = JSON.stringify(
      input.spacesAllocated.map((s) => ({ name: s.name, role: s.role, score: s.score, reasons: s.reasons })),
      null, 2
    );
    const prompt = `You are an event operations AI for the Pyramid of Tirana. Summarize the following event plan in 2-3 sentences for a venue manager. Be concise and operational. Do not invent any facts.

Event: ${input.eventTitle}
Guests: ${input.expectedGuests}
Spaces allocated: ${spacesJson}
Conflicts detected: ${input.conflictCount}
Feasibility score: ${input.feasibilityScore}%

Write an operational summary.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    return response.text?.trim() || planNarrationFallback(input);
  } catch (err) {
    console.warn("[explainer] Gemini narrate failed:", err);
    return planNarrationFallback(input);
  }
}
