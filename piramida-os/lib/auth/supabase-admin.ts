// Service-role Supabase client. SERVER-ONLY — never import into a client
// component or expose the key to the browser. Used for privileged auth admin
// operations (e.g. creating an email-confirmed user during organizer signup),
// mirroring the pattern in scripts/create-admin.ts.
import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
