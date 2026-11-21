import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { can, getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { apexOf, netlifyReady, recordsFor } from "@/lib/domains";
import type { SiteKind, SitePageInfo } from "@/lib/site-builder";
import { SiteOverview, type DomainView, type StepStats } from "./site-overview";

export const metadata: Metadata = { title: "Overview" };

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

// A funnel's steps or a website's pages, with views and sign-ups for each,
// the shared header and footer, the link and the site's own domains.
export default async function OverviewRoute({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, ws] = await Promise.all([params, getWorkspace()]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const since = daysAgo(30);
  const [{ data: site }, { data: rows }, { data: stats }, { data: domains }, { data: acc }] = await Promise.all([
    supabase.from("sites").select("id, name, slug, status, kind, updated_at").eq("id", id).eq("account_id", ws.account.id).maybeSingle(),
    supabase.from("site_pages").select("id, name, slug, position, in_menu").eq("site_id", id).eq("account_id", ws.account.id).order("position"),
    supabase.from("page_stats").select("page_id, views, submissions, site_pages!inner(site_id)").eq("account_id", ws.account.id).eq("site_pages.site_id", id).gte("day", since),
    supabase.from("site_domains").select("id, domain, token, status, hosting, last_error, checked_at").eq("site_id", id).eq("account_id", ws.account.id).order("created_at"),
    supabase.from("accounts").select("slug").eq("id", ws.account.id).single(),
  ]);
  if (!site) notFound();
  const per: Record<string, StepStats> = {};
  for (const r of (stats ?? []) as { page_id: string; views: number; submissions: number }[]) {
    const s = (per[r.page_id] ??= { views: 0, submissions: 0 });
    s.views += r.views ?? 0;
    s.submissions += r.submissions ?? 0;
  }
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://os.scalency.us").replace(/\/$/, "");
  const doms: DomainView[] = (domains ?? []).map((d) => ({
    id: d.id as string,
    domain: d.domain as string,
    status: d.status as DomainView["status"],
    hosting: d.hosting as DomainView["hosting"],
    lastError: (d.last_error as string | null) ?? null,
    checkedAt: (d.checked_at as string | null) ?? null,
    records: recordsFor(d.domain as string, d.token as string),
    apex: apexOf(d.domain as string),
  }));
  return (
    <SiteOverview
      site={{ id: site.id as string, name: site.name as string, slug: site.slug as string, status: site.status as "draft" | "live" | "archived", kind: site.kind as SiteKind }}
      pages={(rows ?? []) as SitePageInfo[]}
      stats={per}
      domains={doms}
      base={base}
      workspaceSlug={(acc?.slug as string) ?? ""}
      canEdit={can(ws, "sites.manage")}
      netlify={netlifyReady()}
    />
  );
}
