-- Migration 0003 — Notifications, normalized AgendaItem, AppSetting metadata.
--
-- Purely ADDITIVE. No locked decision is reverted; no existing column/table is
-- altered destructively. Hand-authored (matching 0002_rls_policies) and written
-- to be idempotent so it can be re-applied safely.

-- ---------------------------------------------------------------------------
-- Enums (guarded: Postgres has no CREATE TYPE IF NOT EXISTS)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM (
    'EVENT_REQUEST_RECEIVED', 'EVENT_APPROVED', 'EVENT_REJECTED', 'CONFLICT_DETECTED',
    'PROPOSAL_SHARED', 'PROPOSAL_RESPONDED', 'TASK_ASSIGNED', 'RESERVATION_UPDATED',
    'LAUNCH_READY', 'GENERAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'READ', 'FAILED', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- AppSetting: additive metadata columns
-- ("group" is a reserved word and must stay quoted everywhere.)
-- ---------------------------------------------------------------------------
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "group" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "label" TEXT;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "is_public" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "is_editable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "updated_by_id" UUID;

-- ---------------------------------------------------------------------------
-- agenda_items (normalized; complements EventPublication.agenda jsonb cache)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "agenda_items" (
  "id"             UUID NOT NULL,
  "org_id"         UUID NOT NULL,
  "publication_id" UUID NOT NULL,
  "space_id"       UUID,
  "title"          TEXT NOT NULL,
  "description"    TEXT,
  "starts_at"      TIMESTAMPTZ(6) NOT NULL,
  "ends_at"        TIMESTAMPTZ(6) NOT NULL,
  "sort_order"     INTEGER,
  "public_visible" BOOLEAN NOT NULL DEFAULT true,
  "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "agenda_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agenda_items_org_id_publication_id_idx"
  ON "agenda_items" ("org_id", "publication_id");

DO $$ BEGIN
  ALTER TABLE "agenda_items"
    ADD CONSTRAINT "agenda_items_publication_id_fkey"
    FOREIGN KEY ("publication_id") REFERENCES "event_publications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "agenda_items"
    ADD CONSTRAINT "agenda_items_space_id_fkey"
    FOREIGN KEY ("space_id") REFERENCES "spaces"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- notifications (org_id is a plain column, AuditLog pattern — no FK relation)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "notifications" (
  "id"                   UUID NOT NULL,
  "org_id"               UUID NOT NULL,
  "recipient_profile_id" UUID,
  "type"                 "NotificationType" NOT NULL,
  "channel"              "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
  "status"               "NotificationStatus" NOT NULL DEFAULT 'PENDING',
  "title"                TEXT NOT NULL,
  "body"                 TEXT,
  "entity_type"          TEXT,
  "entity_id"            UUID,
  "data"                 JSONB NOT NULL DEFAULT '{}',
  "read_at"              TIMESTAMPTZ(6),
  "sent_at"              TIMESTAMPTZ(6),
  "created_at"           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notifications_org_id_recipient_profile_id_status_idx"
  ON "notifications" ("org_id", "recipient_profile_id", "status");

CREATE INDEX IF NOT EXISTS "notifications_org_id_type_idx"
  ON "notifications" ("org_id", "type");
