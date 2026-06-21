// Organizer-facing event management service.
// All operations are scoped to the organizer's own client — never another client's data.
// Extra costs from detail changes are captured as SUPPLEMENT quotes.
// Plan version snapshots are created on every edit for audit history (view only, no revert).

import {
  QuoteType,
  QuoteStatus,
  GuestTicketStatus,
  GuestCheckinStatus,
  ProposalStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getOrgId } from "@/lib/db/org";
import { AuthError } from "@/lib/auth/guards";
import { getOrganizerContext, type OrganizerContext } from "./portal-data";
import { createAuditLog } from "@/lib/audit/log";

// Statuses where the organizer is allowed to edit their event details.
const EDITABLE_STATUSES = ["CONFIRMED", "PUBLISHED", "LAUNCH_READY", "LIVE"] as const;

function isEditable(status: string): boolean {
  return (EDITABLE_STATUSES as readonly string[]).includes(status);
}

// ============================================================================
// Internal fetch helpers
// ============================================================================

type FetchedEvent = NonNullable<Awaited<ReturnType<typeof fetchEvent>>>;

async function fetchEvent(eventId: string, orgId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, orgId, deletedAt: null },
    include: {
      publication: {
        select: {
          id: true,
          slug: true,
          status: true,
          publicTitle: true,
          publicDescription: true,
          publicStart: true,
          publicEnd: true,
          registrationOpen: true,
          capacityPublic: true,
        },
      },
      quotes: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          quoteType: true,
          status: true,
          subtotal: true,
          taxTotal: true,
          total: true,
          currency: true,
          notes: true,
          version: true,
          createdAt: true,
          items: { select: { id: true, label: true, quantity: true, unitPrice: true, lineTotal: true } },
        },
      },
    },
  });
}

// ============================================================================
// Guard: verify the signed-in organizer owns this event
// ============================================================================

export interface OrganizerEventContext {
  ctx: OrganizerContext;
  event: FetchedEvent;
}

export async function requireOrganizerEvent(eventId: string): Promise<OrganizerEventContext> {
  const ctx = await getOrganizerContext();
  if (!ctx) throw new AuthError("Not signed in as an organizer", 401);
  if (!ctx.clientId) throw new AuthError("Your account is not linked to a client", 403);

  const orgId = await getOrgId();
  const event = await fetchEvent(eventId, orgId);
  if (!event) throw new AuthError("Event not found", 404);
  if (event.clientId !== ctx.clientId) throw new AuthError("Not authorized for this event", 403);

  return { ctx, event };
}

// ============================================================================
// Event detail — read
// ============================================================================

export interface OrganizerEventDetail {
  id: string;
  title: string;
  type: string;
  status: string;
  visibility: string;
  expectedGuests: number | null;
  eventStart: string | null;
  eventEnd: string | null;
  summary: string | null;
  editable: boolean;
  isPublic: boolean;
  publication: {
    id: string;
    slug: string;
    status: string;
    publicTitle: string;
    publicDescription: string | null;
    publicStart: string | null;
    publicEnd: string | null;
    registrationOpen: boolean;
    capacityPublic: number | null;
  } | null;
}

export function mapEventDetail(event: FetchedEvent): OrganizerEventDetail {
  return {
    id: event.id,
    title: event.title,
    type: event.type,
    status: event.status,
    visibility: event.visibility,
    expectedGuests: event.expectedGuests,
    eventStart: event.eventStart?.toISOString() ?? null,
    eventEnd: event.eventEnd?.toISOString() ?? null,
    summary: event.summary,
    editable: isEditable(event.status),
    isPublic: event.visibility === "PUBLIC",
    publication: event.publication
      ? {
          id: event.publication.id,
          slug: event.publication.slug,
          status: event.publication.status,
          publicTitle: event.publication.publicTitle,
          publicDescription: event.publication.publicDescription ?? null,
          publicStart: event.publication.publicStart?.toISOString() ?? null,
          publicEnd: event.publication.publicEnd?.toISOString() ?? null,
          registrationOpen: event.publication.registrationOpen,
          capacityPublic: event.publication.capacityPublic ?? null,
        }
      : null,
  };
}

