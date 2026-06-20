import {
  PublicationStatus,
  GuestRegistrationStatus,
  GuestTicketStatus,
  GuestCheckinStatus,
  EventStatus,
  Prisma,
} from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma } from "../db/prisma";
import { getOrgId } from "../db/org";
import { createAuditLog } from "../audit/log";
import {
  requirePermission,
  requireTicketToken,
  AuthError,
} from "../auth/guards";
import {
  publishEventInput,
  createAgendaItemInput,
  guestRegistrationInput,
} from "../validation/schemas";
import { uuid } from "../validation/common";
import { assertTransition, EVENT_TRANSITIONS } from "./state-machines";

// Public publication + guest lifecycle.
//
// Guests never get accounts. Publication rows are the guest-safe projection of
// an event (no storage, staff, pricing, conflicts). Tickets are reachable only
// by a high-entropy token; QR encodes the token only — never guest PII.

function newTicketToken(): string {
  return randomBytes(24).toString("base64url"); // ~32 chars, URL-safe, high entropy
}

export async function publishEvent(input: unknown) {
  const actor = await requirePermission("events.publish");
  const data = publishEventInput.parse(input);
  const orgId = await getOrgId();
  const event = await prisma.event.findFirst({ where: { id: data.eventId, orgId, deletedAt: null } });
  if (!event) throw new AuthError("Event not found", 404);

  const publication = await prisma.$transaction(async (tx) => {
    const pub = await tx.eventPublication.upsert({
      where: { eventId: data.eventId },
      update: {
        slug: data.slug,
        status: PublicationStatus.PUBLISHED,
        publicTitle: data.publicTitle,
        publicDescription: data.publicDescription,
        publicStart: data.publicStart,
        publicEnd: data.publicEnd,
        venueLabel: data.venueLabel,
        registrationOpen: data.registrationOpen ?? true,
        capacityPublic: data.capacityPublic,
        agenda: (data.agenda ?? []) as Prisma.InputJsonValue,
        publicMap: (data.publicMap ?? {}) as Prisma.InputJsonValue,
        publishedAt: new Date(),
      },
      create: {
        orgId,
        eventId: data.eventId,
        slug: data.slug,
        status: PublicationStatus.PUBLISHED,
        publicTitle: data.publicTitle,
        publicDescription: data.publicDescription,
        publicStart: data.publicStart,
        publicEnd: data.publicEnd,
        venueLabel: data.venueLabel,
        registrationOpen: data.registrationOpen ?? true,
        capacityPublic: data.capacityPublic,
        agenda: (data.agenda ?? []) as Prisma.InputJsonValue,
        publicMap: (data.publicMap ?? {}) as Prisma.InputJsonValue,
        publishedAt: new Date(),
      },
    });

    // Advance the event to PUBLISHED when the state machine allows it.
    if (event.status !== EventStatus.PUBLISHED) {
      try {
        assertTransition("Event", EVENT_TRANSITIONS, event.status, EventStatus.PUBLISHED);
        await tx.event.update({ where: { id: data.eventId }, data: { status: EventStatus.PUBLISHED } });
      } catch {
        // Leave event status untouched if not in a publishable state.
      }
    }

    await createAuditLog({
      tx,
      actorProfileId: actor.id,
      action: "PUBLISH",
      entityType: "Event",
      entityId: data.eventId,
      summary: `Published event as /${data.slug}`,
    });
    return pub;
  });
  return publication;
}

export async function unpublishEvent(publicationId: string) {
  const actor = await requirePermission("events.publish");
  uuid.parse(publicationId);
  const orgId = await getOrgId();
  const pub = await prisma.eventPublication.findFirst({ where: { id: publicationId, orgId, deletedAt: null } });
  if (!pub) throw new AuthError("Publication not found", 404);
  const updated = await prisma.eventPublication.update({
    where: { id: publicationId },
    data: { status: PublicationStatus.CLOSED, registrationOpen: false, closedAt: new Date() },
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "STATUS_CHANGE",
    entityType: "EventPublication",
    entityId: publicationId,
    summary: "Unpublished event",
  });
  return updated;
}

// -- Public reads (guest-safe projections) ----------------------------------

export type PublicEventCategory = "live" | "upcoming" | "past";

function deriveCategory(start: Date | null, end: Date | null): PublicEventCategory {
  const now = new Date();
  if (start && start > now) return "upcoming";
  if (end && end < now) return "past";
  if (start && start <= now && (!end || end >= now)) return "live";
  return "upcoming";
}

