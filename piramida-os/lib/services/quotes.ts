import {
  QuoteStatus,
  ProposalStatus,
  AssetReservationStatus,
  AssetReservationItemStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../db/prisma";
import { getOrgId } from "../db/org";
import { createAuditLog } from "../audit/log";
import {
  requirePermission,
  requireOrganizerCanViewProposal,
  AuthError,
} from "../auth/guards";
import { getSetting } from "./settings";
import { uuid, requiredText } from "../validation/common";

// Deterministic quote calculation + proposal flow.
//
// Money is ALWAYS computed here from reservations and a fixed price book — AI
// never sets or changes a price. AI may later write proposal prose, but only
// from these validated totals.

// Price book in minor-unit-free ALL (Albanian lek). Demo-grade flat rates.
const SPACE_DAY_RATE = 75_000;
const SERIALIZED_RATES: Record<string, number> = {
  "Wireless Microphone": 6_000,
  "Wired Microphone": 3_000,
  Projector: 20_000,
  Screen: 12_000,
  Speaker: 10_000,
  "Registration Desk": 8_000,
};
const BULK_UNIT_RATES: Record<string, number> = {
  Chairs: 300,
  Tables: 1_500,
  "Extension Cables": 500,
  "Cable Covers": 400,
};

interface ComputedItem {
  label: string;
  category: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

async function computeQuoteItems(orgId: string, eventId: string): Promise<ComputedItem[]> {
  const items: ComputedItem[] = [];

  const spaceRes = await prisma.spaceReservation.findMany({
    where: {
      orgId,
      eventId,
      deletedAt: null,
      status: { notIn: [AssetReservationStatus.RELEASED, AssetReservationStatus.CANCELLED] },
    },
    include: { space: { select: { name: true } } },
  });
  if (spaceRes.length > 0) {
    items.push({
      label: `Space rental (${spaceRes.map((s) => s.space.name).join(", ")})`,
      category: "spaces",
      quantity: spaceRes.length,
      unitPrice: SPACE_DAY_RATE,
      lineTotal: spaceRes.length * SPACE_DAY_RATE,
    });
  }

  const resItems = await prisma.assetReservationItem.findMany({
    where: {
      orgId,
      reservation: { eventId, status: { notIn: [AssetReservationStatus.RELEASED, AssetReservationStatus.CANCELLED] } },
      itemStatus: { notIn: [AssetReservationItemStatus.RELEASED, AssetReservationItemStatus.CANCELLED, AssetReservationItemStatus.SUBSTITUTED] },
    },
    include: { category: { select: { name: true } } },
  });

  // Aggregate by category name.
  const byCategory = new Map<string, number>();
  for (const it of resItems) {
    const name = it.category?.name ?? "Equipment";
    byCategory.set(name, (byCategory.get(name) ?? 0) + it.quantity);
  }
  for (const [name, qty] of byCategory) {
    const serialRate = SERIALIZED_RATES[name];
    const bulkRate = BULK_UNIT_RATES[name];
    const rate = serialRate ?? bulkRate;
    if (!rate) continue;
    items.push({
      label: `${name} ×${qty}`,
      category: serialRate ? "av" : "furniture",
      quantity: qty,
      unitPrice: rate,
      lineTotal: qty * rate,
    });
  }
  return items;
}

export async function createQuote(eventId: string) {
  const actor = await requirePermission("quotes.manage");
  uuid.parse(eventId);
  const orgId = await getOrgId();
  const event = await prisma.event.findFirst({ where: { id: eventId, orgId, deletedAt: null } });
  if (!event) throw new AuthError("Event not found", 404);
  const currency = (await getSetting<string>("currency")) ?? "ALL";

  const quote = await prisma.quote.create({
    data: { orgId, eventId, clientId: event.clientId, status: QuoteStatus.DRAFT, currency },
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "CREATE",
    entityType: "Quote",
    entityId: quote.id,
    summary: `Created quote for event ${event.code}`,
  });
  return quote;
}

/** Recompute quote items + totals from the event's reservations. Deterministic. */
export async function calculateQuote(eventId: string) {
  const actor = await requirePermission("quotes.manage");
  uuid.parse(eventId);
  const orgId = await getOrgId();
  const event = await prisma.event.findFirst({ where: { id: eventId, orgId, deletedAt: null } });
  if (!event) throw new AuthError("Event not found", 404);

  const currency = (await getSetting<string>("currency")) ?? "ALL";
  const vatRate = (await getSetting<number>("vat_rate")) ?? 0.2;
  const computed = await computeQuoteItems(orgId, eventId);
  const subtotal = computed.reduce((s, i) => s + i.lineTotal, 0);
  const taxTotal = Math.round(subtotal * vatRate);
  const total = subtotal + taxTotal;

  const quote = await prisma.$transaction(async (tx) => {
    let q = await tx.quote.findFirst({ where: { orgId, eventId }, orderBy: { createdAt: "desc" } });
    if (!q) {
      q = await tx.quote.create({ data: { orgId, eventId, clientId: event.clientId, currency } });
    }
    await tx.quoteItem.deleteMany({ where: { quoteId: q.id } });
    await tx.quoteItem.createMany({
      data: computed.map((i, idx) => ({
        orgId,
        quoteId: q!.id,
        label: i.label,
        category: i.category,
        quantity: new Prisma.Decimal(i.quantity),
        unitPrice: new Prisma.Decimal(i.unitPrice),
        lineTotal: new Prisma.Decimal(i.lineTotal),
        sortOrder: idx,
      })),
    });
    const updated = await tx.quote.update({
      where: { id: q.id },
      data: {
        currency,
        subtotal: new Prisma.Decimal(subtotal),
        taxTotal: new Prisma.Decimal(taxTotal),
        total: new Prisma.Decimal(total),
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    await createAuditLog({
      tx,
      actorProfileId: actor.id,
      action: "UPDATE",
      entityType: "Quote",
      entityId: q.id,
      summary: `Calculated quote: ${total} ${currency}`,
      after: { subtotal, taxTotal, total },
    });
    return updated;
  });
  return quote;
}

export async function addQuoteItem(input: {
  quoteId: string;
  label: string;
  category?: string;
  quantity: number;
  unitPrice: number;
}) {
  await requirePermission("quotes.manage");
  uuid.parse(input.quoteId);
  const orgId = await getOrgId();
  const lineTotal = input.quantity * input.unitPrice;
  return prisma.quoteItem.create({
    data: {
      orgId,
      quoteId: input.quoteId,
      label: requiredText(200).parse(input.label),
      category: input.category,
      quantity: new Prisma.Decimal(input.quantity),
      unitPrice: new Prisma.Decimal(input.unitPrice),
      lineTotal: new Prisma.Decimal(lineTotal),
    },
  });
}

export async function updateQuoteStatus(id: string, status: QuoteStatus) {
  const actor = await requirePermission("quotes.manage");
  uuid.parse(id);
  const quote = await prisma.quote.update({ where: { id }, data: { status } });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "STATUS_CHANGE",
    entityType: "Quote",
    entityId: id,
    summary: `Quote status -> ${status}`,
  });
  return quote;
}

function fallbackProposalBody(eventTitle: string, total: number, currency: string): string {
  return [
    `Thank you for choosing the Pyramid of Tirana for ${eventTitle}.`,
    `Our team has prepared an operational plan covering your spaces, AV equipment, and on-site support.`,
    `The total estimate for this event is ${total.toLocaleString()} ${currency}, inclusive of applicable VAT.`,
    `We look forward to making your event a success.`,
  ].join("\n\n");
}

export async function createProposalPreview(eventId: string, quoteId: string) {
  const actor = await requirePermission("proposals.manage");
  uuid.parse(eventId);
  uuid.parse(quoteId);
  const orgId = await getOrgId();
  const event = await prisma.event.findFirst({ where: { id: eventId, orgId, deletedAt: null } });
  if (!event) throw new AuthError("Event not found", 404);
  const quote = await prisma.quote.findFirst({ where: { id: quoteId, orgId } });
  if (!quote) throw new AuthError("Quote not found", 404);

  const proposal = await prisma.proposal.create({
    data: {
      orgId,
      eventId,
      quoteId,
      clientId: event.clientId,
      status: ProposalStatus.DRAFT,
      title: `Proposal — ${event.title}`,
      body: fallbackProposalBody(event.title, Number(quote.total), quote.currency),
    },
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "CREATE",
    entityType: "Proposal",
    entityId: proposal.id,
    summary: `Drafted proposal for ${event.code}`,
  });
  return proposal;
}

export async function shareProposalWithOrganizer(proposalId: string) {
  const actor = await requirePermission("proposals.manage");
  uuid.parse(proposalId);
  const orgId = await getOrgId();
  const proposal = await prisma.proposal.findFirst({ where: { id: proposalId, orgId, deletedAt: null } });
  if (!proposal) throw new AuthError("Proposal not found", 404);

  const contact = await prisma.contact.findFirst({
    where: { orgId, clientId: proposal.clientId, isPrimary: true },
    select: { id: true },
  });

  const updated = await prisma.proposal.update({
    where: { id: proposalId },
    data: {
      status: ProposalStatus.SENT,
      sentAt: new Date(),
      sharedWithContactId: contact?.id ?? proposal.sharedWithContactId,
    },
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "UPDATE",
    entityType: "Proposal",
    entityId: proposalId,
    summary: "Shared proposal with organizer",
  });
  return updated;
}

export async function approveProposalAsOrganizer(proposalId: string) {
  const profile = await requireOrganizerCanViewProposal(proposalId);
  const orgId = await getOrgId();
  const updated = await prisma.proposal.update({
    where: { id: proposalId },
    data: { status: ProposalStatus.APPROVED, respondedAt: new Date() },
  });
  await createAuditLog({
    actorProfileId: profile.id,
    action: "APPROVE",
    entityType: "Proposal",
    entityId: proposalId,
    summary: "Organizer approved proposal",
  });
  void orgId;
  return updated;
}

export async function requestProposalChanges(proposalId: string, notes: string) {
  const profile = await requireOrganizerCanViewProposal(proposalId);
  const cleanNotes = requiredText(4000).parse(notes);
  const updated = await prisma.proposal.update({
    where: { id: proposalId },
    data: { status: ProposalStatus.CHANGES_REQUESTED, respondedAt: new Date(), responseNote: cleanNotes },
  });
  await createAuditLog({
    actorProfileId: profile.id,
    action: "UPDATE",
    entityType: "Proposal",
    entityId: proposalId,
    summary: "Organizer requested changes",
  });
  return updated;
}

export async function approveProposalInternally(proposalId: string) {
  const actor = await requirePermission("proposals.manage");
  uuid.parse(proposalId);
  const updated = await prisma.proposal.update({
    where: { id: proposalId },
    data: { status: ProposalStatus.APPROVED, respondedAt: new Date() },
  });
  await createAuditLog({
    actorProfileId: actor.id,
    action: "APPROVE",
    entityType: "Proposal",
    entityId: proposalId,
    summary: "Internal proposal approval",
  });
  return updated;
}
