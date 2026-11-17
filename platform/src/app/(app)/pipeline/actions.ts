"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getDeal, getPipeline, getWorkspace, listCustomFields } from "@/lib/data";
import { parseFieldValue } from "@/lib/field-types";
import { NO_ACCESS } from "@/lib/permissions";
import { text, type ActionResult } from "@/lib/forms";
import { runWorkflowsSoon } from "@/lib/run-soon";

const TEMPLATES: Record<string, { name: string; stages: string[] }> = {
  sales: { name: "Sales", stages: ["New lead", "Contacted", "Call booked", "Proposal sent", "Won", "Lost"] },
  leadgen: {
    name: "Lead gen",
    stages: ["Application started", "Qualified, not booked", "Call booked", "Confirmed", "No answer", "No-show", "Unqualified", "Follow-up", "Closed", "Lost"],
  },
  clients: { name: "Clients", stages: ["Onboarding", "In progress", "Review", "Live", "Paused"] },
};

/** Creates the workspace's pipeline from a template, or from the stages the person typed. */
export async function createPipeline(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const template = text(fd, "template", 20);
  const custom = text(fd, "stages", 2000)
    .split(/[\n,]+/)
    .map((s) => s.trim().slice(0, 60))
    .filter(Boolean);
  const base = template === "custom" ? { name: "Pipeline", stages: [...new Set(custom)] } : TEMPLATES[template];
  const chosen = base ? { ...base, name: text(fd, "name", 60) || base.name } : null;
  if (!chosen) return { error: "Choose a template." };
  if (chosen.stages.length < 2) return { error: "Add at least two stages, one per line." };
  if (chosen.stages.length > 20) return { error: "Keep it to 20 stages or fewer." };

  const ws = await getWorkspace();
  const supabase = await createClient();
  const { count } = await supabase.from("pipelines").select("id", { count: "exact", head: true }).eq("account_id", ws.account.id);
  if ((count ?? 0) >= 20) return { error: "You can have up to 20 pipelines." };
  const { data: pipeline, error } = await supabase.from("pipelines").insert({ account_id: ws.account.id, name: chosen.name, position: (count ?? 0) + 1 }).select("id").single();
  if (error || !pipeline) return { error: error?.code === "23505" ? "You already have a pipeline with that name." : "We couldn't create the pipeline." };
  const { error: stageError } = await supabase
    .from("pipeline_stages")
    .insert(chosen.stages.map((name, i) => ({ account_id: ws.account.id, pipeline_id: pipeline.id, name, position: i + 1 })));
  if (stageError) {
    await supabase.from("pipelines").delete().eq("id", pipeline.id);
    return { error: "Each stage needs a different name." };
  }
  refresh();
  return { ok: pipeline.id as string };
}

/** Drag and drop on the board: moves one card to another stage. */
export async function moveCard(opportunityId: string, stageId: string): Promise<ActionResult> {
  const ws = await getWorkspace();
  const supabase = await createClient();
  const [{ data: stage }, { data: opp }] = await Promise.all([
    supabase.from("pipeline_stages").select("id, name, pipeline_id").eq("id", stageId).eq("account_id", ws.account.id).maybeSingle(),
    supabase.from("opportunities").select("id, contact_id, stage_id").eq("id", opportunityId).eq("account_id", ws.account.id).maybeSingle(),
  ]);
  if (!stage || !opp) return { error: "That card or stage no longer exists." };
  if (opp.stage_id === stage.id) return {};
  const { error } = await supabase.from("opportunities").update({ stage_id: stage.id, pipeline_id: stage.pipeline_id }).eq("id", opp.id);
  if (error) return { error: "We couldn't move the card." };
  await supabase.from("activity").insert({
    account_id: ws.account.id,
    contact_id: opp.contact_id,
    opportunity_id: opp.id,
    type: "stage.changed",
    summary: `Moved to ${stage.name}`,
  });
  runWorkflowsSoon(supabase, ws.account.id);
  return {};
}

/** Adds a stage at the end of the pipeline. */
export async function addStage(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const name = text(fd, "name", 60);
  if (!name) return { error: "Name the stage." };
  const ws = await getWorkspace();
  const pipeline = await getPipeline(ws.account.id, text(fd, "pipeline_id", 40) || null);
  if (!pipeline) return { error: "Set up your pipeline first." };
  const supabase = await createClient();
  const position = Math.max(0, ...pipeline.stages.map((s) => s.position)) + 1;
  const { error } = await supabase.from("pipeline_stages").insert({ account_id: ws.account.id, pipeline_id: pipeline.id, name, position });
  if (error) return { error: error.code === "23505" ? "You already have a stage with that name." : "We couldn't add the stage." };
  refresh();
  return { ok: "Stage added." };
}

/** Renames a pipeline. */
export async function renamePipeline(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = text(fd, "id", 40);
  const name = text(fd, "name", 60);
  if (!name) return { error: "Name the pipeline." };
  const ws = await getWorkspace();
  const supabase = await createClient();
  const { error } = await supabase.from("pipelines").update({ name }).eq("id", id).eq("account_id", ws.account.id);
  if (error) return { error: error.code === "23505" ? "You already have a pipeline with that name." : NO_ACCESS };
  refresh();
  return { ok: "Saved." };
}

/** Deletes a pipeline that has no deals. */
export async function deletePipeline(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = text(fd, "id", 40);
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_pipeline", { target: id });
  if (error) return { error: error.message.replace(/^.*?: /, "") };
  refresh();
  return {};
}

