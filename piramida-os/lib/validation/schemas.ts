import { z } from "zod";
import {
  ProfileType,
  ProfileStatus,
  SpaceKind,
  LocationKind,
  EventRequestStatus,
  EventApprovalStatus,
  EventType,
  EventVisibility,
  AssetTrackingMode,
  AssetStatus,
  AssetCondition,
  AssetVisibility,
  AssetReservationItemStatus,
  AssetMovementStatus,
  AssetIssueType,
  MaintenanceStatus,
  ConflictType,
  ConflictSeverity,
  ConflictStatus,
  TaskStatus,
  TaskPriority,
  QuoteStatus,
  ProposalStatus,
  AttachmentOwnerType,
  CommentOwnerType,
  CommentVisibility,
  SettingValueType,
} from "@prisma/client";
import {
  trimmed,
  requiredText,
  emailSchema,
  phoneSchema,
  slugSchema,
  uuid,
  money,
  positiveInt,
  nonNegInt,
  dateSchema,
  jsonObject,
  jsonValue,
  eventWindowRefine,
  exactlyOne,
  atLeastOne,
} from "./common";

/**
 * API input DTOs for Piramida / Pyramid OS.
 *
 * These validate ONLY client-supplied fields. Server-injected values (org_id —
 * single org; id; created_at/updated_at; audit actor; computed status defaults)
 * are added in the service/route layer, never trusted from the client.
 *
 * Field names and enum values match prisma/schema.prisma exactly. Where this
 * brief referenced the original pre-decision spec (e.g. EXTERNAL_ORGANIZER,
 * setupStartsAt, separate maintenance/reservation-approval statuses), the schema
 * uses the LOCKED names instead (ORGANIZER, setupStart, the simpler reservation
 * status machine). See docs/validation-and-implementation-contracts.md.
 */

// Spatial fields shared by Space and Location (3D-model ready).
const spatialFields = {
  modelNodeId: trimmed(120).optional(),
  floor: z.coerce.number().int().optional(),
  x: z.coerce.number().optional(),
  y: z.coerce.number().optional(),
  z: z.coerce.number().optional(),
  width: z.coerce.number().nonnegative().optional(),
  height: z.coerce.number().nonnegative().optional(),
  depth: z.coerce.number().nonnegative().optional(),
  sortOrder: z.coerce.number().int().optional(),
  metadata: jsonObject.optional(),
};

// ============================================================================
// Profiles, Clients, Contacts
// ============================================================================

export const createProfileInput = z.object({
  type: z.nativeEnum(ProfileType),
  status: z.nativeEnum(ProfileStatus).optional(),
  fullName: requiredText(160),
  displayName: trimmed(80).optional(),
  email: emailSchema,
  phone: phoneSchema.optional(),
  title: trimmed(120).optional(),
  authUserId: uuid.optional(), // -> auth.users.id, null until first sign-in
  contactId: uuid.optional(), // required when type === ORGANIZER (enforced in service)
});

export const updateProfileInput = z
  .object({
    fullName: requiredText(160),
    displayName: trimmed(80).nullable(),
    phone: phoneSchema.nullable(),
    title: trimmed(120).nullable(),
    status: z.nativeEnum(ProfileStatus),
    avatarFileId: uuid.nullable(),
  })
  .partial();

export const createClientInput = z.object({
  name: requiredText(200),
  legalName: trimmed(200).optional(),
  industry: trimmed(120).optional(),
  website: z.url("Invalid URL").max(300).optional(),
  billingEmail: emailSchema.optional(),
  taxId: trimmed(60).optional(),
  notes: trimmed(2000).optional(), // staff-only
  status: trimmed(40).optional(),
});

export const createContactInput = z.object({
  clientId: uuid,
  firstName: requiredText(80),
  lastName: requiredText(80),
  email: emailSchema,
  phone: phoneSchema.optional(),
  roleTitle: trimmed(120).optional(),
  isPrimary: z.boolean().optional(),
  status: trimmed(40).optional(),
});

