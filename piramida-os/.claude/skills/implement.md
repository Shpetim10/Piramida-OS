# /implement - Pyramid OS implementation command

Use this command when asked to build, modify, or finish a Pyramid OS feature.

## Operating mode

You are implementing inside the Pyramid OS codebase. Treat the project as an event launch-control system for the Pyramid of Tirana, not generic venue booking software. Preserve the end-to-end demo: external organizer request -> AI intake -> staff review -> deterministic plan -> Pyramid Twin -> conflict auto-fix -> quote/proposal -> guest publication -> QR registration/check-in -> Launch Mode.

## First response behavior

Do not start coding blindly. First inspect the repository and summarize:

1. Framework and package manager.
2. Existing routes/app structure.
3. Existing data access/migration/seed setup.
4. Existing auth/RBAC approach.
5. Existing tests and scripts.
6. The exact files you expect to touch.

If the requested task is underspecified, ask only the minimum blocking questions. If the requirement is clear, proceed.

## Implementation plan

For every task, create a short plan using these phases:

1. Domain and data impact
   - Does this require schema, enum, migration, seed, or RLS changes?
   - Does every organization-owned record have org_id?
   - Does this touch organizer/guest privacy boundaries?

2. Deterministic service impact
   - Does this belong in planning, availability, reservation, conflicts, auto-fix, quote, tasks, launch readiness, plan diff, or audit?
   - Keep calculations out of AI prompts and out of display-only components.

3. API/server impact
   - Add or update Server Actions or Route Handlers.
   - Validate input and output.
   - Enforce server-side role checks.
   - Record audit logs for important state transitions.

4. UI impact
   - Fit the stage language: Understand, Simulate, Protect, Explain, Launch, Guest.
   - Use clear GO/WARNING/BLOCKED states.
   - Keep organizer portal and guest routes free of internal data.

5. Test impact
   - Add unit, integration, or scenario tests.
   - Update seed data and demo reset flow when necessary.

## Mandatory implementation rules

### AI guardrail

AI may extract, draft, summarize, or explain. It must not determine availability, pricing, inventory, reservations, approvals, conflict states, or launch readiness.

When adding an AI call:

- Define a Zod schema or equivalent validation.
- Log input hash, model, latency, validation result, and output reference if AI runs are persisted.
- Add deterministic fallback data for demo-critical flows.
- Pass only allowed facts to proposal/public-copy prompts.

### Data guardrail

When adding or changing data:

- Create an automated migration.
- Create or update a seed script.
- Use UUIDs and timestamptz.
- Add org_id to organization-owned tables.
- Add enums/constants in one shared place.
- Avoid hand-edited demo data.

### Security guardrail

Before committing a server/API change:

- Confirm no service role key is exposed to the browser.
- Confirm staff actions have server-side role checks.
- Confirm organizer access is scoped to own organizer_profile_id/client_id.
- Confirm public event routes read from event_publications, not private event tables.
- Confirm ticket routes use high-entropy token lookup.
- Confirm guest route/map filters public_visible locations only.

### UI guardrail

Before completing a UI change:

- Avoid generic admin labels where command-center language is better.
- Show reasons behind plan recommendations.
- Include loading, empty, and error states.
- Keep mobile usability for organizer and guest flows.
- Ensure Launch Mode remains visually polished and emotionally memorable.

## Preferred implementation order by feature type

### For event intake

1. Define/verify EventIntake schema.
2. Add route/action for parsing.
3. Validate and normalize output.
4. Store raw request, extracted_json, confidence, missingFields, and review status.
5. Add review UI before planning.
6. Add fallback parsed startup conference fixture.

### For planning

1. Read reviewed event requirements.
2. Calculate reservation window from setup_start to teardown_end plus return buffer.
3. Score spaces deterministically.
4. Reserve spaces/assets as soft_hold first if proposal is pending.
5. Detect conflicts.
6. Generate plan version snapshot.
7. Return reasons and gate states.

### For inventory/equipment

1. Support category, serialized asset, bulk batch, kit, kit items.
2. Choose available serialized assets with non-overlapping reservations.
3. Reserve quantities from bulk batches by location/availability.
4. Detect shortages.
5. Search replacement_category_id.
6. Generate movement tasks and asset flows.
7. Support QR scan state changes and audit logs.

### For conflict auto-fix

1. Load open conflict and allowed suggestions.
2. Revalidate availability before applying.
3. Apply reservation/task/gate updates in a transaction where possible.
4. Mark conflict resolved or auto_fixed.
5. Create audit log and plan diff.
6. Refetch or invalidate event plan state.

### For guest/organizer flows

1. Use event_publications as guest-safe projection.
2. Organizer sees only own request, status, and shared proposal.
3. Guest registration creates registration and ticket token.
4. QR payload contains token only, not private guest data.
5. Check-in updates staff dashboard/counts.
6. Guest map shows only public spaces and route steps.

## Required acceptance checks

Before final response, run the available commands. Prefer:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Use pnpm/yarn/bun if the repository uses them. Run migration/seed checks when data changes.

If a command fails, fix the issue. If it cannot be fixed within scope, report the exact command, failure, and recommended next step.

## Final response format

Return:

1. What changed.
2. Files changed.
3. Tests/checks run and results.
4. Any remaining risks or follow-up needed.

Keep it factual. Do not claim tests passed unless they were run successfully.