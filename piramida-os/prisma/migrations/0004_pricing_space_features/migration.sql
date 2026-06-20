-- Migration 0004 — Pricing rules table + Space feature metadata
--
-- ADDITIVE: adds two columns to spaces and creates the new pricing_rules table.
-- Idempotent: all DDL guarded with IF NOT EXISTS / IF EXISTS.

-- ---------------------------------------------------------------------------
-- spaces: area_sqm + features JSONB
-- ---------------------------------------------------------------------------
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "area_sqm" DOUBLE PRECISION;
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "features" JSONB NOT NULL DEFAULT '{}';

-- ---------------------------------------------------------------------------
-- pricing_rules: composable, scope-keyed pricing rows.
--
-- scope:     'space' | 'asset_category' | 'kit' | 'service' | 'modifier'
-- target_id: FK into the relevant table (null for modifiers / tax rows)
-- match_json: optional condition bag — all keys must match for the rule to apply
-- rate_type: 'per_hour' | 'per_day' | 'per_event' | 'per_unit_per_day' |
--             'per_unit_per_event' | 'flat' | 'percent'
-- priority:  lower number is applied first; modifier rows applied after base
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "pricing_rules" (
    "id"                  UUID          NOT NULL DEFAULT gen_random_uuid(),
    "org_id"              UUID          NOT NULL,
    "scope"               TEXT          NOT NULL,
    "target_id"           UUID,
    "label"               TEXT          NOT NULL,
    "match_json"          JSONB         NOT NULL DEFAULT '{}',
    "rate_type"           TEXT          NOT NULL,
    "amount"              DECIMAL(10,2) NOT NULL,
    "currency"            TEXT          NOT NULL DEFAULT 'ALL',
    "min_billable_hours"  DECIMAL(4,1),
    "priority"            INTEGER       NOT NULL DEFAULT 0,
    "active"              BOOLEAN       NOT NULL DEFAULT true,
    "notes"               TEXT,
    "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- FK
DO $$ BEGIN
  ALTER TABLE "pricing_rules"
    ADD CONSTRAINT "pricing_rules_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "pricing_rules_org_scope_active_idx"
  ON "pricing_rules"("org_id", "scope", "active");

CREATE INDEX IF NOT EXISTS "pricing_rules_org_target_scope_idx"
  ON "pricing_rules"("org_id", "target_id", "scope");
