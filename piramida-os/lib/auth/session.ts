// Server-only module (imports next/headers). Never import into a client component.
import { cookies, headers } from "next/headers";
import { createSupabaseServerClient } from "./supabase-server";

/**
 * Auth session seam.
 *
 * Production wiring: replace `resolveAuthUserId` with a Supabase call
 * (`createServerClient(...).auth.getUser()` from `@supabase/ssr`) that VERIFIES
 * the JWT and returns `auth.users.id`. That package is not yet installed, so the
 * default implementation below is a clearly-marked development seam:
 *   - reads a verified session id if a future Supabase adapter sets it, else
 *   - in DEMO_MODE only, trusts an `x-demo-auth-user-id` header / `demo_auth`
 *     cookie so the app is testable locally before Auth is wired.
 *
 * It must NEVER trust an unverified header outside DEMO_MODE.
 */

export async function getAuthUserId(): Promise<string | null> {
  // Slot for the real Supabase adapter (set once @supabase/ssr is added).
  const fromSupabase = await resolveSupabaseUserId();
  if (fromSupabase) return fromSupabase;

  if (process.env.DEMO_MODE === "true") {
    const h = await headers();
    const headerId = h.get("x-demo-auth-user-id");
    if (headerId) return headerId;
    const c = await cookies();
    const cookieId = c.get("demo_auth")?.value;
    if (cookieId) return cookieId;
  }
  return null;
}

// Verifies the Supabase session and returns auth.users.id. Returns null on any
// error (missing/placeholder keys, no session) so the DEMO_MODE fallback can
// take over in development.
async function resolveSupabaseUserId(): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}
