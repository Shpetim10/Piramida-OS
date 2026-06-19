# CLAUDE.md - Pyramid OS Project Instructions

## Project identity

Pyramid OS is an event launch-control platform for the Pyramid of Tirana. It is not generic venue booking software. The product promise is: turn an ambiguous external organizer request into a ready-to-execute operational plan that answers: "Can we make this happen? If yes, what is next?"

The hackathon MVP must optimize for one polished end-to-end scenario: an external event organizer submits a messy startup conference request for 180 guests; staff reviews AI-extracted requirements; the system generates an Event DNA fingerprint, Pyramid Twin plan, space and asset reservations, conflict auto-fixes, quote/proposal, guest publication, QR registration, check-in, and a final EVENT READY FOR LAUNCH screen.

Use this framing in every feature, UI label, commit, and review: Other platforms book rooms. Pyramid OS launches experiences.

## Current implementation target

Build a pragmatic MVP with this stack unless the repository already proves a different implementation:

- Next.js App Router, React, TypeScript
- Tailwind CSS, shadcn/ui, accessible components, polished command-center UI
- Supabase Postgres as the intended database target
- Local storage may be used as an initial demo/auth/state fallback only when Supabase is not yet wired
- Automated migrations and seed scripts must be prepared for all database changes
- Supabase Realtime for live updates where practical, with refresh fallback
- OpenAI Structured Outputs for AI extraction and prose generation, with deterministic fallback data
- React Flow or custom SVG for Decision Graph
- SVG Pyramid Twin for the MVP; no full CAD/3D twin in MVP

## Non-negotiable product principles

1. AI writes and explains. Deterministic code calculates.
   - AI must never invent availability, price, inventory count, asset reservation, approval, gate status, or conflict state.
   - AI output must be validated with Zod or equivalent before use.
   - All critical facts must come from typed inputs, database records, seed data, or deterministic services.

2. Public and external surfaces are privacy-first.
   - Event Organizers are external clients, not Pyramid staff.
   - Guests see only published public event information and their own tokenized ticket.
   - Never expose storage locations, internal conflicts, staff notes, staff names, pricing rules, inventory locations, or operational comments to organizers or guests.

3. The demo path matters more than generic coverage.
   - Fully polish startup conference first.
   - Build extensible services and data models, but do not overbuild generic workflows that do not serve the demo.
   - When tradeoffs are required, preserve the full lifecycle: organizer request -> staff planning -> conflict fix -> proposal -> guest publication -> QR/check-in -> launch readiness.

4. Server-side authorization is mandatory for real mutations.
   - UI hiding is not security.
   - Staff role checks must happen server-side.
   - Public routes must read only event_publications and token-protected tickets.

5. Every important state transition must be auditable.
   - Log request parsing, staff review, event creation, plan generation, reservations, conflict fixes, proposal approval, publication, check-in, and launch overrides.

## Required MVP domain

### Roles

Support these roles in code, enums, seed data, UI routing, or placeholders:

- admin
- event_manager
- ops_manager
- inventory_manager
- technician
- finance_manager
- event_organizer
- guest

Event Organizer is an external profile linked to a client/contact. It can submit and track only its own event requests, view explicitly shared proposal/quote data, approve/request changes, and access the public event link after publication.

Staff roles are internal and may be additive. Guest is public/external and token-scoped.

### Core entities

Prefer these names unless an existing schema uses different names consistently:

- organizations
- profiles
- roles
- profile_roles
- clients
- contacts
- spaces
- space_adjacencies
- locations
- space_reservations
- event_requests
- event_request_messages
- ai_extractions or ai_runs
- events
- event_requirements
- event_plan_versions
- event_plan_diffs
- asset_categories
- assets
- asset_batches
- asset_kits
- asset_kit_items
- asset_reservations
- asset_movements
- asset_issues
- conflicts
- conflict_suggestions
- tasks
- task_dependencies
- quotes
- quote_items
- proposals
- event_publications
- agenda_items
- guests or guest_profiles
- guest_registrations
- guest_tickets
- guest_checkins
- audit_logs
- notifications
- documents

Every organization-owned table must include org_id, even though MVP uses one organization.

### Required statuses and enums

Use explicit enums or TypeScript union constants for:

- app_user_status: active, invited, disabled, pending_approval where needed
- event_request_status: received, parsed, reviewed, planning, proposed, approved, rejected, cancelled
- event_status: draft, planning, proposed, confirmed, published, launch_ready, live, completed, archived, cancelled
- reservation_status: soft_hold, reserved, picked, in_transit, in_use, returned, released, cancelled
- asset_status: available, soft_hold, reserved, picked, in_transit, in_use, returned, needs_inspection, maintenance, missing, retired
- asset_condition: excellent, good, usable, needs_inspection, damaged
- conflict_severity: low, medium, high, critical
- conflict_status: open, ignored, resolved, auto_fixed
- task_status: todo, in_progress, blocked, ready, done, cancelled
- approval_status: pending, approved, rejected, cancelled
- publication_status: draft, published, closed, hidden
- ticket_status: registered, cancelled, checked_in, no_show
- launch_gate_status: GO, WARNING, BLOCKED

