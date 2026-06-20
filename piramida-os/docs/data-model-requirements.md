# Piramida Data Model Requirements

> Authoritative design document for the initial production-ready data model and enum catalog of **Piramida / Pyramid OS** — an event launch-control platform for the Pyramid of Tirana.
>
> Scope of this document: data model, enum catalog, relationships, permission model, migration & seed strategy. It does **not** implement code; it defines the contract that migrations, Prisma/SQL schema, services, and seeds must satisfy.

---

## Locked Decisions (2026-06-20)

These overrides from the stakeholder are implemented in `prisma/schema.prisma`, the migrations, and `prisma/seed.ts`:

1. **Per-asset / per-group reservation timing.** `AssetCategory` carries `default_setup_minutes`, `default_teardown_minutes`, `default_return_buffer_minutes` (group level); serialized `Asset` and bulk `AssetBatch` each carry nullable `setup_minutes` / `teardown_minutes` / `return_buffer_minutes` overrides. A reservation item's effective window = `event_start − setup` … `event_end + teardown + return_buffer`, taking the per-asset value when set, else the category default.
2. **Currency = `ALL`** (Albanian Lek) as the starting default on `Organization`, `Quote`, and `app_settings.currency`. Changeable later.
3. **Roles merged.** `FINANCE_MANAGER` and `INVENTORY_MANAGER` are removed; `EVENT_MANAGER` now owns inventory + finance permissions. Active `RoleCode`s: `SUPER_ADMIN, ADMIN, EVENT_MANAGER, OPERATIONS_MANAGER, TECHNICIAN, EVENT_ORGANIZER`.
4. **Soft-delete retention = 30 days** (`app_settings.soft_delete.retention_days = 30`; env `SOFT_DELETE_RETENTION_DAYS`). A future purge job may hard-delete soft-deleted rows older than this, except append-only ledgers.
5. **Q7 clarified** — see "Profile auto-provisioning" note under Open Questions; it describes how a `Profile` row is created the first time a Supabase Auth user signs in.

## Confirmed Decisions

These are locked decisions for the MVP and near-term production build. They are not open questions.

1. **Single organization.** One seeded `Organization` row. Every operational table carries `org_id` (FK → `organizations.id`) from day one to avoid a painful future multi-tenant migration. **No tenant-management UI** is built.
2. **No `MEMBER` role.** Generic membership is removed. Roles are the explicit staff set plus `EVENT_ORGANIZER`. A membership program would be a future, explicitly-specified addition.
3. **Guests are temporary records, not users.** Guests never get `auth.users` or `Profile` rows. They live only in `EventParticipant`, `GuestRegistration`, `GuestTicket`, and `GuestCheckin`.
4. **Locations are DB records, not enums.** `Space` and `Location` tables hold all room/zone/scan-point data, seeded as placeholders now and imported later from the 3D / Pyramid Twin model. There is **no `LocationKey` enum**.
5. **Quantity-based inventory is required.** Inventory supports both serialized assets (individually tracked) and bulk batches (quantity-based), plus category-level soft holds.
6. **Supabase Auth is the recommended authentication provider.** `auth.users` is the identity source of truth; the app owns authorization.
7. **Authorization uses `Profile`, `Role`, `ProfileRole`, server-side permission checks, and (optionally) RLS.** UI hiding is never security.
8. **Attachments use local filesystem storage initially.** Metadata lives in `FileObject` + `Attachment` so storage can migrate to Supabase Storage / S3 with no business-model change.
9. **Migrations and seeds are automated.** No manual schema edits in the database; deterministic, idempotent seed scripts.

---

## Authentication and Authorization Recommendation

### Why Supabase Auth is the default choice

- The recommended platform is already Supabase (Postgres + Realtime), so Auth is co-located with the database — no extra identity vendor, one set of credentials, one project.
- It provides email/password, magic links, OAuth providers, JWT issuance, refresh-token rotation, and email verification out of the box, which covers both **staff** sign-in and **external organizer** sign-in.
- JWTs carry a stable `sub` (the `auth.users.id` UUID) and custom claims, which integrate directly with Postgres **RLS** via `auth.uid()`.
- It avoids us hand-rolling password hashing, session management, and token rotation — areas where mistakes are security incidents.

### How `auth.users` links to `Profile`

- `auth.users` (managed by Supabase, in the `auth` schema) is the **identity** record: credentials, email, verification state.
- `Profile` (in our `public` schema) is the **application** record: org membership, display name, status, type, and the anchor for roles and ownership.
- Link: `profiles.auth_user_id uuid UNIQUE REFERENCES auth.users(id)`. One `auth.users` ↔ at most one `Profile`.
- A Postgres trigger (or a server action on first sign-in) creates a `Profile` in `pending_approval`/`invited` status when a new `auth.users` row appears, so the app always has its own record to attach roles, audit, and ownership to.
- We never query `auth.users` for business logic; we always go through `Profile`.

### Staff Profiles vs External Organizer Profiles

| Aspect | Staff Profile | External Organizer Profile |
|---|---|---|
| `Profile.type` | `STAFF` | `ORGANIZER` |
| Roles | One or more staff `RoleCode`s (`ADMIN`, `EVENT_MANAGER`, …) | `EVENT_ORGANIZER` only |
| Linked to | Internal org | A `Client` (company) via `Contact` |
| Can see | Internal planning, inventory, conflicts, pricing rules, audit | Only their own requests, shared proposal/quote, public event info |
| Created by | Admin invite / seed | Self sign-up or staff invite, then linked to a `Contact` |

Both are real `Profile` + `auth.users` records; the difference is `type`, role set, and what RLS/permission checks allow them to read or mutate.

### Why Guest does not need authentication initially

- Guests interact only with **public** surfaces: a published event page, a registration form, and a tokenized ticket.
- Registration produces a `GuestRegistration` + `GuestTicket` whose `token` is a high-entropy random string. The ticket URL (`/tickets/[token]`) is the bearer credential — knowing the token is sufficient and scoped to exactly one ticket.
- There is no guest dashboard, no cross-event identity, and no private data behind a guest login, so a full auth account would add friction and attack surface with no benefit.
- If a future loyalty/returning-guest program is specified, guests can be upgraded to real `Profile`s without breaking the temporary-record model (the `GuestRegistration` can optionally reference a future `Profile`).

### How RBAC should work

- **Roles** are seeded rows keyed by a stable `RoleCode` enum value. `Role` may hold a human label, description, and a JSON `permissions` array for fine-grained checks.
- **`ProfileRole`** is the many-to-many join: a `Profile` can hold multiple roles (e.g., an `EVENT_MANAGER` who is also `OPERATIONS_MANAGER`).
- Authorization is evaluated **server-side** by a `requirePermission(profile, permission)` / `requireRole(profile, roleCode)` helper used in every Server Action and Route Handler that mutates or reads sensitive data.
- Permissions are derived from roles via a static permission matrix in `lib/auth` (single source of truth), so adding a capability is a code + seed change, not ad-hoc checks.
- `SUPER_ADMIN` bypasses fine-grained checks (break-glass / platform owner); `ADMIN` is the normal top staff role.

### How RLS should protect organizer-owned and public records

