-- Starter Row Level Security (RLS) policies for Piramida / Pyramid OS.
--
-- IMPORTANT: the Next.js server connects to Postgres via DATABASE_URL as the
-- `postgres` owner role, which BYPASSES RLS. These policies therefore protect
-- only the paths that use the Supabase anon/authenticated keys directly
-- (browser/edge). Server-side role checks in lib/auth remain mandatory.
--
-- Default posture: enabling RLS with no permissive policy denies all access to
-- anon/authenticated roles. We open up only guest-safe, public surfaces.

-- ---------------------------------------------------------------------------
-- Public, guest-safe reads
-- ---------------------------------------------------------------------------

-- Published event pages are world-readable (anon).
ALTER TABLE "event_publications" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_published_publications" ON "event_publications";
CREATE POLICY "public_read_published_publications"
  ON "event_publications"
  FOR SELECT
  TO anon, authenticated
  USING ("status" = 'PUBLISHED');

-- Public spaces only (never storage / tech / staff-only zones).
ALTER TABLE "spaces" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_public_spaces" ON "spaces";
CREATE POLICY "public_read_public_spaces"
  ON "spaces"
  FOR SELECT
  TO anon, authenticated
  USING ("public_visible" = true AND "staff_only" = false);

-- Public locations only (route waypoints flagged public). Storage points stay hidden.
ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_public_locations" ON "locations";
CREATE POLICY "public_read_public_locations"
  ON "locations"
  FOR SELECT
  TO anon, authenticated
  USING ("public_visible" = true AND "staff_only" = false);

-- ---------------------------------------------------------------------------
-- Tickets: no broad SELECT. Lookup happens only via a security-definer RPC
-- that filters by the exact token, so tokens cannot be enumerated.
-- ---------------------------------------------------------------------------
ALTER TABLE "guest_tickets" ENABLE ROW LEVEL SECURITY;
-- (no permissive policy => anon/authenticated get zero rows by default)

-- Return column types match the schema: ids are uuid, timestamps are timestamptz.
CREATE OR REPLACE FUNCTION public.get_ticket_by_token(p_token text)
RETURNS TABLE (
  id           uuid,
  status       "GuestTicketStatus",
  issued_at    timestamptz,
  guest_name   text,
  event_title  text,
  event_slug   text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id,
         t.status,
         t.issued_at,
         r.full_name      AS guest_name,
         p.public_title   AS event_title,
         p.slug           AS event_slug
  FROM guest_tickets t
  JOIN guest_registrations r ON r.id = t.registration_id
  JOIN event_publications  p ON p.id = r.publication_id
  WHERE t.token = p_token
    AND p.status = 'PUBLISHED'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_ticket_by_token(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Guest registration insert (public sign-up). Reads are NOT granted to anon.
-- ---------------------------------------------------------------------------
ALTER TABLE "guest_registrations" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_insert_registration" ON "guest_registrations";
CREATE POLICY "public_insert_registration"
  ON "guest_registrations"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_publications p
      WHERE p.id = publication_id
        AND p.status = 'PUBLISHED'
        AND p.registration_open = true
    )
  );

-- Everything else (assets, conflicts, reservations, audit, pricing, internal
-- tables) is left WITHOUT RLS policies for anon; those tables must only ever be
-- reached through the server (postgres role) behind lib/auth role checks.
