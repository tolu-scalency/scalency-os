"use server";

import { shortId } from "@/lib/short-id-shared";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { can, getWorkspace } from "@/lib/data";
import { randomUUID } from "node:crypto";
import { adminClient } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { cleanBusiness, cleanRules, DEFAULT_RULES, DEMO_BUSINESS, type SetterStatus } from "@/lib/setter";

// The AI setter's settings. Saving the GHL key and the test chat go straight to the
// ai-setter function from the page (it encrypts the key); everything else is here.

const NO_ACCESS = "You don't have access to set up AI in this workspace. Ask the workspace owner.";
type Result = { error?: string; ok?: string };

/** A new AI setter, filled in with the med spa demo so it can be tested straight away. */
export async function createSetter() {
  const ws = await getWorkspace();
  if (!can(ws, "ai.manage")) redirect("/agents?error=access");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("setter_agents")
    .insert({ account_id: ws.account.id, name: "AI setter", status: "off", business: DEMO_BUSINESS, rules: DEFAULT_RULES })
    .select("id")
    .single();
  if (error || !data) redirect("/agents?error=1");
  redirect(`/agents/${shortId(data.id)}`);
}

export async function saveSetter(id: string, input: { name: string; business: unknown; rules: unknown }): Promise<Result> {
  const ws = await getWorkspace();
  if (!can(ws, "ai.manage")) return { error: NO_ACCESS };
  const name = String(input.name ?? "").trim().slice(0, 120) || "AI setter";
  const business = cleanBusiness(input.business);
  if (!business.clinicName) return { error: "Add the business name first." };
  const supabase = await createClient();
  const { error } = await supabase.from("setter_agents").update({ name, business, rules: cleanRules(input.rules) }).eq("id", id).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't save that. Try again." };
  return { ok: "Saved" };
}

/** Off, test (only contacts tagged ai-test) or live (every lead). Live needs GHL and a calendar. */
export async function setSetterStatus(id: string, status: SetterStatus): Promise<Result> {
  const ws = await getWorkspace();
  if (!can(ws, "ai.manage")) return { error: NO_ACCESS };
  if (!["off", "test", "live"].includes(status)) return { error: "Unknown status." };
  const supabase = await createClient();
  const { data: a } = await supabase.from("setter_agents").select("ghl_location_id, ghl_checked_at, ghl_error, ghl_calendar_id").eq("id", id).eq("account_id", ws.account.id).maybeSingle();
  if (!a) return { error: "We couldn't find that AI setter." };
  if (status !== "off") {
    if (!a.ghl_location_id || !a.ghl_checked_at || a.ghl_error) return { error: "Connect GHL first (the Connect GHL tab)." };
    if (!a.ghl_calendar_id) return { error: "Choose the calendar to book into first (the Connect GHL tab)." };
  }
  const { error } = await supabase.from("setter_agents").update({ status }).eq("id", id).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't change that. Try again." };
  refresh();
  return { ok: status === "live" ? "Live: the AI setter now works every new lead." : status === "test" ? "Test mode: it only talks to contacts tagged ai-test." : "Switched off." };
}

/** The calendar to book into and the pipeline stages to move deals to. */
export async function saveGhlChoices(
  id: string,
  input: { calendarId: string; calendarName: string; pipelineId: string; stages: { contacted?: string; booked?: string; not_interested?: string } },
): Promise<Result> {
  const ws = await getWorkspace();
  if (!can(ws, "ai.manage")) return { error: NO_ACCESS };
  const idOk = (v: unknown) => typeof v === "string" && /^[A-Za-z0-9-]{1,60}$/.test(v);
  const stages = Object.fromEntries(Object.entries(input.stages ?? {}).filter(([k, v]) => ["contacted", "booked", "not_interested"].includes(k) && idOk(v)));
  const supabase = await createClient();
  const { error } = await supabase
    .from("setter_agents")
    .update({
      ghl_calendar_id: idOk(input.calendarId) ? input.calendarId : null,
      ghl_calendar_name: String(input.calendarName ?? "").slice(0, 120) || null,
      ghl_pipeline_id: idOk(input.pipelineId) ? input.pipelineId : null,
      ghl_stages: stages,
    })
    .eq("id", id)
    .eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't save that. Try again." };
  refresh();
  return { ok: "Saved" };
}