RLS is **defense-in-depth** behind server-side checks, especially valuable if the Supabase client is ever used directly.

- **Organizer-owned records** (`event_requests`, organizer-visible `proposals`/`quotes`, `event_request_messages`): policy allows `SELECT`/`UPDATE` only where the row's `client_id`/`organizer_profile_id` resolves to the requesting `auth.uid()`'s organizer profile.
- **Public records** (`event_publications` with `status = PUBLISHED`, public `Space`/`Location` projections, ticket lookups by token): readable by the anon role, but **only the guest-safe columns/views**. Internal tables are never exposed to anon; we expose **views** (e.g., `public_event_view`) that select only safe fields.
- **Staff records** (inventory, conflicts, audit, pricing): RLS requires the requester to have a staff profile in the org; anon and organizer roles get no rows.
- **Tickets**: `guest_tickets` row is selectable by anon **only** when filtered by the exact `token` (enforced via a security-definer RPC, not a broad policy), so tokens can't be enumerated.

### Which actions require server-side role checks

All mutations of operational truth, specifically:

- Creating an event from a request, generating plans, reserving spaces/assets.
- Applying conflict fixes; changing reservation/asset/gate state.
- Generating/approving quotes and proposals; recording event approval.
- Publishing an event; opening/closing registration.
- Staff check-in scanning; launch-readiness overrides.
- Any read of internal inventory, pricing rules, conflicts, audit logs, or staff notes.

UI hiding is **never** sufficient; each of the above is gated by `requireRole`/`requirePermission` in the server layer regardless of what the client shows.

---

## Output 1 — Entity List (Core Visible CRUDs)

Each entity below is a user-facing CRUD. Conventions for **every** operational table: UUID PK (`id`), `org_id` FK, `created_at`/`updated_at` (`timestamptz`), `created_by`/`updated_by` (`profile_id`, nullable for system), and `deleted_at` (`timestamptz`, nullable) for soft delete where noted.

### 1. Staff Users / Profiles (`profiles`)
- **Purpose:** Internal staff and external organizer application identities; anchor for roles, ownership, and audit.
- **Primary users:** Admin (manage), all staff (read self/colleagues).
- **Fields:** `id`, `org_id`, `auth_user_id` (UNIQUE → `auth.users`), `type` (`ProfileType`), `status` (`ProfileStatus`), `full_name`, `display_name`, `email`, `phone?`, `avatar_file_id?`, `title?`, `contact_id?` (for organizers → `Contact`), `last_active_at?`, audit cols, `deleted_at?`.
- **Required:** `org_id`, `type`, `status`, `full_name`, `email`.
- **Optional:** `auth_user_id` (null until first sign-in for invited), `display_name`, `phone`, `avatar_file_id`, `title`, `contact_id`.
- **Relations:** 1—N `ProfileRole`; N—1 `Contact` (organizers); 1—N ownership across requests/events/audit.
- **Validation:** unique `email` per org; `email` format; `type=ORGANIZER` ⇒ `contact_id` required; `type=STAFF` ⇒ no organizer-only role; status transitions enforced.
- **Search/filter/sort:** by name, email, status, type, role, last_active_at, created_at.
- **Permissions:** Admin full CRUD; staff read; self can update limited profile fields; organizer reads only own profile.
- **Audit:** create, role change, status change, disable.
- **Soft delete:** Yes (`deleted_at`); never hard-delete (preserves audit/ownership). Disabling sets `status=DISABLED`.

### 2. Roles (`roles`)
- **Purpose:** Catalog of authorization roles and their permission sets.
- **Primary users:** Admin (read; edit labels/permissions if enabled), system (seed).
- **Fields:** `id`, `org_id`, `code` (`RoleCode`, UNIQUE per org), `label`, `description?`, `permissions` (jsonb array), `is_system` (bool), audit cols.
- **Required:** `org_id`, `code`, `label`, `is_system`.
- **Relations:** N—M `Profile` via `ProfileRole`.
- **Validation:** `code` from `RoleCode` enum; `is_system` roles cannot be deleted; permission strings validated against permission catalog.
- **Recommendation:** **Seed-only with admin-editable labels/permissions.** Codes are fixed; admins may tune the `permissions` jsonb but cannot add/remove role codes. (See Open Questions Q1.)
- **Permissions:** Admin read + edit permissions array; no create/delete of role codes.
- **Audit:** permission edits logged.
- **Soft delete:** No (seed catalog); disabling is not applicable.

### 3. Clients (`clients`)
- **Purpose:** External companies/organizations that request events.
- **Primary users:** Event Manager, Admin.
- **Fields:** `id`, `org_id`, `name`, `legal_name?`, `industry?`, `website?`, `billing_email?`, `tax_id?`, `notes?` (staff-only), `status?`, audit cols, `deleted_at?`.
- **Required:** `org_id`, `name`.
- **Relations:** 1—N `Contact`, 1—N `EventRequest`, 1—N `Event`, 1—N `Quote`.
- **Validation:** unique `name` per org (soft warn); email/website format.
- **Search/filter/sort:** name, industry, status, created_at.
- **Permissions:** staff CRUD; organizer reads only own client (limited fields), never `notes`.
- **Audit:** create/update/merge.
- **Soft delete:** Yes.

### 4. Contacts / External Organizers (`contacts`)
- **Purpose:** People at a `Client`; the external organizer persona. Optionally linked to a `Profile` if they authenticate.
- **Primary users:** Event Manager, Admin; the organizer themselves (own record).
- **Fields:** `id`, `org_id`, `client_id`, `profile_id?` (→ organizer Profile), `first_name`, `last_name`, `email`, `phone?`, `role_title?`, `is_primary` (bool), `status?`, audit cols, `deleted_at?`.
- **Required:** `org_id`, `client_id`, `first_name`, `last_name`, `email`.
- **Relations:** N—1 `Client`; 0/1—1 `Profile`; 1—N `EventRequest` (submitter).
- **Validation:** email format/uniqueness per client; one `is_primary` per client.
- **Search/filter/sort:** name, email, client, is_primary.
- **Permissions:** staff CRUD; organizer reads/updates own contact only.
- **Audit:** create/update/link-to-profile.
- **Soft delete:** Yes.

### 5. Event Requests (`event_requests`)
- **Purpose:** The inbound (often messy) organizer request; AI-parsed and staff-reviewed.
- **Primary users:** Organizer (submit/track own), Event Manager (review).
- **Fields:** `id`, `org_id`, `client_id`, `contact_id`, `submitted_by_profile_id?`, `title?`, `raw_text`, `channel?`, `status` (`EventRequestStatus`), `approval_status` (`EventApprovalStatus`), `extracted_json?` (jsonb), `confidence?`, `missing_fields?` (jsonb), `reviewed_by?`, `reviewed_at?`, `event_id?` (once created), audit cols, `deleted_at?`.
- **Required:** `org_id`, `client_id`, `contact_id`, `raw_text`, `status`.
- **Relations:** N—1 `Client`/`Contact`; 1—1 → `Event`; 1—N `EventRequestMessage`; 1—N `AiRun`; 1—N `Attachment`.
- **Validation:** `raw_text` non-empty; status transitions per state machine; `extracted_json` Zod-validated before use.
- **Search/filter/sort:** status, client, created_at, reviewed_at, confidence.
- **Permissions:** organizer CRUD own (create + read + comment, cannot edit after submit except via messages); staff review/transition.
- **Audit:** received, parsed, reviewed, approved/rejected/needs_changes, converted to event.
- **Soft delete:** Yes.

