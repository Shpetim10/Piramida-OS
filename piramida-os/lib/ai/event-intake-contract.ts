import { EventType, Prisma } from "@prisma/client";
import { z } from "zod";

type NeedKind = "boolean" | "number";

export const EVENT_TYPE_OPTIONS = Object.values(EventType).map((value) => ({
  id: value.toLowerCase(),
  value,
  label: value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" "),
}));

export const EVENT_TYPE_IDS = EVENT_TYPE_OPTIONS.map((type) => type.id);

export const INTAKE_NEED_FIELDS = [
  { key: "mainStage", label: "Main stage", kind: "boolean", category: "Spaces", defaultValue: false },
  { key: "breakoutRooms", label: "Breakout rooms", kind: "number", category: "Spaces", defaultValue: 0 },
  { key: "coffeeArea", label: "Coffee area", kind: "boolean", category: "Hospitality", defaultValue: false },
  { key: "registrationDesk", label: "Registration desk", kind: "boolean", category: "Guest flow", defaultValue: false },
  { key: "publicGuestRegistration", label: "Public guest registration", kind: "boolean", category: "Guest flow", defaultValue: false },
  { key: "screens", label: "Screens", kind: "number", category: "AV", defaultValue: 0 },
  { key: "projectors", label: "Projectors", kind: "number", category: "AV", defaultValue: 0 },
  { key: "wirelessMicrophones", label: "Wireless microphones", kind: "number", category: "AV", defaultValue: 0 },
  { key: "wiredMicrophones", label: "Wired microphones", kind: "number", category: "AV", defaultValue: 0 },
  { key: "chairs", label: "Chairs", kind: "number", category: "Furniture", defaultValue: 0 },
  { key: "tables", label: "Tables", kind: "number", category: "Furniture", defaultValue: 0 },
  { key: "speakers", label: "Speakers", kind: "number", category: "AV", defaultValue: 0 },
  { key: "livestream", label: "Livestream", kind: "boolean", category: "Broadcast", defaultValue: false },
] as const satisfies readonly {
  key: string;
  label: string;
  kind: NeedKind;
  category: string;
  defaultValue: boolean | number;
}[];

export type IntakeNeedKey = (typeof INTAKE_NEED_FIELDS)[number]["key"];

export type EventIntakeNeeds = Record<IntakeNeedKey, boolean | number>;

export type IntakeSuggestedNeed = {
  key: IntakeNeedKey;
  value: boolean | number;
  reason: string;
  confidence: number;
};

export type EventIntake = {
  eventType: string;
  expectedGuests: number;
  datePreference?: string;
  setupHours?: number;
  teardownHours?: number;
  needs: EventIntakeNeeds;
  missingFields: string[];
  confidence: number;
  fieldConfidence: Record<string, number>;
  clarifyingQuestions: string[];
  suggestedNeeds: IntakeSuggestedNeed[];
  thinkingLevel: "lite" | "high";
};

const needShape = Object.fromEntries(
  INTAKE_NEED_FIELDS.map((field) => [
    field.key,
    field.kind === "boolean"
      ? z.boolean().default(field.defaultValue as boolean)
      : z.coerce.number().int().nonnegative().default(field.defaultValue as number),
  ]),
) as unknown as Record<IntakeNeedKey, z.ZodTypeAny>;

export const eventIntakeNeedsSchema = z.object(needShape) as z.ZodObject<Record<IntakeNeedKey, z.ZodTypeAny>>;

export const eventIntakeSchema = z.object({
  eventType: z.string().min(1),
  expectedGuests: z.coerce.number().int().nonnegative(),
  datePreference: z.string().trim().min(1).optional(),
  setupHours: z.coerce.number().nonnegative().optional(),
  teardownHours: z.coerce.number().nonnegative().optional(),
  needs: eventIntakeNeedsSchema,
  missingFields: z.array(z.string()).default([]),
  confidence: z.coerce.number().min(0).max(1).default(0.75),
  fieldConfidence: z.record(z.string(), z.coerce.number().min(0).max(1)).default({}),
  clarifyingQuestions: z.array(z.string()).default([]),
  suggestedNeeds: z
    .array(
      z.object({
        key: z.enum(INTAKE_NEED_FIELDS.map((field) => field.key) as [IntakeNeedKey, ...IntakeNeedKey[]]),
        value: z.union([z.boolean(), z.coerce.number().int().nonnegative()]),
        reason: z.string(),
        confidence: z.coerce.number().min(0).max(1),
      }),
    )
    .default([]),
  thinkingLevel: z.enum(["lite", "high"]).default("lite"),
});

export function defaultNeeds(): EventIntakeNeeds {
  return Object.fromEntries(INTAKE_NEED_FIELDS.map((field) => [field.key, field.defaultValue])) as EventIntakeNeeds;
}

