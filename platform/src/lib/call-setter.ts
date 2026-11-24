import { createClient } from "@/lib/supabase/browser";

/** Calls the ai-setter function from the browser, with a plain-words error if it fails. */
export async function callSetter(body: Record<string, unknown>) {
  const { data, error } = await createClient().functions.invoke("ai-setter", { body });
  if (error) {
    let msg = "We couldn't reach the AI setter. Check it's deployed in Supabase (Edge Functions, ai-setter).";
    try {
      const ctx = (error as { context?: Response }).context;
      const j = ctx ? await ctx.json() : null;
      if (j?.error) msg = j.error;
    } catch {}
    return { error: msg } as Record<string, unknown> & { error: string };
  }
  return data as Record<string, unknown>;
}