### 6. Events (`events`)
- **Purpose:** The internal operational event derived from a request; the spine of planning.
- **Primary users:** Event Manager, Ops, all staff.
- **Fields:** `id`, `org_id`, `request_id?`, `client_id`, `code` (human ref), `title`, `type` (`EventType`), `status` (`EventStatus`), `approval_status` (`EventApprovalStatus`), `visibility` (`EventVisibility`), `expected_guests?`, `event_start?`, `event_end?`, `setup_start?`, `teardown_end?`, `return_buffer_minutes?`, `summary?`, `current_plan_version_id?`, `feasibility_score?`, audit cols, `deleted_at?`.
- **Required:** `org_id`, `client_id`, `title`, `type`, `status`, `approval_status`, `visibility`.
- **Relations:** 1—1 `EventRequest`; 1—N `EventRequirement`, `EventPlanVersion`, `AssetReservation`, `SpaceReservation`, `Conflict`, `Task`, `Quote`, `Proposal`, `EventPublication`, `EventParticipant`.
- **Validation:** `event_end > event_start`; `setup_start ≤ event_start`; `teardown_end ≥ event_end`; status machine; can only publish when `approval_status=APPROVED`.
- **Search/filter/sort:** status, type, date range, client, feasibility, visibility.
- **Permissions:** staff CRUD per role; organizer reads shared subset (status, dates, proposal) only.
- **Audit:** every state transition; plan generation; approval; publish; launch override.
- **Soft delete:** Yes; `CANCELLED`/`ARCHIVED` are status values (not deletion).

### 7. Event Approval Workflow (`event_approvals`)
- **Purpose:** Records human approval decisions on events/requests. Approval is **human-verification oriented**; automation prepares text but a staff user records the final decision.
- **Primary users:** Event Manager, Admin.
- **Fields:** `id`, `org_id`, `event_id?`, `event_request_id?`, `status` (`EventApprovalStatus`), `decided_by_profile_id?`, `decided_at?`, `reason?`, `requested_changes?` (jsonb), `is_automated_draft` (bool), audit cols.
- **Required:** `org_id`, target ref (`event_id` XOR `event_request_id`), `status`.
- **Relations:** N—1 `Event`/`EventRequest`; N—1 `Profile` (decider).
- **Validation:** final `APPROVED`/`REJECTED` requires `decided_by_profile_id` (non-null, staff); `NEEDS_CHANGES` requires `requested_changes`.
- **Search/filter/sort:** status, decided_at, event.
- **Permissions:** only Event Manager/Admin may record final decisions; automation may insert drafts flagged `is_automated_draft=true`.
- **Audit:** every decision append-only.
- **Soft delete:** No (decision ledger; append-only).

### 8. Event Publications (`event_publications`)
- **Purpose:** Guest-safe projection of an event for public pages; the **only** source for public/guest reads.
- **Primary users:** Event Manager (manage), Guests/anon (read published).
- **Fields:** `id`, `org_id`, `event_id`, `slug` (UNIQUE), `status` (`PublicationStatus`), `public_title`, `public_description?`, `hero_file_id?`, `public_start?`, `public_end?`, `venue_label?`, `registration_open` (bool), `capacity_public?`, `agenda` (jsonb of `AgendaItem`s), `public_map` (jsonb, public spaces/route only), `published_at?`, `closed_at?`, audit cols, `deleted_at?`.
- **Required:** `org_id`, `event_id`, `slug`, `status`, `public_title`.
- **Relations:** 1—1 `Event`; 1—N `GuestRegistration`.
- **Validation:** no field may derive from internal-only data; slug URL-safe & unique; cannot be `PUBLISHED` unless `Event.approval_status=APPROVED`.
- **Search/filter/sort (staff):** status, event, published_at. **Public:** slug, status=PUBLISHED only.
- **Permissions:** staff manage; anon reads only `PUBLISHED` safe fields (via view/RLS).
- **Audit:** publish/close/hide.
- **Soft delete:** Yes (staff); public sees `HIDDEN`/`CLOSED` as not-available.

### 9. Guest Registrations / Event Participants
See **Guest Design** section for `EventParticipant`, `GuestRegistration`, `GuestTicket`, `GuestCheckin` field detail. CRUD summary:
- **Purpose:** public registration → ticket; internal attendance tracking.
- **Primary users:** Guests (self-register), staff (check-in, attendance reports).
- **Permissions:** guest creates own registration via public route; staff read aggregates and check-in; guests never list other guests.
- **Audit:** registration created, ticket issued, checked-in, cancelled.
- **Soft delete:** registrations cancellable (status), tickets `CANCELLED` not deleted.

### 10. Spaces (`spaces`)
- **Purpose:** Rooms/zones (Green Room, corridors, entrance, storage, tech). Seeded now, enriched from 3D model later.
- **Primary users:** Ops, Event Manager, planning services.
- **Fields:** `id`, `org_id`, `name`, `code?`, `kind` (`SpaceKind`), `capacity?`, `standing_capacity?`, `comfort_flow?`, `floor?`, `public_visible` (bool), `staff_only` (bool), `model_node_id?`, `x?`,`y?`,`z?`,`width?`,`height?`,`depth?`, `sort_order?`, `metadata` (jsonb), audit cols, `deleted_at?`.
- **Required:** `org_id`, `name`, `kind`.
- **Relations:** N—M `Space` via `SpaceAdjacency`; 1—N `Location`; 1—N `SpaceReservation`.
- **Validation:** unique `name`/`code` per org; non-negative capacities.
- **Search/filter/sort:** kind, capacity, floor, public_visible.
- **Permissions:** staff CRUD; public reads only `public_visible=true` safe fields.
- **Audit:** create/update/import-from-model.
- **Soft delete:** Yes.

### 11. Locations (`locations`)
- **Purpose:** Asset scan/storage points; optionally belong to a `Space`. Future 3D-mappable.
- **Primary users:** Event Manager (inventory), Technician.
- **Fields:** `id`, `org_id`, `space_id?`, `name`, `kind` (`LocationKind`), `qr_code?` (UNIQUE), `model_node_id?`, `floor?`, `x?`,`y?`,`z?`,`width?`,`height?`,`depth?`, `public_visible` (bool, default false), `staff_only` (bool, default true), `sort_order?`, `metadata` (jsonb), audit cols, `deleted_at?`.
- **Required:** `org_id`, `name`, `kind`.
- **Relations:** N—1 `Space`; 1—N `Asset`/`AssetBatch` (home location); 1—N `AssetMovement`.
- **Validation:** unique `qr_code` per org; storage/tech locations default `staff_only=true, public_visible=false`.
- **Search/filter/sort:** kind, space, qr_code, floor.
- **Permissions:** staff CRUD; public never sees storage/tech locations.
- **Audit:** create/update/import.
- **Soft delete:** Yes.