export async function listPublishedEvents(filters?: { upcomingOnly?: boolean }) {
  const orgId = await getOrgId();
  const rows = await prisma.eventPublication.findMany({
    where: {
      orgId,
      status: PublicationStatus.PUBLISHED,
      deletedAt: null,
      ...(filters?.upcomingOnly
        ? {
            OR: [
              { publicStart: { gte: new Date() } },
              { publicEnd: { gte: new Date() } },
            ],
          }
        : {}),
    },
    orderBy: { publicStart: "asc" },
  });
  return rows.map((p) => ({
    slug: p.slug,
    title: p.publicTitle,
    description: p.publicDescription,
    start: p.publicStart?.toISOString() ?? null,
    end: p.publicEnd?.toISOString() ?? null,
    venue: p.venueLabel,
    registrationOpen: p.registrationOpen,
    acceptsExternalGuests: p.registrationOpen,
    category: deriveCategory(p.publicStart, p.publicEnd),
  }));
}

export async function getPublishedEventBySlug(slug: string) {
  const orgId = await getOrgId();
  const pub = await prisma.eventPublication.findFirst({
    where: { orgId, slug, status: PublicationStatus.PUBLISHED, deletedAt: null },
    include: {
      agendaItems: {
        where: { publicVisible: true },
        orderBy: { sortOrder: "asc" },
        include: { space: { select: { name: true, publicVisible: true } } },
      },
    },
  });
  if (!pub) return null;

  const confirmed = await prisma.guestRegistration.count({
    where: { publicationId: pub.id, status: { in: [GuestRegistrationStatus.CONFIRMED, GuestRegistrationStatus.CHECKED_IN] } },
  });
  const remaining = pub.capacityPublic !== null ? Math.max(0, pub.capacityPublic - confirmed) : null;

  return {
    slug: pub.slug,
    title: pub.publicTitle,
    description: pub.publicDescription,
    start: pub.publicStart,
    end: pub.publicEnd,
    venue: pub.venueLabel,
    registrationOpen: pub.registrationOpen,
    capacity: pub.capacityPublic,
    remainingCapacity: remaining,
    agenda: pub.agenda,
    // Only public spaces appear on the guest map.
    publicMap: pub.publicMap,
    agendaItems: pub.agendaItems
      .filter((a) => !a.space || a.space.publicVisible)
      .map((a) => ({ title: a.title, description: a.description, startsAt: a.startsAt, endsAt: a.endsAt, space: a.space?.name ?? null })),
  };
}

// -- Agenda -----------------------------------------------------------------

export async function createAgendaItem(input: unknown) {
  const actor = await requirePermission("events.publish");
  const data = createAgendaItemInput.parse(input);
  const orgId = await getOrgId();
  const item = await prisma.agendaItem.create({ data: { orgId, ...data } });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "CREATE",
    entityType: "AgendaItem",
    entityId: item.id,
    summary: `Added agenda item ${item.title}`,
  });
  return item;
}

export async function updateAgendaItem(id: string, input: unknown) {
  await requirePermission("events.publish");
  uuid.parse(id);
  const data = createAgendaItemInput.partial().parse(input);
  return prisma.agendaItem.update({ where: { id }, data });
}

// -- Guest registration + tickets (public) ----------------------------------

/** PUBLIC: register a guest against a published, open publication. */
export async function registerGuest(input: unknown) {
  const data = guestRegistrationInput.parse(input);
  const orgId = await getOrgId();

  const pub = await prisma.eventPublication.findFirst({
    where: { id: data.publicationId, orgId, status: PublicationStatus.PUBLISHED, deletedAt: null },
  });
  if (!pub) throw new AuthError("Event not found", 404);
  if (!pub.registrationOpen) throw new AuthError("Registration is closed", 403);

  return prisma.$transaction(async (tx) => {
    // Capacity check (confirmed + checked-in count against public capacity).
    let status: GuestRegistrationStatus = GuestRegistrationStatus.CONFIRMED;
    if (pub.capacityPublic !== null) {
      const taken = await tx.guestRegistration.count({
        where: {
          publicationId: pub.id,
          status: { in: [GuestRegistrationStatus.CONFIRMED, GuestRegistrationStatus.CHECKED_IN] },
        },
      });
      if (taken >= pub.capacityPublic) status = GuestRegistrationStatus.WAITLISTED;
    }

    const registration = await tx.guestRegistration.create({
      data: {
        orgId,
        publicationId: pub.id,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        company: data.company,
        status,
        answers: (data.answers ?? {}) as Prisma.InputJsonValue,
      },
    });

    let ticket = null;
    if (status === GuestRegistrationStatus.CONFIRMED) {
      ticket = await tx.guestTicket.create({
        data: {
          orgId,
          registrationId: registration.id,
          token: newTicketToken(),
          status: GuestTicketStatus.REGISTERED,
        },
      });
    }
    await createAuditLog({
      tx,
      actorProfileId: null,
      action: "CREATE",
      entityType: "GuestRegistration",
      entityId: registration.id,
      summary: `Guest registered (${status})`,
    });
    return { registration, ticket };
  });
}