// ============================================================================
// Event status change (organizer-initiated: cancel only)
// ============================================================================

// Statuses from which an organizer can cancel their event.
const CANCELLABLE_STATUSES = ["CONFIRMED", "PUBLISHED", "LAUNCH_READY", "LIVE"] as const;

export async function cancelOrganizerEvent(
  eventId: string,
  reason?: string,
): Promise<OrganizerEventDetail> {
  const { ctx, event } = await requireOrganizerEvent(eventId);

  if (!(CANCELLABLE_STATUSES as readonly string[]).includes(event.status)) {
    throw new AuthError(
      `Event cannot be cancelled from status ${event.status}. It must be CONFIRMED, PUBLISHED, LAUNCH_READY, or LIVE.`,
      403,
    );
  }

  const orgId = await getOrgId();

  await prisma.$transaction(async (tx) => {
    await tx.event.update({
      where: { id: eventId },
      data: { status: "CANCELLED" },
    });

    await createAuditLog({
      tx,
      actorProfileId: ctx.profileId,
      action: "STATUS_CHANGE",
      entityType: "Event",
      entityId: eventId,
      summary: `Organizer ${ctx.name} cancelled event. Reason: ${reason ?? "not provided"}`,
      before: { status: event.status } as Prisma.InputJsonValue,
      after: { status: "CANCELLED" } as Prisma.InputJsonValue,
    });
  });

  const refreshed = await fetchEvent(eventId, orgId);
  if (!refreshed) throw new AuthError("Event not found after update", 404);
  return mapEventDetail(refreshed);
}

// ============================================================================
// Event detail — edit (with versioning + supplement bill)
// ============================================================================

export interface OrganizerEventEditInput {
  title?: string;
  summary?: string;
  expectedGuests?: number;
  extraCostItems?: { label: string; unitPrice: number; quantity?: number }[];
  extraCostNotes?: string;
}