export function eventTypeToPrisma(eventType: string): EventType {
  return EVENT_TYPE_OPTIONS.find((type) => type.id === eventType)?.value ?? EventType.OTHER;
}

export function normalizeEventType(value: string | undefined): string {
  if (!value) return "other";
  const normalized = value.toLowerCase().trim();
  return EVENT_TYPE_IDS.includes(normalized) ? normalized : "other";
}

export function normalizeIntake(input: unknown): EventIntake {
  const parsed = eventIntakeSchema.parse(withLegacyNeeds(input));
  const missing = new Set(parsed.missingFields);
  const clarifyingQuestions = [...parsed.clarifyingQuestions];
  const suggestions = [...parsed.suggestedNeeds];
  const needs = parsed.needs as EventIntakeNeeds;

  if (!EVENT_TYPE_IDS.includes(parsed.eventType)) missing.add("event type");
  if (parsed.expectedGuests <= 0) missing.add("expected guest count");
  if (!parsed.datePreference) missing.add("date preference");
  if (!parsed.setupHours) missing.add("setup window");
  if (!parsed.teardownHours) missing.add("teardown window");

  if (parsed.expectedGuests >= 150) {
    if (!needs.registrationDesk) {
      suggestions.push({
        key: "registrationDesk",
        value: true,
        reason: "Large guest counts usually need a controlled arrival point.",
        confidence: 0.82,
      });
    }
    if (!needs.coffeeArea) {
      suggestions.push({
        key: "coffeeArea",
        value: true,
        reason: "Large all-hands formats commonly need a coffee or networking area.",
        confidence: 0.78,
      });
    }
  }

  if (parsed.expectedGuests > 0 && Number(needs.chairs ?? 0) === 0 && needs.mainStage) {
    needs.chairs = parsed.expectedGuests;
    suggestions.push({
      key: "chairs",
      value: parsed.expectedGuests,
      reason: "A staged seated session strongly implies one chair per guest.",
      confidence: 0.86,
    });
  }

  if (missing.size > 0 && clarifyingQuestions.length === 0) {
    const top = Array.from(missing).slice(0, 3);
    clarifyingQuestions.push(...top.map((field) => `Can you confirm the ${field}?`));
  }

  const confidence = Math.min(parsed.confidence, missing.size > 0 ? 0.84 : 1);

  return {
    ...parsed,
    eventType: normalizeEventType(parsed.eventType),
    needs,
    missingFields: Array.from(missing),
    clarifyingQuestions: clarifyingQuestions.slice(0, 3),
    suggestedNeeds: dedupeSuggestedNeeds(suggestions).slice(0, 6),
    confidence,
    thinkingLevel: confidence < 0.72 || missing.size >= 3 ? "high" : parsed.thinkingLevel,
  };
}

function withLegacyNeeds(input: unknown): unknown {
  if (!input || typeof input !== "object" || "needs" in input) return input;
  const record = input as Record<string, unknown>;
  return {
    ...record,
    confidence: record.confidence ?? 0.75,
    fieldConfidence: record.fieldConfidence ?? {},
    clarifyingQuestions: record.clarifyingQuestions ?? [],
    suggestedNeeds: record.suggestedNeeds ?? [],
    thinkingLevel: record.thinkingLevel ?? "lite",
    needs: Object.fromEntries(INTAKE_NEED_FIELDS.map((field) => [field.key, record[field.key] ?? field.defaultValue])),
  };
}

function dedupeSuggestedNeeds(suggestions: IntakeSuggestedNeed[]): IntakeSuggestedNeed[] {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    const id = `${suggestion.key}:${String(suggestion.value)}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function intakeToRequirementRows(intake: EventIntake): Array<{ key: string; valueJson: Prisma.InputJsonValue; source: string }> {
  const rows: Array<{ key: string; valueJson: Prisma.InputJsonValue; source: string }> = [
    { key: "expectedGuests", valueJson: intake.expectedGuests, source: "staff" },
    { key: "datePreference", valueJson: intake.datePreference ?? "", source: "staff" },
    { key: "setupHours", valueJson: intake.setupHours ?? 0, source: "staff" },
    { key: "teardownHours", valueJson: intake.teardownHours ?? 0, source: "staff" },
  ];

  for (const field of INTAKE_NEED_FIELDS) {
    rows.push({
      key: field.key,
      valueJson: intake.needs[field.key] as Prisma.InputJsonValue,
      source: "staff",
    });
  }

  if (intake.missingFields.length > 0) {
    rows.push({ key: "missingFields", valueJson: intake.missingFields, source: "staff" });
  }

  return rows;
}
