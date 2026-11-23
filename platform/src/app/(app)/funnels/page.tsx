import { shortId } from "@/lib/short-id-shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Page, PageHeader, Pill, Tile } from "@/components/ui";
import { can, getWorkspace, timeAgo } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { formsHealth } from "@/lib/forms-health";
import { NewPageButton } from "./new-page";
import { NewSiteButton } from "./new-site";
import { PageRowMenu } from "./row-menu";

export const metadata: Metadata = { title: "Funnels and pages" };

function daysAgoIso(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

const statusLook = { live: { tone: "green", label: "Live" }, draft: { tone: "neutral", label: "Draft" }, archived: { tone: "neutral", label: "Archived" } } as const;

const KINDS = { page: { label: "Page", icon: "globe" }, funnel: { label: "Funnel", icon: "zap" }, website: { label: "Website", icon: "layout" } } as const;

export default async function FunnelsPage({ searchParams }: { searchParams: Promise<{ error?: string; show?: string; kind?: string }> }) {
  const [ws, { error, show, kind: kindIn }] = await Promise.all([getWorkspace(), searchParams]);
  const archived = show === "archived";
  const kind = kindIn === "page" || kindIn === "funnel" || kindIn === "website" ? kindIn : null;
  const supabase = await createClient();
  let q = supabase.from("sites").select("id, name, slug, kind, status, updated_at, site_pages(count)").eq("account_id", ws.account.id).order("updated_at", { ascending: false });
  if (kind) q = q.eq("kind", kind);
  const [{ data: sites }, { count: archivedCount }, health, { data: stats }, { data: forms }, { data: acc }] = await Promise.all([
    archived ? q.eq("status", "archived") : q.neq("status", "archived"),
    supabase.from("sites").select("id", { count: "exact", head: true }).eq("account_id", ws.account.id).eq("status", "archived"),
    formsHealth(),
    supabase.from("page_stats").select("page_id, views, site_pages(site_id)").eq("account_id", ws.account.id).gte("day", daysAgoIso(30).slice(0, 10)),
    supabase.from("forms").select("id, name").eq("account_id", ws.account.id).eq("status", "live").order("name"),
    supabase.from("accounts").select("slug").eq("id", ws.account.id).single(),
  ]);
  const views = new Map<string, number>();
  for (const r of (stats ?? []) as { views: number; site_pages: { site_id: string } | { site_id: string }[] | null }[]) {
    const sp = Array.isArray(r.site_pages) ? r.site_pages[0] : r.site_pages;
    if (sp?.site_id) views.set(sp.site_id, (views.get(sp.site_id) ?? 0) + (r.views ?? 0));
  }
  const canEdit = can(ws, "sites.manage");
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://os.scalency.us").replace(/\/$/, "");
  const wsSlug = (acc?.slug as string) ?? "";
  const formList = (forms ?? []).map((f) => ({ id: f.id as string, name: f.name as string }));

  return (
    <Page>
      <PageHeader
        title="Funnels and pages"
        subtitle="Landing pages, funnels and websites that turn visitors into leads. Drag and drop, start from a template, or let AI draft a page."
        actions={
          canEdit ? (
            <div className="flex flex-wrap gap-2">
              <NewSiteButton kind="website" />
              <NewSiteButton kind="funnel" />
              {sites?.length || kind ? <NewPageButton accountId={ws.account.id} forms={formList} /> : null}
            </div>
          ) : undefined
        }
      />

      {error && (
        <p className="rounded-xl border border-bad/30 bg-bad-bg px-4 py-3 text-[13.5px] text-bad">
          {error === "access" ? "You don't have access to build pages. Ask the workspace owner." : "We couldn't create the page. Try again."}
        </p>
      )}
      {canEdit && !health.ok && (
        <div className="rounded-xl border border-warn/30 bg-warn-bg px-4 py-3 text-[13.5px] text-warn">
          <strong>{(health.problem ?? "").replace("Form links and embeds", "Page and form links")}</strong>
          {health.fix && <div className="mt-1 text-[13px]">{health.fix}</div>}
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-[13px] font-semibold">
        {(
          [
            ["All", "/funnels", !archived && !kind],
            ["Pages", "/funnels?kind=page", !archived && kind === "page"],
            ["Funnels", "/funnels?kind=funnel", !archived && kind === "funnel"],
            ["Websites", "/funnels?kind=website", !archived && kind === "website"],
            ...(archived || archivedCount ? [[`Archived ${archivedCount ?? 0}`, "/funnels?show=archived", archived] as const] : []),
          ] as const
        ).map(([label, href, on]) => (
          <Link key={href} href={href} className={`rounded-xl px-3 py-1.5 ring-1 ${on ? "bg-navy text-white ring-navy" : "bg-white text-muted ring-line hover:text-navy"}`}>
            {label}
          </Link>
        ))}
      </div>

      {archived && !sites?.length ? (
        <p className="rounded-2xl border border-dashed border-line-strong bg-white/60 p-8 text-center text-[14px] text-muted">Nothing archived.</p>
      ) : !sites?.length && kind ? (
        <p className="rounded-2xl border border-dashed border-line-strong bg-white/60 p-8 text-center text-[14px] text-muted">No {KINDS[kind].label.toLowerCase()}s yet. Use the buttons above to make one.</p>
      ) : !sites?.length ? (
        canEdit ? (
          <div className="flex flex-col gap-3">
            <p className="text-[14px] text-muted">No pages yet. Pick how you&apos;d like to start.</p>
            <NewPageButton accountId={ws.account.id} forms={formList} big />
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-line-strong bg-white/60 p-8 text-center text-[14px] text-muted">No pages yet.</p>
        )
      ) : (
        <div className="card divide-y divide-line">
          {(sites ?? []).map((s) => {
            const look = statusLook[s.status as keyof typeof statusLook] ?? statusLook.draft;
            const href = `${base}/p/${wsSlug}/${s.slug}`;
            const k = KINDS[(s.kind as keyof typeof KINDS) ?? "page"] ?? KINDS.page;
            const count = (s.site_pages as unknown as { count: number }[] | null)?.[0]?.count ?? 1;
            const open = s.kind === "page" ? `/funnels/${shortId(s.id)}` : `/funnels/${shortId(s.id)}/overview`;
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-surface">
                <Link href={open} className="flex min-w-0 flex-[1_1_260px] items-center gap-4">
                  <Tile icon={k.icon} tone={s.status === "live" ? "blue" : "grey"} size={38} />
                  <div className="min-w-0">
                    <div className="truncate text-[14.5px] font-semibold">
                      {s.name}
                      {s.kind !== "page" && (
                        <span className="ml-2 rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-muted">
                          {k.label} · {count} {s.kind === "funnel" ? "steps" : "pages"}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[12.5px] text-muted">
                      {s.status === "live" ? `/p/${wsSlug}/${s.slug}` : "Not published"} · edited {timeAgo(s.updated_at as string)}
                    </div>
                  </div>
                </Link>
                <div className="text-[12px] text-muted" title="Last 30 days">
                  <div className="text-[15px] font-semibold text-navy">{views.get(s.id as string) ?? 0}</div>views
                </div>
                <Pill tone={look.tone}>{look.label}</Pill>
                {canEdit && <PageRowMenu id={s.id as string} archived={s.status === "archived"} live={s.status === "live"} href={href} edit={open} kind={s.kind as string} />}
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
