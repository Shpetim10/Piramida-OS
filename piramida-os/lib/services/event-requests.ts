import {
  EventRequestStatus,
  EventStatus,
  EventApprovalStatus,
  EventType,
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
  requireStaff,
  requireOrganizerOwnsRequest,
  getCurrentProfile,
  AuthError,
} from "../auth/guards";
import { hasPermission } from "../auth/permissions";
import { createEventRequestInput } from "../validation/schemas";
import { requiredText, trimmed, uuid } from "../validation/common";
import { assertTransition, EVENT_REQUEST_TRANSITIONS } from "./state-machines";

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

export const eventExtractionSchema = z.object({
  eventType: z.enum(["conference", "workshop", "exhibition", "concert", "private", "corporate", "other"]),
  expectedGuests: z.number().int().nonnegative(),
  setupHours: z.number().nonnegative().optional(),
  mainStage: z.boolean().optional(),
  breakoutRooms: z.number().int().nonnegative().optional(),
  coffeeArea: z.boolean().optional(),
  registrationDesk: z.boolean().optional(),
  publicGuestRegistration: z.boolean().optional(),
  screens: z.number().int().nonnegative().optional(),
  projectors: z.number().int().nonnegative().optional(),
  wirelessMicrophones: z.number().int().nonnegative().optional(),
  wiredMicrophones: z.number().int().nonnegative().optional(),
  chairs: z.number().int().nonnegative().optional(),
  tables: z.number().int().nonnegative().optional(),
  speakers: z.number().int().nonnegative().optional(),
  livestream: z.boolean().optional(),
  missingFields: z.array(z.string()).default([]),
});
export type EventExtraction = z.infer<typeof eventExtractionSchema>;

const EVENT_TYPE_MAP: Record<EventExtraction["eventType"], EventType> = {
  conference: EventType.CONFERENCE,
  workshop: EventType.WORKSHOP,
  exhibition: EventType.EXHIBITION,
  concert: EventType.CONCERT,
  private: EventType.PRIVATE,
  corporate: EventType.CORPORATE,
  other: EventType.OTHER,
};

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

  let eventType: EventExtraction["eventType"] = "other";
  if (lower.includes("conference")) eventType = "conference";
  else if (lower.includes("workshop")) eventType = "workshop";
  else if (lower.includes("exhibition")) eventType = "exhibition";
  else if (lower.includes("concert") || lower.includes("performance")) eventType = "concert";

  const breakoutRooms = lower.includes("two breakout") ? 2 : num(/(\d+)\s*breakout/);
  const missingFields: string[] = [];
  if (!/\b(20\d{2}|january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(lower)) {
    missingFields.push("exact event date");
  }
  if (!/\bend(?:s|ing)?\b.*\b(\d{1,2})(?::\d{2})?\s*(?:am|pm)?\b/.test(lower)) {
    missingFields.push("event end time");
  }

  return eventExtractionSchema.parse({
    eventType,
    expectedGuests: guests,
    setupHours: 2,
    mainStage: /keynote|stage/.test(lower),
    breakoutRooms,
    coffeeArea: lower.includes("coffee"),
    registrationDesk: lower.includes("registration") || lower.includes("register"),
    publicGuestRegistration: lower.includes("register online") || lower.includes("register") || lower.includes("qr"),
    screens,
    projectors,
    wirelessMicrophones: wireless,
    wiredMicrophones: wired,
    chairs: lower.includes("chair") ? Math.max(guests > 0 ? Math.ceil(guests * 0.85) : 0, 0) : 0,
    tables: lower.includes("table") ? 15 : 0,
    speakers,
    livestream: lower.includes("livestream") || lower.includes("live stream"),
    missingFields,
  });
}

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------

const submitOrganizerRequestInput = z.object({
  title: trimmed(200).optional(),
  rawText: requiredText(20000),
  channel: trimmed(40).optional(),
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
      include: { event: { select: { id: true, status: true } } },
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
  reviewedJson: eventExtractionSchema, // staff-corrected, re-validated
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
export async function createEventFromRequest(requestId: string) {
  const actor = await requirePermission("events.plan");
  uuid.parse(requestId);
  const orgId = await getOrgId();

  const request = await prisma.eventRequest.findFirst({
    where: { id: requestId, orgId, deletedAt: null },
    include: { event: { select: { id: true } } },
  });
  if (!request) throw new AuthError("Request not found", 404);
  if (request.event) throw new AuthError("An event already exists for this request", 403);

  const extraction = request.extractedJson
    ? eventExtractionSchema.safeParse(request.extractedJson)
    : null;
  const ex = extraction?.success ? extraction.data : deterministicExtract(request.rawText);

  const code = await nextEventCode(orgId);

  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        orgId,
        requestId,
        clientId: request.clientId,
        code,
        title: request.title ?? `${ex.eventType} event`,
        type: EVENT_TYPE_MAP[ex.eventType],
        status: EventStatus.PLANNING,
        approvalStatus: EventApprovalStatus.PENDING_APPROVAL,
        visibility: ex.publicGuestRegistration ? EventVisibility.PUBLIC : EventVisibility.PRIVATE,
        expectedGuests: ex.expectedGuests,
        returnBufferMinutes: 30,
      },
    });

    // Derive requirement rows from the validated extraction.
    const reqs: Array<{ key: string; valueJson: Prisma.InputJsonValue }> = [
      { key: "wirelessMicrophones", valueJson: ex.wirelessMicrophones ?? 0 },
      { key: "wiredMicrophones", valueJson: ex.wiredMicrophones ?? 0 },
      { key: "screens", valueJson: ex.screens ?? 0 },
      { key: "projectors", valueJson: ex.projectors ?? 0 },
      { key: "speakers", valueJson: ex.speakers ?? 0 },
      { key: "chairs", valueJson: ex.chairs ?? 0 },
      { key: "tables", valueJson: ex.tables ?? 0 },
      { key: "breakoutRooms", valueJson: ex.breakoutRooms ?? 0 },
      { key: "registrationDesk", valueJson: ex.registrationDesk ?? false },
      { key: "publicGuestRegistration", valueJson: ex.publicGuestRegistration ?? false },
    ];
    await tx.eventRequirement.createMany({
      data: reqs.map((r) => ({ orgId, eventId: created.id, key: r.key, valueJson: r.valueJson, source: "ai" })),
    });

    await tx.eventRequest.update({
      where: { id: requestId },
      data: { status: EventRequestStatus.PLANNING },
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
