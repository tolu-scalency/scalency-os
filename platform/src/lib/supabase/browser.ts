import { createBrowserClient } from "@supabase/ssr";

// A Supabase client for Client Components (the login form and the sidebar's user menu).
// Next.js replaces these two values at build time, so they must be read directly, not through a helper.
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
