import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icon";
import { Button, Tile } from "@/components/ui";
import { EmptyState, Loading, NoAccount } from "@/components/states";
import { formatPence, getDashboard, getWorkspace, timeAgo } from "@/lib/data";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <main className="relative overflow-hidden px-7 pb-10 pt-7">
      <div className="dots pointer-events-none absolute inset-x-0 top-0 h-[340px] [mask-image:linear-gradient(#000,transparent)]" />
      <div className="relative flex flex-col gap-5">
        <Suspense fallback={<Loading rows={6} />}>
          <Dashboard />
        </Suspense>
      </div>
    </main>
  );
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

async function Dashboard() {
  const ws = await getWorkspace();
  if (!ws.account) return <NoAccount email={ws.userEmail} />;
  const d = await getDashboard(ws.account.id);
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/London" }).format(new Date());
  const maxStage = Math.max(1, ...d.stages.map((s) => s.count));

  const stats = [
    { label: "New contacts (7 days)", value: String(d.newContactsThisWeek), icon: "users" as const, tone: "blue" as const },
    { label: "Applications (7 days)", value: String(d.applicationsStarted), icon: "form" as const, tone: "pink" as const },
    { label: "Qualified (7 days)", value: String(d.qualified), icon: "checkCircle" as const, tone: "violet" as const },
    { label: "Pipeline value", value: formatPence(d.pipelineTotalPence), icon: "pound" as const, tone: "orange" as const },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">{today} · {ws.account.name}</div>
          <h1 className="mt-2.5 text-[30px] font-semibold leading-tight tracking-[-0.035em]">{greeting()}</h1>
          <p className="mt-1.5 text-sm text-muted">
            {d.totalContacts === 0 ? "No contacts yet. Add one to see the dashboard come to life." : `${d.totalContacts} contacts · ${d.openOpportunities} open in the pipeline.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button href="/contacts" icon="plus">Add contact</Button>
          <Button href="/pipeline" variant="primary" icon="pipeline">Open pipeline</Button>
        </div>
      </div>

      {ws.account.testMode && (
        <div className="flex items-center gap-3 rounded-[14px] border border-[#d99600]/35 bg-warn-bg px-4 py-3 text-[13px] text-warn">
          <Icon name="shield" size={16} />
          Test mode is on. No email or text will reach a real lead until the owner switches it off.
        </div>
      )}

      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
        {stats.map((k) => (
          <div key={k.label} className="card flex flex-col gap-3.5 p-[18px]">
            <Tile icon={k.icon} tone={k.tone} size={38} />
            <div>
              <div className="eyebrow">{k.label}</div>
              <div className="mt-1.5 text-[30px] font-semibold tracking-[-0.04em]">{k.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3.5">
        <section className="card min-w-0 flex-[1_1_420px] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Pipeline by stage</h2>
            <Link href="/pipeline" className="font-mono text-[11px] text-muted hover:text-brand">PIPELINE →</Link>
          </div>
          {d.stages.length === 0 ? (
            <p className="text-[13px] text-muted">No pipeline set up yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {d.stages.map((s) => (
                <div key={s.name}>
                  <div className="mb-1.5 flex justify-between text-[13px]">
                    <span>{s.name}</span>
                    <span className="font-mono font-semibold">{s.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand via-sky to-turquoise" style={{ width: `${(s.count / maxStage) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card min-w-0 flex-[1_1_380px] p-5">
          <h2 className="mb-1 text-[15px] font-semibold">Latest activity</h2>
          {d.activity.length === 0 ? (
            <EmptyState icon="activity" title="Nothing yet">New contacts, stage changes and notes will show here.</EmptyState>
          ) : (
            d.activity.map((a) => (
              <Link key={a.id} href={a.contactId ? `/contacts/${a.contactId}` : "/dashboard"} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0 hover:bg-surface">
                <Tile icon={a.type === "note" ? "edit" : a.type === "stage.changed" ? "pipeline" : "user"} size={30} />
                <div className="min-w-0 flex-1 truncate text-[13px]">{a.summary}</div>
                <span className="font-mono text-[11px] text-muted">{timeAgo(a.createdAt)}</span>
              </Link>
            ))
          )}
        </section>
      </div>
    </>
  );
}
