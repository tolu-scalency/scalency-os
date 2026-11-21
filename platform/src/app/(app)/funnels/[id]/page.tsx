import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { can, getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { cleanPage } from "@/lib/page-builder";
import { cleanSiteSettings, type SiteKind, type SitePageInfo } from "@/lib/site-builder";
import { PageStudio } from "./studio/page-studio";

export const metadata: Metadata = { title: "Page Studio" };

// Page Studio for one page of a site:
//   /funnels/<site>                    a single page (funnels and websites go to their overview)
//   /funnels/<site>?page=<page id>     a funnel step or website page
//   /funnels/<site>?part=header|footer a website's shared header or footer
export default async function PageStudioRoute({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string; part?: string }> }) {
  const [{ id }, sp, ws] = await Promise.all([params, searchParams, getWorkspace()]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: site }, { data: rows }, { data: forms }, { data: acc }] = await Promise.all([
    supabase.from("sites").select("id, name, slug, status, kind, settings").eq("id", id).eq("account_id", ws.account.id).maybeSingle(),
    supabase.from("site_pages").select("id, name, slug, position, in_menu").eq("site_id", id).eq("account_id", ws.account.id).order("position"),
    supabase.from("forms").select("id, name").eq("account_id", ws.account.id).eq("status", "live").order("name"),
    supabase.from("accounts").select("slug").eq("id", ws.account.id).single(),
  ]);
  const pages = (rows ?? []) as SitePageInfo[];
  if (!site || !pages.length) notFound();
  const kind = site.kind as SiteKind;
  const part = kind === "website" && (sp.part === "header" || sp.part === "footer") ? sp.part : null;
  if (kind !== "page" && !part && !sp.page) redirect(`/funnels/${id}/overview`);
  const page = part ? pages[0] : (pages.find((p) => p.id === sp.page) ?? pages[0]);
  const { data: full } = await supabase.from("site_pages").select("definition").eq("id", page.id).single();
  const pageDef = cleanPage(full?.definition);
  const parts = kind === "website" ? cleanSiteSettings(site.settings) : { header: [], footer: [] };
  // A shared part is edited like a page, in the home page's style.
  const definition = part ? { ...pageDef, sections: parts[part] } : pageDef;
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://os.scalency.us").replace(/\/$/, "");
  return (
    <PageStudio
      key={`${page.id}-${part ?? ""}`}
      site={{
        id: site.id,
        name: site.name,
        slug: site.slug,
        status: site.status,
        kind,
        pageId: page.id,
        pageName: page.name,
        pageSlug: page.slug,
        part,
        pages,
        parts,
        definition,
      }}
      base={base}
      workspaceSlug={(acc?.slug as string) ?? ""}
      forms={(forms ?? []).map((f) => ({ id: f.id as string, name: f.name as string }))}
      canEdit={can(ws, "sites.manage")}
    />
  );
}
