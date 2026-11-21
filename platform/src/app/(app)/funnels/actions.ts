"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getWorkspace } from "@/lib/data";
import { blankPage, cleanPage, slugify } from "@/lib/page-builder";
import { pageTemplateByKey } from "@/lib/page-templates";

const NO_ACCESS = "You don't have access to build pages. Ask the workspace owner.";
type Db = Awaited<ReturnType<typeof createClient>>;

/** A link name not used yet in this workspace: "summer-offer", then "summer-offer-2" and so on. */
async function freeSlug(supabase: Db, accountId: string, base: string, exceptId?: string) {
  const root = base || "page";
  for (let i = 1; i < 60; i++) {
    const slug = (i === 1 ? root : `${root}-${i}`).slice(0, 70);
    let q = supabase.from("sites").select("id", { count: "exact", head: true }).eq("account_id", accountId).eq("slug", slug);
    if (exceptId) q = q.neq("id", exceptId);
    const { count } = await q;
    if (!count) return slug;
  }
  return `${root}-${Math.random().toString(36).slice(2, 6)}`;
}

async function freeName(supabase: Db, accountId: string, base: string) {
  let name = base;
  for (let i = 2; i < 50; i++) {
    const { count } = await supabase.from("sites").select("id", { count: "exact", head: true }).eq("account_id", accountId).eq("name", name);
    if (!count) break;
    name = `${base} ${i}`.slice(0, 120);
  }
  return name;
}

/** Creates a page and opens Page Studio: from a template, from scratch, or from an AI draft. */
export async function createPage(fd: FormData) {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) redirect("/funnels?error=access");
  const supabase = await createClient();
  const tpl = pageTemplateByKey(String(fd.get("template") ?? ""));
  let definition = tpl ? tpl.build() : blankPage();
  const raw = String(fd.get("definition") ?? "");
  if (!tpl && raw) {
    try {
      definition = cleanPage({ ...JSON.parse(raw.slice(0, 400_000)), meta: { source: "ai" } });
    } catch {
      redirect("/funnels?error=1");
    }
  }
  const name = await freeName(supabase, ws.account.id, String(fd.get("name") ?? "").trim().slice(0, 100) || tpl?.name || "Untitled page");
  const slug = await freeSlug(supabase, ws.account.id, slugify(name));
  const { data: site, error } = await supabase.from("sites").insert({ account_id: ws.account.id, kind: "page", name, slug, status: "draft" }).select("id").single();
  if (error || !site) redirect("/funnels?error=1");
  const { error: pErr } = await supabase.from("site_pages").insert({ account_id: ws.account.id, site_id: site.id, name, slug: "", position: 0, definition: cleanPage(definition) });
  if (pErr) {
    await supabase.from("sites").delete().eq("id", site.id);
    redirect("/funnels?error=1");
  }
  redirect(`/funnels/${site.id}`);
}

type SaveInput = { name: string; slug?: string; pageId: string; definition: unknown };

/** Saves Page Studio. */
export async function savePage(siteId: string, input: SaveInput): Promise<{ error?: string; ok?: string }> {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) return { error: NO_ACCESS };
  const supabase = await createClient();
  const name = String(input.name ?? "").trim().slice(0, 120);
  if (!name) return { error: "Give the page a name." };
  let slug: string | undefined;
  if (input.slug !== undefined) {
    slug = String(input.slug).trim().toLowerCase();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 70) return { error: "The link name can only use small letters, numbers and dashes, like summer-offer." };
    const { count } = await supabase.from("sites").select("id", { count: "exact", head: true }).eq("account_id", ws.account.id).eq("slug", slug).neq("id", siteId);
    if (count) return { error: "Another page already uses that link name. Try a different one." };
  }
  const definition = cleanPage(input.definition);
  const { error: e1 } = await supabase.from("sites").update({ name, ...(slug ? { slug } : {}) }).eq("id", siteId).eq("account_id", ws.account.id);
  if (e1) return { error: "We couldn't save the page. Try again." };
  const { error: e2 } = await supabase.from("site_pages").update({ name, definition }).eq("id", input.pageId).eq("site_id", siteId).eq("account_id", ws.account.id);
  if (e2) return { error: "We couldn't save the page. Try again." };
  return { ok: "Saved" };
}

/** Publish, unpublish or archive. */
export async function setSiteStatus(id: string, status: "live" | "draft" | "archived"): Promise<{ error?: string; ok?: string }> {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) return { error: NO_ACCESS };
  if (!["live", "draft", "archived"].includes(status)) return { error: "Unknown status." };
  const supabase = await createClient();
  if (status === "live") {
    const { data: pages } = await supabase.from("site_pages").select("definition").eq("site_id", id).eq("account_id", ws.account.id).order("position").limit(1);
    const def = pages?.[0] ? cleanPage(pages[0].definition) : null;
    if (!def || !def.sections.some((s) => s.rows.some((r) => r.columns.some((c) => c.blocks.length)))) return { error: "Add something to the page before publishing it." };
  }
  const { error } = await supabase.from("sites").update({ status }).eq("id", id).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't change that. Try again." };
  refresh();
  return { ok: status === "live" ? "Published. Your page is live." : status === "draft" ? "Unpublished. The link stops working until you publish again." : "Archived. Its link stops working." };
}

/** A draft copy of a page, opened in Page Studio. */
export async function duplicatePage(id: string) {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) redirect("/funnels?error=access");
  const supabase = await createClient();
  const { data: s } = await supabase.from("sites").select("name, kind, settings").eq("id", id).eq("account_id", ws.account.id).maybeSingle();
  if (!s) redirect("/funnels?error=1");
  const { data: pages } = await supabase.from("site_pages").select("name, slug, position, definition").eq("site_id", id).order("position");
  const name = await freeName(supabase, ws.account.id, `${s.name} (copy)`.slice(0, 110));
  const slug = await freeSlug(supabase, ws.account.id, slugify(name));
  const { data: site, error } = await supabase.from("sites").insert({ account_id: ws.account.id, kind: s.kind, name, slug, status: "draft", settings: s.settings ?? {} }).select("id").single();
  if (error || !site) redirect("/funnels?error=1");
  if (pages?.length) {
    await supabase.from("site_pages").insert(pages.map((p) => ({ account_id: ws.account.id, site_id: site.id, name: p.position === 0 ? name : p.name, slug: p.slug, position: p.position, definition: cleanPage(p.definition) })));
  }
  redirect(`/funnels/${site.id}`);
}

export async function archivePage(id: string, archived: boolean) {
  return setSiteStatus(id, archived ? "archived" : "draft");
}

/** Deletes a page for good. */
export async function deletePage(id: string) {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) redirect("/funnels?error=access");
  const supabase = await createClient();
  await supabase.from("sites").delete().eq("id", id).eq("account_id", ws.account.id);
  redirect("/funnels");
}
