"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getWorkspace } from "@/lib/data";
import { blankDefinition, cleanDefinition, field, publishProblem, row, step } from "@/lib/form-builder";
import { templateByKey } from "@/lib/form-templates";

const NO_ACCESS = "You don't have access to build forms. Ask the workspace owner.";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "form";
}

type Db = Awaited<ReturnType<typeof createClient>>;

/** A link name not yet used in this workspace: "free-ai-audit", then "free-ai-audit-2" and so on. */
async function freeSlug(supabase: Db, accountId: string, base: string, exceptId?: string) {
  for (let i = 1; i < 60; i++) {
    const slug = i === 1 ? base : `${base}-${i}`.slice(0, 60);
    let q = supabase.from("forms").select("id", { count: "exact", head: true }).eq("account_id", accountId).eq("slug", slug);
    if (exceptId) q = q.neq("id", exceptId);
    const { count } = await q;
    if (!count) return slug;
  }
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Makes a draft copy of a form (questions, style, settings and tags) and opens it. */
export async function duplicateForm(id: string) {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) redirect("/forms?error=access");
  const supabase = await createClient();
  const { data: f } = await supabase.from("forms").select("name, definition, tags, stage_id, pipeline_id, redirect_url, folder").eq("id", id).eq("account_id", ws.account.id).maybeSingle();
  if (!f) redirect("/forms?error=1");
  const base = `${f.name} (copy)`.slice(0, 80);
  let name = base;
  for (let i = 2; i < 50; i++) {
    const { count } = await supabase.from("forms").select("id", { count: "exact", head: true }).eq("account_id", ws.account.id).eq("name", name);
    if (!count) break;
    name = `${f.name} (copy ${i})`.slice(0, 80);
  }
  const slug = await freeSlug(supabase, ws.account.id, slugify(name));
  const { data, error } = await supabase
    .from("forms")
    .insert({ account_id: ws.account.id, name, slug, status: "draft", definition: cleanDefinition(f.definition), tags: f.tags ?? [], stage_id: f.stage_id, pipeline_id: f.pipeline_id, redirect_url: f.redirect_url, folder: f.folder ?? "" })
    .select("id")
    .single();
  if (error || !data) redirect("/forms?error=1");
  redirect(`/forms/${data.id}`);
}

/** Archive (hide) or restore a form from the list. */
export async function archiveForm(id: string, archived: boolean) {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) return { error: NO_ACCESS };
  const supabase = await createClient();
  const { error } = await supabase.from("forms").update({ status: archived ? "archived" : "draft", updated_at: new Date().toISOString() }).eq("id", id).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't change that. Try again." };
  refresh();
  return { ok: archived ? "Archived. Its link stops working." : "Restored as a draft." };
}

/**
 * Creates a form and opens Form Studio. From a template ("template"), from a
 * definition the AI built ("definition", JSON), or from scratch.
 */
export async function createForm(fd: FormData) {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) redirect("/forms?error=access");
  const supabase = await createClient();
  const tpl = templateByKey(String(fd.get("template") ?? ""));
  let definition = tpl ? tpl.build() : blankDefinition();
  if (!tpl && fd.get("start") === "empty") {
    definition = { ...definition, steps: [step("Step 1", row(field("email")))], progress: "none" };
  }
  const rawDef = String(fd.get("definition") ?? "");
  if (!tpl && rawDef) {
    try {
      definition = cleanDefinition({ ...JSON.parse(rawDef.slice(0, 200_000)), meta: { source: "ai" } });
    } catch {
      redirect("/forms?error=1");
    }
  }
  const base = String(fd.get("name") ?? "").trim().slice(0, 80) || tpl?.name || "Untitled form";
  let name = base;
  for (let i = 2; i < 50; i++) {
    const { count } = await supabase.from("forms").select("id", { count: "exact", head: true }).eq("account_id", ws.account.id).eq("name", name);
    if (!count) break;
    name = `${base} ${i}`;
  }
  const slug = await freeSlug(supabase, ws.account.id, slugify(name));
  const tags = tpl?.key === "ai-audit" ? ["AI audit"] : [];
  const { data, error } = await supabase.from("forms").insert({ account_id: ws.account.id, name, slug, status: "draft", definition: cleanDefinition(definition), tags }).select("id").single();
  if (error || !data) redirect("/forms?error=1");
  redirect(`/forms/${data.id}`);
}

type SaveInput = { name: string; definition: unknown; tags: string[]; stageId: string | null; redirectUrl: string; slug?: string };

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

  let slug: string | undefined;
  if (input.slug !== undefined) {
    slug = String(input.slug).trim().toLowerCase();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 60) return { error: "The link name can only use small letters, numbers and dashes, like free-ai-audit." };
    const { count } = await supabase.from("forms").select("id", { count: "exact", head: true }).eq("account_id", ws.account.id).eq("slug", slug).neq("id", id);
    if (count) return { error: "Another form already uses that link name. Try a different one." };
  }

  const { data: current } = await supabase.from("forms").select("status").eq("id", id).eq("account_id", ws.account.id).maybeSingle();
  if (!current) return { error: "This form no longer exists." };
  if (current.status === "live") {
    const problem = publishProblem(definition);
    if (problem) return { error: problem };
  }

  const { error } = await supabase
    .from("forms")
    .update({ name, definition, tags, stage_id: stageId, pipeline_id: pipelineId, redirect_url: redirectUrl || null, ...(slug ? { slug } : {}), updated_at: new Date().toISOString() })
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

// ---------------------------------------------------------------------------
// Folders: a simple name on each form. A folder exists while a form is in it.
// ---------------------------------------------------------------------------

const cleanFolder = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 60);

/** Moves a form into a folder ("" takes it out of any folder). */
export async function moveFormToFolder(id: string, folder: string): Promise<{ error?: string; ok?: string }> {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) return { error: NO_ACCESS };
  const name = cleanFolder(folder);
  const supabase = await createClient();
  const { error } = await supabase.from("forms").update({ folder: name }).eq("id", id).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't move it. Try again." };
  refresh();
  return { ok: name ? `Moved to "${name}"` : "Taken out of its folder" };
}

/** Renames a folder for every form in it. An empty name takes the forms out of the folder. */
export async function renameFolder(from: string, to: string): Promise<{ error?: string; ok?: string }> {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) return { error: NO_ACCESS };
  const a = cleanFolder(from);
  const b = cleanFolder(to);
  if (!a) return { error: "Choose a folder first." };
  const supabase = await createClient();
  const { error } = await supabase.from("forms").update({ folder: b }).eq("account_id", ws.account.id).eq("folder", a);
  if (error) return { error: "We couldn't rename it. Try again." };
  refresh();
  return { ok: b ? `Renamed to "${b}"` : "Folder removed. Its forms are still here." };
}
