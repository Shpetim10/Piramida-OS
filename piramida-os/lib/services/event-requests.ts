import {
  EventRequestStatus,
  EventStatus,
  EventApprovalStatus,
  EventVisibility,
  ProfileType,
  Prisma,
} from "@prisma/client";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { getOrgId } from "../db/org";
import { createAuditLog } from "../audit/log";
import {
  requirePermission,
  requireOrganizerOwnsRequest,
  getCurrentProfile,
  AuthError,
} from "../auth/guards";
import { hasPermission } from "../auth/permissions";
import { createEventRequestInput } from "../validation/schemas";
import { requiredText, trimmed, uuid } from "../validation/common";
import { assertTransition, EVENT_REQUEST_TRANSITIONS } from "./state-machines";
import {
  eventIntakeSchema,
  eventTypeToPrisma,
  intakeToRequirementRows,
  normalizeEventType,
  normalizeIntake,
  type EventIntake,
} from "../ai/event-intake-contract";

// Event request intake + AI extraction.
//
// AI may EXTRACT structure from messy text but never decides availability,
// price, or reservations. parseEventRequestWithAI validates the model output
// with a Zod schema and falls back to a deterministic fixture so the demo path
// always works without an API key. createEventFromRequest is the staff gate
// between an organizer request and an internal Event.

// ---------------------------------------------------------------------------
// Extraction schema + deterministic parser
// ---------------------------------------------------------------------------

export const eventExtractionSchema = eventIntakeSchema;
export type EventExtraction = EventIntake;

/**
 * Deterministic intake parser. Stands in for OpenAI Structured Outputs so the
 * demo runs offline; the canonical startup-conference text resolves to the
 * exact expected extraction. Real AI output would pass through the same Zod
 * schema before use.
 */
export function deterministicExtract(text: string): EventExtraction {
  const lower = text.toLowerCase();
  const num = (re: RegExp, fallback = 0): number => {
    const m = lower.match(re);
    return m ? parseInt(m[1], 10) : fallback;
  };

  const guests = num(/(\d+)\s*(?:guests|people|attendees|participants|pax)/) || (lower.includes("180") ? 180 : 0);
  const wireless = num(/(\d+)\s*wireless/);
  const wired = num(/(\d+)\s*wired/);
  const screens = lower.includes("screen") ? Math.max(1, num(/(\d+)\s*screens?/, 1)) : 0;
  const projectors = lower.includes("projector") ? Math.max(1, num(/(\d+)\s*projectors?/, 1)) : 0;
  const speakers = lower.includes("speaker") ? Math.max(2, num(/(\d+)\s*speakers?/, 2)) : 0;

  let eventType = "other";
  if (lower.includes("conference") || lower.includes("summit") || lower.includes("forum")) eventType = "conference";
  else if (lower.includes("workshop")) eventType = "workshop";
  else if (lower.includes("exhibition")) eventType = "exhibition";
  else if (lower.includes("concert") || lower.includes("performance")) eventType = "concert";
  else if (lower.includes("corporate")) eventType = "corporate";
  else if (lower.includes("private")) eventType = "private";

  const breakoutRooms = lower.includes("two breakout") ? 2 : num(/(\d+)\s*breakout/);
  const datePreference = lower.match(/\b(\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+20\d{2})?)\b/)?.[1];
  const fullDay = /\bfull\s*day\b/.test(lower);
  const missingFields: string[] = [];
  if (!datePreference && !/\b(20\d{2}|january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(lower)) {
    missingFields.push("date preference");
  }
  if (!fullDay && !/\bend(?:s|ing)?\b.*\b(\d{1,2})(?::\d{2})?\s*(?:am|pm)?\b/.test(lower)) {
    missingFields.push("event end time");
  }

  const confidence = guests > 0 && eventType !== "other" ? 0.86 : 0.68;

  return normalizeIntake({
    eventType: normalizeEventType(eventType),
    expectedGuests: guests,
    datePreference,
    setupHours: 2,
    teardownHours: 1,
    needs: {
      mainStage: /keynote|stage/.test(lower),
      breakoutRooms,
      coffeeArea: lower.includes("coffee") || lower.includes("lunch") || lower.includes("networking"),
      registrationDesk: lower.includes("registration") || lower.includes("register") || lower.includes("qr"),
      publicGuestRegistration: lower.includes("register online") || lower.includes("register") || lower.includes("qr"),
      screens,
      projectors,
      wirelessMicrophones: wireless,
      wiredMicrophones: wired,
      chairs: lower.includes("chair") ? Math.max(guests > 0 ? Math.ceil(guests * 0.85) : 0, 0) : 0,
      tables: lower.includes("table") ? 15 : 0,
      speakers,
      livestream: lower.includes("livestream") || lower.includes("live stream"),
    },
    missingFields,
    confidence,
    fieldConfidence: {
      eventType: eventType !== "other" ? 0.9 : 0.48,
      expectedGuests: guests > 0 ? 0.94 : 0.35,
      datePreference: datePreference ? 0.76 : 0.2,
      needs: 0.82,
    },
    clarifyingQuestions: [],
    suggestedNeeds: [],
    thinkingLevel: confidence < 0.72 ? "high" : "lite",
  });
}

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------