/** Issue (or re-issue) a ticket for a confirmed registration. */
export async function issueGuestTicket(registrationId: string) {
  await requirePermission("events.publish");
  uuid.parse(registrationId);
  const orgId = await getOrgId();
  const registration = await prisma.guestRegistration.findFirst({
    where: { id: registrationId, orgId, deletedAt: null },
    include: { ticket: true },
  });
  if (!registration) throw new AuthError("Registration not found", 404);
  if (registration.ticket) return registration.ticket;
  return prisma.guestTicket.create({
    data: { orgId, registrationId, token: newTicketToken(), status: GuestTicketStatus.REGISTERED },
  });
}

/** PUBLIC: fetch a ticket by its high-entropy token only. */
export async function getTicketByToken(token: string) {
  const ticket = await requireTicketToken(token);
  return {
    token: ticket.token,
    status: ticket.status,
    guestName: ticket.registration.fullName,
    issuedAt: ticket.issuedAt,
  };
}

// -- Check-in ---------------------------------------------------------------

export async function checkInTicket(token: string, checkedInByProfileId?: string) {
  const actor = await requirePermission("checkin.scan");
  const ticket = await requireTicketToken(token);
  const orgId = await getOrgId();

  return prisma.$transaction(async (tx) => {
    if (ticket.status === GuestTicketStatus.CHECKED_IN) {
      // Idempotent: record a duplicate scan but do not double-count.
      const dup = await tx.guestCheckin.create({
        data: { orgId, ticketId: ticket.id, status: GuestCheckinStatus.DUPLICATE, scannedByProfileId: checkedInByProfileId ?? actor.id },
      });
      return { ticket, checkin: dup, alreadyCheckedIn: true };
    }
    const checkin = await tx.guestCheckin.create({
      data: { orgId, ticketId: ticket.id, status: GuestCheckinStatus.CHECKED_IN, scannedByProfileId: checkedInByProfileId ?? actor.id },
    });
    await tx.guestTicket.update({ where: { id: ticket.id }, data: { status: GuestTicketStatus.CHECKED_IN } });
    await tx.guestRegistration.update({
      where: { id: ticket.registrationId },
      data: { status: GuestRegistrationStatus.CHECKED_IN },
    });
    await createAuditLog({
      tx,
      actorProfileId: checkedInByProfileId ?? actor.id,
      action: "CHECK_IN",
      entityType: "GuestTicket",
      entityId: ticket.id,
      summary: `Checked in ${ticket.registration.fullName}`,
    });
    return { ticket, checkin, alreadyCheckedIn: false };
  });
}

export async function getCheckInDashboard(publicationId: string) {
  await requirePermission("checkin.scan");
  uuid.parse(publicationId);
  const orgId = await getOrgId();
  const pub = await prisma.eventPublication.findFirst({ where: { id: publicationId, orgId, deletedAt: null } });
  if (!pub) throw new AuthError("Publication not found", 404);

  const [registered, checkedIn] = await Promise.all([
    prisma.guestRegistration.count({
      where: { publicationId, status: { in: [GuestRegistrationStatus.CONFIRMED, GuestRegistrationStatus.CHECKED_IN] } },
    }),
    prisma.guestRegistration.count({ where: { publicationId, status: GuestRegistrationStatus.CHECKED_IN } }),
  ]);
  return {
    publicationId,
    title: pub.publicTitle,
    capacity: pub.capacityPublic,
    registered,
    checkedIn,
    remaining: pub.capacityPublic !== null ? Math.max(0, pub.capacityPublic - registered) : null,
  };
}