Do not silently introduce new states without updating validation, UI labels, seed data, review checklist, and migrations.

## Required demo seed data

Always preserve or recreate a deterministic seed path for the main demo.

### Spaces

- Green Room, capacity 200
- Orange Room, capacity 120
- Blue Room, capacity 80
- Yellow Room, capacity 80
- Entrance, standing capacity/flow 120
- Main Corridor, comfort flow 80
- Lower Corridor
- Storage A
- Storage B
- Tech Storage
- Tech Booth

### Adjacencies

- Entrance -> Main Corridor
- Main Corridor -> Blue Room
- Main Corridor -> Orange Room
- Lower Corridor -> Green Room
- Lower Corridor -> Yellow Room
- Tech Storage -> Green Room

### Assets

- 220 chairs across bulk stacks
- 30 tables across bulk stacks
- Wireless Mic 01-04
- Wired Mic 01-02
- Projector 01-02
- Screen 01-02
- Speaker 01-02
- Extension cables
- Cable covers
- Cable Kit A
- Signage Kit
- Registration desk

### Conflict event

Robotics Workshop reserves Wireless Mic 04 during the Startup Conference reservation window. The startup conference asks for 4 wireless microphones. The system should detect the shortage and auto-fix by reserving Wireless Mic 01-03 and Wired Mic 01.

### Primary request

Use this as the canonical messy request if no user-provided request exists:

"Hi Pyramid team, we want to host a startup conference next month for around 180 guests. We need a keynote stage, two breakout rooms, coffee and registration near the entrance, 4 wireless microphones, a screen, projector, speakers, chairs and tables. Guests should register online and receive QR passes. We also need clear directions inside the building."

Expected structured extraction:

- eventType: conference
- expectedGuests: 180
- setupHours: 2
- mainStage: true
- breakoutRooms: 2
- coffeeArea: true
- registrationDesk: true
- publicGuestRegistration: true
- screens: 1
- projectors: 1
- wirelessMicrophones: 4
- wiredMicrophones: 0
- chairs: 150
- tables: 15
- speakers: 2
- livestream: false
- missingFields: exact event date, event end time

## Architecture rules

### Directory conventions

Prefer this shape in a Next.js App Router project:

```text
app/
  (organizer)/request
  (organizer)/request/[id]
  (staff)/dashboard
  (staff)/events/[eventId]/understand
  (staff)/events/[eventId]/simulate
  (staff)/events/[eventId]/protect
  (staff)/events/[eventId]/explain
  (staff)/events/[eventId]/launch
  (staff)/inventory
  (staff)/inventory/[assetQr]
  (public)/events
  (public)/events/[slug]
  (public)/tickets/[token]
  (public)/guest-map/[slug]
components/
  command-center/
  organizer/
  guest/
  pyramid-twin/
  decision-graph/
  launch-mode/
lib/
  db/
  auth/
  services/
  planning/
  ai/
  validation/
  audit/
  demo/
supabase/
  migrations/
  seed/
tests/
```

Respect existing repository conventions if they already exist, but keep domain logic separate from UI components.

### Service boundaries

Use deterministic service modules for:

- space matcher
- availability checker
- equipment reservation
- conflict detector
- auto-fix engine
- quote generator
- task generator
- launch readiness gate evaluator
- plan snapshot and diff generator

AI modules may do:

- structured event intake from messy text
- proposal prose from validated quote and plan facts
- plain-language conflict explanation from allowed fixes
- staff briefing/task copy from deterministic task records
- public event copy from event_publication-safe fields only

AI modules must not perform authoritative planning, pricing, inventory, reservations, or approvals.

### API contracts

Implement as Next.js Route Handlers or Server Actions as appropriate:

Organizer:

- POST /api/organizer/requests
- GET /api/organizer/requests/[id]
- POST /api/organizer/requests/[id]/approve

Staff:

- POST /api/ai/parse-event-request
- createEventFromRequest(requestId, reviewedFields)
- generateEventPlan(eventId)
- reserveAssets(eventId, requirements, reservationType)
- applyConflictFix(conflictId, suggestionId)
- generateProposal(eventId, quoteId)
- publishEvent(eventId, publicFields, agenda)
- scanAssetQr(qrCode, eventId, action)
- getLaunchReadiness(eventId)

Guest/Public:

- GET /api/public/events
- GET /api/public/events/[slug]
- POST /api/public/events/[slug]/register
- GET /api/public/tickets/[token]
- POST /api/staff/check-in

All API responses must be typed, validated, and safe for their audience.

## UI and UX rules

The internal staff app should feel like launch control, not an admin table.

Use stage language:

- Understand
- Simulate
- Protect
- Explain
- Launch
- Guest

Critical components:

- OrganizerRequestPortal
- EventIntakePanel
- EventDNACard
- PyramidTwin
- SpaceMatchCards
- InventoryPlanner
- ConflictCenter
- DecisionGraph
- ChangeImpactDiff
- LaunchMode
- GuestEventCard
- GuestTicket

