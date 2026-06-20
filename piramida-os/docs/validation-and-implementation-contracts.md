# Validation & Implementation Contracts — Piramida / Pyramid OS

Production-minded contracts for validation, authorization, migrations, seeds, uploads, and state transitions. Code lives in `lib/`; this document is the spec the code satisfies.

---

## 0. Reconciliation with locked decisions

This brief was written against the original pre-decision spec. Three items were adapted to the **locked 2026-06-20 model** already implemented in `prisma/schema.prisma` (the user confirmed "keep existing, fill real gaps"):

| Brief said | Implemented (locked) | Where |
|---|---|---|
| 8 roles incl. `INVENTORY_MANAGER`, `FINANCE_MANAGER` | **6 roles**; `EVENT_MANAGER` absorbs inventory + finance | `RoleCode` enum, `lib/auth/permissions.ts` |
| `EXTERNAL_ORGANIZER` profile type | `ProfileType.ORGANIZER` | schema |
| `setupStartsAt/startsAt/endsAt/teardownEndsAt` | `setupStart/eventStart/eventEnd/teardownEnd` | schema + DTOs |
| Reservation `approve/checkout/checkin` as distinct statuses | mapped onto the simpler `AssetReservationStatus` machine (`RESERVED/PICKED/RETURNED`) | `lib/services/state-machines.ts` |
| Separate `MaintenanceRecord` table | merged into `asset_issues` | `createMaintenanceRecordInput` targets `AssetIssue` |