export async function editOrganizerEvent(
  eventId: string,
  input: OrganizerEventEditInput,
): Promise<{ event: OrganizerEventDetail; supplementQuoteId: string | null }> {
  const { ctx, event } = await requireOrganizerEvent(eventId);

  if (!isEditable(event.status)) {
    throw new AuthError(
      `Event cannot be edited in status ${event.status}. Allowed: ${EDITABLE_STATUSES.join(", ")}`,
      403,
    );
  }

  const orgId = await getOrgId();

  const before = {
    title: event.title,
    summary: event.summary,
    expectedGuests: event.expectedGuests,
  };

  const after = {
    title: input.title ?? event.title,
    summary: input.summary ?? event.summary,
    expectedGuests: input.expectedGuests ?? event.expectedGuests,
  };

  const versionCount = await prisma.eventPlanVersion.count({ where: { eventId } });

  const { updatedEvent, supplementQuoteId } = await prisma.$transaction(async (tx) => {
    const updatedEvent = await tx.event.update({
      where: { id: eventId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.summary !== undefined && { summary: input.summary }),
        ...(input.expectedGuests !== undefined && { expectedGuests: input.expectedGuests }),
      },
    });

    await tx.eventPlanVersion.create({
      data: {
        orgId,
        eventId,
        version: versionCount + 1,
        snapshot: {
          editedBy: "organizer",
          profileId: ctx.profileId,
          before,
          after,
          editedAt: new Date().toISOString(),
        },
        reason: `Organizer edit by ${ctx.name}`,
        createdById: ctx.profileId,
      },
    });

    let supplementQuoteId: string | null = null;
    if (input.extraCostItems && input.extraCostItems.length > 0) {
      if (!ctx.clientId) throw new AuthError("No client linked", 403);

      const items = input.extraCostItems.map((item) => ({
        label: item.label,
        quantity: item.quantity ?? 1,
        unitPrice: item.unitPrice,
        lineTotal: (item.quantity ?? 1) * item.unitPrice,
      }));

      const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);

      const originalQuote = await tx.quote.findFirst({
        where: { eventId, orgId, quoteType: QuoteType.ORIGINAL, deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      const supplementQuote = await tx.quote.create({
        data: {
          orgId,
          eventId,
          clientId: ctx.clientId,
          quoteType: QuoteType.SUPPLEMENT,
          parentQuoteId: originalQuote?.id ?? null,
          status: QuoteStatus.DRAFT,
          subtotal,
          total: subtotal,
          notes:
            input.extraCostNotes ??
            `Supplement for organizer changes on ${new Date().toLocaleDateString()}`,
          items: {
            createMany: {
              data: items.map((item, idx) => ({
                orgId,
                label: item.label,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                lineTotal: item.lineTotal,
                sortOrder: idx,
              })),
            },
          },
        },
      });
      supplementQuoteId = supplementQuote.id;
    }

    await createAuditLog({
      tx,
      actorProfileId: ctx.profileId,
      action: "UPDATE",
      entityType: "Event",
      entityId: eventId,
      summary: `Organizer ${ctx.name} edited event details`,
      before: before as Prisma.InputJsonValue,
      after: after as Prisma.InputJsonValue,
    });

    return { updatedEvent, supplementQuoteId };
  });

  const refreshed = await fetchEvent(updatedEvent.id, orgId);
  if (!refreshed) throw new AuthError("Event not found after update", 404);

  return { event: mapEventDetail(refreshed), supplementQuoteId };
}

// ============================================================================
// Guests — list (only if public event with registration open)
// ============================================================================

export interface OrganizerGuestRow {
  id: string;
  fullName: string;
  email: string;
  company: string | null;
  status: string;
  ticketStatus: string | null;
  checkedIn: boolean;
  registeredAt: string;
}

export async function getOrganizerEventGuests(eventId: string): Promise<OrganizerGuestRow[]> {
  const { event } = await requireOrganizerEvent(eventId);

  if (!event.publication) {
    throw new AuthError("Event has no public publication", 403);
  }
  if (event.visibility !== "PUBLIC") {
    throw new AuthError("Guest list is only available for public events", 403);
  }

  const registrations = await prisma.guestRegistration.findMany({
    where: { publicationId: event.publication.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      ticket: {
        select: {
          status: true,
          checkins: { select: { status: true }, orderBy: { scannedAt: "desc" }, take: 1 },
        },
      },
    },
  });

  return registrations.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    email: r.email,
    company: r.company ?? null,
    status: r.status,
    ticketStatus: r.ticket?.status ?? null,
    checkedIn: r.ticket?.checkins[0]?.status === GuestCheckinStatus.CHECKED_IN,
    registeredAt: r.createdAt.toISOString(),
  }));
}

// ============================================================================
// Ticket scan (check-in for organizer's own event)
// ============================================================================

export interface TicketScanResult {
  valid: boolean;
  alreadyCheckedIn: boolean;
  guestName: string | null;
  ticketStatus: string;
  message: string;
}

