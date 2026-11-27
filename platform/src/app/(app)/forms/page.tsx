import { shortId } from "@/lib/short-id-shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Page, PageHeader, Pill, Tile } from "@/components/ui";
import { Icon } from "@/components/icon";
import { can, getWorkspace, timeAgo } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { NewFormButton } from "./new-form";
import { FormRowMenu } from "./row-menu";
import { FolderBar } from "./folder-bar";
import { formsHealth } from "@/lib/forms-health";

export const metadata: Metadata = { title: "Forms" };

/** Server-side date maths, kept out of the component body. */
function daysAgoIso(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

const statusLook = { live: { tone: "green", label: "Live" }, draft: { tone: "neutral", label: "Draft" }, archived: { tone: "neutral", label: "Archived" } } as const;

export default async function FormsPage({ searchParams }: { searchParams: Promise<{ error?: string; show?: string; folder?: string }> }) {
  const [ws, { error, show, folder: folderIn }] = await Promise.all([getWorkspace(), searchParams]);
  const archived = show === "archived";
  const folder = typeof folderIn === "string" ? folderIn.slice(0, 60) : null;
  const supabase = await createClient();
  const formsQuery = supabase.from("forms").select("id, name, status, updated_at, folder").eq("account_id", ws.account.id).order("updated_at", { ascending: false });
  const [{ data: all }, { count: archivedCount }, health, { data: stats }] = await Promise.all([
    archived ? formsQuery.eq("status", "archived") : formsQuery.neq("status", "archived"),
    supabase.from("forms").select("id", { count: "exact", head: true }).eq("account_id", ws.account.id).eq("status", "archived"),
    formsHealth(),
    supabase.from("form_stats").select("form_id, views").eq("account_id", ws.account.id).gte("day", daysAgoIso(30).slice(0, 10)),
  ]);
  // Folders, from the forms in them.
  const folderCounts = new Map<string, number>();
  for (const f of all ?? []) if (f.folder) folderCounts.set(f.folder as string, (folderCounts.get(f.folder as string) ?? 0) + 1);
  const folderList = [...folderCounts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }));
  const forms = folder === null || archived ? all : (all ?? []).filter((f) => (f.folder ?? "") === folder);
  const views = new Map<string, number>();
  for (const r of stats ?? []) views.set(r.form_id as string, (views.get(r.form_id as string) ?? 0) + ((r.views as number) ?? 0));
  const ids = (forms ?? []).map((f) => f.id as string);
  const counts = new Map<string, number>();
  const monthAgo = daysAgoIso(30);
  const recent = new Map<string, number>();
  if (ids.length) {
    const { data: subs } = await supabase.from("form_submissions").select("form_id, started_at, status").in("form_id", ids).limit(10000);
    for (const s of subs ?? []) {
      if (s.status === "started") continue;
      counts.set(s.form_id as string, (counts.get(s.form_id as string) ?? 0) + 1);
      if ((s.started_at as string) >= monthAgo) recent.set(s.form_id as string, (recent.get(s.form_id as string) ?? 0) + 1);
    }
  }
  const canEdit = can(ws, "sites.manage");

  return (
    <Page>
      <PageHeader
        title="Forms"
        subtitle="Lead forms for your website. Every submission becomes a contact, gets tagged and can start a workflow."
        actions={canEdit && forms?.length ? <NewFormButton accountId={ws.account.id} /> : undefined}
      />

      {error && (
        <p className="rounded-xl border border-bad/30 bg-bad-bg px-4 py-3 text-[13.5px] text-bad">
          {error === "access" ? "You don't have access to build forms. Ask the workspace owner." : "We couldn't create the form. Try again."}
        </p>
      )}

      {canEdit && !health.ok && (
        <div className="rounded-xl border border-warn/30 bg-warn-bg px-4 py-3 text-[13.5px] text-warn">
          <strong>{health.problem}</strong>
          {health.fix && <div className="mt-1 text-[13px]">{health.fix}</div>}
        </div>
      )}

      {(archived || Boolean(archivedCount)) && (
        <div className="flex gap-2 text-[13px] font-semibold">
          <Link href="/forms" className={`rounded-xl px-3 py-1.5 ring-1 ${!archived ? "bg-navy text-white ring-navy" : "bg-white text-muted ring-line"}`}>
            Forms
          </Link>
          <Link href="/forms?show=archived" className={`rounded-xl px-3 py-1.5 ring-1 ${archived ? "bg-navy text-white ring-navy" : "bg-white text-muted ring-line"}`}>
            Archived {archivedCount ?? 0}
          </Link>
        </div>
      )}

      {!archived && (
        <FolderBar folders={folderList} active={folder} total={all?.length ?? 0} loose={(all ?? []).filter((f) => !f.folder).length} canEdit={canEdit} />
      )}

      {archived && !forms?.length ? (
        <p className="rounded-xl border border-dashed border-line-strong bg-white/60 p-5 text-center text-[14px] text-muted">Nothing archived.</p>
      ) : !forms?.length ? (
        canEdit ? (
          <div className="flex flex-col gap-3">
            <p className="text-[14px] text-muted">No forms yet. Pick how you&apos;d like to start, then add it to your website with one line of code.</p>
            <NewFormButton accountId={ws.account.id} big />
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-line-strong bg-white/60 p-5 text-center text-[14px] text-muted">No forms yet.</p>
        )
      ) : (
        <div className="card divide-y divide-line">
          {forms.map((f) => {
            const look = statusLook[f.status as keyof typeof statusLook] ?? statusLook.draft;
            const v = views.get(f.id as string) ?? 0;
            const sent = recent.get(f.id as string) ?? 0;
            return (
              <div key={f.id} className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-surface">
                <Link href={`/forms/${shortId(f.id)}`} className="flex min-w-0 flex-[1_1_260px] items-center gap-4">
                  <Tile icon="file" tone={f.status === "live" ? "blue" : "grey"} size={38} />
                  <div className="min-w-0">
                    <div className="truncate text-[14.5px] font-semibold">{f.name}</div>
                    <div className="text-[12.5px] text-muted">
                      {f.folder && folder === null ? (
                        <span className="mr-1.5 inline-flex items-center gap-1">
                          <Icon name="folder" size={11} /> {f.folder as string} ·
                        </span>
                      ) : null}
                      Edited {timeAgo(f.updated_at as string)}
                    </div>
                  </div>
                </Link>
                <div className="grid grid-cols-3 gap-5 text-[12px] text-muted" title="Last 30 days">
                  <div>
                    <div className="text-[15px] font-semibold text-navy">{v}</div>views
                  </div>
                  <div>
                    <div className="text-[15px] font-semibold text-navy">{sent}</div>sent
                  </div>
                  <div>
                    <div className="text-[15px] font-semibold text-navy">{v ? `${Math.min(100, Math.round((sent / v) * 100))}%` : "–"}</div>conversion
                  </div>
                </div>
                <span className="hidden text-[12px] text-muted sm:inline">{counts.get(f.id as string) ?? 0} all time</span>
                <Pill tone={look.tone}>{look.label}</Pill>
                {canEdit && <FormRowMenu id={f.id as string} archived={f.status === "archived"} folder={(f.folder as string) ?? ""} folders={folderList.map((x) => x.name)} />}
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
