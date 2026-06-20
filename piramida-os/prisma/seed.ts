/**
 * Deterministic, idempotent seed for Piramida / Pyramid OS.
 *
 * Uses stable UUIDs derived from semantic keys so re-running converges instead
 * of duplicating. Recreates the canonical startup-conference demo, including
 * the Wireless Mic 04 conflict and a guest-safe public publication.
 *
 * Run: npm run db:seed   (or db:reset to migrate-fresh + seed)
 */
import { createHash } from "node:crypto";
import {
  PrismaClient,
  ProfileType,
  ProfileStatus,
  RoleCode,
  AssetTrackingMode,
  AssetVisibility,
  SpaceKind,
  LocationKind,
  EventRequestStatus,
  EventApprovalStatus,
  EventStatus,
  EventType,
  EventVisibility,
  AssetReservationStatus,
  AssetReservationItemStatus,
  ConflictType,
  ConflictSeverity,
  ConflictStatus,
  ConflictSuggestionType,
  PublicationStatus,
  GuestRegistrationStatus,
  GuestTicketStatus,
  QuoteStatus,
  ProposalStatus,
  SettingValueType,
} from "@prisma/client";
import { ROLE_PERMISSIONS } from "../lib/auth/permissions";

const prisma = new PrismaClient();

/** Stable UUID v5-style id from a semantic key (idempotent seeds). */
function sid(key: string): string {
  const h = createHash("sha1").update(`piramida:${key}`).digest("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    "5" + h.slice(13, 16),
    "8" + h.slice(17, 20),
    h.slice(20, 32),
  ].join("-");
}

/** High-entropy-looking deterministic token for demo tickets. */
function token(key: string): string {
  return createHash("sha256").update(`piramida-ticket:${key}`).digest("hex");
}

const ORG_ID = sid("org");