// ============================================================================
// Spaces & Locations (DB records; later imported from 3D model)
// ============================================================================

export const createSpaceInput = z.object({
  name: requiredText(120),
  code: trimmed(40).optional(),
  kind: z.nativeEnum(SpaceKind),
  capacity: nonNegInt.optional(),
  standingCapacity: nonNegInt.optional(),
  comfortFlow: nonNegInt.optional(),
  publicVisible: z.boolean().optional(),
  staffOnly: z.boolean().optional(),
  ...spatialFields,
});
export const updateSpaceInput = createSpaceInput.partial();

export const createLocationInput = z.object({
  spaceId: uuid.optional(),
  name: requiredText(120),
  kind: z.nativeEnum(LocationKind),
  qrCode: trimmed(120).optional(),
  publicVisible: z.boolean().optional(),
  staffOnly: z.boolean().optional(),
  ...spatialFields,
});
export const updateLocationInput = createLocationInput.partial();

// ============================================================================
// Event Requests (human review/approval)
// ============================================================================

export const createEventRequestInput = z.object({
  clientId: uuid,
  contactId: uuid,
  title: trimmed(200).optional(),
  rawText: requiredText(20000),
  channel: trimmed(40).optional(),
  submittedByProfileId: uuid.optional(),
});

// Staff records the AI/manual parse result and moves the request along.
export const reviewEventRequestInput = z.object({
  requestId: uuid,
  status: z.nativeEnum(EventRequestStatus),
  extractedJson: jsonValue.optional(),
  confidence: z.coerce.number().min(0).max(1).optional(),
  missingFields: jsonValue.optional(),
  notes: trimmed(2000).optional(),
});

// Human verification decision on a request.
export const approveEventRequestInput = z
  .object({
    requestId: uuid,
    approvalStatus: z.enum([
      EventApprovalStatus.APPROVED,
      EventApprovalStatus.REJECTED,
      EventApprovalStatus.NEEDS_CHANGES,
    ]),
    reason: trimmed(2000).optional(),
    requestedChanges: jsonValue.optional(),
  })
  .superRefine((d, ctx) => {
    if (d.approvalStatus === EventApprovalStatus.NEEDS_CHANGES && !d.requestedChanges) {
      ctx.addIssue({ code: "custom", path: ["requestedChanges"], message: "Required when requesting changes" });
    }
  });

// ============================================================================
// Events
// ============================================================================

export const createEventInput = z
  .object({
    requestId: uuid.optional(),
    clientId: uuid,
    code: requiredText(40),
    title: requiredText(200),
    type: z.nativeEnum(EventType),
    visibility: z.nativeEnum(EventVisibility).optional(),
    expectedGuests: nonNegInt.optional(),
    eventStart: dateSchema.optional(),
    eventEnd: dateSchema.optional(),
    setupStart: dateSchema.optional(),
    teardownEnd: dateSchema.optional(),
    returnBufferMinutes: nonNegInt.optional(),
    summary: trimmed(4000).optional(),
  })
  .superRefine(eventWindowRefine);

export const updateEventInput = z
  .object({
    title: requiredText(200),
    type: z.nativeEnum(EventType),
    visibility: z.nativeEnum(EventVisibility),
    expectedGuests: nonNegInt,
    eventStart: dateSchema,
    eventEnd: dateSchema,
    setupStart: dateSchema,
    teardownEnd: dateSchema,
    returnBufferMinutes: nonNegInt,
    summary: trimmed(4000),
  })
  .partial()
  .superRefine(eventWindowRefine);

export const approveEventInput = z
  .object({
    eventId: uuid,
    approvalStatus: z.enum([
      EventApprovalStatus.APPROVED,
      EventApprovalStatus.REJECTED,
      EventApprovalStatus.NEEDS_CHANGES,
    ]),
    reason: trimmed(2000).optional(),
    requestedChanges: jsonValue.optional(),
  })
  .superRefine((d, ctx) => {
    if (d.approvalStatus === EventApprovalStatus.NEEDS_CHANGES && !d.requestedChanges) {
      ctx.addIssue({ code: "custom", path: ["requestedChanges"], message: "Required when requesting changes" });
    }
  });