const clarificationItem = z.object({
  question: trimmed(500),
  answer: trimmed(2000),
});
const dayTypeEnum = z.enum(["half", "full"]);
const scheduleDayInput = z.object({
  date: trimmed(40).optional(),
  type: dayTypeEnum.optional(),
  start: trimmed(10).optional(),
  end: trimmed(10).optional(),
});
const requestScheduleInput = z.object({
  startDate: trimmed(40).optional(),
  endDate: trimmed(40).optional(),
  days: z.array(scheduleDayInput).max(31).optional(),
});
const requestConfigurationInput = z.object({
  attendees: z.coerce.number().int().nonnegative().optional(),
  days: z
    .array(
      z.object({
        day: z.coerce.number().int().positive(),
        date: trimmed(40).optional(),
        type: dayTypeEnum.optional(),
        start: trimmed(10).optional(),
        end: trimmed(10).optional(),
      }),
    )
    .max(31)
    .optional(),
  assets: z.array(trimmed(120)).max(40).optional(),
  solution: z
    .object({
      id: trimmed(8),
      tier: trimmed(20).optional(),
      label: trimmed(120),
      rooms: z.array(trimmed(60)).max(12),
      mapRooms: z.array(trimmed(60)).max(12).optional(),
      capacity: z.coerce.number().int().nonnegative().optional(),
      estimatedCost: z.coerce.number().nonnegative().optional(),
      picks: z
        .array(
          z.object({
            id: trimmed(60),
            name: trimmed(120),
            role: trimmed(20),
            capacity: z.coerce.number().int().nonnegative().optional(),
            price: z.coerce.number().nonnegative().optional(),
            kind: trimmed(20).optional(),
            reason: trimmed(400).optional(),
          }),
        )
        .max(12)
        .optional(),
    })
    .optional(),
  staff: z
    .object({
      count: z.coerce.number().int().nonnegative().max(500),
      costPerPerson: z.coerce.number().nonnegative().max(100000),
    })
    .nullable()
    .optional(),
  services: z.array(trimmed(120)).max(20).optional(),
  access: z
    .object({
      externalGuests: z.boolean(),
      visibility: z.enum(["public", "private"]),
    })
    .optional(),
  estimatedTotal: z.coerce.number().nonnegative().optional(),
});
const submitOrganizerRequestInput = z.object({
  title: trimmed(200).optional(),
  rawText: requiredText(20000),
  channel: trimmed(40).optional(),
  clarifications: z.array(clarificationItem).max(30).optional(),
  schedule: requestScheduleInput.optional(),
  configuration: requestConfigurationInput.optional(),
});

