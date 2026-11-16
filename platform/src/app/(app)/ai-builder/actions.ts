"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/data";
import { buildPlan, cleanBlueprint, type SetupResult } from "@/lib/setup";
import { newHookToken } from "@/lib/workflow-templates";

type ApplyOutcome = { error?: string; result?: SetupResult };

/** Builds the reviewed setup into the workspace. Workflows are created switched off. */
export async function applySetup(setupId: string, edited: unknown, replaceStages: boolean): Promise<ApplyOutcome> {
  if (!/^[0-9a-f-]{36}$/i.test(setupId)) return { error: "That setup is missing. Start again." };
  const ws = await getWorkspace();
  if (ws.account.role !== "owner" && ws.account.role !== "admin") return { error: "Only the owner or an admin can build the workspace." };

  const blueprint = cleanBlueprint(edited);
  if (typeof blueprint === "string") return { error: blueprint };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_workspace_setup", {
    target_setup: setupId,
    plan: buildPlan(blueprint, replaceStages, newHookToken),
  });
  if (error) return { error: error.message.includes("already been used") ? "This setup has already been built." : "We couldn't build the setup. Nothing was changed." };
  refresh();
  return { result: data as SetupResult };
}

/** Removes what a setup added, as long as nobody has started using it. */
export async function undoSetup(setupId: string): Promise<{ error?: string; removed?: number; kept?: string[] }> {
  if (!/^[0-9a-f-]{36}$/i.test(setupId)) return { error: "That setup is missing." };
  const ws = await getWorkspace();
  if (ws.account.role !== "owner" && ws.account.role !== "admin") return { error: "Only the owner or an admin can undo a setup." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("undo_workspace_setup", { target_setup: setupId });
  if (error) return { error: "We couldn't undo that setup." };
  refresh();
  const out = (data ?? {}) as { removed?: number; kept?: string[] };
  return { removed: out.removed ?? 0, kept: out.kept ?? [] };
}
