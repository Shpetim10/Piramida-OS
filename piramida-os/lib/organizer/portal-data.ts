import { cache } from "react";
import { ProfileType, type Event, type EventRequest } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getOrgId } from "@/lib/db/org";
import { getCurrentProfile } from "@/lib/auth/guards";

// Organizer portal data access. Everything here is read from the database and
// scoped to the signed-in organizer's own contact/client — no hard-coded demo
// data, and never another client's events. Pages stay presentational.

const ACTIVE_STATUSES = ["DRAFT", "PLANNING", "PROPOSED"] as const;
const UPCOMING_STATUSES = ["CONFIRMED", "PUBLISHED", "LAUNCH_READY", "LIVE"] as const;
const PAST_STATUSES = ["COMPLETED", "ARCHIVED"] as const;

export interface OrganizerContext {
  profileId: string;
  contactId: string | null;
  clientId: string | null;
  name: string;
  email: string;
  phone: string | null;
  org: string;
  initials: string;
  memberSince: string;
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "··";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** The signed-in organizer's identity + client link. Cached per request. */
export const getOrganizerContext = cache(async (): Promise<OrganizerContext | null> => {
  const profile = await getCurrentProfile();
  if (!profile || profile.type !== ProfileType.ORGANIZER) return null;

  const full = await prisma.profile.findUnique({
    where: { id: profile.id },
    select: {
      fullName: true,
      email: true,
      phone: true,
      createdAt: true,
      contact: { select: { id: true, clientId: true, client: { select: { name: true } } } },
    },
  });
  if (!full) return null;

  const name = full.fullName || "Organizer";
  return {
    profileId: profile.id,
    contactId: full.contact?.id ?? profile.contactId,
    clientId: full.contact?.clientId ?? null,
    name,
    email: full.email,
    phone: full.phone,
    org: full.contact?.client?.name ?? "—",
    initials: initialsFrom(name),
    memberSince: full.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  };
});

// ---------------------------------------------------------------------------
// Display mappers (deterministic — no invented facts)
// ---------------------------------------------------------------------------

function extractedGuests(req: Pick<EventRequest, "extractedJson">): number | null {
  const ex = req.extractedJson as { expectedGuests?: unknown } | null;
  const g = ex?.expectedGuests;
  return typeof g === "number" && g > 0 ? g : null;
}

export interface RequestRow {
  id: string;
  event: string;
  date: string;
  status: string;
  sc: string;
  desc: string;
}

function requestRow(req: EventRequest): RequestRow {
  const submitted = req.createdAt.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
  const guests = extractedGuests(req);
  const title = req.title || "Untitled event request";

  let status = "Pending manager approval";
  let sc = "#F59E0B";
  let desc = `Submitted for the venue team's review.${guests ? ` ${guests} guests.` : ""}`;

  if (req.approvalStatus === "APPROVED") {
    status = "Approved";
    sc = "#22C55E";
    desc = "Approved by the venue team. Reservations confirmed.";
  } else if (req.approvalStatus === "REJECTED" || req.status === "REJECTED") {
    status = "Changes requested";
    sc = "#EF4444";
    desc = "The venue team asked for changes before this can proceed.";
  } else if (req.status === "PLANNING" || req.status === "PROPOSED") {
    status = "In planning";
    sc = "#2A6FDB";
    desc = `The venue team is building your plan.${guests ? ` ${guests} guests.` : ""}`;
  }

  return { id: req.id, event: title, date: `Submitted ${submitted}`, status, sc, desc };
}

const EVENT_STATUS_STYLE: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "#7D8799" },
  PLANNING: { label: "Planning", color: "#C8F000" },
  PROPOSED: { label: "Proposed", color: "#F59E0B" },
  CONFIRMED: { label: "Confirmed", color: "#22C55E" },
  PUBLISHED: { label: "Published", color: "#2A6FDB" },
  LAUNCH_READY: { label: "Launch ready", color: "#22C55E" },
  LIVE: { label: "Live", color: "#C53A6B" },
  COMPLETED: { label: "Completed", color: "#7D8799" },
  ARCHIVED: { label: "Archived", color: "#7D8799" },
  CANCELLED: { label: "Cancelled", color: "#EF4444" },
};

export interface EventRow {
  id: string;
  title: string;
  date: string;
  status: string;
  guests: string;
  color: string;
}

function eventRow(e: Event): EventRow {
  const style = EVENT_STATUS_STYLE[e.status] ?? { label: e.status, color: "#7D8799" };
  const date = e.eventStart
    ? e.eventStart.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })
    : "Date TBD";
  return {
    id: e.id,
    title: e.title,
    date,
    status: style.label,
    guests: e.expectedGuests != null ? String(e.expectedGuests) : "—",
    color: style.color,
  };
}