### 12. Asset Categories (`asset_categories`)
- **Purpose:** Shared metadata + the unit of category-level soft holds and substitution.
- **Primary users:** Event Manager (inventory).
- **Fields:** `id`, `org_id`, `name`, `code?`, `tracking_mode` (`AssetTrackingMode`), `unit?`, `default_visibility` (`AssetVisibility`), `replacement_category_id?` (self-FK), `icon?`, `metadata` (jsonb), audit cols, `deleted_at?`.
- **Required:** `org_id`, `name`, `tracking_mode`.
- **Relations:** 1—N `Asset`/`AssetBatch`; self-FK `replacement_category_id`; referenced by category-level `AssetReservationItem`.
- **Validation:** unique `name`/`code`; `replacement_category_id ≠ id`.
- **Search/filter/sort:** name, tracking_mode, visibility.
- **Permissions:** Event Manager (inventory)/Admin CRUD; other staff read.
- **Audit:** create/update.
- **Soft delete:** Yes.

### 13. Serialized Assets (`assets`)
- **Purpose:** Individually tracked, high-value equipment (Wireless Mic 04, Projector 01).
- **Primary users:** Event Manager (inventory), Technician.
- **Fields:** `id`, `org_id`, `category_id`, `name`, `asset_tag` (UNIQUE), `qr_code?` (UNIQUE), `serial_number?`, `status` (`AssetStatus`), `condition` (`AssetCondition`), `visibility` (`AssetVisibility`), `home_location_id?`, `current_location_id?`, `purchase_date?`, `notes?` (staff-only), `metadata` (jsonb), audit cols, `deleted_at?`.
- **Required:** `org_id`, `category_id`, `name`, `asset_tag`, `status`, `condition`.
- **Relations:** N—1 `AssetCategory`; N—1 `Location`; 1—N `AssetReservationItem`, `AssetMovement`, `AssetIssue`; N—M `AssetKit` via `AssetKitItem`.
- **Validation:** unique `asset_tag`/`qr_code`/`serial_number`; status machine; `tracking_mode` of category must be `SERIALIZED`.
- **Search/filter/sort:** category, status, condition, location, asset_tag/qr.
- **Permissions:** Inventory/Tech CRUD; never exposed to organizer/guest.
- **Audit:** status/condition/location changes, reservations, issues.
- **Soft delete:** Yes (`retired` status for end-of-life; `deleted_at` for data hygiene).

### 14. Asset Batches (`asset_batches`)
- **Purpose:** Bulk quantity inventory (220 chairs, 30 tables, cable covers).
- **Primary users:** Event Manager (inventory).
- **Fields:** `id`, `org_id`, `category_id`, `name`, `home_location_id?`, `total_quantity`, `available_quantity` (derived/maintained), `reserved_quantity`, `damaged_quantity?`, `unit?`, `condition` (`AssetCondition`), `visibility` (`AssetVisibility`), `metadata` (jsonb), audit cols, `deleted_at?`.
- **Required:** `org_id`, `category_id`, `name`, `total_quantity`.
- **Relations:** N—1 `AssetCategory`/`Location`; 1—N `AssetReservationItem` (quantity reservations), `AssetMovement`.
- **Validation:** `available + reserved + damaged ≤ total`; quantities ≥ 0; category `tracking_mode = BULK`.
- **Search/filter/sort:** category, location, available_quantity.
- **Permissions:** Inventory/Tech CRUD; not exposed externally.
- **Audit:** quantity adjustments, reservations.
- **Soft delete:** Yes.

### 15. Asset Kits (`asset_kits`) + Kit Items (`asset_kit_items`)
- **Purpose:** Reusable bundles (Cable Kit A, Signage Kit) that expand into concrete reservations.
- **Primary users:** Event Manager (inventory), Technician, planning services.
- **Fields (`asset_kits`):** `id`, `org_id`, `name`, `code?`, `description?`, `is_active` (bool), `metadata` (jsonb), audit cols, `deleted_at?`.
- **Fields (`asset_kit_items`):** `id`, `org_id`, `kit_id`, `category_id?`, `asset_id?`, `batch_id?`, `quantity`, `is_optional` (bool), `sort_order?`.
- **Required:** kit: `org_id`, `name`. item: `kit_id`, `quantity`, and exactly one of `category_id`/`asset_id`/`batch_id`.
- **Relations:** 1—N items; items reference category/asset/batch.
- **Validation:** item references exactly one target; `quantity ≥ 1`.
- **Search/filter/sort:** name, is_active.
- **Permissions:** Inventory/Tech CRUD.
- **Audit:** create/update/expand-into-reservation.
- **Soft delete:** Yes (kits); items hard-delete with kit edit.

### 16. Asset Reservations (`asset_reservations`) + Items (`asset_reservation_items`)
- **Purpose:** Reserve assets/batches/categories for an event across a full window. Header + line-item design.
- **Primary users:** Ops, Event Manager (inventory), planning/reservation services.
- **Fields (`asset_reservations`):** `id`, `org_id`, `event_id`, `status` (`AssetReservationStatus`), `setup_start`, `event_start`, `event_end`, `teardown_end`, `return_buffer_minutes`, `reservation_type` (soft_hold vs reserved via status), `notes?`, audit cols, `deleted_at?`.
- **Fields (`asset_reservation_items`):** `id`, `org_id`, `reservation_id`, `category_id?`, `asset_id?`, `batch_id?`, `quantity` (default 1 for serialized), `item_status` (`AssetReservationItemStatus`), `source_kit_id?`, `replaces_item_id?` (for substitution), audit cols.
- **Required:** reservation: `org_id`, `event_id`, `status`, window fields. item: `reservation_id`, exactly one target, `quantity`, `item_status`.
- **Relations:** N—1 `Event`; 1—N items; items → `Asset`/`Batch`/`Category`/`Kit`.
- **Validation:** window (`setup_start ≤ event_start < event_end ≤ teardown_end`); item references exactly one target; reserving a serialized asset must not overlap an existing reservation window (conflict otherwise); batch quantity must not exceed available in window.
- **Search/filter/sort:** event, status, asset/category, window overlap.
- **Permissions:** Ops/Inventory CRUD via reservation service; never exposed externally.
- **Audit:** soft_hold → reserved → picked → in_use → returned → released; substitutions.
- **Soft delete:** Yes (release/cancel via status; `deleted_at` rare).

### 17. Asset Movements (`asset_movements`)
- **Purpose:** Physical movement / QR scan flow of assets (storage → space → return).
- **Primary users:** Technician, Event Manager (inventory).
- **Fields:** `id`, `org_id`, `asset_id?`, `batch_id?`, `quantity?`, `reservation_item_id?`, `from_location_id?`, `to_location_id?`, `status` (`AssetMovementStatus`), `scanned_by_profile_id?`, `scanned_at`, `notes?`, audit cols.
- **Required:** `org_id`, target (`asset_id` or `batch_id`), `status`, `scanned_at`.
- **Relations:** N—1 `Asset`/`Batch`/`Location`/`Reservation item`/`Profile`.
- **Validation:** valid status transition; quantity ≤ reserved for batches.
- **Search/filter/sort:** asset, status, location, scanned_at.
- **Permissions:** Tech/Inventory; QR scan endpoints require staff role.
- **Audit:** every scan append-only.
- **Soft delete:** No (movement ledger).

