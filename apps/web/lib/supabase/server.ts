/**
 * Supabase clients for the Next.js API.
 *
 * `userClient(token)` → a client scoped to an end-user's JWT. Honours RLS.
 *   Use this in every route that acts on the caller's own data.
 *
 * `adminClient()`     → a client using the service role key. Bypasses RLS.
 *   Use only for privileged operations that genuinely need it (e.g. reading
 *   data across all users for admin reports). Never expose the key to the
 *   client bundle — it lives in server env only.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function userClient(token: string): SupabaseClient {
  return createClient(
    must("NEXT_PUBLIC_SUPABASE_URL"),
    must("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

let _admin: SupabaseClient | null = null;
export function adminClient(): SupabaseClient {
  if (_admin) return _admin;
  _admin = createClient(
    must("NEXT_PUBLIC_SUPABASE_URL"),
    must("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  return _admin;
}
