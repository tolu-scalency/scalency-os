"use server";

import { revalidatePath } from "next/cache";
import { can, getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

type Result = { ok?: string; error?: string };

const OUTCOMES = ["booked", "no_answer", "callback", "not_interested", "handed_back", "resolved"] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** Pick up a lead from the queue: it's yours, and others see who has it. */
export async function claimHandoff(id: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };
  const { data, error } = await supabase.from("setter_handoffs").update({ status: "claimed", claimed_by: user.id, claimed_at: new Date().toISOString() }).eq("id", id).eq("status", "open").select("id");
  if (error) return { error: "You don't have access to pick this up. Ask the workspace owner." };
  if (!data?.length) return { error: "Someone has already picked this up." };
  revalidatePath("/setter-console");
  return { ok: "It's yours. Call them now." };
}

/** Close a handoff with what happened. "Hand back to the AI" also lets the AI carry on with the lead. */
export async function finishHandoff(id: string, outcome: Outcome): Promise<Result> {
  if (!OUTCOMES.includes(outcome)) return { error: "Choose what happened." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };
  const { data: h } = await supabase.from("setter_handoffs").select("id, account_id, thread_id, claimed_by").eq("id", id).maybeSingle();
  if (!h) return { error: "We couldn't find that handoff." };
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("setter_handoffs")
    .update({ status: "done", done_at: now, outcome, claimed_by: h.claimed_by ?? user.id, claimed_at: h.claimed_by ? undefined : now })
    .eq("id", id);
  if (error) return { error: "You don't have access to close this. Ask the workspace owner." };
  if (outcome === "handed_back") {
    const ws = await getWorkspace();
    // Handing back needs "Manage AI" in that clinic's workspace; the queue spans clinics, so check there.
    const { data: allowed } = await supabase.rpc("has_permission", { target: h.account_id, perm: "ai.manage" });
    if (allowed !== true && !(ws.account.id === h.account_id && can(ws, "ai.manage"))) return { ok: "Closed. Ask someone with Manage AI to hand the lead back to the AI." };
    await supabase
      .from("setter_threads")
      .update({ state: "active", next_action: "followup", next_action_at: new Date(Date.now() + 86_400_000).toISOString(), note: "Handed back to the AI from the setter console" })
      .eq("id", h.thread_id);
  }
  revalidatePath("/setter-console");
  return { ok: outcome === "handed_back" ? "Closed and handed back to the AI." : "Closed." };
}