const money = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(/[£,\s]/g, ""));
  return String(v ?? "").trim() === "" || !Number.isFinite(n) || n < 0 ? null : Math.round(n * 100);
};

/** Saves the deal panel: name, value, pipeline and stage, status, owner, source and deal fields. */
export async function saveDeal(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = text(fd, "id", 40);
  const ws = await getWorkspace();
  if (!can(ws, "deals.edit")) return { error: NO_ACCESS };
  const supabase = await createClient();
  const { data: before } = await supabase.from("opportunities").select("id, contact_id, stage_id, status, custom").eq("id", id).eq("account_id", ws.account.id).maybeSingle();
  if (!before) return { error: "That deal no longer exists." };

  const stageId = text(fd, "stage_id", 40);
  const { data: stage } = await supabase.from("pipeline_stages").select("id, name, pipeline_id").eq("id", stageId).eq("account_id", ws.account.id).maybeSingle();
  if (!stage) return { error: "Choose a stage." };
  const status = text(fd, "status", 12);
  if (!["open", "won", "lost", "abandoned"].includes(status)) return { error: "Choose a status." };
  const owner = text(fd, "owner", 40);

  // Deal fields, checked by type.
  const fields = await listCustomFields(ws.account.id, "opportunity");
  const custom: Record<string, unknown> = { ...((before.custom as Record<string, unknown>) ?? {}) };
  for (const f of fields) {
    const key = `cf_${f.key}`;
    if (!fd.has(key) && !fd.has(`${key}__multi`)) continue;
    const raw = f.type === "multi_select" ? fd.getAll(key).map(String) : String(fd.get(key) ?? "");
    const parsed = parseFieldValue(f.type, f.options, raw, f.label);
    if ("error" in parsed) return { error: parsed.error };
    if (parsed.value === null) delete custom[f.key];
    else custom[f.key] = parsed.value;
  }

  const { error } = await supabase
    .from("opportunities")
    .update({
      name: text(fd, "name", 120) || undefined,
      value_pence: money(fd.get("value")),
      pipeline_id: stage.pipeline_id,
      stage_id: stage.id,
      status,
      lost_reason: status === "lost" ? text(fd, "lost_reason", 200) || null : null,
      assigned_to: /^[0-9a-f-]{36}$/i.test(owner) ? owner : null,
      source: text(fd, "source", 80) || null,
      custom,
    })
    .eq("id", id)
    .eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't save the deal." };

  const notes: string[] = [];
  if (before.stage_id !== stage.id) notes.push(`Moved to ${stage.name}`);
  if (before.status !== status) notes.push(status === "open" ? "Reopened" : `Marked ${status}`);
  if (notes.length) {
    await supabase.from("activity").insert({ account_id: ws.account.id, contact_id: before.contact_id, opportunity_id: id, type: "stage.changed", summary: notes.join(". ") });
    runWorkflowsSoon(supabase, ws.account.id);
  }
  refresh();
  return { ok: "Saved." };
}

/** Adds a deal for an existing contact. */
export async function createDeal(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ws = await getWorkspace();
  if (!can(ws, "deals.edit")) return { error: NO_ACCESS };
  const contactId = text(fd, "contact_id", 40);
  const stageId = text(fd, "stage_id", 40);
  const supabase = await createClient();
  const [{ data: contact }, { data: stage }] = await Promise.all([
    supabase.from("contacts").select("id, first_name, last_name, email, phone").eq("id", contactId).eq("account_id", ws.account.id).maybeSingle(),
    supabase.from("pipeline_stages").select("id, name, pipeline_id").eq("id", stageId).eq("account_id", ws.account.id).maybeSingle(),
  ]);
  if (!contact) return { error: "Choose a contact." };
  if (!stage) return { error: "Choose a stage." };
  const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email || contact.phone || "New deal";
  const owner = text(fd, "owner", 40);
  const { data: deal, error } = await supabase
    .from("opportunities")
    .insert({
      account_id: ws.account.id,
      contact_id: contact.id,
      pipeline_id: stage.pipeline_id,
      stage_id: stage.id,
      name: text(fd, "name", 120) || contactName,
      value_pence: money(fd.get("value")),
      source: text(fd, "source", 80) || null,
      assigned_to: /^[0-9a-f-]{36}$/i.test(owner) ? owner : null,
    })
    .select("id")
    .single();
  if (error || !deal) return { error: "We couldn't add the deal." };
  await supabase.from("activity").insert({ account_id: ws.account.id, contact_id: contact.id, opportunity_id: deal.id, type: "stage.changed", summary: `Deal added in ${stage.name}` });
  runWorkflowsSoon(supabase, ws.account.id);
  refresh();
  return { ok: "Deal added." };
}

/** Deletes a deal (the contact stays). */
export async function deleteDeal(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = text(fd, "id", 40);
  const ws = await getWorkspace();
  if (!can(ws, "deals.edit")) return { error: NO_ACCESS };
  const supabase = await createClient();
  const { error } = await supabase.from("opportunities").delete().eq("id", id).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't delete the deal." };
  refresh();
  return { ok: "Deleted." };
}

/** Loads one deal for the panel. */
export async function loadDeal(id: string) {
  const ws = await getWorkspace();
  const [deal, fields] = await Promise.all([getDeal(ws.account.id, id), listCustomFields(ws.account.id, "opportunity")]);
  return deal ? { deal, fields } : null;
}