export async function scanOrganizerTicket(
  eventId: string,
  token: string,
): Promise<TicketScanResult> {
  const { event } = await requireOrganizerEvent(eventId);

  if (!event.publication) {
    throw new AuthError("Event has no publication", 403);
  }

  if (!token || token.length < 20) {
    return {
      valid: false,
      alreadyCheckedIn: false,
      guestName: null,
      ticketStatus: "INVALID",
      message: "Invalid ticket token",
    };
  }

  const ticket = await prisma.guestTicket.findUnique({
    where: { token },
    include: {
      registration: {
        select: { fullName: true, publicationId: true, status: true },
      },
      checkins: { orderBy: { scannedAt: "desc" }, take: 1 },
    },
  });

  if (!ticket) {
    return {
      valid: false,
      alreadyCheckedIn: false,
      guestName: null,
      ticketStatus: "NOT_FOUND",
      message: "Ticket not found",
    };
  }

  if (ticket.registration.publicationId !== event.publication.id) {
    return {
      valid: false,
      alreadyCheckedIn: false,
      guestName: null,
      ticketStatus: "WRONG_EVENT",
      message: "Ticket is for a different event",
    };
  }

  if (ticket.status === GuestTicketStatus.CANCELLED) {
    return {
      valid: false,
      alreadyCheckedIn: false,
      guestName: ticket.registration.fullName,
      ticketStatus: "CANCELLED",
      message: "Ticket has been cancelled",
    };
  }

  const alreadyCheckedIn = ticket.checkins[0]?.status === GuestCheckinStatus.CHECKED_IN;
  if (alreadyCheckedIn) {
    return {
      valid: false,
      alreadyCheckedIn: true,
      guestName: ticket.registration.fullName,
      ticketStatus: ticket.status,
      message: "Guest already checked in",
    };
  }

  const orgId = await getOrgId();
  await prisma.$transaction(async (tx) => {
    await tx.guestCheckin.create({
      data: {
        orgId,
        ticketId: ticket.id,
        status: GuestCheckinStatus.CHECKED_IN,
        gateLabel: "Organizer scan",
      },
    });
    await tx.guestTicket.update({
      where: { id: ticket.id },
      data: { status: GuestTicketStatus.CHECKED_IN },
    });
    await tx.guestRegistration.update({
      where: { id: ticket.registrationId },
      data: { status: "CHECKED_IN" },
    });
    await createAuditLog({
      tx,
      actorProfileId: null,
      action: "CHECK_IN",
      entityType: "GuestTicket",
      entityId: ticket.id,
      summary: `Organizer check-in for ${ticket.registration.fullName}`,
    });
  });

  return {
    valid: true,
    alreadyCheckedIn: false,
    guestName: ticket.registration.fullName,
    ticketStatus: GuestTicketStatus.CHECKED_IN,
    message: `Welcome, ${ticket.registration.fullName}!`,
  };
}

// ============================================================================
// Version history — read-only
// ============================================================================

export interface EventVersionRow {
  id: string;
  version: number;
  reason: string | null;
  createdAt: string;
  snapshot: unknown;
}

export async function getOrganizerEventVersions(eventId: string): Promise<EventVersionRow[]> {
  await requireOrganizerEvent(eventId);

  const versions = await prisma.eventPlanVersion.findMany({
    where: { eventId },
    orderBy: { version: "desc" },
    select: { id: true, version: true, reason: true, createdAt: true, snapshot: true },
  });

  return versions.map((v) => ({
    id: v.id,
    version: v.version,
    reason: v.reason,
    createdAt: v.createdAt.toISOString(),
    snapshot: v.snapshot,
  }));
}

// ============================================================================
// Bills — original + supplement quotes
// ============================================================================

export interface OrganizerQuoteRow {
  id: string;
  type: string;
  status: string;
  subtotal: string;
  total: string;
  currency: string;
  notes: string | null;
  version: number;
  createdAt: string;
  items: { id: string; label: string; quantity: string; unitPrice: string; lineTotal: string }[];
}

export async function getOrganizerEventBills(eventId: string): Promise<OrganizerQuoteRow[]> {
  const { event } = await requireOrganizerEvent(eventId);

  return event.quotes.map((q) => ({
    id: q.id,
    type: q.quoteType,
    status: q.status,
    subtotal: q.subtotal.toString(),
    total: q.total.toString(),
    currency: q.currency,
    notes: q.notes,
    version: q.version,
    createdAt: q.createdAt.toISOString(),
    items: q.items.map((i) => ({
      id: i.id,
      label: i.label,
      quantity: i.quantity.toString(),
      unitPrice: i.unitPrice.toString(),
      lineTotal: i.lineTotal.toString(),
    })),
  }));
}

