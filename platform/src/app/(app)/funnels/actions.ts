"use server";

import { shortId } from "@/lib/short-id-shared";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getWorkspace } from "@/lib/data";
import { blankPage, cleanPage, slugify, type PageDefinition } from "@/lib/page-builder";
import { pageTemplateByKey } from "@/lib/page-templates";
import { cleanSiteSettings, freePageSlug, siteTemplateByKey, type SiteKind } from "@/lib/site-builder";

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
  redirect(`/funnels/${shortId(site.id)}`);
}

type SaveInput = { name: string; slug?: string; pageId: string; definition: unknown; pageName?: string };

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
  // A single page shares its name with the site; funnel steps and website pages have their own.
  const pageName = input.pageName === undefined ? undefined : String(input.pageName).trim().slice(0, 120);
  const { data: site } = await supabase.from("sites").select("kind").eq("id", siteId).eq("account_id", ws.account.id).maybeSingle();
  const patch: Record<string, unknown> = { definition };
  if (site?.kind === "page") patch.name = name;
  else if (pageName) patch.name = pageName;
  const { error: e2 } = await supabase.from("site_pages").update(patch).eq("id", input.pageId).eq("site_id", siteId).eq("account_id", ws.account.id);
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
    if (!def || !def.sections.some((s) => s.rows.some((r) => r.columns.some((c) => c.blocks.length)))) return { error: "Add something to the first page before publishing." };
  }
  const { error } = await supabase.from("sites").update({ status }).eq("id", id).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't change that. Try again." };
  refresh();
  return { ok: status === "live" ? "Published. It's live." : status === "draft" ? "Unpublished. The link stops working until you publish again." : "Archived. Its link stops working." };
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
  redirect(s.kind === "page" ? `/funnels/${shortId(site.id)}` : `/funnels/${shortId(site.id)}/overview`);
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

// ---------------------------------------------------------------------------
// Funnels and websites
// ---------------------------------------------------------------------------

/** Creates a funnel or website from a template and opens its overview. */
export async function createSite(fd: FormData) {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) redirect("/funnels?error=access");
  const kind = String(fd.get("kind") ?? "") as SiteKind;
  if (kind !== "funnel" && kind !== "website") redirect("/funnels?error=1");
  const t = siteTemplateByKey(kind, String(fd.get("template") ?? ""));
  if (!t) redirect("/funnels?error=1");
  const plan = t.build();
  const supabase = await createClient();
  const name = await freeName(supabase, ws.account.id, String(fd.get("name") ?? "").trim().slice(0, 100) || t.name);
  const slug = await freeSlug(supabase, ws.account.id, slugify(name));
  const { data: site, error } = await supabase
    .from("sites")
    .insert({ account_id: ws.account.id, kind, name, slug, status: "draft", settings: plan.settings ? cleanSiteSettings(plan.settings) : {} })
    .select("id")
    .single();
  if (error || !site) redirect("/funnels?error=1");
  const { error: pErr } = await supabase.from("site_pages").insert(
    plan.steps.map((st, i) => ({ account_id: ws.account.id, site_id: site.id, name: st.name, slug: i === 0 ? "" : st.slug, position: i, in_menu: st.in_menu ?? true, definition: cleanPage(st.def) })),
  );
  if (pErr) {
    await supabase.from("sites").delete().eq("id", site.id);
    redirect("/funnels?error=1");
  }
  redirect(`/funnels/${shortId(site.id)}/overview`);
}

async function sitePages(supabase: Db, accountId: string, siteId: string) {
  const { data } = await supabase.from("site_pages").select("id, name, slug, position, in_menu").eq("site_id", siteId).eq("account_id", accountId).order("position");
  return (data ?? []) as { id: string; name: string; slug: string; position: number; in_menu: boolean }[];
}

