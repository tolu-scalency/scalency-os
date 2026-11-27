import type { Metadata } from "next";
import { Page, PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Usage" };

function monthStart(offset = 0) {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - offset, 1));
}

/** What the AI has done per clinic this month: messages sent, conversations, test messages and
 *  voice minutes (once voice is live). The numbers behind usage-based pricing. */
export default async function UsagePage() {
  const ws = await getWorkspace();
  const supabase = await createClient();
  const start = monthStart().toISOString();
  const last = monthStart(1).toISOString();
  const rows = await Promise.all(
    [{ id: ws.account.id, name: ws.account.name }].map(async (w) => {
      const c = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0);
      const turns = () => supabase.from("setter_turns").select("id", { count: "exact", head: true }).eq("account_id", w.id);
      const [ai, aiLast, tests, threads, calls] = await Promise.all([
        c(turns().eq("role", "ai").eq("is_test", false).gte("created_at", start)),
        c(turns().eq("role", "ai").eq("is_test", false).gte("created_at", last).lt("created_at", start)),
        c(turns().eq("is_test", true).gte("created_at", start)),
        c(supabase.from("setter_threads").select("id", { count: "exact", head: true }).eq("account_id", w.id).gte("updated_at", start)),
        supabase.from("setter_calls").select("duration_seconds").eq("account_id", w.id).gte("created_at", start).limit(5000).then((r) => (r.data ?? []) as { duration_seconds: number | null }[]),
      ]);
      const minutes = Math.round(calls.reduce((n, x) => n + (x.duration_seconds ?? 0), 0) / 60);
      return { id: w.id, name: w.name, ai, aiLast, tests, threads, calls: calls.length, minutes };
    }),
  );
  const total = rows.reduce((t, r) => ({ ai: t.ai + r.ai, tests: t.tests + r.tests, threads: t.threads + r.threads, minutes: t.minutes + r.minutes }), { ai: 0, tests: 0, threads: 0, minutes: 0 });
  const month = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date());
  const max = Math.max(1, ...rows.map((r) => r.ai));
  return (
    <Page>
      <PageHeader eyebrow="AI" title="Usage" subtitle={`What the AI has done for ${ws.account.name} in ${month}.`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            ["AI messages sent", total.ai],
            ["Conversations", total.threads],
            ["Test chat messages", total.tests],
            ["Voice minutes", total.minutes],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="card p-5">
            <div className="text-[12px] font-medium text-muted">{k}</div>
            <div className="mt-1.5 font-mono text-[22px] font-semibold tracking-tight text-navy">{v}</div>
            {k === "Voice minutes" && <div className="text-[11.5px] text-muted">AI calls made and answered</div>}
          </div>
        ))}
      </div>
      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[16px] font-semibold">This workspace</h2>
          <p className="text-[12.5px] text-muted">Test chat messages are free and limited to 300 a day. Last month shown for comparison.</p>
        </div>
        <div className="divide-y divide-line">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="min-w-[180px] flex-1">
                <div className="text-[14px] font-semibold text-navy">{r.name}</div>
                <div className="text-[12px] text-muted">
                  {r.threads} conversations · {r.calls} calls ({r.minutes} min) · {r.tests} test messages
                </div>
              </div>
              <div className="flex min-w-[240px] flex-[2] items-center gap-3">
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#29b0f8,#0a5fe3)]" style={{ width: `${(r.ai / max) * 100}%` }} />
                </div>
                <div className="w-[120px] text-right">
                  <div className="font-mono text-[16px] font-semibold text-navy">{r.ai}</div>
                  <div className="text-[11px] text-muted">last month {r.aiLast}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </Page>
  );
}
