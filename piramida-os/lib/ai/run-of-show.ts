import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { GeneratedTask } from "@/lib/planning/types";
import {
  ASSIGNABLE_ROLES,
  TASK_PHASES,
  TASK_PRIORITIES,
  inferRole,
  type EnrichedTask,
  type TaskPhase,
  type TaskPriority,
} from "@/lib/manager/task-mapping";

// Gemini run-of-show enrichment.
//
// Takes the structured plan + the deterministic generatePlanTasks output and has
// Gemini (a) add any event-type-specific tasks the rules missed and (b) write
// concise titles/descriptions and suggest a priority + role + phase for each.
// Model: gemini-3.1-flash-lite with responseSchema (same client/config pattern
// as lib/ai/intake.ts). Per CLAUDE.md the AI only writes/classifies — it never
// invents dates (the route derives due dates from the plan window by phase).
// Falls back to the deterministic base tasks alone in DEMO_MODE / no key / error.

const DEMO_MODE = process.env.DEMO_MODE === "true";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-3.1-flash-lite";

export interface RunOfShowPlan {
  eventName: string;
  eventType: string;
  attendees: number;
  scheduleSummary: string;
  rooms: string[];
  assets: Array<{ label: string; qty: number }>;
  services: string[];
  access: { externalGuests: boolean; isPublic: boolean };
}

const RESPONSE_SCHEMA = {
  type: "object" as const,
  properties: {
    tasks: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: [...TASK_PRIORITIES] },
          role: { type: "string", enum: [...ASSIGNABLE_ROLES] },
          phase: { type: "string", enum: [...TASK_PHASES] },
        },
        required: ["title", "description", "priority", "role", "phase"],
      },
    },
  },
  required: ["tasks"],
};

const enrichedSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        description: z.string().trim().max(400).default(""),
        priority: z.enum(TASK_PRIORITIES),
        role: z.enum(ASSIGNABLE_ROLES),
        phase: z.enum(TASK_PHASES as [TaskPhase, ...TaskPhase[]]),
      }),
    )
    .min(1),
});

// Map a deterministic GeneratedTask to an EnrichedTask (role + phase) for the
// fallback path and to seed the model prompt with the rules' baseline.
function phaseFromTitle(title: string): TaskPhase {
  const t = title.toLowerCase();
  if (/teardown|strike|return/.test(t)) return "teardown";
  if (/setup|set up|prepare/.test(t)) return "setup";
  if (/av|mic|sound|registration|check-?in|qr|rehears|sound check/.test(t)) return "pre_event";
  return "event";
}

function baseToEnriched(task: GeneratedTask): EnrichedTask {
  return {
    title: task.title,
    description: task.description,
    priority: (TASK_PRIORITIES as readonly string[]).includes(task.priority)
      ? (task.priority as TaskPriority)
      : "MEDIUM",
    role: inferRole(task.title, task.description),
    phase: phaseFromTitle(task.title),
  };
}

function dedupeByTitle(tasks: EnrichedTask[]): EnrichedTask[] {
  const seen = new Set<string>();
  const out: EnrichedTask[] = [];
  for (const task of tasks) {
    const key = task.title.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(task);
  }
  return out;
}

export interface RunOfShowResult {
  tasks: EnrichedTask[];
  model: string;
}

export async function enrichRunOfShowTasks(input: {
  plan: RunOfShowPlan;
  baseTasks: GeneratedTask[];
}): Promise<RunOfShowResult> {
  const fallback = (): RunOfShowResult => ({
    tasks: dedupeByTitle(input.baseTasks.map(baseToEnriched)),
    model: "deterministic-fallback",
  });

  if (DEMO_MODE || !GEMINI_API_KEY) return fallback();

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: buildPrompt(input.plan, input.baseTasks) }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const raw = response.text;
    if (!raw) return fallback();
    const validated = enrichedSchema.safeParse(JSON.parse(raw));
    if (!validated.success) {
      console.warn("[run-of-show] Gemini output failed validation, falling back:", validated.error.issues);
      return fallback();
    }
    const tasks = dedupeByTitle(validated.data.tasks);
    if (!tasks.length) return fallback();
    return { tasks, model: MODEL };
  } catch (err) {
    console.warn("[run-of-show] Gemini enrichment failed, falling back:", err);
    return fallback();
  }
}

function buildPrompt(plan: RunOfShowPlan, baseTasks: GeneratedTask[]): string {
  const baseList = baseTasks
    .map((t) => `- ${t.title} [${t.priority}] — ${t.description}`)
    .join("\n");
  const assetList = plan.assets.length
    ? plan.assets.map((a) => `${a.label} ×${a.qty}`).join(", ")
    : "none specified";

  return `You are an event operations planner for the Pyramid of Tirana. Produce the run-of-show task checklist a venue team must complete to deliver this event.

You are given the confirmed plan and a deterministic baseline task list. Your job:
1. Keep every baseline task, but rewrite its title and description to be concise and operational.
2. ADD any tasks the baseline missed that are specific to a "${plan.eventType}" of this size and configuration (e.g. catering coordination, speaker/AV rehearsal, signage & wayfinding, security & crowd flow, guest communications, livestream test, cleaning). Do NOT add tasks for capabilities the plan does not include.
3. For every task set: priority (LOW|MEDIUM|HIGH|URGENT), role (one of: ${ASSIGNABLE_ROLES.join(", ")}), and phase (setup|pre_event|event|teardown|post_event).

Rules:
- Use ONLY the facts below. Do not invent attendee numbers, rooms, assets, dates, or prices.
- Do NOT output dates or times — only the phase. The system computes dates.
- Roles: AV/technical -> Technician; registration/setup/teardown/security/flow -> Operations; sourcing/equipment -> Inventory; coordination/sign-off -> Event Manager.
- Aim for 6-14 focused, non-overlapping tasks.

CONFIRMED PLAN
Event: ${plan.eventName} (${plan.eventType})
Attendees: ${plan.attendees}
Schedule: ${plan.scheduleSummary}
Rooms: ${plan.rooms.length ? plan.rooms.join(", ") : "to be assigned"}
Assets: ${assetList}
Services: ${plan.services.length ? plan.services.join(", ") : "none"}
Access: ${plan.access.externalGuests ? "external guests allowed" : "invite-only"}, ${plan.access.isPublic ? "public listing" : "private"}

DETERMINISTIC BASELINE TASKS
${baseList || "(none)"}

Return JSON matching the schema: { "tasks": [ { "title", "description", "priority", "role", "phase" } ] }.`;
}