/** Puts pages in a new order. The first page is always the site's home (no link name). */
async function reorder(supabase: Db, accountId: string, siteId: string, ids: string[]) {
  const pages = await sitePages(supabase, accountId, siteId);
  const byId = new Map(pages.map((p) => [p.id, p]));
  const order = ids.filter((id) => byId.has(id));
  for (const p of pages) if (!order.includes(p.id)) order.push(p.id);
  // Link names: the new first page gets none; the old home gets one from its name.
  const taken = pages.filter((p) => p.slug).map((p) => p.slug);
  const finalSlug = new Map<string, string>();
  order.forEach((id, i) => {
    const p = byId.get(id)!;
    if (i === 0) finalSlug.set(id, "");
    else if (p.slug) finalSlug.set(id, p.slug);
    else {
      const s = freePageSlug(taken, p.name === "Home" ? "home" : p.name);
      taken.push(s);
      finalSlug.set(id, s);
    }
  });
  // Clear link names first so swapping them never clashes.
  for (const [i, id] of order.entries()) {
    await supabase.from("site_pages").update({ slug: `tmp-${i}-${Date.now().toString(36)}`, position: i }).eq("id", id).eq("account_id", accountId);
  }
  for (const id of order) await supabase.from("site_pages").update({ slug: finalSlug.get(id)! }).eq("id", id).eq("account_id", accountId);
}

/** Adds a step to a funnel, or a page to a website. Returns the new page's id. */
export async function addStep(siteId: string, starter: string, name: string): Promise<{ error?: string; id?: string }> {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) return { error: NO_ACCESS };
  const supabase = await createClient();
  const { data: site } = await supabase.from("sites").select("kind").eq("id", siteId).eq("account_id", ws.account.id).maybeSingle();
  if (!site) return { error: "We couldn't find that." };
  const pages = await sitePages(supabase, ws.account.id, siteId);
  if (pages.length >= 30) return { error: "That's the most pages one site can have (30)." };
  const tpl = starter === "blank" ? null : pageTemplateByKey(starter);
  let def: PageDefinition = tpl ? tpl.build() : blankPage();
  if (site.kind === "website") def = { ...def, sections: def.sections.filter((s) => s.name !== "Header" && s.name !== "Footer") };
  const label = String(name ?? "").trim().slice(0, 100) || tpl?.name || "New page";
  const slug = pages.length ? freePageSlug(pages.map((p) => p.slug), label) : "";
  const { data, error } = await supabase
    .from("site_pages")
    .insert({ account_id: ws.account.id, site_id: siteId, name: label, slug, position: pages.length, definition: cleanPage(def) })
    .select("id")
    .single();
  if (error || !data) return { error: "We couldn't add it. Try again." };
  refresh();
  return { id: data.id as string };
}

/** Renames a step or page and changes its link name. */
export async function updateStep(siteId: string, pageId: string, input: { name?: string; slug?: string; in_menu?: boolean }): Promise<{ error?: string; ok?: string }> {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) return { error: NO_ACCESS };
  const supabase = await createClient();
  const pages = await sitePages(supabase, ws.account.id, siteId);
  const page = pages.find((p) => p.id === pageId);
  if (!page) return { error: "We couldn't find that page." };
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const n = String(input.name).trim().slice(0, 120);
    if (!n) return { error: "Give it a name." };
    patch.name = n;
  }
  if (input.slug !== undefined && page.position > 0) {
    const s = String(input.slug).trim().toLowerCase();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) || s.length > 70) return { error: "The link name can only use small letters, numbers and dashes, like thank-you." };
    if (pages.some((p) => p.id !== pageId && p.slug === s)) return { error: "Another page here already uses that link name." };
    patch.slug = s;
  }
  if (input.in_menu !== undefined) patch.in_menu = Boolean(input.in_menu);
  if (!Object.keys(patch).length) return { ok: "Saved" };
  const { error } = await supabase.from("site_pages").update(patch).eq("id", pageId).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't save that. Try again." };
  refresh();
  return { ok: "Saved" };
}

export async function moveStep(siteId: string, pageId: string, by: -1 | 1): Promise<{ error?: string; ok?: string }> {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) return { error: NO_ACCESS };
  const supabase = await createClient();
  const pages = await sitePages(supabase, ws.account.id, siteId);
  const ids = pages.map((p) => p.id);
  const i = ids.indexOf(pageId);
  const j = i + by;
  if (i < 0 || j < 0 || j >= ids.length) return { ok: "Saved" };
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await reorder(supabase, ws.account.id, siteId, ids);
  refresh();
  return { ok: "Moved" };
}

