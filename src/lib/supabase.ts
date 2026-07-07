import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

// Server-side Supabase client using the service-role key. This bypasses RLS
// and must NEVER be imported into client components. All route handlers run
// server-side, so this is where our DB I/O lives.
let _admin: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  _admin = createClient(env.supabaseUrl(), env.supabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}
