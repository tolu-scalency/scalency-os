import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** The server-only Supabase client (secret key). Bypasses row-level security, so only use it in trusted server code. */
export function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