Design principles:

- Use clear GO, WARNING, BLOCKED statuses.
- Show reasons for recommendations, not only scores.
- Make the final Launch Mode screen visually memorable.
- Use accessible forms, labels, keyboard navigation, and mobile-safe public routes.
- Guest Mode must hide storage, staff-only corridors, inventory, internal conflicts, pricing rules, staff assignments, and operational notes.
- Organizer portal must not show the Pyramid Twin or operational internals.

## Planning algorithms

### Space matching scoring

Implement a deterministic score with these factors unless superseded by tests:

- capacity fit: 30 percent
- availability: 25 percent
- layout fit: 15 percent
- adjacency: 10 percent
- setup feasibility: 10 percent
- guest flow: 10 percent

Return ranked matches with scores and human-readable reasons.

### Feasibility score

Use these weights:

- Space fit: 30 percent
- Asset readiness: 25 percent
- Schedule safety: 15 percent
- Power/cable readiness: 10 percent
- Staff/task readiness: 10 percent
- Guest readiness: 10 percent

### Conflict types

At minimum detect:

- space overlap
- asset shortage
- serialized double-booking
- setup/teardown buffer conflict
- power/cable risk
- guest flow risk

### Auto-fixes

At minimum support suggestions for:

- replacing unavailable wireless microphones with wired microphones where allowed
- adding Cable Kit A or cable covers for power/cable risks
- selecting alternative spaces or overflow spaces for capacity issues
- increasing setup buffer or adding crew for setup conflicts

Applying a fix must update reservations, tasks, launch gates, plan snapshot/diff where relevant, and audit logs.

## Data and migrations

- All database changes require a migration file under supabase/migrations or the repository's migration system.
- All demo-critical data must be in a seed script, not hand-edited in a database.
- Migrations must be idempotent where practical.
- Use UUID primary keys.
- Prefer timestamptz for times.
- Model reservation windows from setup_start to teardown_end plus return buffer, not only public event time.
- Separate serialized assets from bulk asset batches.
- Use event_plan_versions as JSON snapshots for Change Impact.
- Use event_publications as guest-safe projections rather than exposing events directly.

## Testing expectations

Every implementation should add or update tests for the changed layer.

Required scenario tests:

- T-000 External organizer submits request via portal; request is staff-visible and organizer-scoped.
- T-001 Messy startup request parses to expectedGuests 180 and required assets.
- T-002 Plan generation recommends Green, Blue, Yellow, and Entrance.
- T-003 Wireless Mic 04 conflict creates missing wireless mic conflict.
- T-004 Wired mic substitution resolves the conflict and updates Assets gate.
- T-005 Cable Kit A moves Power gate from WARNING to GO.
- T-006 Changing guests 180 to 240 creates plan diff and updates feasibility, assets, quote, and conflicts.
- T-007 Publishing creates a public event page and opens registration.
- T-008 Guest registration creates a ticket and updates remaining capacity.
- T-009 Check-in increments dashboard count.
- T-010 Guest map shows only public spaces and route steps.

For each task, run the repository's available checks. If no scripts exist, create reasonable scripts in package.json:

- typecheck
- lint
- test
- build
- db:migrate
- db:seed

## Security checklist for every change

Before completing code, verify:

- No service role key is used in client components.
- No private fields are returned to public/organizer routes.
- Organizer queries are scoped to organizer_profile_id/client_id.
- Staff-only actions require server-side role checks.
- Ticket tokens are random/high-entropy and not sequential.
- QR payloads do not contain private guest data.
- Audit logs are append-only from normal app flows.
- AI prompts cannot leak internal notes into public copy.

## Environment variables

Use these names unless existing project conventions differ:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
APP_BASE_URL=http://localhost:3000
QR_SIGNING_SECRET=
DEMO_MODE=true
```

Never commit real secrets. Include .env.example when env variables change.

## Implementation behavior for Claude

When asked to implement:

1. Inspect the repository first.
2. Identify existing stack, package manager, scripts, routes, data access patterns, and tests.
3. Make the smallest coherent vertical slice that works end to end.
4. Preserve the demo path and seed data.
5. Prefer typed domain services over component-only mock logic.
6. Add migrations/seeds for data-model changes.
7. Add or update tests.
8. Run checks and report results.
9. If a requirement is ambiguous or conflicts with the project documentation, ask before inventing.

When asked to review:

1. Review against Pyramid OS product intent, security boundaries, deterministic planning rules, and demo readiness.
2. Prioritize issues that could break the demo, leak private data, corrupt reservations, or let AI invent critical facts.
3. Provide actionable file-level comments and concrete fixes.
4. Verify tests and migrations.
5. Do not approve code that only hides unauthorized data in UI while returning it from server/API.

## Completion definition

A task is complete only when:

- It preserves or improves the full demo flow.
- It is typed and validated at boundaries.
- It respects role/privacy boundaries.
- Deterministic services own operational truth.
- Migrations and seed scripts are included when data changes.
- Tests or a clear manual verification path are included.
- The final user-facing behavior is polished enough for a hackathon judge.