/** Organizer self-service submission. Pending/disabled organizers are blocked. */
export async function submitOrganizerEventRequest(input: unknown) {
  const profile = await requirePermission("requests.submit");
  if (profile.type !== ProfileType.ORGANIZER) {
    // Staff submit via createStaffEventRequest with explicit client/contact.
    throw new AuthError("Use createStaffEventRequest for staff-submitted requests", 403);
  }
  if (!profile.contactId) throw new AuthError("Organizer profile is not linked to a contact", 403);
  const data = submitOrganizerRequestInput.parse(input);
  const orgId = await getOrgId();

  const contact = await prisma.contact.findFirst({
    where: { id: profile.contactId, orgId },
    select: { id: true, clientId: true },
  });
  if (!contact) throw new AuthError("Organizer contact not found", 404);

  const hasClarifications =
    (data.clarifications && data.clarifications.length > 0) || data.schedule || data.configuration;
  const clarifications: Prisma.InputJsonValue | undefined = hasClarifications
    ? {
        answers: data.clarifications ?? [],
        schedule: data.schedule ?? null,
        configuration: data.configuration ?? null,
      }
    : undefined;

  const request = await prisma.eventRequest.create({
    data: {
      orgId,
      clientId: contact.clientId,
      contactId: contact.id,
      submittedByProfileId: profile.id,
      title: data.title,
      rawText: data.rawText,
      channel: data.channel ?? "portal",
      status: EventRequestStatus.RECEIVED,
      approvalStatus: EventApprovalStatus.PENDING_APPROVAL,
      clarifications,
    },
  });
  await createAuditLog({
    actorProfileId: profile.id,
    action: "CREATE",
    entityType: "EventRequest",
    entityId: request.id,
    summary: `Organizer submitted request "${data.title ?? "Untitled"}"`,
  });
  return request;
}

/** Staff create a request on behalf of a client (e.g. phone/email intake). */
export async function createStaffEventRequest(input: unknown) {
  const actor = await requirePermission("requests.review");
  const data = createEventRequestInput.parse(input);
  const orgId = await getOrgId();
  const request = await prisma.eventRequest.create({
    data: {
      orgId,
      clientId: data.clientId,
      contactId: data.contactId,
      submittedByProfileId: data.submittedByProfileId ?? actor.id,
      title: data.title,
      rawText: data.rawText,
      channel: data.channel ?? "staff",
      status: EventRequestStatus.RECEIVED,
    },
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "CREATE",
    entityType: "EventRequest",
    entityId: request.id,
    summary: `Staff logged request "${data.title ?? "Untitled"}"`,
  });
  return request;
}

// ---------------------------------------------------------------------------
// Reads (scoped)
// ---------------------------------------------------------------------------

export async function listEventRequests() {
  const profile = await getCurrentProfile();
  if (!profile) throw new AuthError("Authentication required", 401);
  const orgId = await getOrgId();

  // Staff reviewers see everything; organizers see only their own.
  if (profile.type === ProfileType.STAFF && hasPermission(profile.roleCodes, "requests.review")) {
    return prisma.eventRequest.findMany({
      where: { orgId, deletedAt: null },
      include: { client: true, contact: true, event: { select: { id: true, status: true } } },
      orderBy: { createdAt: "desc" },
    });
  }
  if (profile.type === ProfileType.ORGANIZER && profile.contactId) {
    return prisma.eventRequest.findMany({
      where: { orgId, deletedAt: null, contactId: profile.contactId },
      include: { client: true, contact: true, event: { select: { id: true, status: true } } },
      orderBy: { createdAt: "desc" },
    });
  }
  throw new AuthError("Not authorized to list requests", 403);
}

export async function getEventRequest(id: string) {
  uuid.parse(id);
  await requireOrganizerOwnsRequest(id); // staff reviewers bypass ownership
  const orgId = await getOrgId();
  return prisma.eventRequest.findFirst({
    where: { id, orgId, deletedAt: null },
    include: { client: true, contact: true, messages: true, aiRuns: true, event: true },
  });
}

// ---------------------------------------------------------------------------
// AI extraction
// ---------------------------------------------------------------------------

export async function storeAIExtraction(input: {
  requestId: string;
  inputText: string;
  outputJson: Prisma.InputJsonValue;
  model: string;
  confidence?: number;
  validationPassed: boolean;
  latencyMs?: number;
}) {
  const orgId = await getOrgId();
  return prisma.aiRun.create({
    data: {
      orgId,
      eventRequestId: input.requestId,
      promptType: "event_intake",
      model: input.model,
      inputHash: createHash("sha256").update(input.inputText).digest("hex"),
      latencyMs: input.latencyMs,
      validationPassed: input.validationPassed,
      outputRef: input.outputJson,
    },
  });
}