**Role capability mapping** (so the brief's intent is preserved without re-adding role codes):

- *Inventory Manager* responsibilities → `EVENT_MANAGER` and `OPERATIONS_MANAGER` (both hold `inventory.manage` + `inventory.scan`).
- *Finance Manager* responsibilities (quotes/proposal financials) → `EVENT_MANAGER` (`quotes.manage`, `proposals.manage`).
- *Technician* → `inventory.scan` + `checkin.scan` only (view/scan, technical status updates).

---

## 1. Zod schemas & DTOs — `lib/validation/`

- `common.ts` — shared primitives: `trimmed/requiredText`, `emailSchema`, `phoneSchema`, `slugSchema`, `uuid`, `money`, `positiveInt`, `nonNegInt`, `dateSchema`, `jsonValue/jsonObject`, plus refinement helpers `eventWindowRefine`, `exactlyOne`, `atLeastOne`.
- `schemas.ts` — all 44 input DTOs. Enums use `z.nativeEnum(<PrismaEnum>)` so validation can never drift from the DB.

Validation rules and where they are enforced:

| Rule | Mechanism |
|---|---|
| Trim strings, max lengths | `trimmed(max)` on every text field |
| Email / phone / slug | `emailSchema` (lowercased), `phoneSchema`, `slugSchema` |
| Money decimal, non-negative | `money` (`coerce.number().nonnegative().finite()`) |
| Quantities positive ints | `positiveInt` / `nonNegInt` |
| `setupStart ≤ eventStart < eventEnd ≤ teardownEnd` | `eventWindowRefine` on event + reservation DTOs |
| `reservedFrom < reservedUntil` | same window refine (`eventStart < eventEnd`) |
| Quote `total = subtotal + tax − discount`, `lineTotal = qty × unit` | `superRefine` in `createQuoteInput` |
| Batch quantities never negative; parts ≤ total | `nonNegInt` + `superRefine` in `createAssetBatch*` |
| ReservationItem references exactly one of asset/batch/category | `exactlyOne([...])` |
| Participant/guest has profileId **or** name/email | `EventParticipant` service refine; guest route requires name+email |
| Upload mime allowlist + max size | `uploadFileInput` (lists shared with `lib/storage/uploads.ts`) |
| Upload path cannot escape root | `resolveStoredPath()` (not a Zod rule — see §5) |
| Guest registration capacity / waitlist | **server-side** against `event_publications.capacity_public` (never client-trusted) |

**Boundary contract:** every Route Handler / Server Action calls `schema.parse(input)` (or `safeParse`) before touching Prisma. AI output is validated by the same schemas before persistence — AI never writes unvalidated facts.

---

## 2. Authorization guards — `lib/auth/`

- `session.ts` — `getAuthUserId()` seam. Production: swap in `@supabase/ssr` `auth.getUser()` (verifies JWT → `auth.users.id`). Until then, a DEMO_MODE-only header/cookie fallback keeps the app testable. **Never trusts an unverified header outside DEMO_MODE.**
- `permissions.ts` — RBAC matrix (existing; unchanged).
- `guards.ts` — all 17 guards. They throw `AuthError{status}` (401/403/404), mapped to responses by routes.

| Guard | Rule |
|---|---|
| `requireAuth()` | 401 if no Supabase user |
| `getCurrentProfile()` | Loads `Profile` + role codes by `authUserId`; null if none |
| `requireStaff()` | Active `ProfileType.STAFF` |
| `requireRole(role)` / `requireAnyRole(roles)` | Role membership |
| `requirePermission(perm)` | RBAC matrix check |
| `requireOrganizerOwnsRequest(id)` | Organizer's `contactId`/`submittedBy` matches; staff with `requests.review` bypass |
| `requireOrganizerCanViewProposal(id)` | Proposal `sentAt != null` **and** `sharedWithContactId == contactId`; staff with `proposals.manage` bypass |
| `requirePublicPublication(slug)` | Returns only `PUBLISHED`, non-deleted; else 404 — no auth |
| `requireTicketToken(token)` | Exact-match `guest_tickets.token` (length-gated, no enumeration) — no auth |
| `canManageUsers/Settings`, `canApproveEvent`, `canPublishEvent`, `canManageInventory`, `canApplyConflictFix`, `canCheckInGuests`, `canViewInternalOperations` | Boolean predicates over the matrix |

**Audit rule:** every critical mutation writes an `AuditLog` row (actor, action, entityType, entityId, before/after). The `require*` guard authorizes; the service performs the mutation **and** the audit write in the same transaction.

---

## 3. Migration automation

### `package.json` scripts

```jsonc
"db:generate": "prisma generate",
"db:migrate":  "prisma migrate dev",            // create + apply a dev migration
"db:deploy":   "prisma migrate deploy",         // apply in CI/prod (no shadow DB)
"db:seed":     "tsx prisma/seed.ts",
"db:reset":    "prisma migrate reset --force",  // drop + migrate + seed (via prisma.seed)
"db:studio":   "prisma studio",
"db:check":    "prisma validate && prisma migrate status"   // NEW: drift/validation gate
```

### Folder structure

```
prisma/
  schema.prisma
  seed.ts
  migrations/
    migration_lock.toml
    0001_init/migration.sql
    0002_rls_policies/migration.sql          # hand-written SQL (RLS)
    0003_notifications_agenda_settings/migration.sql
lib/
  validation/   auth/   services/   storage/   db/
```

### Migration naming convention

`NNNN_snake_case_summary` — zero-padded sequence + concise scope (`0003_notifications_agenda_settings`). RLS/views/security-definer RPCs go in their **own** hand-written SQL migration (Prisma doesn't model them).

### CI migration workflow

1. `npm ci`
2. Spin up a **disposable** Postgres (service container).
3. `prisma migrate deploy` against it (replays all migrations from scratch).
4. `npm run db:check` — `prisma validate` + `migrate status` must be clean (no drift).
5. `npm run db:seed` — must succeed and be idempotent (run twice; second run no-ops).
6. Run planning/reservation tests against the seeded DB.

> Tooling note: `prisma migrate diff --from-url` hangs against the Supabase **pooler** (pgBouncer). Point diff/shadow operations at the **direct** connection (`DIRECT_URL`, port 5432). `migrate deploy`/`status` work on the pooler.

### Local dev workflow

`db:migrate` (creates migration from schema edits) → inspect SQL → `db:seed`. Never edit an applied migration; add a new one.

### Preview / demo reset workflow

`npm run db:reset` → drops, replays all migrations, runs the deterministic seed → known demo state (startup conference + Wireless Mic 04 conflict + published page + guests).

### Safe migration rules

- **Never edit an applied migration.** New migration per change.
- **Expand → migrate → contract** for destructive changes: add nullable column → backfill → deploy code reading both → set `NOT NULL` → drop old later.
- Backfill accompanies every new `NOT NULL` column.
- Large prod tables: add indexes `CONCURRENTLY` in a manual/hand-written migration step.
- Enum changes backward-compatible (`ADD VALUE`; removal via expand/contract).
- Dynamic business data (spaces/locations) lives in **tables**, never enums.
- Migrations run against a disposable DB in CI; seed + planning tests follow.

---

## 4. Seed automation — `prisma/seed.ts` (existing, deterministic & idempotent)

Stable UUIDs via `sid("semantic:key")` and `upsert` semantics → re-running converges, never duplicates. Seed order respects FKs:

1. `Organization` — **Pyramid of Tirana**, slug `pyramid-of-tirana`, tz `Europe/Tirane`.
2. `Role` rows — the **6** locked `RoleCode`s (+ permissions from `ROLE_PERMISSIONS`).
3. Demo staff `Profile`s + `ProfileRole`; one external organizer `Profile`.
4. `Client` + `Contact` (organizer linked to contact).
5. `Space`s (Green/Orange/Blue/Yellow Rooms, Entrance, Main/Lower Corridor, Storage A/B, Tech Storage, Tech Booth) + `SpaceAdjacency`.
6. Placeholder `Location`s (storage/scan; `staff_only`, `public_visible=false`).
7. `AssetCategory` (chairs, tables, wireless/wired mics, screens, projectors, speakers, extension cables, cable covers, signage, registration desk, cable safety kit) with `replacementCategoryId` wireless→wired.
8. Serialized `Asset`s (Wireless Mic 01–04, Wired Mic 01–02, Projector 01–02, Screen 01–02, Speaker 01–02).
9. `AssetBatch`es (chair stacks, table stacks, cable cover/extension batches).
10. `AssetKit` + items (Conference Kit, Cable Safety Kit, Registration Kit).
11. Demo `EventRequest` (canonical 180-guest startup conference) + parsed `EventRequirement`s.
12. Derived `Event` (`PENDING_APPROVAL`) + plan version + space/asset reservations.
13. **Seeded conflict** — Robotics Workshop reserves Wireless Mic 04 inside the conference window → `ASSET_SHORTAGE`/`SERIALIZED_DOUBLE_BOOKING` + suggestion (substitute Wired Mic 01). *(Commented in seed.)*
14. `Quote` + `Proposal` (draft).
15. `EventPublication` (PUBLISHED) for the public page.
16. Demo `GuestRegistration` + `GuestTicket` (high-entropy tokens) + a check-in.
17. `AppSetting`s (currency `ALL`, vat_rate, buffers, upload_dir, soft-delete retention, demo_mode).

Idempotency rules: stable codes/slugs, `upsert` by stable id/natural key, no duplicate rows on re-seed. **Demo reset** = `npm run db:reset`. (Brief role #4 lists 8 roles; seed uses the **6** locked codes — see §0.)

---

## 5. Local file upload handling — `lib/storage/uploads.ts` + `app/api/uploads/route.ts`

- **Route plan:** `POST /api/uploads` (staff only via `requireStaff`), multipart; optional `ownerType`+`ownerId` → `createAttachment`. Returns safe metadata only (id, name, mime, size, checksum) — **never** the absolute path.
- **Storage path:** `UPLOAD_ROOT = resolve(UPLOAD_DIR ?? "./uploads")`; relative path `YYYY/MM/<uuid>.<ext>` stored in `FileObject.relativePath`.
- **Validation:** mime allowlist + `MAX_UPLOAD_BYTES` (25 MB), non-empty; lists shared with the Zod layer.
- **Stored name:** random `randomUUID()` + extension derived from mime — client filename is never used as the stored name.
- **Checksum:** sha256 stored on `FileObject`.
- **Path-escape guard:** `resolveStoredPath()` resolves against root and rejects anything whose relative path starts with `..` or is absolute.
- **FileObject:** `storageProvider=LOCAL`, `relativePath`, `originalName`, `mimeType`, `sizeBytes`, `checksum`, `uploadedById`. `publicUrl` set **only** when explicitly marked public.
- **Attachment:** polymorphic `ownerType`/`ownerId` link.
- **Safe delete:** `softDeleteFile()` sets `deletedAt` on `FileObject` + `Attachment`; bytes removed later by the retention job (recoverable, audit-safe).
- **Migration to Supabase Storage / S3:** change only `saveUpload`/`resolveStoredPath` and set `storageProvider`; `relativePath` becomes the object key. Owner/attachment model is unchanged. Private files are always served via an authenticated route, never a static public dir.

---

## 6. State transition rules — enforced in `lib/services/state-machines.ts`

`assertTransition(machine, MAP, from, to)` throws `InvalidTransitionError` unless `to ∈ MAP[from]` (self-transitions allowed). Roles, side effects, and audit actions below are the contract each service must honor alongside the graph.

### EventRequestStatus
| From | → To | Actor | Side effects | Audit |
|---|---|---|---|---|
| RECEIVED | PARSED, REVIEWED, REJECTED, CANCELLED | EVENT_MANAGER (`requests.review`) | parse fills `extractedJson` | STATUS_CHANGE |
| PARSED | REVIEWED, REJECTED, CANCELLED | EVENT_MANAGER | — | STATUS_CHANGE |
| REVIEWED | PLANNING, PROPOSED, APPROVED, REJECTED, CANCELLED | EVENT_MANAGER | APPROVED → create Event (`PENDING_APPROVAL`) | APPROVE / REJECT |
| PLANNING/PROPOSED | APPROVED, REJECTED, CANCELLED | EVENT_MANAGER | — | STATUS_CHANGE |
| APPROVED/REJECTED/CANCELLED | (terminal, APPROVED→CANCELLED) | EVENT_MANAGER | — | CANCEL |

**Enforcement:** organizer can only push RECEIVED (submit) and request changes; all forward moves require `requests.review`.

### EventStatus
| From | → To | Actor | Side effects | Audit |
|---|---|---|---|---|
| DRAFT | PENDING_APPROVAL, PLANNING, CANCELLED | EVENT_MANAGER | — | STATUS_CHANGE |
| PENDING_APPROVAL | PLANNING, CANCELLED, ARCHIVED | EVENT_MANAGER (`requests.review`) | approval gate | APPROVE |
| PLANNING | PROPOSED, CONFIRMED, CANCELLED | EVENT_MANAGER/OPS | plan version snapshot | PLAN_GENERATED |
| PROPOSED | CONFIRMED, PLANNING, CANCELLED | EVENT_MANAGER | — | STATUS_CHANGE |
| CONFIRMED | PUBLISHED, LAUNCH_READY, PLANNING, CANCELLED | EVENT_MANAGER (`events.publish`) | publication created | PUBLISH |
| PUBLISHED | LAUNCH_READY, LIVE, CANCELLED | OPS_MANAGER | gates evaluated | LAUNCH_OVERRIDE? |
| LAUNCH_READY | LIVE, PUBLISHED, CANCELLED | OPS_MANAGER | — | STATUS_CHANGE |
| LIVE | COMPLETED, CANCELLED | OPS_MANAGER | — | STATUS_CHANGE |
| COMPLETED | ARCHIVED | ADMIN | — | UPDATE |
| CANCELLED | ARCHIVED | ADMIN | release reservations | RELEASE |

**Enforcement:** publish requires `approvalStatus=APPROVED` (checked in service before `CONFIRMED→PUBLISHED`).

### EventApprovalStatus
| From | → To | Actor | Side effects | Audit |
|---|---|---|---|---|
| PENDING_APPROVAL | APPROVED, REJECTED, NEEDS_CHANGES, CANCELLED | EVENT_MANAGER/ADMIN | APPROVED unlocks publish | APPROVE/REJECT/REQUEST_CHANGES* |
| NEEDS_CHANGES | PENDING_APPROVAL, APPROVED, REJECTED, CANCELLED | EVENT_MANAGER | — | STATUS_CHANGE |
| REJECTED | PENDING_APPROVAL | EVENT_MANAGER | — | STATUS_CHANGE |
| APPROVED | CANCELLED | ADMIN | — | CANCEL |

*`AuditAction` has `APPROVE`/`REJECT`; "request changes" logs as `UPDATE` with reason.

### AssetStatus
| From | → To | Actor | Side effects | Audit |
|---|---|---|---|---|
| AVAILABLE | SOFT_HOLD, RESERVED, NEEDS_INSPECTION, MAINTENANCE, MISSING, RETIRED | INVENTORY (`inventory.manage`) | hold/reserve links reservation item | RESERVE |
| SOFT_HOLD | RESERVED, AVAILABLE, MISSING | INVENTORY | — | RESERVE/RELEASE |
| RESERVED | PICKED, AVAILABLE, MISSING | TECHNICIAN (`inventory.scan`) | QR scan creates movement | MOVE |
| PICKED | IN_TRANSIT, IN_USE, RETURNED, MISSING | TECHNICIAN | — | MOVE |
| IN_TRANSIT/IN_USE | RETURNED, … | TECHNICIAN | — | MOVE |
| RETURNED | NEEDS_INSPECTION, AVAILABLE, MAINTENANCE | INVENTORY | inspection task | UPDATE |
| NEEDS_INSPECTION/MAINTENANCE | AVAILABLE, RETIRED, … | INVENTORY | maintenance record | MAINTENANCE_START/COMPLETE* |
| MISSING | AVAILABLE, RETIRED | INVENTORY | — | UPDATE |
| RETIRED | (terminal) | — | — | — |

*`AuditAction` here uses `UPDATE`/`STATUS_CHANGE` (no maintenance-specific action in the locked enum).

### AssetReservationStatus
| From | → To | Actor | Side effects | Audit |
|---|---|---|---|---|
| SOFT_HOLD | RESERVED, RELEASED, CANCELLED | INVENTORY | "approve" = SOFT_HOLD→RESERVED; firms holds | RESERVE |
| RESERVED | PICKED, RELEASED, CANCELLED | TECHNICIAN | "checkout" = RESERVED→PICKED; movements | CHECK_OUT |
| PICKED | IN_TRANSIT, IN_USE, RETURNED, CANCELLED | TECHNICIAN | — | MOVE |
| IN_TRANSIT/IN_USE | RETURNED | TECHNICIAN | "checkin" = →RETURNED | CHECK_IN |
| RETURNED | RELEASED | INVENTORY | restores batch qty | RELEASE |
| RELEASED/CANCELLED | (terminal) | — | — | — |

### AssetReservationItemStatus
| From | → To | Actor | Side effects | Audit |
|---|---|---|---|---|
| PENDING | SOFT_HOLD, RESERVED, ASSIGNED, SUBSTITUTED, CANCELLED | INVENTORY | substitution sets `replacesItemId` | RESERVE/APPLY_FIX |
| SOFT_HOLD/RESERVED | ASSIGNED, PICKED, SUBSTITUTED, RELEASED, CANCELLED | INVENTORY/TECH | — | RESERVE |
| ASSIGNED | PICKED, SUBSTITUTED, RELEASED, CANCELLED | TECHNICIAN | — | MOVE |
| PICKED/IN_USE | RETURNED | TECHNICIAN | — | CHECK_IN |
| RETURNED | RELEASED | INVENTORY | — | RELEASE |
| SUBSTITUTED | RELEASED, CANCELLED | INVENTORY | original released, replacement reserved | APPLY_FIX |

### ConflictStatus
| From | → To | Actor | Side effects | Audit |
|---|---|---|---|---|
| OPEN | RESOLVED, AUTO_FIXED, IGNORED | OPS (`conflicts.resolve`) | AUTO_FIXED applies suggestion (reservations/tasks/gates) + plan diff | CONFLICT_RESOLVED / AUTO_FIX_APPLIED |
| AUTO_FIXED | OPEN, RESOLVED | system/OPS | reopen if a later change reintroduces it | CONFLICT_DETECTED |
| RESOLVED | OPEN | system | reopen on change | CONFLICT_DETECTED |
| IGNORED | OPEN, RESOLVED | OPS | — | UPDATE |

**Enforcement:** conflicts are created **only** by deterministic detection (never AI/organizer).

### TaskStatus
| From | → To | Actor | Side effects | Audit |
|---|---|---|---|---|
| TODO | READY, IN_PROGRESS, BLOCKED, CANCELLED | OPS (`tasks.manage`) / assignee | BLOCKED if deps not DONE | STATUS_CHANGE |
| READY | IN_PROGRESS, BLOCKED, CANCELLED | assignee | — | STATUS_CHANGE |
| IN_PROGRESS | BLOCKED, DONE, CANCELLED | assignee | DONE sets `completedAt` | STATUS_CHANGE |
| BLOCKED | READY, IN_PROGRESS, CANCELLED | OPS | unblock when deps DONE | STATUS_CHANGE |
| DONE | IN_PROGRESS | OPS | reopen | STATUS_CHANGE |

### QuoteStatus
| From | → To | Actor | Side effects | Audit |
|---|---|---|---|---|
| DRAFT | SENT, APPROVED, SUPERSEDED | EVENT_MANAGER (`quotes.manage`) | SENT shares to organizer | UPDATE |
| SENT | APPROVED, REJECTED, EXPIRED, SUPERSEDED | EVENT_MANAGER | — | APPROVE/REJECT |
| APPROVED/REJECTED/EXPIRED | SUPERSEDED | EVENT_MANAGER | new version | UPDATE |
| SUPERSEDED | (terminal) | — | — | — |

### ProposalStatus
| From | → To | Actor | Side effects | Audit |
|---|---|---|---|---|
| DRAFT | SENT, EXPIRED | EVENT_MANAGER (`proposals.manage`) | SENT sets `sentAt`, shares with contact | PUBLISH/UPDATE |
| SENT | APPROVED, CHANGES_REQUESTED, REJECTED, EXPIRED | **organizer** (own) or staff | organizer decision via `organizerProposalDecisionInput` | APPROVE/REJECT |
| CHANGES_REQUESTED | DRAFT, SENT | EVENT_MANAGER | revise | UPDATE |
| REJECTED/EXPIRED | DRAFT | EVENT_MANAGER | new version | UPDATE |
| APPROVED | (terminal) | — | confirm event | STATUS_CHANGE |

### PublicationStatus
| From | → To | Actor | Side effects | Audit |
|---|---|---|---|---|
| DRAFT | PUBLISHED, HIDDEN | EVENT_MANAGER (`events.publish`) | PUBLISHED sets `publishedAt`, opens registration | PUBLISH |
| PUBLISHED | CLOSED, HIDDEN | EVENT_MANAGER | CLOSED stops registration | UNPUBLISH |
| CLOSED | PUBLISHED, HIDDEN | EVENT_MANAGER | reopen | PUBLISH |
| HIDDEN | DRAFT, PUBLISHED | EVENT_MANAGER | — | UPDATE |

**Enforcement:** `DRAFT→PUBLISHED` requires `Event.approvalStatus=APPROVED`. Anon reads only `PUBLISHED` (RLS + `requirePublicPublication`).

### GuestRegistrationStatus
| From | → To | Actor | Side effects | Audit |
|---|---|---|---|---|
| PENDING | CONFIRMED, WAITLISTED, CANCELLED | system/public | capacity check → CONFIRMED or WAITLISTED; issues ticket on CONFIRMED | CREATE |
| WAITLISTED | CONFIRMED, CANCELLED | system | promote on capacity freeing | UPDATE |
| CONFIRMED | CHECKED_IN, NO_SHOW, CANCELLED | staff (`checkin.scan`) | CHECKED_IN increments dashboard | CHECK_IN |
| CHECKED_IN | NO_SHOW | staff | reversal/correction | UPDATE |
| NO_SHOW | CHECKED_IN | staff | correction | CHECK_IN |
| CANCELLED | (terminal) | — | — | CANCEL |

### GuestTicketStatus
| From | → To | Actor | Side effects | Audit |
|---|---|---|---|---|
| REGISTERED | CHECKED_IN, CANCELLED, NO_SHOW | staff (`checkin.scan`) | CHECKED_IN creates `GuestCheckin` | CHECK_IN |
| CHECKED_IN | NO_SHOW | staff | reversal | UPDATE |
| NO_SHOW | CHECKED_IN | staff | correction | CHECK_IN |
| CANCELLED | (terminal) | — | — | CANCEL |

**Enforcement:** check-in looked up by exact `token` only; QR payload carries token, never guest PII.

---

## 7. Open questions (blocking only)

1. **Supabase Auth wiring.** `getAuthUserId()` is a seam. To enable real staff/organizer auth we need `@supabase/ssr` installed and the project URL + anon key + JWT verification approach (HS256 secret vs. asymmetric signing keys). Until provided, only the DEMO_MODE fallback works. **Blocks production auth.**
2. **VAT rate.** Seed/app_settings uses `vat_rate=0.20` as a placeholder. Confirm the real Albania VAT rate before any quote is shown to a client. **Blocks correct pricing.**

All other items (multi-tenancy, guest users, LocationKey, storage provider) are settled by the confirmed decisions and are not re-opened.