export const createEventRequirementInput = z.object({
  eventId: uuid,
  key: requiredText(80),
  valueJson: jsonValue,
  source: z.enum(["ai", "staff", "derived"]).optional(),
});

// ============================================================================
// Inventory: categories, assets, batches, kits
// ============================================================================

export const createAssetCategoryInput = z.object({
  name: requiredText(120),
  code: trimmed(40).optional(),
  trackingMode: z.nativeEnum(AssetTrackingMode),
  unit: trimmed(20).optional(),
  defaultVisibility: z.nativeEnum(AssetVisibility).optional(),
  defaultSetupMinutes: nonNegInt.optional(),
  defaultTeardownMinutes: nonNegInt.optional(),
  defaultReturnBufferMinutes: nonNegInt.optional(),
  replacementCategoryId: uuid.optional(),
  icon: trimmed(60).optional(),
  metadata: jsonObject.optional(),
});

export const createAssetInput = z.object({
  categoryId: uuid,
  name: requiredText(120),
  assetTag: requiredText(60),
  qrCode: trimmed(120).optional(),
  serialNumber: trimmed(120).optional(),
  status: z.nativeEnum(AssetStatus).optional(),
  condition: z.nativeEnum(AssetCondition).optional(),
  visibility: z.nativeEnum(AssetVisibility).optional(),
  homeLocationId: uuid.optional(),
  currentLocationId: uuid.optional(),
  setupMinutes: nonNegInt.optional(),
  teardownMinutes: nonNegInt.optional(),
  returnBufferMinutes: nonNegInt.optional(),
  purchaseDate: dateSchema.optional(),
  notes: trimmed(2000).optional(),
  metadata: jsonObject.optional(),
});

export const createAssetBatchInput = z
  .object({
    categoryId: uuid,
    name: requiredText(120),
    homeLocationId: uuid.optional(),
    totalQuantity: positiveInt,
    availableQuantity: nonNegInt.optional(),
    reservedQuantity: nonNegInt.optional(),
    damagedQuantity: nonNegInt.optional(),
    unit: trimmed(20).optional(),
    condition: z.nativeEnum(AssetCondition).optional(),
    visibility: z.nativeEnum(AssetVisibility).optional(),
    setupMinutes: nonNegInt.optional(),
    teardownMinutes: nonNegInt.optional(),
    returnBufferMinutes: nonNegInt.optional(),
    metadata: jsonObject.optional(),
  })
  .superRefine((d, ctx) => {
    const sum = (d.availableQuantity ?? 0) + (d.reservedQuantity ?? 0) + (d.damagedQuantity ?? 0);
    if ((d.availableQuantity ?? d.reservedQuantity ?? d.damagedQuantity) !== undefined && sum > d.totalQuantity) {
      ctx.addIssue({ code: "custom", path: ["totalQuantity"], message: "available + reserved + damaged cannot exceed total" });
    }
  });

// Quantities can never go below zero, and the parts can never exceed the total.
export const updateAssetBatchQuantityInput = z
  .object({
    batchId: uuid,
    totalQuantity: nonNegInt.optional(),
    availableQuantity: nonNegInt.optional(),
    reservedQuantity: nonNegInt.optional(),
    damagedQuantity: nonNegInt.optional(),
  })
  .superRefine((d, ctx) => {
    if (d.totalQuantity !== undefined) {
      const sum = (d.availableQuantity ?? 0) + (d.reservedQuantity ?? 0) + (d.damagedQuantity ?? 0);
      if (sum > d.totalQuantity) {
        ctx.addIssue({ code: "custom", path: ["totalQuantity"], message: "parts cannot exceed total" });
      }
    }
  });

export const createAssetKitInput = z.object({
  name: requiredText(120),
  code: trimmed(40).optional(),
  description: trimmed(2000).optional(),
  isActive: z.boolean().optional(),
  metadata: jsonObject.optional(),
});

