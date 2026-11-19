"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getWorkspace } from "@/lib/data";
import { cleanDefinition, DEFAULT_DEFINITION, publishProblem } from "@/lib/form-builder";

const NO_ACCESS = "You don't have access to build forms. Ask the workspace owner.";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "form";
}

/** Creates a form with the usual contact fields and opens the builder. */
export async function createForm(fd: FormData) {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) redirect("/forms?error=access");
  const supabase = await createClient();
  const base = String(fd.get("name") ?? "").trim().slice(0, 80) || "Contact form";
  let name = base;
  for (let i = 2; i < 50; i++) {
    const { count } = await supabase.from("forms").select("id", { count: "exact", head: true }).eq("account_id", ws.account.id).eq("name", name);
    if (!count) break;
    name = `${base} ${i}`;
  }
  const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await supabase
    .from("forms")
    .insert({ account_id: ws.account.id, name, slug, status: "draft", definition: { ...DEFAULT_DEFINITION, title: base === "Contact form" ? DEFAULT_DEFINITION.title : base } })
    .select("id")
    .single();
  if (error || !data) redirect("/forms?error=1");
  redirect(`/forms/${data.id}`);
}

type SaveInput = { name: string; definition: unknown; tags: string[]; stageId: string | null; redirectUrl: string };

/** Saves the builder. Published forms must still have a way to reach the person. */
export async function saveForm(id: string, input: SaveInput): Promise<{ error?: string; ok?: string }> {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) return { error: NO_ACCESS };
  const supabase = await createClient();
  const name = String(input.name ?? "").trim().slice(0, 80);
  if (!name) return { error: "Give the form a name." };
  const definition = cleanDefinition(input.definition);
  const tags = [...new Set((Array.isArray(input.tags) ? input.tags : []).map((t) => String(t).trim().slice(0, 40)).filter(Boolean))].slice(0, 10);
  const redirectUrl = String(input.redirectUrl ?? "").trim();
  if (redirectUrl && !/^https:\/\/[^\s]+\.[^\s]+$/.test(redirectUrl)) return { error: "The thank-you page must be a full https:// address." };

  let stageId: string | null = null;
  let pipelineId: string | null = null;
  if (input.stageId) {
    const { data: st } = await supabase.from("pipeline_stages").select("id, pipeline_id").eq("id", input.stageId).eq("account_id", ws.account.id).maybeSingle();
    if (!st) return { error: "Choose a pipeline stage that still exists." };
    stageId = st.id as string;
    pipelineId = st.pipeline_id as string;
  }

  const { data: current } = await supabase.from("forms").select("status").eq("id", id).eq("account_id", ws.account.id).maybeSingle();
  if (!current) return { error: "This form no longer exists." };
  if (current.status === "live") {
    const problem = publishProblem(definition);
    if (problem) return { error: problem };
  }

  const { error } = await supabase
    .from("forms")
    .update({ name, definition, tags, stage_id: stageId, pipeline_id: pipelineId, redirect_url: redirectUrl || null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't save the form. Try again." };
  return { ok: "Saved" };
}

/** Publish, unpublish or archive. */
export async function setFormStatus(id: string, status: "live" | "draft" | "archived"): Promise<{ error?: string; ok?: string }> {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) return { error: NO_ACCESS };
  if (!["live", "draft", "archived"].includes(status)) return { error: "Unknown status." };
  const supabase = await createClient();
  if (status === "live") {
    const { data } = await supabase.from("forms").select("definition").eq("id", id).eq("account_id", ws.account.id).maybeSingle();
    if (!data) return { error: "This form no longer exists." };
    const problem = publishProblem(cleanDefinition(data.definition));
    if (problem) return { error: problem };
  }
  const { error } = await supabase.from("forms").update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't change that. Try again." };
  refresh();
  return { ok: status === "live" ? "Published. The link and embed code are ready." : status === "draft" ? "Unpublished. The link stops working until you publish again." : "Archived." };
}

/** Deletes a form and its submissions (contacts stay). */
export async function deleteForm(id: string) {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) redirect("/forms?error=access");
  const supabase = await createClient();
  await supabase.from("forms").delete().eq("id", id).eq("account_id", ws.account.id);
  redirect("/forms");
}
