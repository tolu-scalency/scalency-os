"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deliverPending } from "@/lib/deliver";
import { getPipeline, getWorkspace } from "@/lib/data";
import { text, type ActionResult } from "@/lib/forms";

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
  const chosen = template === "custom" ? { name: text(fd, "name", 60) || "Pipeline", stages: [...new Set(custom)] } : TEMPLATES[template];
  if (!chosen) return { error: "Choose a template." };
  if (chosen.stages.length < 2) return { error: "Add at least two stages, one per line." };
  if (chosen.stages.length > 20) return { error: "Keep it to 20 stages or fewer." };

  const ws = await getWorkspace();
  if (await getPipeline(ws.account.id)) return { error: "Your pipeline is already set up." };
  const supabase = await createClient();
  const { data: pipeline, error } = await supabase.from("pipelines").insert({ account_id: ws.account.id, name: chosen.name }).select("id").single();
  if (error || !pipeline) return { error: "We couldn't create the pipeline." };
  const { error: stageError } = await supabase
    .from("pipeline_stages")
    .insert(chosen.stages.map((name, i) => ({ account_id: ws.account.id, pipeline_id: pipeline.id, name, position: i + 1 })));
  if (stageError) {
    await supabase.from("pipelines").delete().eq("id", pipeline.id);
    return { error: "Each stage needs a different name." };
  }
  refresh();
  return {};
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
  await supabase.rpc("run_due_workflows", { target_account: ws.account.id });
  await deliverPending(supabase, ws.account.id);
  return {};
}

/** Adds a stage at the end of the pipeline. */
export async function addStage(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const name = text(fd, "name", 60);
  if (!name) return { error: "Name the stage." };
  const ws = await getWorkspace();
  const pipeline = await getPipeline(ws.account.id);
  if (!pipeline) return { error: "Set up your pipeline first." };
  const supabase = await createClient();
  const position = Math.max(0, ...pipeline.stages.map((s) => s.position)) + 1;
  const { error } = await supabase.from("pipeline_stages").insert({ account_id: ws.account.id, pipeline_id: pipeline.id, name, position });
  if (error) return { error: error.code === "23505" ? "You already have a stage with that name." : "We couldn't add the stage." };
  refresh();
  return { ok: "Stage added." };
}