export const createAssetKitItemInput = z
  .object({
    kitId: uuid,
    categoryId: uuid.optional(),
    assetId: uuid.optional(),
    batchId: uuid.optional(),
    quantity: positiveInt,
    isOptional: z.boolean().optional(),
    sortOrder: z.coerce.number().int().optional(),
  })
  .superRefine((d, ctx) =>
    exactlyOne(d, ["categoryId", "assetId", "batchId"], ctx, "Provide exactly one of categoryId, assetId, batchId"),
  );

// ============================================================================
// Reservations, movements, issues, maintenance
// ============================================================================

export const createAssetReservationInput = z
  .object({
    eventId: uuid,
    setupStart: dateSchema,
    eventStart: dateSchema,
    eventEnd: dateSchema,
    teardownEnd: dateSchema,
    returnBufferMinutes: nonNegInt.optional(),
    notes: trimmed(2000).optional(),
  })
  .superRefine(eventWindowRefine);

export const createAssetReservationItemInput = z
  .object({
    reservationId: uuid,
    categoryId: uuid.optional(), // category-level soft hold (dry run only)
    assetId: uuid.optional(), // serialized
    batchId: uuid.optional(), // bulk quantity
    quantity: positiveInt.optional(),
    itemStatus: z.nativeEnum(AssetReservationItemStatus).optional(),
    sourceKitId: uuid.optional(),
    replacesItemId: uuid.optional(),
  })
  .superRefine((d, ctx) =>
    exactlyOne(
      d,
      ["categoryId", "assetId", "batchId"],
      ctx,
      "AssetReservationItem must reference exactly one of assetId, assetBatchId, or categoryId (soft hold)",
    ),
  );

// Reservation lifecycle actions. The actual AssetReservationStatus machine is
// SOFT_HOLD -> RESERVED -> PICKED -> IN_TRANSIT -> IN_USE -> RETURNED -> RELEASED.
// "approve" => RESERVED, "checkout" => PICKED, "checkin" => RETURNED.
export const approveAssetReservationInput = z.object({
  reservationId: uuid,
  notes: trimmed(2000).optional(),
});

export const checkoutAssetReservationInput = z.object({
  reservationId: uuid,
  locationId: uuid.optional(),
  notes: trimmed(2000).optional(),
});

export const checkinAssetReservationInput = z.object({
  reservationId: uuid,
  returnLocationId: uuid.optional(),
  condition: z.nativeEnum(AssetCondition).optional(),
  notes: trimmed(2000).optional(),
});

export const createAssetMovementInput = z
  .object({
    assetId: uuid.optional(),
    batchId: uuid.optional(),
    reservationItemId: uuid.optional(),
    quantity: positiveInt.optional(),
    fromLocationId: uuid.optional(),
    toLocationId: uuid.optional(),
    status: z.nativeEnum(AssetMovementStatus).optional(),
    notes: trimmed(2000).optional(),
  })
  .superRefine((d, ctx) =>
    atLeastOne(d, ["assetId", "batchId"], ctx, "Provide assetId or batchId"),
  );

export const createAssetIssueInput = z
  .object({
    assetId: uuid.optional(),
    batchId: uuid.optional(),
    type: z.nativeEnum(AssetIssueType),
    maintenanceStatus: z.nativeEnum(MaintenanceStatus).optional(),
    severity: z.nativeEnum(ConflictSeverity).optional(),
    description: requiredText(4000),
    assignedToProfileId: uuid.optional(),
    cost: money.optional(),
  })
  .superRefine((d, ctx) =>
    atLeastOne(d, ["assetId", "batchId"], ctx, "Provide assetId or batchId"),
  );

// Maintenance records are merged into asset_issues (locked decision); this is a
// convenience DTO that defaults type to a maintenance flavour.
export const createMaintenanceRecordInput = z
  .object({
    assetId: uuid.optional(),
    batchId: uuid.optional(),
    type: z.nativeEnum(AssetIssueType).default(AssetIssueType.INSPECTION),
    maintenanceStatus: z.nativeEnum(MaintenanceStatus),
    description: requiredText(4000),
    assignedToProfileId: uuid.optional(),
    cost: money.optional(),
  })
  .superRefine((d, ctx) =>
    atLeastOne(d, ["assetId", "batchId"], ctx, "Provide assetId or batchId"),
  );

