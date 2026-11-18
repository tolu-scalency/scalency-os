"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getWorkspace } from "@/lib/data";
import { cleanLayout } from "@/lib/dashboard";

/** Saves the workspace's home page layout. Null puts it back to the default. */
export async function saveDashboard(layout: unknown): Promise<{ error?: string; ok?: string }> {
  const ws = await getWorkspace();
  if (!can(ws, "settings.manage")) return { error: "Only people who can manage settings can change the home page." };
  const clean = layout === null ? null : cleanLayout(layout);
  if (layout !== null && !clean) return { error: "That layout isn't valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_dashboard", { target: ws.account.id, layout: clean });
  if (error) return { error: "We couldn't save the home page. Try again." };
  refresh();
  return { ok: "Home page saved." };
}
