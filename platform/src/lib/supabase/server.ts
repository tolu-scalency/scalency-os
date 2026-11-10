import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./env";

/**
 * A Supabase client for Server Components, Server Actions and Route Handlers.
 * It signs in as the person using the app, so row-level security decides what they can see.
 * Reading cookies happens at request time, so callers must sit inside a <Suspense> boundary.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabaseKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies. The proxy refreshes the session instead, so this is safe to ignore.
        }
      },
    },
  });
}