// ============================================================================
// Conflicts (created by deterministic services only)
// ============================================================================

export const createConflictInput = z.object({
  eventId: uuid,
  type: z.nativeEnum(ConflictType),
  severity: z.nativeEnum(ConflictSeverity),
  status: z.nativeEnum(ConflictStatus).optional(),
  title: requiredText(200),
  detail: jsonObject.optional(),
  planVersionId: uuid.optional(),
});

export const applyConflictSuggestionInput = z.object({
  conflictId: uuid,
  suggestionId: uuid,
});

// ============================================================================
// Tasks
// ============================================================================

export const createTaskInput = z.object({
  eventId: uuid.optional(),
  title: requiredText(200),
  description: trimmed(4000).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  assignedToProfileId: uuid.optional(),
  spaceId: uuid.optional(),
  locationId: uuid.optional(),
  dueAt: dateSchema.optional(),
  source: trimmed(40).optional(),
});

export const updateTaskStatusInput = z.object({
  taskId: uuid,
  status: z.nativeEnum(TaskStatus),
});

// ============================================================================
// Quotes & Proposals (deterministic money; AI never sets prices)
// ============================================================================

const quoteItemInput = z
  .object({
    label: requiredText(200),
    category: trimmed(80).optional(),
    quantity: money, // Decimal(12,2) >= 0
    unitPrice: money,
    lineTotal: money,
    sourceRef: trimmed(120).optional(),
    sortOrder: z.coerce.number().int().optional(),
  })
  .superRefine((d, ctx) => {
    if (Math.abs(d.quantity * d.unitPrice - d.lineTotal) > 0.01) {
      ctx.addIssue({ code: "custom", path: ["lineTotal"], message: "lineTotal must equal quantity × unitPrice" });
    }
  });

export const createQuoteInput = z
  .object({
    eventId: uuid,
    clientId: uuid,
    status: z.nativeEnum(QuoteStatus).optional(),
    currency: trimmed(3).optional(),
    subtotal: money,
    taxTotal: money.optional(),
    discountTotal: money.optional(),
    total: money,
    validUntil: dateSchema.optional(),
    notes: trimmed(2000).optional(),
    items: z.array(quoteItemInput).optional(),
  })
  .superRefine((d, ctx) => {
    const expected = d.subtotal + (d.taxTotal ?? 0) - (d.discountTotal ?? 0);
    if (Math.abs(expected - d.total) > 0.01) {
      ctx.addIssue({ code: "custom", path: ["total"], message: "total must equal subtotal + tax − discount" });
    }
  });

export const createProposalInput = z.object({
  eventId: uuid,
  quoteId: uuid.optional(),
  clientId: uuid,
  status: z.nativeEnum(ProposalStatus).optional(),
  title: requiredText(200),
  body: trimmed(20000).optional(), // AI prose from validated facts only
  sharedWithContactId: uuid.optional(),
});

export const shareProposalInput = z.object({
  proposalId: uuid,
  sharedWithContactId: uuid,
});

// External organizer's decision on a shared proposal.
export const organizerProposalDecisionInput = z.object({
  proposalId: uuid,
  decision: z.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED"]),
  responseNote: trimmed(4000).optional(),
});

// ============================================================================
// Publication, agenda, guests
// ============================================================================

export const publishEventInput = z.object({
  eventId: uuid,
  slug: slugSchema,
  publicTitle: requiredText(200),
  publicDescription: trimmed(8000).optional(),
  heroFileId: uuid.optional(),
  publicStart: dateSchema.optional(),
  publicEnd: dateSchema.optional(),
  venueLabel: trimmed(120).optional(),
  registrationOpen: z.boolean().optional(),
  capacityPublic: nonNegInt.optional(),
  agenda: z.array(jsonObject).optional(), // denormalized public cache
  publicMap: jsonObject.optional(), // public spaces / route only
});