async function main() {
  // -- Organization -----------------------------------------------------------
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: {
      id: ORG_ID,
      name: "Pyramid of Tirana",
      slug: "pyramid-tirana",
      timezone: "Europe/Tirane",
      currency: "ALL",
    },
  });

  // -- Roles ------------------------------------------------------------------
  const roleLabels: Record<RoleCode, string> = {
    SUPER_ADMIN: "Super Admin",
    ADMIN: "Admin",
    EVENT_MANAGER: "Event Manager",
    OPERATIONS_MANAGER: "Operations Manager",
    TECHNICIAN: "Technician",
    EVENT_ORGANIZER: "Event Organizer",
  };
  for (const code of Object.keys(roleLabels) as RoleCode[]) {
    await prisma.role.upsert({
      where: { orgId_code: { orgId: ORG_ID, code } },
      update: { permissions: ROLE_PERMISSIONS[code], label: roleLabels[code] },
      create: {
        id: sid(`role:${code}`),
        orgId: ORG_ID,
        code,
        label: roleLabels[code],
        isSystem: true,
        permissions: ROLE_PERMISSIONS[code],
      },
    });
  }

  // -- Staff profiles ---------------------------------------------------------
  const staff: Array<{ key: string; name: string; email: string; role: RoleCode }> = [
    { key: "admin", name: "Ada Admin", email: "admin@pyramid.al", role: "ADMIN" },
    { key: "event-mgr", name: "Erion Event", email: "events@pyramid.al", role: "EVENT_MANAGER" },
    { key: "ops-mgr", name: "Olta Ops", email: "ops@pyramid.al", role: "OPERATIONS_MANAGER" },
    { key: "tech", name: "Teo Tech", email: "tech@pyramid.al", role: "TECHNICIAN" },
  ];
  for (const s of staff) {
    const profileId = sid(`profile:${s.key}`);
    await prisma.profile.upsert({
      where: { id: profileId },
      // authUserId mirrors the profile id so DEMO_MODE login can resolve a real
      // profile by id until Supabase Auth issues real auth.users ids.
      update: { fullName: s.name, status: ProfileStatus.ACTIVE, authUserId: profileId },
      create: {
        id: profileId,
        orgId: ORG_ID,
        authUserId: profileId,
        type: ProfileType.STAFF,
        status: ProfileStatus.ACTIVE,
        fullName: s.name,
        email: s.email,
      },
    });
    const roleId = sid(`role:${s.role}`);
    await prisma.profileRole.upsert({
      where: { profileId_roleId: { profileId, roleId } },
      update: {},
      create: { id: sid(`pr:${s.key}`), orgId: ORG_ID, profileId, roleId },
    });
  }

  // -- Client + external organizer contact/profile ----------------------------
  const clientId = sid("client:nimbus");
  await prisma.client.upsert({
    where: { id: clientId },
    update: {},
    create: {
      id: clientId,
      orgId: ORG_ID,
      name: "Nimbus Labs",
      industry: "Technology",
      billingEmail: "billing@nimbuslabs.io",
    },
  });
  const contactId = sid("contact:lena");
  await prisma.contact.upsert({
    where: { id: contactId },
    update: {},
    create: {
      id: contactId,
      orgId: ORG_ID,
      clientId,
      firstName: "Lena",
      lastName: "Organizer",
      email: "lena@nimbuslabs.io",
      isPrimary: true,
    },
  });
  const organizerProfileId = sid("profile:organizer");
  await prisma.profile.upsert({
    where: { id: organizerProfileId },
    update: { contactId, authUserId: organizerProfileId },
    create: {
      id: organizerProfileId,
      orgId: ORG_ID,
      authUserId: organizerProfileId,
      type: ProfileType.ORGANIZER,
      status: ProfileStatus.ACTIVE,
      fullName: "Lena Organizer",
      email: "lena@nimbuslabs.io",
      contactId,
    },
  });
  await prisma.profileRole.upsert({
    where: {
      profileId_roleId: {
        profileId: organizerProfileId,
        roleId: sid("role:EVENT_ORGANIZER"),
      },
    },
    update: {},
    create: {
      id: sid("pr:organizer"),
      orgId: ORG_ID,
      profileId: organizerProfileId,
      roleId: sid("role:EVENT_ORGANIZER"),
    },
  });

  // -- Spaces -----------------------------------------------------------------
  const spaces: Array<{
    key: string;
    name: string;
    kind: SpaceKind;
    capacity?: number;
    standing?: number;
    flow?: number;
    publicVisible?: boolean;
  }> = [
    { key: "green", name: "Green Room", kind: "ROOM", capacity: 200, publicVisible: true },
    { key: "orange", name: "Orange Room", kind: "ROOM", capacity: 120, publicVisible: true },
    { key: "blue", name: "Blue Room", kind: "ROOM", capacity: 80, publicVisible: true },
    { key: "yellow", name: "Yellow Room", kind: "ROOM", capacity: 80, publicVisible: true },
    { key: "entrance", name: "Entrance", kind: "ENTRANCE", standing: 120, flow: 120, publicVisible: true },
    { key: "main-corridor", name: "Main Corridor", kind: "CORRIDOR", flow: 80, publicVisible: true },
    { key: "lower-corridor", name: "Lower Corridor", kind: "CORRIDOR", publicVisible: false },
    { key: "storage-a", name: "Storage A", kind: "STORAGE" },
    { key: "storage-b", name: "Storage B", kind: "STORAGE" },
    { key: "tech-storage", name: "Tech Storage", kind: "STORAGE" },
    { key: "tech-booth", name: "Tech Booth", kind: "TECH_ZONE" },
  ];
  for (const [i, s] of spaces.entries()) {
    await prisma.space.upsert({
      where: { orgId_name: { orgId: ORG_ID, name: s.name } },
      update: {},
      create: {
        id: sid(`space:${s.key}`),
        orgId: ORG_ID,
        name: s.name,
        kind: s.kind,
        capacity: s.capacity,
        standingCapacity: s.standing,
        comfortFlow: s.flow,
        publicVisible: s.publicVisible ?? false,
        staffOnly: !(s.publicVisible ?? false),
        sortOrder: i,
      },
    });
  }
  const adjacencies: Array<[string, string]> = [
    ["entrance", "main-corridor"],
    ["main-corridor", "blue"],
    ["main-corridor", "orange"],
    ["lower-corridor", "green"],
    ["lower-corridor", "yellow"],
    ["tech-storage", "green"],
  ];
  for (const [from, to] of adjacencies) {
    await prisma.spaceAdjacency.upsert({
      where: {
        fromSpaceId_toSpaceId: {
          fromSpaceId: sid(`space:${from}`),
          toSpaceId: sid(`space:${to}`),
        },
      },
      update: {},
      create: {
        id: sid(`adj:${from}->${to}`),
        orgId: ORG_ID,
        fromSpaceId: sid(`space:${from}`),
        toSpaceId: sid(`space:${to}`),
      },
    });
  }

  // -- Placeholder locations (storage/scan points) ----------------------------
  const locations: Array<{ key: string; name: string; kind: LocationKind; space?: string }> = [
    { key: "loc-storage-a", name: "Storage A — Rack 1", kind: "STORAGE_POINT", space: "storage-a" },
    { key: "loc-storage-b", name: "Storage B — Rack 1", kind: "STORAGE_POINT", space: "storage-b" },
    { key: "loc-tech-storage", name: "Tech Storage — Shelf 1", kind: "SHELF", space: "tech-storage" },
    { key: "loc-tech-booth", name: "Tech Booth — Console", kind: "TECH_BOOTH", space: "tech-booth" },
    { key: "loc-entrance-desk", name: "Entrance — Registration Scan", kind: "SCAN_POINT", space: "entrance" },
  ];
  for (const [i, l] of locations.entries()) {
    await prisma.location.upsert({
      where: { id: sid(l.key) },
      update: {},
      create: {
        id: sid(l.key),
        orgId: ORG_ID,
        spaceId: l.space ? sid(`space:${l.space}`) : null,
        name: l.name,
        kind: l.kind,
        qrCode: `LOC-${l.key.toUpperCase()}`,
        staffOnly: true,
        publicVisible: false,
        sortOrder: i,
      },
    });
  }

  // -- Asset categories (with per-group setup/teardown/return-buffer) ---------
  const categories: Array<{
    key: string;
    name: string;
    mode: AssetTrackingMode;
    unit?: string;
    setup: number;
    teardown: number;
    buffer: number;
    replacement?: string;
    visibility?: AssetVisibility;
  }> = [
    { key: "wireless-mic", name: "Wireless Microphone", mode: "SERIALIZED", setup: 15, teardown: 10, buffer: 30, replacement: "wired-mic" },
    { key: "wired-mic", name: "Wired Microphone", mode: "SERIALIZED", setup: 15, teardown: 10, buffer: 30 },
    { key: "projector", name: "Projector", mode: "SERIALIZED", setup: 30, teardown: 20, buffer: 30 },
    { key: "screen", name: "Screen", mode: "SERIALIZED", setup: 30, teardown: 20, buffer: 30 },
    { key: "speaker", name: "Speaker", mode: "SERIALIZED", setup: 20, teardown: 15, buffer: 30 },
    { key: "reg-desk", name: "Registration Desk", mode: "SERIALIZED", setup: 20, teardown: 15, buffer: 30 },
    { key: "chairs", name: "Chairs", mode: "BULK", unit: "pcs", setup: 60, teardown: 45, buffer: 30 },
    { key: "tables", name: "Tables", mode: "BULK", unit: "pcs", setup: 60, teardown: 45, buffer: 30 },
    { key: "ext-cables", name: "Extension Cables", mode: "BULK", unit: "pcs", setup: 20, teardown: 15, buffer: 30 },
    { key: "cable-covers", name: "Cable Covers", mode: "BULK", unit: "pcs", setup: 20, teardown: 15, buffer: 30 },
  ];
  for (const c of categories) {
    await prisma.assetCategory.upsert({
      where: { orgId_name: { orgId: ORG_ID, name: c.name } },
      update: {
        defaultSetupMinutes: c.setup,
        defaultTeardownMinutes: c.teardown,
        defaultReturnBufferMinutes: c.buffer,
      },
      create: {
        id: sid(`cat:${c.key}`),
        orgId: ORG_ID,
        name: c.name,
        trackingMode: c.mode,
        unit: c.unit,
        defaultSetupMinutes: c.setup,
        defaultTeardownMinutes: c.teardown,
        defaultReturnBufferMinutes: c.buffer,
        defaultVisibility: c.visibility ?? AssetVisibility.STAFF_ONLY,
      },
    });
  }
  // Wire replacement: Wireless Microphone -> Wired Microphone
  await prisma.assetCategory.update({
    where: { id: sid("cat:wireless-mic") },
    data: { replacementCategoryId: sid("cat:wired-mic") },
  });

  // -- Serialized assets ------------------------------------------------------
  const serialized: Array<{ key: string; name: string; cat: string }> = [
    ...[1, 2, 3, 4].map((n) => ({ key: `wmic-0${n}`, name: `Wireless Mic 0${n}`, cat: "wireless-mic" })),
    ...[1, 2].map((n) => ({ key: `wdmic-0${n}`, name: `Wired Mic 0${n}`, cat: "wired-mic" })),
    ...[1, 2].map((n) => ({ key: `proj-0${n}`, name: `Projector 0${n}`, cat: "projector" })),
    ...[1, 2].map((n) => ({ key: `screen-0${n}`, name: `Screen 0${n}`, cat: "screen" })),
    ...[1, 2].map((n) => ({ key: `spk-0${n}`, name: `Speaker 0${n}`, cat: "speaker" })),
    { key: "regdesk-01", name: "Registration Desk 01", cat: "reg-desk" },
  ];
  for (const a of serialized) {
    await prisma.asset.upsert({
      where: { orgId_assetTag: { orgId: ORG_ID, assetTag: a.name.toUpperCase().replace(/\s+/g, "-") } },
      update: {},
      create: {
        id: sid(`asset:${a.key}`),
        orgId: ORG_ID,
        categoryId: sid(`cat:${a.cat}`),
        name: a.name,
        assetTag: a.name.toUpperCase().replace(/\s+/g, "-"),
        qrCode: `AST-${a.key.toUpperCase()}`,
        homeLocationId: sid("loc-tech-storage"),
      },
    });
  }

  // -- Bulk batches -----------------------------------------------------------
  const batches: Array<{ key: string; name: string; cat: string; total: number }> = [
    { key: "chairs", name: "Chairs Bulk Stack", cat: "chairs", total: 220 },
    { key: "tables", name: "Tables Bulk Stack", cat: "tables", total: 30 },
    { key: "ext-cables", name: "Extension Cables Stock", cat: "ext-cables", total: 40 },
    { key: "cable-covers", name: "Cable Covers Stock", cat: "cable-covers", total: 60 },
  ];
  for (const b of batches) {
    await prisma.assetBatch.upsert({
      where: { id: sid(`batch:${b.key}`) },
      update: {},
      create: {
        id: sid(`batch:${b.key}`),
        orgId: ORG_ID,
        categoryId: sid(`cat:${b.cat}`),
        name: b.name,
        totalQuantity: b.total,
        availableQuantity: b.total,
        homeLocationId: sid("loc-storage-a"),
      },
    });
  }

  // -- Kits -------------------------------------------------------------------
  const cableKit = sid("kit:cable-a");
  await prisma.assetKit.upsert({
    where: { orgId_name: { orgId: ORG_ID, name: "Cable Kit A" } },
    update: {},
    create: { id: cableKit, orgId: ORG_ID, name: "Cable Kit A", description: "Power/cable safety kit" },
  });
  await prisma.assetKitItem.upsert({
    where: { id: sid("kititem:cable-a-ext") },
    update: {},
    create: { id: sid("kititem:cable-a-ext"), orgId: ORG_ID, kitId: cableKit, batchId: sid("batch:ext-cables"), quantity: 4 },
  });
  await prisma.assetKitItem.upsert({
    where: { id: sid("kititem:cable-a-cover") },
    update: {},
    create: { id: sid("kititem:cable-a-cover"), orgId: ORG_ID, kitId: cableKit, batchId: sid("batch:cable-covers"), quantity: 6 },
  });
  const signageKit = sid("kit:signage");
  await prisma.assetKit.upsert({
    where: { orgId_name: { orgId: ORG_ID, name: "Signage Kit" } },
    update: {},
    create: { id: signageKit, orgId: ORG_ID, name: "Signage Kit", description: "Wayfinding signage bundle" },
  });

  // -- Event request (canonical messy startup conference) ---------------------
  const requestId = sid("request:startup");
  const extracted = {
    eventType: "conference",
    expectedGuests: 180,
    setupHours: 2,
    mainStage: true,
    breakoutRooms: 2,
    coffeeArea: true,
    registrationDesk: true,
    publicGuestRegistration: true,
    screens: 1,
    projectors: 1,
    wirelessMicrophones: 4,
    wiredMicrophones: 0,
    chairs: 150,
    tables: 15,
    speakers: 2,
    livestream: false,
    missingFields: ["exact event date", "event end time"],
  };
  await prisma.eventRequest.upsert({
    where: { id: requestId },
    update: {},
    create: {
      id: requestId,
      orgId: ORG_ID,
      clientId,
      contactId,
      title: "Startup Conference",
      rawText:
        "Hi Pyramid team, we want to host a startup conference next month for around 180 guests. We need a keynote stage, two breakout rooms, coffee and registration near the entrance, 4 wireless microphones, a screen, projector, speakers, chairs and tables. Guests should register online and receive QR passes. We also need clear directions inside the building.",
      channel: "portal",
      status: EventRequestStatus.REVIEWED,
      approvalStatus: EventApprovalStatus.PENDING_APPROVAL,
      extractedJson: extracted,
      confidence: 0.86,
      missingFields: extracted.missingFields,
      submittedByProfileId: organizerProfileId,
    },
  });

  // -- Event (starts PENDING_APPROVAL) ---------------------------------------
  const eventId = sid("event:startup");
  const setupStart = new Date("2026-07-15T07:00:00.000Z");
  const eventStart = new Date("2026-07-15T09:00:00.000Z");
  const eventEnd = new Date("2026-07-15T17:00:00.000Z");
  const teardownEnd = new Date("2026-07-15T19:00:00.000Z");
  await prisma.event.upsert({
    where: { id: eventId },
    update: {},
    create: {
      id: eventId,
      orgId: ORG_ID,
      requestId,
      clientId,
      code: "EVT-2026-0001",
      title: "Nimbus Startup Conference",
      type: EventType.CONFERENCE,
      status: EventStatus.PENDING_APPROVAL,
      approvalStatus: EventApprovalStatus.PENDING_APPROVAL,
      visibility: EventVisibility.PUBLIC,
      expectedGuests: 180,
      eventStart,
      eventEnd,
      setupStart,
      teardownEnd,
      returnBufferMinutes: 30,
    },
  });

  // Plan version snapshot
  await prisma.eventPlanVersion.upsert({
    where: { eventId_version: { eventId, version: 1 } },
    update: {},
    create: {
      id: sid("plan:startup:v1"),
      orgId: ORG_ID,
      eventId,
      version: 1,
      reason: "Initial deterministic plan",
      snapshot: {
        spaces: ["Green Room", "Blue Room", "Yellow Room", "Entrance"],
        assets: { wirelessMics: 4, screens: 1, projectors: 1, speakers: 2 },
        gates: { space: "GO", assets: "WARNING", power: "WARNING", guest: "GO" },
      },
    },
  });

  // -- Asset reservation for startup conference (soft hold) -------------------
  const startupResId = sid("res:startup");
  await prisma.assetReservation.upsert({
    where: { id: startupResId },
    update: {},
    create: {
      id: startupResId,
      orgId: ORG_ID,
      eventId,
      status: AssetReservationStatus.SOFT_HOLD,
      setupStart,
      eventStart,
      eventEnd,
      teardownEnd,
      returnBufferMinutes: 30,
    },
  });
  // Reserve wireless mics 01-04 for the conference
  for (const n of [1, 2, 3, 4]) {
    await prisma.assetReservationItem.upsert({
      where: { id: sid(`resitem:startup:wmic-0${n}`) },
      update: {},
      create: {
        id: sid(`resitem:startup:wmic-0${n}`),
        orgId: ORG_ID,
        reservationId: startupResId,
        assetId: sid(`asset:wmic-0${n}`),
        quantity: 1,
        itemStatus: AssetReservationItemStatus.SOFT_HOLD,
        windowStart: setupStart,
        windowEnd: teardownEnd,
      },
    });
  }

  // -- Conflict event: Robotics Workshop double-books Wireless Mic 04 ---------
  const roboticsEventId = sid("event:robotics");
  await prisma.event.upsert({
    where: { id: roboticsEventId },
    update: {},
    create: {
      id: roboticsEventId,
      orgId: ORG_ID,
      clientId,
      code: "EVT-2026-0002",
      title: "Robotics Workshop",
      type: EventType.WORKSHOP,
      status: EventStatus.CONFIRMED,
      approvalStatus: EventApprovalStatus.APPROVED,
      visibility: EventVisibility.INTERNAL,
      expectedGuests: 40,
      eventStart,
      eventEnd,
      setupStart,
      teardownEnd,
    },
  });
  const roboticsResId = sid("res:robotics");
  await prisma.assetReservation.upsert({
    where: { id: roboticsResId },
    update: {},
    create: {
      id: roboticsResId,
      orgId: ORG_ID,
      eventId: roboticsEventId,
      status: AssetReservationStatus.RESERVED,
      setupStart,
      eventStart,
      eventEnd,
      teardownEnd,
    },
  });
  await prisma.assetReservationItem.upsert({
    where: { id: sid("resitem:robotics:wmic-04") },
    update: {},
    create: {
      id: sid("resitem:robotics:wmic-04"),
      orgId: ORG_ID,
      reservationId: roboticsResId,
      assetId: sid("asset:wmic-04"),
      quantity: 1,
      itemStatus: AssetReservationItemStatus.RESERVED,
      windowStart: setupStart,
      windowEnd: teardownEnd,
    },
  });

  // Conflict + auto-fix suggestion (substitute Wired Mic 01)
  const conflictId = sid("conflict:wmic-04");
  await prisma.conflict.upsert({
    where: { id: conflictId },
    update: {},
    create: {
      id: conflictId,
      orgId: ORG_ID,
      eventId,
      type: ConflictType.SERIALIZED_DOUBLE_BOOKING,
      severity: ConflictSeverity.HIGH,
      status: ConflictStatus.OPEN,
      title: "Wireless Mic 04 double-booked with Robotics Workshop",
      detail: {
        asset: "Wireless Mic 04",
        competingEvent: "Robotics Workshop",
        requiredWireless: 4,
        availableWireless: 3,
      },
    },
  });
  await prisma.conflictSuggestion.upsert({
    where: { id: sid("suggestion:wmic-04-sub") },
    update: {},
    create: {
      id: sid("suggestion:wmic-04-sub"),
      orgId: ORG_ID,
      conflictId,
      type: ConflictSuggestionType.SUBSTITUTE_ASSET,
      label: "Substitute Wired Mic 01 for the keynote stage",
      rationale: "Wired Mic 01 is free for the full reservation window and is an allowed replacement category.",
      payload: { replaceAssetId: sid("asset:wmic-04"), withAssetId: sid("asset:wdmic-01") },
      rank: 1,
    },
  });

  // -- Quote + proposal -------------------------------------------------------
  const quoteId = sid("quote:startup");
  await prisma.quote.upsert({
    where: { id: quoteId },
    update: {},
    create: {
      id: quoteId,
      orgId: ORG_ID,
      eventId,
      clientId,
      status: QuoteStatus.DRAFT,
      currency: "ALL",
      subtotal: 450000,
      taxTotal: 90000,
      total: 540000,
    },
  });
  await prisma.quoteItem.upsert({
    where: { id: sid("quoteitem:spaces") },
    update: {},
    create: {
      id: sid("quoteitem:spaces"),
      orgId: ORG_ID,
      quoteId,
      label: "Space rental (Green, Blue, Yellow, Entrance)",
      quantity: 1,
      unitPrice: 300000,
      lineTotal: 300000,
      sortOrder: 0,
    },
  });
  await prisma.quoteItem.upsert({
    where: { id: sid("quoteitem:av") },
    update: {},
    create: {
      id: sid("quoteitem:av"),
      orgId: ORG_ID,
      quoteId,
      label: "AV package (mics, screen, projector, speakers)",
      quantity: 1,
      unitPrice: 150000,
      lineTotal: 150000,
      sortOrder: 1,
    },
  });
  await prisma.proposal.upsert({
    where: { id: sid("proposal:startup") },
    update: {},
    create: {
      id: sid("proposal:startup"),
      orgId: ORG_ID,
      eventId,
      quoteId,
      clientId,
      status: ProposalStatus.DRAFT,
      title: "Proposal — Nimbus Startup Conference",
      sharedWithContactId: contactId,
    },
  });

  // -- Public publication -----------------------------------------------------
  const publicationId = sid("pub:startup");
  await prisma.eventPublication.upsert({
    where: { eventId },
    update: {},
    create: {
      id: publicationId,
      orgId: ORG_ID,
      eventId,
      slug: "nimbus-startup-conference",
      status: PublicationStatus.PUBLISHED,
      publicTitle: "Nimbus Startup Conference",
      publicDescription:
        "A day of keynotes and breakout sessions for the Tirana startup community at the Pyramid.",
      registrationOpen: true,
      capacityPublic: 180,
      publishedAt: new Date(),
      agenda: [
        { time: "09:00", title: "Doors & Registration", space: "Entrance" },
        { time: "10:00", title: "Keynote", space: "Green Room" },
        { time: "13:00", title: "Breakouts", space: "Blue Room / Yellow Room" },
      ],
      publicMap: {
        route: ["Entrance", "Main Corridor", "Blue Room"],
      },
    },
  });

  // -- Guest registrations + tickets ------------------------------------------
  const guests = [
    { key: "g1", name: "Arber Guest", email: "arber@example.com", checkin: true },
    { key: "g2", name: "Besa Guest", email: "besa@example.com", checkin: false },
    { key: "g3", name: "Drin Guest", email: "drin@example.com", checkin: false },
  ];
  for (const g of guests) {
    const regId = sid(`reg:${g.key}`);
    await prisma.guestRegistration.upsert({
      where: { id: regId },
      update: {},
      create: {
        id: regId,
        orgId: ORG_ID,
        publicationId,
        fullName: g.name,
        email: g.email,
        status: g.checkin ? GuestRegistrationStatus.CHECKED_IN : GuestRegistrationStatus.CONFIRMED,
      },
    });
    const ticketId = sid(`ticket:${g.key}`);
    await prisma.guestTicket.upsert({
      where: { id: ticketId },
      update: {},
      create: {
        id: ticketId,
        orgId: ORG_ID,
        registrationId: regId,
        token: token(g.key),
        status: g.checkin ? GuestTicketStatus.CHECKED_IN : GuestTicketStatus.REGISTERED,
      },
    });
    if (g.checkin) {
      await prisma.guestCheckin.upsert({
        where: { id: sid(`checkin:${g.key}`) },
        update: {},
        create: {
          id: sid(`checkin:${g.key}`),
          orgId: ORG_ID,
          ticketId,
          scannedByProfileId: sid("profile:tech"),
          gateLabel: "Entrance",
        },
      });
    }
  }

  // -- App settings -----------------------------------------------------------
  const settings: Array<{ key: string; value: string; type: SettingValueType }> = [
    { key: "currency", value: "ALL", type: SettingValueType.STRING },
    { key: "vat_rate", value: "0.20", type: SettingValueType.NUMBER },
    { key: "reservation.default_return_buffer_minutes", value: "30", type: SettingValueType.NUMBER },
    { key: "reservation.default_setup_minutes", value: "120", type: SettingValueType.NUMBER },
    { key: "soft_delete.retention_days", value: "30", type: SettingValueType.NUMBER },
    { key: "storage.upload_dir", value: "./uploads", type: SettingValueType.STRING },
    { key: "demo_mode", value: "true", type: SettingValueType.BOOLEAN },
  ];
  for (const s of settings) {
    await prisma.appSetting.upsert({
      where: { orgId_key: { orgId: ORG_ID, key: s.key } },
      update: { value: s.value, valueType: s.type },
      create: { id: sid(`setting:${s.key}`), orgId: ORG_ID, key: s.key, value: s.value, valueType: s.type },
    });
  }

  console.log("✅ Seed complete (idempotent).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