### 18. Asset Issues / Maintenance (`asset_issues`)
- **Purpose:** Damage, loss, inspection, and maintenance records for assets/batches.
- **Primary users:** Technician, Event Manager (inventory).
- **Fields:** `id`, `org_id`, `asset_id?`, `batch_id?`, `type` (`AssetIssueType`), `maintenance_status` (`MaintenanceStatus`), `severity?`, `description`, `reported_by_profile_id?`, `assigned_to_profile_id?`, `reported_at`, `resolved_at?`, `cost?`, audit cols, `deleted_at?`.
- **Required:** `org_id`, target, `type`, `maintenance_status`, `description`, `reported_at`.
- **Relations:** N—1 `Asset`/`Batch`/`Profile`.
- **Validation:** resolving requires `resolved_at`; sets asset back to appropriate status.
- **Search/filter/sort:** type, status, asset, severity, reported_at.
- **Permissions:** Tech/Inventory CRUD.
- **Audit:** report/assign/resolve.
- **Soft delete:** Yes.

### 19. Conflicts (`conflicts`)
- **Purpose:** Deterministically detected planning conflicts (space overlap, asset shortage, double-booking, buffer, power/cable, guest flow).
- **Primary users:** Ops, Event Manager (read + resolve), detection service (create).
- **Fields:** `id`, `org_id`, `event_id`, `type` (`ConflictType`), `severity` (`ConflictSeverity`), `status` (`ConflictStatus`), `title`, `detail` (jsonb: involved assets/spaces/quantities), `detected_at`, `resolved_at?`, `resolved_by_profile_id?`, `resolution_note?`, `plan_version_id?`, audit cols.
- **Required:** `org_id`, `event_id`, `type`, `severity`, `status`, `detected_at`.
- **Relations:** N—1 `Event`; 1—N `ConflictSuggestion`.
- **Validation:** conflicts are **only** created by deterministic services (never AI); resolving requires updating reservations/gates.
- **Search/filter/sort:** event, type, severity, status.
- **Permissions:** staff read/resolve; never exposed to organizer/guest.
- **Audit:** detected/auto_fixed/resolved/ignored.
- **Soft delete:** No (resolution via status).

### 20. Conflict Suggestions (`conflict_suggestions`)
- **Purpose:** Allowed auto-fix options for a conflict (substitute mic, add Cable Kit A, alt space, increase buffer).
- **Primary users:** Ops, auto-fix engine.
- **Fields:** `id`, `org_id`, `conflict_id`, `type` (`ConflictSuggestionType`), `label`, `rationale?` (AI-explained, validated), `payload` (jsonb: deterministic action params), `is_applied` (bool), `applied_at?`, `applied_by_profile_id?`, `rank?`, audit cols.
- **Required:** `org_id`, `conflict_id`, `type`, `label`, `payload`.
- **Relations:** N—1 `Conflict`.
- **Validation:** `payload` describes a deterministic action; applying revalidates availability in a transaction.
- **Search/filter/sort:** conflict, type, rank, is_applied.
- **Permissions:** staff apply via auto-fix service.
- **Audit:** suggestion applied.
- **Soft delete:** No.

### 21. Tasks (`tasks`) + Dependencies (`task_dependencies`)
- **Purpose:** Operational/crew tasks generated from plan (setup, movement, teardown), with ordering.
- **Primary users:** Ops, Technician, assignees.
- **Fields (`tasks`):** `id`, `org_id`, `event_id?`, `title`, `description?`, `status` (`TaskStatus`), `priority` (`TaskPriority`), `assigned_to_profile_id?`, `space_id?`, `location_id?`, `due_at?`, `started_at?`, `completed_at?`, `source` (e.g., generated/manual), audit cols, `deleted_at?`.
- **Fields (`task_dependencies`):** `id`, `org_id`, `task_id`, `depends_on_task_id`.
- **Required:** task: `org_id`, `title`, `status`, `priority`.
- **Relations:** N—1 `Event`/`Profile`/`Space`/`Location`; self-M via dependencies.
- **Validation:** no cyclic dependencies; status machine; `BLOCKED` if any dependency not `done`.
- **Search/filter/sort:** event, status, priority, assignee, due_at.
- **Permissions:** staff CRUD; assignees update own task status.
- **Audit:** create/assign/status-change.
- **Soft delete:** Yes.

### 22. Quotes (`quotes`) + Items (`quote_items`)
- **Purpose:** Deterministic pricing of an event plan.
- **Primary users:** Event Manager; organizer (read shared).
- **Fields (`quotes`):** `id`, `org_id`, `event_id`, `client_id`, `status` (`QuoteStatus`), `currency`, `subtotal`, `tax_total?`, `discount_total?`, `total`, `valid_until?`, `notes?`, `version`, audit cols, `deleted_at?`.
- **Fields (`quote_items`):** `id`, `org_id`, `quote_id`, `label`, `category?`, `quantity`, `unit_price`, `line_total`, `source_ref?` (asset/space/service), `sort_order?`.
- **Required:** quote: `org_id`, `event_id`, `client_id`, `status`, `currency`, `total`. item: `quote_id`, `label`, `quantity`, `unit_price`, `line_total`.
- **Relations:** N—1 `Event`/`Client`; 1—N items; 1—N `Proposal`.
- **Validation:** `total = subtotal + tax − discount`; line totals = qty × unit; AI never sets prices.
- **Search/filter/sort:** event, client, status, total, valid_until.
- **Permissions:** Event Manager CRUD; organizer reads only when shared via proposal.
- **Audit:** create/version/approve.
- **Soft delete:** Yes (supersede via new version).

### 23. Proposals (`proposals`)
- **Purpose:** Client-facing document combining validated quote + plan facts + AI prose; the organizer approves/requests changes here.
- **Primary users:** Event Manager (create/send), Organizer (review/approve).
- **Fields:** `id`, `org_id`, `event_id`, `quote_id?`, `client_id`, `status` (`ProposalStatus`), `title`, `body` (AI prose from validated facts only), `shared_with_contact_id?`, `sent_at?`, `responded_at?`, `response_note?`, `pdf_file_id?`, `version`, audit cols, `deleted_at?`.
- **Required:** `org_id`, `event_id`, `client_id`, `status`, `title`.
- **Relations:** N—1 `Event`/`Quote`/`Client`/`Contact`.
- **Validation:** body generated only from `event_publication`-safe + quote facts; cannot leak staff notes; status machine.
- **Search/filter/sort:** event, client, status, sent_at.
- **Permissions:** staff create/send; organizer reads own + approve/request-changes.
- **Audit:** sent/approved/changes-requested.
- **Soft delete:** Yes (version supersede).

### 24. App Settings (`app_settings`)
- **Purpose:** Configurable org/app settings (currency, tax rate, buffer defaults, upload path, DEMO_MODE flags).
- **Primary users:** Admin.
- **Fields:** `id`, `org_id`, `key` (UNIQUE per org), `value` (text/jsonb), `value_type` (`SettingValueType`), `description?`, `is_secret` (bool), audit cols.
- **Required:** `org_id`, `key`, `value_type`.
- **Relations:** none.
- **Validation:** `value` parses per `value_type`; secrets never returned to client.
- **Search/filter/sort:** key.
- **Permissions:** Admin CRUD; some keys readable by services only.
- **Audit:** every change.
- **Soft delete:** No (overwrite + audit).