export const createAgendaItemInput = z
  .object({
    publicationId: uuid,
    spaceId: uuid.optional(),
    title: requiredText(200),
    description: trimmed(4000).optional(),
    startsAt: dateSchema,
    endsAt: dateSchema,
    sortOrder: z.coerce.number().int().optional(),
    publicVisible: z.boolean().optional(),
  })
  .superRefine((d, ctx) => {
    if (!(d.startsAt < d.endsAt)) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "endsAt must be after startsAt" });
    }
  });

// Public route input. Capacity / waitlist is enforced server-side against the
// publication, never trusted from the client.
export const guestRegistrationInput = z.object({
  publicationId: uuid,
  fullName: requiredText(160),
  email: emailSchema,
  phone: phoneSchema.optional(),
  company: trimmed(160).optional(),
  consentAccepted: z.literal(true, { error: "Consent is required" }),
  answers: jsonObject.optional(),
});

export const checkinGuestTicketInput = z.object({
  token: z.string().trim().min(20).max(128), // high-entropy; exact-match lookup only
  gateLabel: trimmed(60).optional(),
});

// ============================================================================
// Files, attachments, comments, settings
// ============================================================================

// Limits also enforced in lib/storage/uploads.ts (single source for the lists).
const ALLOWED_UPLOAD_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

export const uploadFileInput = z.object({
  originalName: requiredText(255),
  mimeType: z.enum(ALLOWED_UPLOAD_MIME),
  sizeBytes: positiveInt.refine((n) => n <= MAX_UPLOAD_BYTES, `File exceeds ${MAX_UPLOAD_BYTES} bytes`),
  checksum: trimmed(128).optional(),
});

export const createAttachmentInput = z.object({
  fileId: uuid,
  ownerType: z.nativeEnum(AttachmentOwnerType),
  ownerId: uuid,
  label: trimmed(120).optional(),
});

export const createCommentInput = z.object({
  ownerType: z.nativeEnum(CommentOwnerType),
  ownerId: uuid,
  body: requiredText(8000),
  visibility: z.nativeEnum(CommentVisibility).optional(),
});

export const updateAppSettingInput = z.object({
  key: requiredText(120),
  value: z.string().max(20000),
  valueType: z.nativeEnum(SettingValueType).optional(),
  group: trimmed(60).optional(),
  label: trimmed(120).optional(),
  description: trimmed(2000).optional(),
  isSecret: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  isEditable: z.boolean().optional(),
});

export { ALLOWED_UPLOAD_MIME, MAX_UPLOAD_BYTES };

// Inferred types (use these in services/route handlers).
export type CreateProfileInput = z.infer<typeof createProfileInput>;
export type UpdateProfileInput = z.infer<typeof updateProfileInput>;
export type CreateClientInput = z.infer<typeof createClientInput>;
export type CreateContactInput = z.infer<typeof createContactInput>;
export type CreateSpaceInput = z.infer<typeof createSpaceInput>;
export type CreateLocationInput = z.infer<typeof createLocationInput>;
export type CreateEventRequestInput = z.infer<typeof createEventRequestInput>;
export type ReviewEventRequestInput = z.infer<typeof reviewEventRequestInput>;
export type ApproveEventRequestInput = z.infer<typeof approveEventRequestInput>;
export type CreateEventInput = z.infer<typeof createEventInput>;
export type ApproveEventInput = z.infer<typeof approveEventInput>;
export type UpdateEventInput = z.infer<typeof updateEventInput>;
export type CreateAssetReservationInput = z.infer<typeof createAssetReservationInput>;
export type CreateAssetReservationItemInput = z.infer<typeof createAssetReservationItemInput>;
export type CreateQuoteInput = z.infer<typeof createQuoteInput>;
export type PublishEventInput = z.infer<typeof publishEventInput>;
export type GuestRegistrationInput = z.infer<typeof guestRegistrationInput>;
export type UploadFileInput = z.infer<typeof uploadFileInput>;