export async function duplicateStep(siteId: string, pageId: string): Promise<{ error?: string; id?: string }> {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) return { error: NO_ACCESS };
  const supabase = await createClient();
  const pages = await sitePages(supabase, ws.account.id, siteId);
  const src = pages.find((p) => p.id === pageId);
  if (!src) return { error: "We couldn't find that page." };
  if (pages.length >= 30) return { error: "That's the most pages one site can have (30)." };
  const { data: full } = await supabase.from("site_pages").select("definition").eq("id", pageId).single();
  const name = `${src.name} (copy)`.slice(0, 120);
  const { data, error } = await supabase
    .from("site_pages")
    .insert({ account_id: ws.account.id, site_id: siteId, name, slug: freePageSlug(pages.map((p) => p.slug), name), position: pages.length, in_menu: false, definition: cleanPage(full?.definition) })
    .select("id")
    .single();
  if (error || !data) return { error: "We couldn't copy it. Try again." };
  // Put the copy straight after the original.
  const ids = pages.map((p) => p.id);
  ids.splice(ids.indexOf(pageId) + 1, 0, data.id as string);
  await reorder(supabase, ws.account.id, siteId, ids);
  refresh();
  return { id: data.id as string };
}

export async function deleteStep(siteId: string, pageId: string): Promise<{ error?: string; ok?: string }> {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) return { error: NO_ACCESS };
  const supabase = await createClient();
  const pages = await sitePages(supabase, ws.account.id, siteId);
  if (pages.length <= 1) return { error: "A site needs at least one page." };
  if (!pages.some((p) => p.id === pageId)) return { error: "We couldn't find that page." };
  await supabase.from("site_pages").delete().eq("id", pageId).eq("account_id", ws.account.id);
  await reorder(supabase, ws.account.id, siteId, pages.filter((p) => p.id !== pageId).map((p) => p.id));
  refresh();
  return { ok: "Deleted" };
}

/** Saves a website's shared header or footer. */
export async function saveSitePart(siteId: string, part: "header" | "footer", definition: unknown): Promise<{ error?: string; ok?: string }> {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) return { error: NO_ACCESS };
  if (part !== "header" && part !== "footer") return { error: "Unknown part." };
  const supabase = await createClient();
  const { data: site } = await supabase.from("sites").select("kind, settings").eq("id", siteId).eq("account_id", ws.account.id).maybeSingle();
  if (!site || site.kind !== "website") return { error: "Only websites have a shared header and footer." };
  const settings = { ...((site.settings as object) ?? {}), ...cleanSiteSettings({ ...cleanSiteSettings(site.settings), [part]: cleanPage(definition).sections }) };
  const { error } = await supabase.from("sites").update({ settings }).eq("id", siteId).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't save it. Try again." };
  return { ok: "Saved" };
}

/** Renames a funnel or website (its overview page). */
export async function renameSite(siteId: string, name: string): Promise<{ error?: string; ok?: string }> {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) return { error: NO_ACCESS };
  const n = String(name ?? "").trim().slice(0, 120);
  if (!n) return { error: "Give it a name." };
  const supabase = await createClient();
  const { error } = await supabase.from("sites").update({ name: n }).eq("id", siteId).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't save that. Try again." };
  refresh();
  return { ok: "Saved" };
}

/** Changes the site's link name (/p/<workspace>/<link name>). */
export async function setSiteSlug(siteId: string, slug: string): Promise<{ error?: string; ok?: string }> {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) return { error: NO_ACCESS };
  const s = String(slug ?? "").trim().toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) || s.length > 70) return { error: "The link name can only use small letters, numbers and dashes, like summer-offer." };
  const supabase = await createClient();
  const { count } = await supabase.from("sites").select("id", { count: "exact", head: true }).eq("account_id", ws.account.id).eq("slug", s).neq("id", siteId);
  if (count) return { error: "Another page already uses that link name. Try a different one." };
  const { error } = await supabase.from("sites").update({ slug: s }).eq("id", siteId).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't save that. Try again." };
  refresh();
  return { ok: "Link saved" };
}
