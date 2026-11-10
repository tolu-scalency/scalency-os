import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon, type IconName } from "@/components/icon";
import { Button, Page, Tile, type Tone } from "@/components/ui";
import { Loading } from "@/components/states";
import { TaskList } from "@/components/task-list";
import { formatPence, getDashboard, getWorkspace, timeAgo } from "@/lib/data";

export const metadata: Metadata = { title: "Home" };

export default function HomePage() {
  return (
    <Page>
      <Suspense fallback={<Loading rows={5} />}>
        <Home />
      </Suspense>
    </Page>
  );
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const activityLook: Record<string, { icon: IconName; tone: Tone }> = {
  "contact.created": { icon: "user", tone: "blue" },
  "stage.changed": { icon: "pipeline", tone: "violet" },
  note: { icon: "edit", tone: "orange" },
};

async function Home() {
  const ws = await getWorkspace();
  const d = await getDashboard(ws.account.id);
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" }).format(new Date());

  const steps = [
    { done: d.checklist.pipeline, title: "Set up your pipeline", text: "Pick the stages your deals move through.", href: "/pipeline", icon: "pipeline" as const },
    { done: d.checklist.contact, title: "Add your first contact", text: "Or import them later.", href: "/contacts?new=1", icon: "user" as const },
    { done: d.checklist.team, title: "Invite your team", text: "Work on leads together.", href: "/settings/team", icon: "team" as const },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const maxStage = Math.max(1, ...d.stages.map((s) => s.count));

  const stats = [
    { label: "Contacts", value: String(d.totalContacts), note: d.newContactsThisWeek ? `+${d.newContactsThisWeek} this week` : "None new this week", icon: "users" as const, tone: "blue" as const, href: "/contacts" },
    { label: "Open deals", value: String(d.openOpportunities), note: "In your pipeline", icon: "pipeline" as const, tone: "violet" as const, href: "/pipeline" },
    { label: "Pipeline value", value: formatPence(d.pipelineTotalPence), note: "Across open deals", icon: "pound" as const, tone: "green" as const, href: "/pipeline" },
    { label: "Tasks due", value: String(d.tasksDue), note: d.tasksDue ? "Today or overdue" : "You're all caught up", icon: "tasks" as const, tone: "orange" as const, href: "/tasks" },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[13px] text-muted">{today}</div>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.035em] sm:text-[32px]">
            {greeting()}, <span className="text-gradient">{ws.firstName}</span>
          </h1>
        </div>
        <div className="flex gap-2">
          <Button href="/tasks" icon="tasks">New task</Button>
          <Button href="/contacts?new=1" variant="primary" icon="plus">New contact</Button>
        </div>
      </div>

      {doneCount < steps.length && (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-[16px] font-semibold">Get set up</h2>
              <p className="text-[13px] text-muted">{doneCount} of {steps.length} done</p>
            </div>
            <div className="h-2 w-40 overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#55e3ec,#0a5fe3)] transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </div>
          </div>
          <div className="grid sm:grid-cols-3">
            {steps.map((s) => (
              <Link
                key={s.title}
                href={s.href}
                className={`group flex items-start gap-3 border-line px-5 py-4 transition-colors hover:bg-surface sm:border-l sm:first:border-l-0 ${s.done ? "opacity-60" : ""}`}
              >
                <span className={`mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full ${s.done ? "bg-ok text-white" : "border-2 border-line-strong text-transparent group-hover:border-sky"}`}>
                  <Icon name="check" size={13} strokeWidth={3} />
                </span>
                <span>
                  <span className={`block text-[14px] font-semibold ${s.done ? "line-through" : ""}`}>{s.title}</span>
                  <span className="block text-[13px] text-muted">{s.text}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {stats.map((k) => (
          <Link key={k.label} href={k.href} className="card group flex items-start justify-between gap-3 p-5 transition-shadow hover:shadow-[var(--shadow-pop)]">
            <div>
              <div className="text-[13px] font-medium text-muted">{k.label}</div>
              <div className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.04em]">{k.value}</div>
              <div className="mt-2 text-[12.5px] text-faint">{k.note}</div>
            </div>
            <Tile icon={k.icon} tone={k.tone} size={38} />
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold">Pipeline</h2>
            <Link href="/pipeline" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline">
              Open board <Icon name="arrowRight" size={14} />
            </Link>
          </div>
          {d.stages.length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-xl bg-surface p-5">
              <p className="text-[14px] text-muted">Your pipeline isn&apos;t set up yet.</p>
              <Button href="/pipeline" variant="primary" size="sm" icon="pipeline">Set it up</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {d.stages.map((s) => (
                <div key={s.id} className="grid grid-cols-[minmax(110px,170px)_1fr_32px] items-center gap-3 text-[13.5px]">
                  <span className="truncate">{s.name}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-surface">
                    <div className="h-full rounded-full bg-[linear-gradient(90deg,#0a5fe3,#29b0f8,#55e3ec)]" style={{ width: `${Math.max(s.count ? 6 : 0, (s.count / maxStage) * 100)}%` }} />
                  </div>
                  <span className="text-right font-semibold tabular-nums">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold">Your tasks</h2>
            <Link href="/tasks" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline">
              All tasks <Icon name="arrowRight" size={14} />
            </Link>
          </div>
          {d.myTasks.length === 0 ? (
            <p className="py-6 text-center text-[14px] text-muted">No open tasks. Nice.</p>
          ) : (
            <TaskList tasks={d.myTasks} compact />
          )}
        </section>
      </div>

      <section className="card p-5">
        <h2 className="mb-2 text-[16px] font-semibold">Recent activity</h2>
        {d.activity.length === 0 ? (
          <p className="py-6 text-center text-[14px] text-muted">New contacts, stage moves and notes will show here.</p>
        ) : (
          <ul>
            {d.activity.map((a) => {
              const look = activityLook[a.type] ?? { icon: "activity" as const, tone: "grey" as const };
              return (
                <li key={a.id}>
                  <Link href={a.contactId ? `/contacts/${a.contactId}` : "/dashboard"} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface">
                    <Tile icon={look.icon} tone={look.tone} size={30} />
                    <span className="min-w-0 flex-1 truncate text-[14px]">{a.summary}</span>
                    <span className="whitespace-nowrap text-[12.5px] text-faint">{timeAgo(a.createdAt)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
