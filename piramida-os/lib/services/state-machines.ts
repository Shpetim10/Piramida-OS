// Deterministic state-transition enforcement for Piramida / Pyramid OS.
//
// Each map lists the ALLOWED next states for a given current state. Services
// call assertTransition(...) before persisting a status change and write an
// AuditLog entry. The role permitted to drive each transition and its side
// effects are specified in docs/validation-and-implementation-contracts.md §6;
// here we enforce the graph itself (terminal states map to []).
import {
  EventRequestStatus,
  EventStatus,
  EventApprovalStatus,
  AssetStatus,
  AssetReservationStatus,
  AssetReservationItemStatus,
  ConflictStatus,
  TaskStatus,
  QuoteStatus,
  ProposalStatus,
  PublicationStatus,
  GuestRegistrationStatus,
  GuestTicketStatus,
} from "@prisma/client";

type Transitions<E extends string> = Record<E, E[]>;

export const EVENT_REQUEST_TRANSITIONS: Transitions<EventRequestStatus> = {
  RECEIVED: ["PARSED", "REVIEWED", "CANCELLED", "REJECTED"],
  PARSED: ["REVIEWED", "CANCELLED", "REJECTED"],
  REVIEWED: ["PLANNING", "PROPOSED", "APPROVED", "REJECTED", "CANCELLED"],
  PLANNING: ["PROPOSED", "APPROVED", "REJECTED", "CANCELLED"],
  PROPOSED: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["CANCELLED"],
  REJECTED: [],
  CANCELLED: [],
};

export const EVENT_TRANSITIONS: Transitions<EventStatus> = {
  DRAFT: ["PENDING_APPROVAL", "PLANNING", "CANCELLED"],
  PENDING_APPROVAL: ["PLANNING", "CANCELLED", "ARCHIVED"],
  PLANNING: ["PROPOSED", "CONFIRMED", "CANCELLED"],
  PROPOSED: ["CONFIRMED", "PLANNING", "CANCELLED"],
  CONFIRMED: ["PUBLISHED", "LAUNCH_READY", "PLANNING", "CANCELLED"],
  PUBLISHED: ["LAUNCH_READY", "LIVE", "CANCELLED"],
  LAUNCH_READY: ["LIVE", "PUBLISHED", "CANCELLED"],
  LIVE: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
  CANCELLED: ["ARCHIVED"],
};