/** Hand a conversation back to the AI, or stop it. */
export async function setThread(threadId: string, to: "active" | "stopped" | "opener"): Promise<Result> {
  const ws = await getWorkspace();
  if (!can(ws, "ai.manage")) return { error: NO_ACCESS };
  const supabase = await createClient();
  if (to === "opener") {
    // Only for a lead who hasn't had a first message yet. The clock sends it within a minute.
    const { data, error } = await supabase
      .from("setter_threads")
      .update({ state: "active", next_action: "opener", next_action_at: new Date().toISOString(), note: null })
      .eq("id", threadId)
      .eq("account_id", ws.account.id)
      .is("last_outbound_at", null)
      .select("id");
    if (error) return { error: "We couldn't do that. Try again." };
    if (!data?.length) return { error: "The AI has already messaged this lead." };
    refresh();
    return { ok: "Queued. The first message goes out within a minute, if it's within opening hours. In test mode the contact needs the ai-test tag in GHL." };
  }
  const patch =
    to === "active"
      ? { state: "active", next_action: "followup", next_action_at: new Date(Date.now() + 86_400_000).toISOString(), note: "Handed back to the AI" }
      : { state: "stopped", next_action: null, next_action_at: null, note: "Stopped by the team" };
  const { error } = await supabase.from("setter_threads").update(patch).eq("id", threadId).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't change that. Try again." };
  refresh();
  return { ok: to === "active" ? "Handed back. The AI follows up from tomorrow if they don't reply." : "Stopped. The AI won't message them again." };
}

export async function deleteSetter(id: string) {
  const ws = await getWorkspace();
  if (!can(ws, "ai.manage")) redirect("/agents?error=access");
  const supabase = await createClient();
  await supabase.from("setter_agents").delete().eq("id", id).eq("account_id", ws.account.id);
  redirect("/agents");
}

/** Gives the setter new webhook addresses. The old ones stop working straight away. */
export async function newWebhookAddresses(id: string): Promise<Result> {
  const ws = await getWorkspace();
  if (!can(ws, "ai.manage")) return { error: NO_ACCESS };
  const admin = adminClient();
  if (!admin) return { error: "The server isn't set up for this yet (SUPABASE_SECRET_KEY is missing in Netlify)." };
  const { error, count } = await admin
    .from("setter_agents")
    .update({ webhook_key: randomUUID().replace(/-/g, "") }, { count: "exact" })
    .eq("id", id)
    .eq("account_id", ws.account.id);
  if (error || !count) return { error: "We couldn't change the addresses. Try again." };
  return { ok: "New addresses made. Paste them into your 3 GHL workflows now, as the old ones have stopped working." };
}

// ---------------------------------------------------------------- Knowledge bank

type KnowledgeIn = { question: string; answer: string };
const cleanQa = (k: KnowledgeIn) => ({ question: String(k.question ?? "").trim().slice(0, 300), answer: String(k.answer ?? "").trim().slice(0, 1500) });

/** Adds answers to the Knowledge bank. Typed answers are approved; scanned ones wait to be checked. */
export async function addKnowledge(setterId: string, items: KnowledgeIn[], source: "manual" | "website" | "document"): Promise<Result & { count?: number }> {
  const ws = await getWorkspace();
  if (!can(ws, "ai.manage")) return { error: NO_ACCESS };
  const rows = (Array.isArray(items) ? items : [])
    .map(cleanQa)
    .filter((k) => k.question && k.answer)
    .slice(0, 50)
    .map((k) => ({ ...k, account_id: ws.account.id, agent_id: setterId, source: ["manual", "website", "document"].includes(source) ? source : "manual", approved: source === "manual" }));
  if (!rows.length) return { error: "Add a question and an answer." };
  const supabase = await createClient();
  const { error } = await supabase.from("setter_knowledge").insert(rows);
  if (error) return { error: "We couldn't save that. Check the database update (SQL-14) has been run." };
  refresh();
  return { ok: rows.length === 1 ? "Added" : `${rows.length} answers added`, count: rows.length };
}

export async function updateKnowledge(id: string, patch: { question?: string; answer?: string; approved?: boolean }): Promise<Result> {
  const ws = await getWorkspace();
  if (!can(ws, "ai.manage")) return { error: NO_ACCESS };
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.question === "string") row.question = patch.question.trim().slice(0, 300);
  if (typeof patch.answer === "string") row.answer = patch.answer.trim().slice(0, 1500);
  if (typeof patch.approved === "boolean") row.approved = patch.approved;
  if (row.question === "" || row.answer === "") return { error: "A question and an answer are both needed." };
  const supabase = await createClient();
  const { error } = await supabase.from("setter_knowledge").update(row).eq("id", id).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't save that." };
  refresh();
  return { ok: "Saved" };
}

export async function deleteKnowledge(id: string): Promise<Result> {
  const ws = await getWorkspace();
  if (!can(ws, "ai.manage")) return { error: NO_ACCESS };
  const supabase = await createClient();
  const { error } = await supabase.from("setter_knowledge").delete().eq("id", id).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't delete that." };
  refresh();
  return { ok: "Deleted" };
}
