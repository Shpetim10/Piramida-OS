-- Migration 0005 — Event request clarifications (organizer Q&A + schedule)
--
-- ADDITIVE: stores the questions the AI surfaced, the organizer's answers, and
-- the chosen start date / duration / end date captured at submit time. Staff &
-- admins read this as the authoritative organizer intent for each request.
-- Idempotent: guarded with IF NOT EXISTS.

ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "clarifications" JSONB;