### 25. File Attachments (`file_objects` + `attachments`)
See **File Storage** section. CRUD summary: staff/organizer upload to owned records; metadata stored; binary on local FS now. Permissions scoped to the owner record's permissions. Soft delete: yes (and FS cleanup job).

### 26. Audit Logs / Activity Logs (`audit_logs`) — read-only
- **Purpose:** Append-only ledger of important state transitions.
- **Primary users:** Admin (read), all services (write).
- **Fields:** `id`, `org_id`, `actor_profile_id?`, `action` (`AuditAction`), `entity_type`, `entity_id`, `summary?`, `before` (jsonb?), `after` (jsonb?), `ip?`, `created_at`.
- **Required:** `org_id`, `action`, `entity_type`, `entity_id`, `created_at`.
- **Validation:** insert-only; no update/delete from app paths.
- **Search/filter/sort:** actor, action, entity_type, entity_id, date range.
- **Permissions:** Admin read; no UI edit/delete; writes via audit service only.
- **Audit:** is the audit.
- **Soft delete:** No (immutable).

---

## Output 2 — CRUD List (summary)

Visible CRUD modules: **Profiles, Roles, Clients, Contacts, EventRequests, Events, EventApprovals, EventPublications, GuestRegistrations/EventParticipants, Spaces, Locations, AssetCategories, Assets, AssetBatches, AssetKits, AssetReservations, AssetMovements, AssetIssues, Conflicts, ConflictSuggestions, Tasks, Quotes, Proposals, AppSettings, FileAttachments, AuditLogs (read-only).**

---

## Output 3 — Supporting / Internal Tables

These back the visible CRUDs and deterministic services; not all need full CRUD UI.

| Table | Purpose |
|---|---|
| `organizations` | Single seeded org; FK target for `org_id`. |
| `profile_roles` | RBAC join: `Profile` ↔ `Role` (with `assigned_by`, `assigned_at`). |
| `role_permissions` *(optional)* | If permissions normalized instead of jsonb on `roles`. |
| `space_adjacencies` | `Space` ↔ `Space` graph (directed) for guest-flow/adjacency scoring. |
| `space_reservations` | Reserve a `Space` for an event window (mirror of asset reservation windows). |
| `event_requirements` | Normalized, reviewed requirement rows derived from `extracted_json`. |
| `event_request_messages` | Threaded organizer↔staff messages on a request. |
| `ai_runs` | AI call ledger: input hash, model, latency, validation result, output ref, prompt type. |
| `event_plan_versions` | JSON snapshots of a full plan for Change Impact. |
| `event_plan_diffs` | Computed diffs between two plan versions. |
| `asset_kit_items` | Kit expansion lines (see Kits CRUD). |
| `asset_reservation_items` | Reservation line items (serialized/batch/category). |
| `task_dependencies` | Task ordering graph. |
| `quote_items` | Quote line items. |
| `agenda_items` | Normalized, space-linked agenda rows (migration 0003). `event_publications.agenda` jsonb is kept as a denormalized public cache. |
| `event_participants` | Internal attendance tracking (staff + invited). |
| `guest_registrations` | Public registrations. |
| `guest_tickets` | High-entropy tokenized tickets. |
| `guest_checkins` | Scan/check-in records. |
| `file_objects` | Physical file metadata (storage provider, path, checksum). |
| `attachments` | Polymorphic link of `file_object` → owner record. |
| `comments` *(optional)* | Polymorphic staff/organizer comments with `CommentVisibility`. |
| `notifications` | In-app/email notification queue/log (migration 0003). `org_id` is a plain column (AuditLog pattern); polymorphic `entity_type`/`entity_id` source ref. |
| `audit_logs` | Append-only audit ledger. |
| `app_settings` | Config KV. |
| `_migrations` | Migration tracking (Prisma `_prisma_migrations` or custom). |
| `seed_runs` *(optional)* | Idempotent seed bookkeeping. |

---

## Output 4 — Enum Catalog

> Implemented as **Postgres `enum` types** (or Prisma `enum`s) in one shared module. Adding/removing a value is a migration. Never reused for locations.

```
ProfileStatus            : ACTIVE | INVITED | PENDING_APPROVAL | DISABLED
ProfileType              : STAFF | ORGANIZER
RoleCode                 : SUPER_ADMIN | ADMIN | EVENT_MANAGER | OPERATIONS_MANAGER
                           | TECHNICIAN | EVENT_ORGANIZER
                           // FINANCE_MANAGER + INVENTORY_MANAGER merged into EVENT_MANAGER

EventRequestStatus       : RECEIVED | PARSED | REVIEWED | PLANNING | PROPOSED
                           | APPROVED | REJECTED | CANCELLED
EventStatus              : DRAFT | PENDING_APPROVAL | PLANNING | PROPOSED | CONFIRMED
                           | PUBLISHED | LAUNCH_READY | LIVE | COMPLETED | ARCHIVED | CANCELLED
EventApprovalStatus      : PENDING_APPROVAL | APPROVED | REJECTED | NEEDS_CHANGES | CANCELLED
EventType                : CONFERENCE | WORKSHOP | EXHIBITION | CONCERT | PRIVATE
                           | CORPORATE | OTHER
EventVisibility          : PRIVATE | INTERNAL | PUBLIC
PublicationStatus        : DRAFT | PUBLISHED | CLOSED | HIDDEN

SpaceKind                : ROOM | CORRIDOR | ENTRANCE | HALL | STORAGE | TECH_ZONE
                           | OUTDOOR | OTHER
LocationKind             : STORAGE_POINT | SCAN_POINT | STAGING | SHELF | DOCK
                           | TECH_BOOTH | ZONE | OTHER

AssetTrackingMode        : SERIALIZED | BULK
AssetStatus              : AVAILABLE | SOFT_HOLD | RESERVED | PICKED | IN_TRANSIT | IN_USE
                           | RETURNED | NEEDS_INSPECTION | MAINTENANCE | MISSING | RETIRED
AssetCondition           : EXCELLENT | GOOD | USABLE | NEEDS_INSPECTION | DAMAGED
AssetVisibility          : INTERNAL | STAFF_ONLY | PUBLIC_SAFE
AssetReservationStatus   : SOFT_HOLD | RESERVED | PICKED | IN_TRANSIT | IN_USE
                           | RETURNED | RELEASED | CANCELLED
AssetReservationItemStatus : PENDING | SOFT_HOLD | RESERVED | ASSIGNED | PICKED | IN_USE
                           | RETURNED | RELEASED | SUBSTITUTED | CANCELLED
AssetMovementStatus      : PLANNED | PICKED | IN_TRANSIT | DELIVERED | RETURNED | CANCELLED
AssetIssueType           : DAMAGE | LOSS | MALFUNCTION | INSPECTION | CLEANING | CALIBRATION
MaintenanceStatus        : OPEN | IN_PROGRESS | ON_HOLD | RESOLVED | WONT_FIX

ConflictType             : SPACE_OVERLAP | ASSET_SHORTAGE | SERIALIZED_DOUBLE_BOOKING
                           | SETUP_TEARDOWN_BUFFER | POWER_CABLE_RISK | GUEST_FLOW_RISK
ConflictSeverity         : LOW | MEDIUM | HIGH | CRITICAL
ConflictStatus           : OPEN | IGNORED | RESOLVED | AUTO_FIXED
ConflictSuggestionType   : SUBSTITUTE_ASSET | ADD_CABLE_KIT | ALTERNATIVE_SPACE
                           | OVERFLOW_SPACE | INCREASE_BUFFER | ADD_CREW | REDUCE_QUANTITY

TaskStatus               : TODO | IN_PROGRESS | BLOCKED | READY | DONE | CANCELLED
TaskPriority             : LOW | MEDIUM | HIGH | URGENT

QuoteStatus              : DRAFT | SENT | APPROVED | REJECTED | EXPIRED | SUPERSEDED
ProposalStatus           : DRAFT | SENT | APPROVED | CHANGES_REQUESTED | REJECTED | EXPIRED

GuestRegistrationStatus  : PENDING | CONFIRMED | WAITLISTED | CANCELLED | CHECKED_IN | NO_SHOW
GuestTicketStatus        : REGISTERED | CANCELLED | CHECKED_IN | NO_SHOW
GuestCheckinStatus       : CHECKED_IN | DUPLICATE | REJECTED | REVERSED

FileStorageProvider      : LOCAL | SUPABASE | S3
AttachmentOwnerType      : EVENT_REQUEST | EVENT | PROPOSAL | QUOTE | ASSET | PROFILE
                           | CLIENT | PUBLICATION | TASK | ASSET_ISSUE
CommentOwnerType         : EVENT_REQUEST | EVENT | CONFLICT | TASK | PROPOSAL | ASSET
CommentVisibility        : INTERNAL | STAFF_ONLY | ORGANIZER_SHARED

AuditAction              : CREATE | UPDATE | DELETE | STATUS_CHANGE | LOGIN | APPROVE | REJECT
                           | PUBLISH | RESERVE | RELEASE | CONFLICT_DETECTED | CONFLICT_RESOLVED
                           | AUTO_FIX_APPLIED | PLAN_GENERATED | CHECK_IN | LAUNCH_OVERRIDE
                           | AI_RUN | FILE_UPLOAD
SettingValueType         : STRING | NUMBER | BOOLEAN | JSON | SECRET
```

