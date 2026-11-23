import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Page, PageHeader, Pill } from "@/components/ui";
import { getWorkspace, timeAgo } from "@/lib/data";
import { shortId } from "@/lib/short-id-shared";
import { createClient } from "@/lib/supabase/server";
import { AddDomain } from "./add-domain";

export const metadata: Metadata = { title: "Domains" };

const LOOK = {
  verified: { label: "Connected", tone: "green" },
  pending: { label: "Waiting for DNS", tone: "amber" },
  failed: { label: "Not found yet", tone: "red" },
} as const;

/** Every own domain in the workspace, on whichever website, funnel or page it points to. */
export default async function DomainsPage() {
  const ws = await getWorkspace();
  const supabase = await createClient();
  const [{ data: domains }, { data: sites }] = await Promise.all([
    supabase.from("site_domains").select("id, domain, status, hosting, last_error, checked_at, created_at, site_id, sites(name, kind)").eq("account_id", ws.account.id).order("created_at", { ascending: false }),
    supabase.from("sites").select("id, name, kind").eq("account_id", ws.account.id).neq("status", "archived").order("name"),
  ]);
  const rows = (domains ?? []) as unknown as {
    id: string;
    domain: string;
    status: keyof typeof LOOK;
    hosting: string;
    last_error: string | null;
    checked_at: string | null;
    site_id: string;
    sites: { name: string; kind: string } | null;
  }[];

  return (
    <Page>
      <PageHeader eyebrow="Sites" title="Domains" subtitle="Your own web addresses, like www.yourbusiness.co.uk, and what each one shows." />
      <AddDomain sites={(sites ?? []).map((s) => ({ id: s.id as string, name: s.name as string, kind: s.kind as string }))} />
      <section className="card overflow-hidden">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <span className="tile h-12 w-12 rounded-2xl">
              <Icon name="globe" size={20} />
            </span>
            <div className="text-[15px] font-semibold">No domains yet</div>
            <p className="max-w-[420px] text-[13.5px] text-muted">Add one above. You&apos;ll get one record to add where you bought the domain (for example Namecheap), then it connects by itself.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((d) => {
              const look = LOOK[d.status] ?? LOOK.pending;
              return (
                <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <span className="tile h-10 w-10 flex-none rounded-xl">
                    <Icon name="globe" size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-semibold">{d.domain}</div>
                    <div className="truncate text-[12.5px] text-muted">
                      Shows {d.sites?.name ?? "a page"} {d.sites?.kind ? `(${d.sites.kind})` : ""}
                      {d.checked_at ? ` · checked ${timeAgo(d.checked_at).toLowerCase()}` : ""}
                      {d.status !== "verified" && d.last_error ? ` · ${d.last_error}` : ""}
                    </div>
                  </div>
                  <Pill tone={look.tone}>{look.label}</Pill>
                  <Link href={`/funnels/${shortId(d.site_id)}/overview`} className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold">
                    {d.status === "verified" ? "Manage" : "See the DNS record"} <Icon name="arrowRight" size={13} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Page>
  );
}