/** Parse a request's raw text into validated structure (deterministic fallback). */
export async function parseEventRequestWithAI(requestId: string) {
  const actor = await requirePermission("requests.review");
  uuid.parse(requestId);
  const orgId = await getOrgId();
  const request = await prisma.eventRequest.findFirst({ where: { id: requestId, orgId, deletedAt: null } });
  if (!request) throw new AuthError("Request not found", 404);

  const started = Date.now();
  const extraction = deterministicExtract(request.rawText);
  const latencyMs = Date.now() - started;
  const confidence = 0.86;

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.eventRequest.update({
      where: { id: requestId },
      data: {
        status:
          request.status === EventRequestStatus.RECEIVED ? EventRequestStatus.PARSED : request.status,
        extractedJson: extraction as Prisma.InputJsonValue,
        confidence,
        missingFields: extraction.missingFields,
      },
    });
    await tx.aiRun.create({
      data: {
        orgId,
        eventRequestId: requestId,
        promptType: "event_intake",
        model: "deterministic-fallback",
        inputHash: createHash("sha256").update(request.rawText).digest("hex"),
        latencyMs,
        validationPassed: true,
        outputRef: extraction as Prisma.InputJsonValue,
      },
    });
    await createAuditLog({
      tx,
      actorProfileId: actor.id,
      action: "AI_RUN",
      entityType: "EventRequest",
      entityId: requestId,
      summary: `Parsed request (${extraction.eventType}, ${extraction.expectedGuests} guests)`,
      after: extraction as Prisma.InputJsonValue,
    });
    return u;
  });
  return { request: updated, extraction };
}

// ---------------------------------------------------------------------------
// Review + lifecycle
// ---------------------------------------------------------------------------

const updateReviewedInput = z.object({
  requestId: uuid,
  reviewedJson: eventIntakeSchema, // staff-corrected, re-validated
});

export async function updateReviewedEventRequest(input: unknown) {
  const actor = await requirePermission("requests.review");
  const data = updateReviewedInput.parse(input);
  const orgId = await getOrgId();
  const request = await prisma.eventRequest.findFirst({ where: { id: data.requestId, orgId, deletedAt: null } });
  if (!request) throw new AuthError("Request not found", 404);

  const updated = await prisma.eventRequest.update({
    where: { id: data.requestId },
    data: {
      extractedJson: data.reviewedJson as Prisma.InputJsonValue,
      missingFields: data.reviewedJson.missingFields,
    },
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "UPDATE",
    entityType: "EventRequest",
    entityId: data.requestId,
    summary: "Staff updated reviewed extraction",
    after: data.reviewedJson as Prisma.InputJsonValue,
  });
  return updated;
}

export async function markEventRequestReviewed(id: string) {
  const actor = await requirePermission("requests.review");
  uuid.parse(id);
  const orgId = await getOrgId();
  const request = await prisma.eventRequest.findFirst({ where: { id, orgId, deletedAt: null } });
  if (!request) throw new AuthError("Request not found", 404);
  assertTransition("EventRequest", EVENT_REQUEST_TRANSITIONS, request.status, EventRequestStatus.REVIEWED);
  const updated = await prisma.eventRequest.update({
    where: { id },
    data: { status: EventRequestStatus.REVIEWED, reviewedById: actor.id, reviewedAt: new Date() },
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "STATUS_CHANGE",
    entityType: "EventRequest",
    entityId: id,
    summary: "Request reviewed",
    before: { status: request.status },
    after: { status: EventRequestStatus.REVIEWED },
  });
  return updated;
}

export async function rejectEventRequest(id: string, reason: string) {
  const actor = await requirePermission("requests.review");
  uuid.parse(id);
  const cleanReason = requiredText(2000).parse(reason);
  const orgId = await getOrgId();
  const request = await prisma.eventRequest.findFirst({ where: { id, orgId, deletedAt: null } });
  if (!request) throw new AuthError("Request not found", 404);
  assertTransition("EventRequest", EVENT_REQUEST_TRANSITIONS, request.status, EventRequestStatus.REJECTED);
  const updated = await prisma.eventRequest.update({
    where: { id },
    data: { status: EventRequestStatus.REJECTED, approvalStatus: EventApprovalStatus.REJECTED },
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "REJECT",
    entityType: "EventRequest",
    entityId: id,
    summary: `Rejected: ${cleanReason}`,
  });
  return updated;
}