// ---------------------------------------------------------------------------
// Page payloads
// ---------------------------------------------------------------------------

export interface OrganizerDashboard {
  stats: { label: string; value: string; sub: string; accent: boolean }[];
  activeEvent: { title: string; status: string; chips: string[] } | null;
  requests: RequestRow[];
}

export async function getOrganizerDashboard(ctx: OrganizerContext): Promise<OrganizerDashboard> {
  const orgId = await getOrgId();
  const { contactId, clientId } = ctx;

  const [requests, events] = await Promise.all([
    contactId
      ? prisma.eventRequest.findMany({
          where: { orgId, contactId, deletedAt: null },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    clientId
      ? prisma.event.findMany({
          where: { orgId, clientId, deletedAt: null },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const count = (set: readonly string[]) => events.filter((e) => set.includes(e.status)).length;
  const pending = requests.filter(
    (r) => r.approvalStatus === "PENDING_APPROVAL" && r.status !== "REJECTED",
  ).length;

  const stats = [
    { label: "Active Events", value: String(count(ACTIVE_STATUSES)), sub: "In planning", accent: true },
    { label: "Upcoming Events", value: String(count(UPCOMING_STATUSES)), sub: "Approved", accent: false },
    { label: "Past Events", value: String(count(PAST_STATUSES)), sub: "Completed", accent: false },
    { label: "Pending Requests", value: String(pending), sub: "Awaiting manager", accent: false },
  ];

  const active =
    events.find((e) => (ACTIVE_STATUSES as readonly string[]).includes(e.status)) ?? events[0] ?? null;

  let activeEvent: OrganizerDashboard["activeEvent"] = null;
  if (active) {
    const style = EVENT_STATUS_STYLE[active.status] ?? { label: active.status };
    const chips: string[] = [];
    if (active.expectedGuests != null) chips.push(`${active.expectedGuests} guests`);
    if (active.eventStart) {
      chips.push(active.eventStart.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }));
    }
    chips.push(active.code);
    activeEvent = { title: active.title, status: style.label, chips };
  } else if (requests[0]) {
    const r = requests[0];
    const guests = extractedGuests(r);
    activeEvent = {
      title: r.title || "Your event request",
      status: requestRow(r).status,
      chips: guests ? [`${guests} guests`, "Awaiting review"] : ["Awaiting review"],
    };
  }

  return { stats, activeEvent, requests: requests.slice(0, 4).map(requestRow) };
}

export async function getOrganizerRequests(ctx: OrganizerContext): Promise<RequestRow[]> {
  if (!ctx.contactId) return [];
  const orgId = await getOrgId();
  const requests = await prisma.eventRequest.findMany({
    where: { orgId, contactId: ctx.contactId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return requests.map(requestRow);
}

export async function getOrganizerEvents(ctx: OrganizerContext): Promise<EventRow[]> {
  if (!ctx.clientId) return [];
  const orgId = await getOrgId();
  const events = await prisma.event.findMany({
    where: { orgId, clientId: ctx.clientId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return events.map(eventRow);
}

export interface OrganizerProfileData {
  name: string;
  org: string;
  initials: string;
  info: { label: string; value: string }[];
  track: { value: string; label: string; accent: boolean }[];
}

export async function getOrganizerProfileData(ctx: OrganizerContext): Promise<OrganizerProfileData> {
  const orgId = await getOrgId();

  const [events, requests] = await Promise.all([
    ctx.clientId
      ? prisma.event.findMany({
          where: { orgId, clientId: ctx.clientId, deletedAt: null },
          select: { expectedGuests: true },
        })
      : Promise.resolve([]),
    ctx.contactId
      ? prisma.eventRequest.findMany({
          where: { orgId, contactId: ctx.contactId, deletedAt: null },
          select: { approvalStatus: true },
        })
      : Promise.resolve([]),
  ]);

  const guestsHosted = events.reduce((t, e) => t + (e.expectedGuests ?? 0), 0);
  const decided = requests.filter((r) => r.approvalStatus === "APPROVED" || r.approvalStatus === "REJECTED");
  const approved = requests.filter((r) => r.approvalStatus === "APPROVED").length;
  const approvalRate = decided.length === 0 ? null : Math.round((approved / decided.length) * 100);

  return {
    name: ctx.name,
    org: ctx.org,
    initials: ctx.initials,
    info: [
      { label: "Email", value: ctx.email },
      { label: "Phone", value: ctx.phone || "—" },
      { label: "Organization", value: ctx.org },
      { label: "Member since", value: ctx.memberSince },
    ],
    track: [
      { value: String(events.length), label: "Events", accent: false },
      { value: String(guestsHosted), label: "Guests hosted", accent: false },
      { value: approvalRate == null ? "—" : `${approvalRate}%`, label: "Approval rate", accent: true },
    ],
  };
}