export const EVENT_APPROVAL_TRANSITIONS: Transitions<EventApprovalStatus> = {
  PENDING_APPROVAL: ["APPROVED", "REJECTED", "NEEDS_CHANGES", "CANCELLED"],
  NEEDS_CHANGES: ["PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["CANCELLED"],
  REJECTED: ["PENDING_APPROVAL"],
  CANCELLED: [],
};

export const ASSET_TRANSITIONS: Transitions<AssetStatus> = {
  AVAILABLE: ["SOFT_HOLD", "RESERVED", "NEEDS_INSPECTION", "MAINTENANCE", "MISSING", "RETIRED"],
  SOFT_HOLD: ["RESERVED", "AVAILABLE", "MISSING"],
  RESERVED: ["PICKED", "AVAILABLE", "MISSING"],
  PICKED: ["IN_TRANSIT", "IN_USE", "RETURNED", "MISSING"],
  IN_TRANSIT: ["IN_USE", "RETURNED", "MISSING"],
  IN_USE: ["RETURNED", "IN_TRANSIT", "MISSING"],
  RETURNED: ["NEEDS_INSPECTION", "AVAILABLE", "MAINTENANCE"],
  NEEDS_INSPECTION: ["AVAILABLE", "MAINTENANCE", "RETIRED"],
  MAINTENANCE: ["AVAILABLE", "NEEDS_INSPECTION", "RETIRED"],
  MISSING: ["AVAILABLE", "RETIRED"],
  RETIRED: [],
};

export const ASSET_RESERVATION_TRANSITIONS: Transitions<AssetReservationStatus> = {
  SOFT_HOLD: ["RESERVED", "RELEASED", "CANCELLED"],
  RESERVED: ["PICKED", "RELEASED", "CANCELLED"],
  PICKED: ["IN_TRANSIT", "IN_USE", "RETURNED", "CANCELLED"],
  IN_TRANSIT: ["IN_USE", "RETURNED"],
  IN_USE: ["RETURNED"],
  RETURNED: ["RELEASED"],
  RELEASED: [],
  CANCELLED: [],
};

export const ASSET_RESERVATION_ITEM_TRANSITIONS: Transitions<AssetReservationItemStatus> = {
  PENDING: ["SOFT_HOLD", "RESERVED", "ASSIGNED", "SUBSTITUTED", "CANCELLED"],
  SOFT_HOLD: ["RESERVED", "ASSIGNED", "SUBSTITUTED", "RELEASED", "CANCELLED"],
  RESERVED: ["ASSIGNED", "PICKED", "SUBSTITUTED", "RELEASED", "CANCELLED"],
  ASSIGNED: ["PICKED", "SUBSTITUTED", "RELEASED", "CANCELLED"],
  PICKED: ["IN_USE", "RETURNED"],
  IN_USE: ["RETURNED"],
  RETURNED: ["RELEASED"],
  SUBSTITUTED: ["RELEASED", "CANCELLED"],
  RELEASED: [],
  CANCELLED: [],
};

export const CONFLICT_TRANSITIONS: Transitions<ConflictStatus> = {
  OPEN: ["RESOLVED", "AUTO_FIXED", "IGNORED"],
  AUTO_FIXED: ["OPEN", "RESOLVED"], // may reopen if a later change reintroduces it
  RESOLVED: ["OPEN"],
  IGNORED: ["OPEN", "RESOLVED"],
};

export const TASK_TRANSITIONS: Transitions<TaskStatus> = {
  TODO: ["READY", "IN_PROGRESS", "BLOCKED", "CANCELLED"],
  READY: ["IN_PROGRESS", "BLOCKED", "CANCELLED"],
  IN_PROGRESS: ["BLOCKED", "DONE", "CANCELLED"],
  BLOCKED: ["READY", "IN_PROGRESS", "CANCELLED"],
  DONE: ["IN_PROGRESS"], // reopen
  CANCELLED: [],
};

export const QUOTE_TRANSITIONS: Transitions<QuoteStatus> = {
  DRAFT: ["SENT", "APPROVED", "SUPERSEDED"],
  SENT: ["APPROVED", "REJECTED", "EXPIRED", "SUPERSEDED"],
  APPROVED: ["SUPERSEDED"],
  REJECTED: ["SUPERSEDED"],
  EXPIRED: ["SUPERSEDED"],
  SUPERSEDED: [],
};

export const PROPOSAL_TRANSITIONS: Transitions<ProposalStatus> = {
  DRAFT: ["SENT", "EXPIRED"],
  SENT: ["APPROVED", "CHANGES_REQUESTED", "REJECTED", "EXPIRED"],
  CHANGES_REQUESTED: ["DRAFT", "SENT"],
  APPROVED: [],
  REJECTED: ["DRAFT"],
  EXPIRED: ["DRAFT"],
};

export const PUBLICATION_TRANSITIONS: Transitions<PublicationStatus> = {
  DRAFT: ["PUBLISHED", "HIDDEN"],
  PUBLISHED: ["CLOSED", "HIDDEN"],
  CLOSED: ["PUBLISHED", "HIDDEN"],
  HIDDEN: ["DRAFT", "PUBLISHED"],
};

export const GUEST_REGISTRATION_TRANSITIONS: Transitions<GuestRegistrationStatus> = {
  PENDING: ["CONFIRMED", "WAITLISTED", "CANCELLED"],
  WAITLISTED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "NO_SHOW", "CANCELLED"],
  CHECKED_IN: ["NO_SHOW"], // reversal/correction
  NO_SHOW: ["CHECKED_IN"],
  CANCELLED: [],
};

export const GUEST_TICKET_TRANSITIONS: Transitions<GuestTicketStatus> = {
  REGISTERED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["NO_SHOW"],
  NO_SHOW: ["CHECKED_IN"],
  CANCELLED: [],
};

export class InvalidTransitionError extends Error {
  constructor(machine: string, from: string, to: string) {
    super(`Invalid ${machine} transition: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

/** Returns true if `to` is reachable from `from` (no-op self-transitions allowed). */
export function canTransition<E extends string>(map: Transitions<E>, from: E, to: E): boolean {
  if (from === to) return true;
  return (map[from] ?? []).includes(to);
}

/** Throws InvalidTransitionError if the transition is not allowed. */
export function assertTransition<E extends string>(
  machine: string,
  map: Transitions<E>,
  from: E,
  to: E,
): void {
  if (!canTransition(map, from, to)) throw new InvalidTransitionError(machine, from, to);
}