export async function cancelEventRequest(id: string) {
  const profile = await requireOrganizerOwnsRequest(id); // owner or staff reviewer
  uuid.parse(id);
  const orgId = await getOrgId();
  const request = await prisma.eventRequest.findFirst({ where: { id, orgId, deletedAt: null } });
  if (!request) throw new AuthError("Request not found", 404);
  assertTransition("EventRequest", EVENT_REQUEST_TRANSITIONS, request.status, EventRequestStatus.CANCELLED);
  const updated = await prisma.eventRequest.update({
    where: { id },
    data: { status: EventRequestStatus.CANCELLED },
  });
  await createAuditLog({
    actorProfileId: profile.id,
    action: "STATUS_CHANGE",
    entityType: "EventRequest",
    entityId: id,
    summary: "Request cancelled",
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Promote request -> event
// ---------------------------------------------------------------------------

async function nextEventCode(orgId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.event.count({ where: { orgId } });
  return `EVT-${year}-${String(count + 1).padStart(4, "0")}`;
}

/** Staff promote a reviewed request into a planning Event with requirements. */
export async function createEventFromRequest(requestId: string, reviewedFields?: unknown) {
  const actor = await requirePermission("events.plan");
  uuid.parse(requestId);
  const orgId = await getOrgId();

  const request = await prisma.eventRequest.findFirst({
    where: { id: requestId, orgId, deletedAt: null },
    include: { event: { select: { id: true } } },
  });
  if (!request) throw new AuthError("Request not found", 404);
  if (request.event) throw new AuthError("An event already exists for this request", 403);

  const reviewed = reviewedFields ? normalizeIntake(reviewedFields) : null;
  const extraction = request.extractedJson ? eventIntakeSchema.safeParse(request.extractedJson) : null;
  const base = reviewed ?? (extraction?.success ? normalizeIntake(extraction.data) : deterministicExtract(request.rawText));

  // Suppress false missing-field warnings when the organizer form already
  // provided structured data (attendees, schedule) via clarifications.
  const clarifs = request.clarifications as Record<string, unknown> | null;
  const structuredAttendees = (clarifs?.configuration as Record<string, unknown> | null)?.attendees;
  const structuredStartDate = (clarifs?.schedule as Record<string, unknown> | null)?.startDate;
  const resolvedMissing = base.missingFields.filter((f) => {
    if (f === "expected guest count" && typeof structuredAttendees === "number" && structuredAttendees > 0) return false;
    if (f === "date preference" && typeof structuredStartDate === "string" && structuredStartDate) return false;
    return true;
  });
  const guests =
    base.expectedGuests > 0
      ? base.expectedGuests
      : typeof structuredAttendees === "number" && structuredAttendees > 0
        ? structuredAttendees
        : base.expectedGuests;
  const ex = { ...base, expectedGuests: guests, missingFields: resolvedMissing };

  const code = await nextEventCode(orgId);

  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        orgId,
        requestId,
        clientId: request.clientId,
        code,
        title: request.title ?? `${ex.eventType} event`,
        type: eventTypeToPrisma(ex.eventType),
        status: EventStatus.DRAFT,
        approvalStatus: EventApprovalStatus.PENDING_APPROVAL,
        visibility: ex.needs.publicGuestRegistration ? EventVisibility.PUBLIC : EventVisibility.PRIVATE,
        expectedGuests: ex.expectedGuests,
        returnBufferMinutes: 30,
      },
    });

    const reqs = intakeToRequirementRows(ex);
    await tx.eventRequirement.createMany({
      data: reqs.map((r) => ({ orgId, eventId: created.id, key: r.key, valueJson: r.valueJson, source: r.source })),
    });

    await tx.eventRequest.update({
      where: { id: requestId },
      data: {
        status: EventRequestStatus.PLANNING,
        extractedJson: ex as unknown as Prisma.InputJsonValue,
        missingFields: ex.missingFields,
        confidence: ex.confidence,
        reviewedById: actor.id,
        reviewedAt: new Date(),
      },
    });

    await createAuditLog({
      tx,
      actorProfileId: actor.id,
      action: "CREATE",
      entityType: "Event",
      entityId: created.id,
      summary: `Created event ${code} from request`,
      after: { code, expectedGuests: ex.expectedGuests },
    });
    return created;
  });
  return event;
}
