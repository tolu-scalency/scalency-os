import type { Metadata } from "next";
import Link from "next/link";
import { Page, PageHeader, Pill, Tile } from "@/components/ui";
import { can, getWorkspace, timeAgo } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { NewFormButton } from "./new-form";

export const metadata: Metadata = { title: "Forms" };

/** Server-side date maths, kept out of the component body. */
function daysAgoIso(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

const statusLook = { live: { tone: "green", label: "Live" }, draft: { tone: "neutral", label: "Draft" }, archived: { tone: "neutral", label: "Archived" } } as const;

export default async function FormsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [ws, { error }] = await Promise.all([getWorkspace(), searchParams]);
  const supabase = await createClient();
  const { data: forms } = await supabase.from("forms").select("id, name, status, updated_at").eq("account_id", ws.account.id).neq("status", "archived").order("updated_at", { ascending: false });
  const ids = (forms ?? []).map((f) => f.id as string);
  const counts = new Map<string, number>();
  const weekAgo = daysAgoIso(7);
  const recent = new Map<string, number>();
  if (ids.length) {
    const { data: subs } = await supabase.from("form_submissions").select("form_id, started_at").in("form_id", ids).limit(10000);
    for (const s of subs ?? []) {
      counts.set(s.form_id as string, (counts.get(s.form_id as string) ?? 0) + 1);
      if ((s.started_at as string) >= weekAgo) recent.set(s.form_id as string, (recent.get(s.form_id as string) ?? 0) + 1);
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

      {!forms?.length ? (
        canEdit ? (
          <div className="flex flex-col gap-3">
            <p className="text-[14px] text-muted">No forms yet. Pick how you&apos;d like to start, then add it to your website with one line of code.</p>
            <NewFormButton accountId={ws.account.id} big />
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-line-strong bg-white/60 p-8 text-center text-[14px] text-muted">No forms yet.</p>
        )
      ) : (
        <div className="card divide-y divide-line">
          {forms.map((f) => {
            const look = statusLook[f.status as keyof typeof statusLook] ?? statusLook.draft;
            return (
              <Link key={f.id} href={`/forms/${f.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-surface">
                <Tile icon="file" tone={f.status === "live" ? "blue" : "grey"} size={38} />
                <div className="min-w-0 flex-[1_1_220px]">
                  <div className="truncate text-[14.5px] font-semibold">{f.name}</div>
                  <div className="text-[12.5px] text-muted">Edited {timeAgo(f.updated_at as string)}</div>
                </div>
                <div className="text-[12.5px] text-muted">
                  <strong className="text-navy">{recent.get(f.id as string) ?? 0}</strong> this week · {counts.get(f.id as string) ?? 0} total
                </div>
                <Pill tone={look.tone}>{look.label}</Pill>
              </Link>
            );
          })}
        </div>
      )}
    </Page>
  );
}