**Explicitly excluded:** `UserLevel.GUEST`, `UserLevel.MEMBER`, `LocationKey`, and any `UserLevel` enum (replaced by `RoleCode`).

---

## Output 5 — Relationship Map

```
organizations 1───N (everything via org_id)

auth.users 1───1 profiles
profiles N───M roles (via profile_roles)
profiles N───1 contacts (organizers)              contacts N───1 clients
clients 1───N contacts | event_requests | events | quotes

event_requests N───1 client, contact
event_requests 1───1 events (request → event)
event_requests 1───N event_request_messages | ai_runs | attachments
events 1───N event_requirements | event_plan_versions | space_reservations
            | asset_reservations | conflicts | tasks | quotes | proposals
            | event_publications | event_participants | event_approvals
event_plan_versions 1───N event_plan_diffs (from/to)

spaces N───M spaces (space_adjacencies)
spaces 1───N locations | space_reservations
locations 1───N assets | asset_batches | asset_movements

asset_categories 1───N assets | asset_batches
asset_categories 0/1───1 asset_categories (replacement_category_id)
asset_kits 1───N asset_kit_items ───> categories | assets | batches
asset_reservations 1───N asset_reservation_items ───> assets | batches | categories
asset_reservation_items 0/1───1 asset_reservation_items (replaces_item_id, source_kit_id)
assets 1───N asset_reservation_items | asset_movements | asset_issues
asset_batches 1───N asset_reservation_items | asset_movements | asset_issues

conflicts N───1 events ;  conflicts 1───N conflict_suggestions
tasks N───1 events ; tasks N───M tasks (task_dependencies)
quotes 1───N quote_items ; quotes 1───N proposals
proposals N───1 events, quotes, clients, contacts

event_publications 1───1 events
event_publications 1───N guest_registrations
guest_registrations 1───1 guest_tickets
guest_tickets 1───N guest_checkins

file_objects 1───N attachments (polymorphic via owner_type/owner_id)
audit_logs N───1 profiles (actor) [polymorphic entity ref]
```

---

## Output 6 — Permission Model

**Principle:** server-side checks first; RLS as defense-in-depth; UI hiding never counts as security.

Implemented in `lib/auth/permissions.ts` (`ROLE_PERMISSIONS`). `EVENT_MANAGER` absorbs the former inventory + finance roles.

| Capability (permission) | SUPER_ADMIN | ADMIN | EVENT_MGR | OPS_MGR | TECHNICIAN | EVENT_ORGANIZER | Guest(anon) |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Manage profiles/roles (`profiles.manage`,`roles.manage`) | ✓ | ✓ | – | – | – | – | – |
| Manage clients/contacts (`clients.manage`) | ✓ | ✓ | ✓ | – | – | own only | – |
| Submit event request (`requests.submit`) | ✓ | ✓ | ✓ | – | – | own only | – |
| Review/approve request & event (`requests.review`) | ✓ | ✓ | ✓ | – | – | request changes on own | – |
| Generate plan / reserve (`events.plan`) | ✓ | ✓ | ✓ | ✓ | – | – | – |
| Manage inventory (`inventory.manage`) | ✓ | ✓ | ✓ | ✓ | – | – | – |
| QR scan / movements (`inventory.scan`) | ✓ | ✓ | ✓ | ✓ | ✓ | – | – |
| Resolve conflicts / auto-fix (`conflicts.resolve`) | ✓ | ✓ | ✓ | ✓ | – | – | – |
| Manage tasks (`tasks.manage`) | ✓ | ✓ | ✓ | ✓ | – | – | – |
| Quotes (`quotes.manage`) | ✓ | ✓ | ✓ | – | – | read shared | – |
| Proposals (`proposals.manage`) | ✓ | ✓ | ✓ | – | – | read+respond own | – |
| Publish event (`events.publish`) | ✓ | ✓ | ✓ | – | – | – | – |
| Read event_publications (PUBLISHED) | ✓ | ✓ | ✓ | ✓ | ✓ | shared | ✓ safe fields |
| Register / view own ticket | – | – | – | – | – | – | ✓ token-scoped |
| Staff check-in (`checkin.scan`) | ✓ | ✓ | ✓ | ✓ | ✓ | – | – |
| Read audit logs (`audit.read`) | ✓ | ✓ | – | – | – | – | – |
| Manage app settings (`settings.manage`) | ✓ | ✓ | – | – | – | – | – |

**RLS sketch:**
- `event_requests`, `proposals`, `quotes` (organizer-shared): organizer `SELECT` only where row's client resolves to their `auth.uid()` profile; staff `SELECT/UPDATE` if staff profile in org.
- `event_publications`: anon `SELECT` only `status=PUBLISHED` through a guest-safe **view**.
- `guest_tickets`: anon access only via security-definer RPC filtered by exact `token` (no enumeration).
- Internal tables (`assets`, `conflicts`, `audit_logs`, …): no anon/organizer policy = no rows.

