# /review - Pyramid OS review command

Use this command when asked to review code, a pull request, implementation plan, migration, prompt, or UI flow for Pyramid OS.

## Review stance

Review as a senior engineer and product guardian for Pyramid OS. The goal is not just code correctness; it is preserving the hackathon-winning product story: an external organizer request becomes a safe, deterministic, explainable event launch plan and guest experience.

Be direct, specific, and actionable. Prioritize issues that could break the demo, leak private data, corrupt reservations, or make AI the source of operational truth.

## Review inputs to inspect

Start by identifying:

1. Files changed.
2. Feature area affected.
3. Database/migration/seed impact.
4. API/server-action impact.
5. UI/public-route impact.
6. Tests added or missing.
7. Whether the change affects the main startup conference demo path.

If reviewing a diff, read the actual changed files, not only summaries.

## Severity levels

Use these severities:

- Blocker: must fix before merge/demo; causes data leak, broken demo path, corrupt reservation, invalid migration, failed build, or AI-owned operational truth.
- High: likely production/demo bug, missing server authorization, wrong planning result, unsafe public data, or missing migration/seed for changed data model.
- Medium: correctness, maintainability, accessibility, test coverage, or UX issue that should be fixed soon.
- Low: naming, polish, small refactor, copy, or non-blocking improvement.

## Pyramid OS review checklist

### Product/demo fit

- Does the change support the full demo path?
- Does it keep startup conference as the polished path?
- Does it preserve the emotional Launch Mode outcome: EVENT READY FOR LAUNCH?
- Does it use stage language where appropriate: Understand, Simulate, Protect, Explain, Launch, Guest?
- Does it avoid drifting into generic CRUD/admin software?

### AI and deterministic boundary

Block if AI determines any of these:

- availability
- price
- inventory counts
- asset reservations
- space reservations
- launch gate status
- conflict state
- approval status

Verify:

- AI output is schema-validated.
- AI has deterministic fallback for demo-critical paths.
- AI prompts explicitly prohibit inventing facts.
- Proposal/public copy uses only validated allowed facts.
- Decision Graph nodes/edges come from planning outputs; AI may summarize but not invent graph facts.

### Data model and migrations

Verify:

- Organization-owned tables include org_id.
- UUIDs are used for primary keys.
- Time fields use timestamptz.
- Statuses use shared enums/constants.
- Reservation windows cover setup, event, teardown, and return buffer.
- Serialized assets and bulk batches are modeled separately.
- event_plan_versions capture snapshots for Change Impact.
- event_publications are guest-safe projections.
- Migrations are automated, reversible/idempotent where practical, and included with schema changes.
- Seed scripts preserve the primary demo data and conflict scenario.

### Authorization, privacy, and public exposure

Block if:

- Service role keys appear in client code.
- Server returns private operational data to organizer or guest routes.
- Organizer can access another client's request/proposal.
- Guest map exposes storage, staff-only corridors, asset locations, staff names, internal conflicts, pricing rules, or operational notes.
- Staff-only mutation relies only on hidden UI.
- Ticket tokens are predictable or contain private data.

Verify:

- Staff mutations enforce server-side role checks.
- Organizer access is scoped by organizer_profile_id/client_id.
- Public routes read only published event_publications and agenda/route data.
- Check-in routes validate ticket tokens and update counts safely.
- Audit logs are written for important state changes.

### Planning and operations logic

Verify deterministic logic for:

- space matching by capacity, availability, layout, adjacency, setup feasibility, and guest flow
- availability across setup/event/teardown/buffer windows
- asset reservation for serialized and bulk assets
- conflict detection for space overlap, asset shortage, serialized double-booking, setup conflicts, power/cable risks, guest flow risks
- auto-fix suggestions and application
- quote calculation
- launch readiness gates
- plan version diffs

For auto-fixes, verify applying a fix updates all relevant state:

- reservations
- tasks
- conflict status
- launch gates
- audit logs
- plan snapshots/diffs
- UI cache/refetch state

### UI/UX and accessibility

Verify:

- Command-center UI is visually clear and not generic admin CRUD.
- Recommendations show reasons, not only scores.
- GO/WARNING/BLOCKED states are clear and consistent.
- Organizer portal is simple and does not expose internal planning.
- Guest routes are mobile-friendly and accessible.
- Forms have labels, validation, keyboard usability, loading states, empty states, and error states.
- Color is not the only signal for status.
- The Pyramid Twin and guest map hide internal-only layers by role.

### Testing and demo reliability

Verify tests or manual verification for relevant scenario IDs:

- T-000 Organizer request portal and scoping
- T-001 AI intake parsing
- T-002 Space recommendations
- T-003 Wireless Mic 04 conflict
- T-004 Wired mic substitution auto-fix
- T-005 Cable Kit A gate update
- T-006 Guest count 180 -> 240 plan diff
- T-007 Public event publication
- T-008 Guest registration and QR ticket
- T-009 Check-in count update
- T-010 Guest-safe map

Verify that fallback behavior exists for:

- AI API failure
- PDF export failure
- realtime failure
- QR camera permission failure
- Decision Graph library failure

## Review output format

Use this structure:

```markdown
## Review summary
<1-3 sentence overall assessment>

## Findings

### Blocker
- [file:line] Issue. Why it matters. Suggested fix.

### High
- [file:line] Issue. Why it matters. Suggested fix.

### Medium
- [file:line] Issue. Why it matters. Suggested fix.

### Low
- [file:line] Issue. Why it matters. Suggested fix.

## Positive notes
- <What is strong or aligned with Pyramid OS.>

## Required checks before merge
- <Commands/tests/migrations/seed verification required.>

## Verdict
<Approve / Approve with nits / Request changes / Block>
```

Only include severity sections that have findings.

## Review rules

- Be specific: cite file paths and lines when possible.
- Do not invent missing context. Ask for the diff/file if needed.
- Do not approve if checks were not run and the changed area needs them.
- Do not approve schema changes without migration and seed consideration.
- Do not approve public/organizer changes without privacy review.
- Do not approve AI changes without schema validation and deterministic fallback.
- Prefer concise, actionable findings over long general commentary.