// ============================================================================
// Proposal — organizer read + respond
// ============================================================================

export interface OrganizerProposal {
  id: string;
  status: string;
  title: string;
  body: string;
  sentAt: string | null;
  respondedAt: string | null;
  responseNote: string | null;
  quoteTotal: string;
  quoteCurrency: string;
  quoteItems: { label: string; lineTotal: string }[];
}

export async function getOrganizerEventProposal(
  eventId: string,
): Promise<OrganizerProposal | null> {
  const { event } = await requireOrganizerEvent(eventId);

  const proposal = await prisma.proposal.findFirst({
    where: { eventId: event.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      quote: {
        include: { items: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  if (!proposal || proposal.sentAt === null) return null;

  return {
    id: proposal.id,
    status: proposal.status,
    title: proposal.title,
    body: proposal.body ?? "",
    sentAt: proposal.sentAt?.toISOString() ?? null,
    respondedAt: proposal.respondedAt?.toISOString() ?? null,
    responseNote: proposal.responseNote ?? null,
    quoteTotal: proposal.quote?.total?.toString() ?? "0",
    quoteCurrency: proposal.quote?.currency ?? "ALL",
    quoteItems: (proposal.quote?.items ?? []).map((i) => ({
      label: i.label,
      lineTotal: i.lineTotal.toString(),
    })),
  };
}

export async function organizerApproveProposal(eventId: string): Promise<OrganizerProposal> {
  const { ctx, event } = await requireOrganizerEvent(eventId);

  const proposal = await prisma.proposal.findFirst({
    where: { eventId: event.id, status: ProposalStatus.SENT, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { quote: { include: { items: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (!proposal) throw new AuthError("No pending proposal found for this event", 404);

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.proposal.update({
      where: { id: proposal.id },
      data: { status: ProposalStatus.APPROVED, respondedAt: new Date() },
      include: { quote: { include: { items: { orderBy: { sortOrder: "asc" } } } } },
    });
    await createAuditLog({
      tx,
      actorProfileId: ctx.profileId,
      action: "APPROVE",
      entityType: "Proposal",
      entityId: proposal.id,
      summary: `Organizer approved proposal for event ${event.code}`,
    });
    return p;
  });

  return {
    id: updated.id,
    status: updated.status,
    title: updated.title,
    body: updated.body ?? "",
    sentAt: updated.sentAt?.toISOString() ?? null,
    respondedAt: updated.respondedAt?.toISOString() ?? null,
    responseNote: updated.responseNote ?? null,
    quoteTotal: updated.quote?.total?.toString() ?? "0",
    quoteCurrency: updated.quote?.currency ?? "ALL",
    quoteItems: (updated.quote?.items ?? []).map((i) => ({
      label: i.label,
      lineTotal: i.lineTotal.toString(),
    })),
  };
}

export async function organizerRequestProposalChanges(
  eventId: string,
  note: string,
): Promise<OrganizerProposal> {
  const { ctx, event } = await requireOrganizerEvent(eventId);

  const cleanNote = note.trim().slice(0, 4000);
  if (!cleanNote) throw new AuthError("Please describe what changes you need", 403);

  const proposal = await prisma.proposal.findFirst({
    where: { eventId: event.id, status: ProposalStatus.SENT, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { quote: { include: { items: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (!proposal) throw new AuthError("No pending proposal found for this event", 404);

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.proposal.update({
      where: { id: proposal.id },
      data: {
        status: ProposalStatus.CHANGES_REQUESTED,
        respondedAt: new Date(),
        responseNote: cleanNote,
      },
      include: { quote: { include: { items: { orderBy: { sortOrder: "asc" } } } } },
    });
    await createAuditLog({
      tx,
      actorProfileId: ctx.profileId,
      action: "UPDATE",
      entityType: "Proposal",
      entityId: proposal.id,
      summary: `Organizer requested changes: ${cleanNote.slice(0, 80)}`,
    });
    return p;
  });

  return {
    id: updated.id,
    status: updated.status,
    title: updated.title,
    body: updated.body ?? "",
    sentAt: updated.sentAt?.toISOString() ?? null,
    respondedAt: updated.respondedAt?.toISOString() ?? null,
    responseNote: updated.responseNote ?? null,
    quoteTotal: updated.quote?.total?.toString() ?? "0",
    quoteCurrency: updated.quote?.currency ?? "ALL",
    quoteItems: (updated.quote?.items ?? []).map((i) => ({
      label: i.label,
      lineTotal: i.lineTotal.toString(),
    })),
  };
}

// ============================================================================
// Timeline (agenda items) — CRUD with day boundary validation
// ============================================================================

export interface TimelineItemInput {
  title: string;
  description?: string;
  spaceId?: string;
  startsAt: string;
  endsAt: string;
  sortOrder?: number;
  publicVisible?: boolean;
}

export interface TimelineItem {
  id: string;
  title: string;
  description: string | null;
  spaceId: string | null;
  startsAt: string;
  endsAt: string;
  sortOrder: number | null;
  publicVisible: boolean;
  createdAt: string;
}

function validateTimelineBoundaries(
  startsAt: Date,
  endsAt: Date,
  eventStart: Date | null,
  eventEnd: Date | null,
): void {
  if (startsAt >= endsAt) {
    throw new AuthError("Timeline item end time must be after start time", 403);
  }

  if (!eventStart || !eventEnd) return;

  const eventStartDay = new Date(eventStart);
  eventStartDay.setHours(0, 0, 0, 0);
  const eventEndDay = new Date(eventEnd);
  eventEndDay.setHours(23, 59, 59, 999);

  if (startsAt < eventStartDay) {
    throw new AuthError(
      `Timeline item cannot start before the event date (${eventStart.toLocaleDateString()})`,
      403,
    );
  }
  if (endsAt > eventEndDay) {
    throw new AuthError(
      `Timeline item cannot end after the last event day (${eventEnd.toLocaleDateString()})`,
      403,
    );
  }
}

function mapAgendaItem(i: {
  id: string;
  title: string;
  description: string | null;
  spaceId: string | null;
  startsAt: Date;
  endsAt: Date;
  sortOrder: number | null;
  publicVisible: boolean;
  createdAt: Date;
}): TimelineItem {
  return {
    id: i.id,
    title: i.title,
    description: i.description ?? null,
    spaceId: i.spaceId ?? null,
    startsAt: i.startsAt.toISOString(),
    endsAt: i.endsAt.toISOString(),
    sortOrder: i.sortOrder ?? null,
    publicVisible: i.publicVisible,
    createdAt: i.createdAt.toISOString(),
  };
}

// Ensure a publication exists for the event. If none exists and the event is
// CONFIRMED or later, auto-create a DRAFT publication so agenda items can be
// attached before staff formally publishes. Staff can fill in the rest later.
async function ensurePublication(
  tx: Prisma.TransactionClient,
  event: FetchedEvent,
  orgId: string,
): Promise<string> {
  if (event.publication) return event.publication.id;

  // Generate a URL-safe slug from the event title + code.
  const base = event.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const suffix = event.code.toLowerCase().replace(/[^a-z0-9]/g, "");
  let slug = `${base}-${suffix}`;

  // Ensure uniqueness by appending a counter if needed.
  const existing = await tx.eventPublication.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now().toString(36)}`;

  const pub = await tx.eventPublication.create({
    data: {
      orgId,
      eventId: event.id,
      slug,
      status: "DRAFT",
      publicTitle: event.title,
      registrationOpen: false,
    },
  });
  return pub.id;
}

export async function getOrganizerEventTimeline(eventId: string): Promise<TimelineItem[]> {
  const { event } = await requireOrganizerEvent(eventId);

  // No publication yet — return empty list instead of throwing.
  if (!event.publication) return [];

  const items = await prisma.agendaItem.findMany({
    where: { publicationId: event.publication.id },
    orderBy: [{ startsAt: "asc" }, { sortOrder: "asc" }],
  });

  return items.map(mapAgendaItem);
}

export async function createOrganizerTimelineItem(
  eventId: string,
  input: TimelineItemInput,
): Promise<TimelineItem> {
  const { ctx, event } = await requireOrganizerEvent(eventId);

  if (!isEditable(event.status)) {
    throw new AuthError(`Cannot add timeline items to an event in status ${event.status}`, 403);
  }

  const orgId = await getOrgId();
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);

  validateTimelineBoundaries(startsAt, endsAt, event.eventStart, event.eventEnd);

  const item = await prisma.$transaction(async (tx) => {
    // Auto-create a DRAFT publication if none exists yet.
    const publicationId = await ensurePublication(tx, event, orgId);

    const created = await tx.agendaItem.create({
      data: {
        orgId,
        publicationId,
        spaceId: input.spaceId ?? null,
        title: input.title,
        description: input.description ?? null,
        startsAt,
        endsAt,
        sortOrder: input.sortOrder ?? null,
        publicVisible: input.publicVisible ?? true,
      },
    });

    await createAuditLog({
      tx,
      actorProfileId: ctx.profileId,
      action: "CREATE",
      entityType: "AgendaItem",
      entityId: created.id,
      summary: `Organizer added timeline item: ${input.title}`,
    });

    return created;
  });

  return mapAgendaItem(item);
}

export async function updateOrganizerTimelineItem(
  eventId: string,
  itemId: string,
  input: Partial<TimelineItemInput>,
): Promise<TimelineItem> {
  const { ctx, event } = await requireOrganizerEvent(eventId);

  if (!isEditable(event.status)) {
    throw new AuthError(`Cannot edit timeline items in status ${event.status}`, 403);
  }

  const existing = await prisma.agendaItem.findFirst({
    where: { id: itemId },
  });
  if (!existing) throw new AuthError("Timeline item not found", 404);

  const startsAt = input.startsAt ? new Date(input.startsAt) : existing.startsAt;
  const endsAt = input.endsAt ? new Date(input.endsAt) : existing.endsAt;

  validateTimelineBoundaries(startsAt, endsAt, event.eventStart, event.eventEnd);

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.agendaItem.update({
      where: { id: itemId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.spaceId !== undefined && { spaceId: input.spaceId }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        ...(input.publicVisible !== undefined && { publicVisible: input.publicVisible }),
        startsAt,
        endsAt,
      },
    });

    await createAuditLog({
      tx,
      actorProfileId: ctx.profileId,
      action: "UPDATE",
      entityType: "AgendaItem",
      entityId: itemId,
      summary: `Organizer updated timeline item: ${u.title}`,
    });

    return u;
  });

  return mapAgendaItem(updated);
}

export async function deleteOrganizerTimelineItem(
  eventId: string,
  itemId: string,
): Promise<void> {
  const { ctx, event } = await requireOrganizerEvent(eventId);

  if (!isEditable(event.status)) {
    throw new AuthError(`Cannot remove timeline items in status ${event.status}`, 403);
  }

  const existing = await prisma.agendaItem.findFirst({
    where: { id: itemId },
  });
  if (!existing) throw new AuthError("Timeline item not found", 404);

  await prisma.$transaction(async (tx) => {
    await tx.agendaItem.delete({ where: { id: itemId } });
    await createAuditLog({
      tx,
      actorProfileId: ctx.profileId,
      action: "DELETE",
      entityType: "AgendaItem",
      entityId: itemId,
      summary: `Organizer removed timeline item: ${existing.title}`,
    });
  });
}

// ============================================================================
// Summary (for event detail page header)
// ============================================================================

export async function getOrganizerEventSummary(eventId: string): Promise<OrganizerEventDetail> {
  const { event } = await requireOrganizerEvent(eventId);
  return mapEventDetail(event);
}