---

## Output 7 — Migration Strategy

- **Tooling recommendation:** Prisma Migrate against Supabase Postgres (typed client + migrations), OR plain SQL files under `supabase/migrations`. Either way the schema must be migration-safe and CI-verified. *(See Open Questions Q2 for Prisma vs SQL.)*
- **Rules:**
  - All schema changes are migration-based. **No manual DB schema edits.**
  - **Never edit an applied migration.** Generate a new migration for every change.
  - **Expand → migrate → contract** for destructive changes: add new column/table, backfill, switch reads/writes, then drop the old in a later migration.
  - **Backfills** accompany every new `NOT NULL` column (add nullable → backfill → set `NOT NULL`).
  - UUID PKs (`gen_random_uuid()`); `timestamptz` for all times.
  - `org_id` on every operational table from the first migration.
  - Enums created as first-class types; adding a value = migration (`ALTER TYPE ... ADD VALUE`), removal = expand/contract.
  - Idempotent where practical (`IF NOT EXISTS`, guarded indexes).
  - **CI verification:** migrations applied to an ephemeral Postgres in CI; `prisma migrate diff`/drift check must be clean; seed runs after migrate.
- **Scripts (`package.json`):**
  ```jsonc
  "db:generate": "prisma generate",            // client/types
  "db:migrate":  "prisma migrate dev",         // create+apply dev migration
  "db:deploy":   "prisma migrate deploy",      // apply in CI/prod
  "db:seed":     "tsx scripts/seed.ts",        // idempotent seed
  "db:reset":    "prisma migrate reset --force && npm run db:seed",
  "db:studio":   "prisma studio"
  ```
  (If SQL-only: wrap `supabase db push`/`supabase migration` equivalents behind the same script names.)

---

## Output 8 — Seed Strategy

- **Deterministic & idempotent:** fixed UUIDs (or stable natural keys) and `upsert` semantics so re-running seeds converges, not duplicates. Optional `seed_runs` table records applied seed versions.
- **Seed order (respecting FKs):**
  1. `organization` (single row).
  2. `roles` (all `RoleCode`s) + permission matrices.
  3. Staff `profiles` (one per staff role) + `profile_roles`; one external organizer `profile`.
  4. `clients` + `contacts` (link organizer profile to a contact).
  5. `spaces` (Green/Orange/Blue/Yellow Rooms, Entrance, Main/Lower Corridor, Storage A/B, Tech Storage, Tech Booth) + `space_adjacencies`.
  6. Placeholder `locations` (storage/scan points; `staff_only`, `public_visible=false`).
  7. `asset_categories` (chairs, tables, wireless mic, wired mic, projector, screen, speaker, cables, cable covers, signage, registration desk) with `tracking_mode` + `replacement_category_id` (wireless→wired).
  8. Serialized `assets` (Wireless Mic 01–04, Wired Mic 01–02, Projector 01–02, Screen 01–02, Speaker 01–02, Registration desk).
  9. `asset_batches` (220 chairs, 30 tables, extension cables, cable covers).
  10. `asset_kits` + items (Cable Kit A, Signage Kit).
  11. Sample `event_request` (canonical messy startup-conference text) + parsed `event_requirements`.
  12. Derived `event` (`PENDING_APPROVAL`) + plan version + space/asset reservations.
  13. **Seeded conflict:** Robotics Workshop reserving Wireless Mic 04 during the conference window → `ASSET_SHORTAGE`/`SERIALIZED_DOUBLE_BOOKING` conflict + `conflict_suggestions` (substitute Wired Mic 01).
  14. `quote` + `proposal` (draft).
  15. `event_publication` (PUBLISHED) for the public event page.
  16. Sample `guest_registrations` + `guest_tickets` (high-entropy tokens) + optional `guest_checkins`.
- **DEMO_MODE:** when `DEMO_MODE=true`, seed the full demo path; in production seed only org + roles + staff scaffolding.

---

## Output 9 — Open Questions (with Recommended Defaults)

1. **Are role codes admin-editable?**
   *Recommended default:* Role **codes** are seed-only/fixed; admins may edit role **labels and the permissions jsonb**, but cannot add or delete role codes. Revisit only if a custom-roles feature is requested.
2. **Prisma Migrate vs raw SQL migrations?**
   *Recommended default:* **Prisma Migrate** for typed client + ergonomic migrations on Supabase Postgres, with raw SQL escape hatches for RLS policies, views, and triggers (which Prisma doesn't model natively). RLS/views/security-definer RPCs live in dedicated SQL migration files.
3. **RESOLVED — Setup/teardown/return timing is per asset or per group.** Configured on `AssetCategory` (group defaults: setup 0, teardown 0, return-buffer 30 min) with optional overrides on each serialized `Asset` and bulk `AssetBatch`. The reservation window is computed from these per-asset values plus event time. Org-wide setup default remains 120 min (`app_settings`).
4. **RESOLVED — Currency starts as `ALL`.** Albanian Lek default on `Organization`/`Quote`/`app_settings`. Plans may change later; VAT in `app_settings` (`vat_rate`, default 0.20 placeholder — confirm real rate). All line prices remain deterministic, never AI-set.
5. **Guest registration capacity / waitlist policy?**
   *Recommended default:* Honor `event_publications.capacity_public`; registrations beyond capacity become `WAITLISTED`. Toggleable per publication.
6. **Ticket token format & expiry.**
   *Recommended default:* 256-bit (32-byte) URL-safe random token, no expiry until event `COMPLETED`; tokens are non-sequential and looked up only by exact value.
7. **CLARIFIED — Profile auto-provisioning on first sign-in.** *What it means:* Supabase Auth stores the login identity in `auth.users`, but our app needs its own `profiles` row to attach roles, ownership, and audit. "Auto-provisioning" is the step that creates that `profiles` row automatically the first time someone logs in, so staff don't hand-create it. *Default flow:* an invited staff member or organizer is created with a `profiles` row in `INVITED`/`PENDING_APPROVAL` **before** they log in; on first sign-in we match `auth.users.id` → `profiles.auth_user_id` and flip status to `ACTIVE`. A brand-new self-signup organizer gets a fresh `profiles` row in `PENDING_APPROVAL` until staff link them to a `Client`. Implemented either by a Postgres trigger on `auth.users` or in the first server action after login.
8. **Local upload path & retention.**
   *Recommended default:* `./uploads` (configurable via `app_settings`/env `UPLOAD_DIR`), served through an authenticated route (not a static public dir) so attachment permissions are enforced; metadata in `file_objects`, provider `LOCAL`.
9. **RESOLVED — Soft-delete retention = 30 days.** Soft delete everywhere (`deleted_at`) except append-only ledgers (`audit_logs`, `asset_movements`, `guest_checkins`, `event_approvals`). A retention job may hard-delete soft-deleted rows older than **30 days** (`app_settings.soft_delete.retention_days = 30`, env `SOFT_DELETE_RETENTION_DAYS`).
10. **Realtime scope.**
    *Recommended default:* Enable Supabase Realtime for `conflicts`, `asset_reservations`, `tasks`, `guest_checkins`, and launch-gate state; everything else uses refresh/refetch fallback.
```

