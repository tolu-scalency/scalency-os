import { shortId } from "@/lib/short-id-shared";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icon";
import { Button, Page, Tile, type Tone } from "@/components/ui";
import { TaskList } from "@/components/task-list";
import { can, formatPence, getDashboard, getDashboardExtras, getWorkspace, listPipelines, timeAgo } from "@/lib/data";
import { cleanLayout, DEFAULT_LAYOUT, type Widget } from "@/lib/dashboard";
import { createClient } from "@/lib/supabase/server";
import { AiToday } from "./ai-today";
import { DashboardGrid } from "./dashboard-grid";

export const metadata: Metadata = { title: "Home" };

export default function HomePage() {
  return (
    <Page>
      <Home />
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
  const supabase = await createClient();
  const [{ data: acc }, pipelines] = await Promise.all([supabase.from("accounts").select("dashboard").eq("id", ws.account.id).maybeSingle(), listPipelines(ws.account.id)]);
  const saved = cleanLayout(acc?.dashboard);
  const layout: Widget[] = saved ?? DEFAULT_LAYOUT.map((w) => (w.type === "pipeline" && pipelines[0] ? { ...w, settings: { pipelineId: pipelines[0].id } } : w));
  const types = new Set<string>(layout.map((w) => w.type));
  const pipelineIds = layout.filter((w) => w.type === "pipeline").map((w) => w.settings?.pipelineId ?? pipelines[0]?.id).filter(Boolean) as string[];

  const [d, x] = await Promise.all([getDashboard(ws.account.id), getDashboardExtras(ws.account.id, types, pipelineIds)]);
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" }).format(new Date());

  function stat(label: string, value: string, note: string, icon: IconName, tone: Tone, href: string) {
    return (
      <Link href={href} className="card group flex flex-col-reverse items-start justify-between gap-3 p-4 transition-shadow hover:shadow-[var(--shadow-pop)] sm:flex-row sm:p-5">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-muted">{label}</div>
          <div className="mt-2 truncate text-[24px] font-semibold leading-none tracking-[-0.04em] sm:text-[30px]">{value}</div>
          <div className="mt-2 text-[12.5px] text-faint">{note}</div>
        </div>
        <Tile icon={icon} tone={tone} size={38} />
      </Link>
    );
  }

  function card(title: string, link: { href: string; label: string } | null, body: ReactNode) {
    return (
      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[16px] font-semibold">{title}</h2>
          {link && (
            <Link href={link.href} className="inline-flex items-center gap-1 whitespace-nowrap text-[13px] font-medium text-brand hover:underline">
              {link.label} <Icon name="arrowRight" size={14} />
            </Link>
          )}
        </div>
        {body}
      </section>
    );
  }

  function bars(rows: { label: string; value: number; note?: string }[], empty: string) {
    if (!rows.length) return <p className="py-6 text-center text-[14px] text-muted">{empty}</p>;
    const max = Math.max(1, ...rows.map((r) => r.value));
    return (
      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[minmax(90px,160px)_1fr_auto] items-center gap-3 text-[13.5px]">
            <span className="truncate">{r.label}</span>
            <div className="h-2 overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#0a5fe3,#29b0f8,#55e3ec)]" style={{ width: `${Math.max(r.value ? 6 : 0, (r.value / max) * 100)}%` }} />
            </div>
            <span className="text-right font-semibold tabular-nums">{r.note ?? r.value}</span>
          </div>
        ))}
      </div>
    );
  }

  const steps = [
    { done: d.checklist.pipeline, title: "Set up your workspace with AI", text: "Tell us how you work. We'll suggest your pipeline, fields and workflows.", href: "/ai-builder" },
    { done: d.checklist.contact, title: "Add your first contact", text: "Or import them later.", href: "/contacts?new=1" },
    { done: d.checklist.team, title: "Invite your team", text: "Work on leads together.", href: "/settings/team" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  function render(w: Widget): ReactNode {
    switch (w.type) {
      case "setup":
        if (doneCount === steps.length) return null;
        return (
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
                <Link key={s.title} href={s.href} className={`group flex items-start gap-3 border-line px-5 py-4 transition-colors hover:bg-surface sm:border-l sm:first:border-l-0 ${s.done ? "opacity-60" : ""}`}>
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
        );
      case "stat_contacts":
        return stat("Contacts", String(d.totalContacts), d.newContactsThisWeek ? `+${d.newContactsThisWeek} this week` : "None new this week", "users", "blue", "/contacts");
      case "stat_new_contacts":
        return stat("New leads", String(d.newContactsThisWeek), "Last 7 days", "user", "blue", "/contacts");
      case "stat_open_deals":
        return stat("Open deals", String(d.openOpportunities), "In your pipeline", "pipeline", "violet", "/pipeline");
      case "stat_pipeline_value":
        return stat("Pipeline value", formatPence(d.pipelineTotalPence), "Across open deals", "pound", "green", "/pipeline");
      case "stat_won_month":
        return stat("Won this month", formatPence(x.wonMonth.valuePence), `${x.wonMonth.count} deal${x.wonMonth.count === 1 ? "" : "s"}`, "star", "green", "/pipeline?view=list&status=won");
      case "stat_win_rate":
        return stat("Win rate", x.winRate ? `${x.winRate.rate}%` : "–", x.winRate ? `${x.winRate.won} won of ${x.winRate.closed} closed, 90 days` : "No closed deals yet", "chart", "violet", "/pipeline?view=list");
      case "stat_tasks_due":
        return stat("Tasks due", String(d.tasksDue), d.tasksDue ? "Today or overdue" : "You're all caught up", "tasks", "orange", "/tasks");
      case "pipeline": {
        const id = w.settings?.pipelineId ?? pipelines[0]?.id;
        const board = id ? x.boards[id] : null;
        const name = pipelines.find((p) => p.id === id)?.name ?? "Pipeline";
        if (!board || !board.columns.length)
          return card("Pipeline", null, (
            <div className="flex flex-col items-start gap-3 rounded-xl bg-surface p-5">
              <p className="text-[14px] text-muted">Your pipeline isn&apos;t set up yet.</p>
              <Button href="/pipeline" variant="primary" size="sm" icon="pipeline">Set it up</Button>
            </div>
          ));
        return card(name, { href: `/pipeline?p=${id}`, label: "Open board" },
          bars(board.columns.map((c) => ({ label: c.name, value: c.cards.length })), "No stages yet."),
        );
      }
      case "tasks":
        return card("Your tasks", { href: "/tasks", label: "All tasks" }, d.myTasks.length === 0 ? <p className="py-6 text-center text-[14px] text-muted">No open tasks. Nice.</p> : <TaskList tasks={d.myTasks} compact />);
      case "leads_chart": {
        const days = x.leadsPerDay.slice(-14);
        const max = Math.max(1, ...days.map((r) => r.count));
        const total = days.reduce((n, r) => n + r.count, 0);
        return card("New leads, last 14 days", { href: "/contacts", label: `${total} total` },
          <div className="flex h-40 items-end gap-1.5">
            {days.map((r) => (
              <div key={r.day} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${r.day}: ${r.count}`}>
                <span className="text-[10.5px] font-semibold tabular-nums text-muted opacity-0 transition-opacity group-hover:opacity-100">{r.count}</span>
                <div className="w-full rounded-t-md bg-[linear-gradient(180deg,#29b0f8,#0a5fe3)]" style={{ height: `${Math.max(r.count ? 6 : 2, (r.count / max) * 100)}%`, opacity: r.count ? 1 : 0.25 }} />
                <span className="text-[10px] text-faint">{Number(r.day.slice(8))}</span>
              </div>
            ))}
          </div>,
        );
      }
      case "leads_by_source":
        return card("Leads by source, 30 days", { href: "/contacts", label: "Contacts" }, bars(x.leadsBySource.slice(0, 7).map((r) => ({ label: r.source, value: r.count })), "No new leads in the last 30 days."));
      case "deals_by_owner":
        return card("Open deals by owner", { href: "/pipeline?view=list", label: "Deal list" }, bars(x.owners.slice(0, 8).map((o) => ({ label: o.name, value: o.valuePence || o.count, note: `${o.count} · ${formatPence(o.valuePence)}` })), "No open deals."));
      case "activity":
        return card("Recent activity", null, d.activity.length === 0 ? (
          <p className="py-6 text-center text-[14px] text-muted">New contacts, stage moves and notes will show here.</p>
        ) : (
          <ul className="-mt-2">
            {d.activity.map((a) => {
              const look = activityLook[a.type] ?? { icon: "activity" as const, tone: "grey" as const };
              return (
                <li key={a.id}>
                  <Link href={a.contactId ? `/contacts/${shortId(a.contactId)}` : "/dashboard"} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface">
                    <Tile icon={look.icon} tone={look.tone} size={30} />
                    <span className="min-w-0 flex-1 truncate text-[14px]">{a.summary}</span>
                    <span className="whitespace-nowrap text-[12.5px] text-faint">{timeAgo(a.createdAt)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ));
      case "shortcuts":
        return (
          <section className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#0a3fa6,#0a5fe3_60%,#29b0f8)] p-5 text-white shadow-[var(--shadow-card)] sm:p-6">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[radial-gradient(closest-side,rgba(85,227,236,0.45),transparent)]" />
            <h2 className="relative text-[16px] font-semibold">Shortcuts</h2>
            <div className="relative mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { href: "/agents", icon: "spark" as const, title: "AI setter", text: "Replies and books in under a minute" },
                { href: "/ai/knowledge", icon: "book" as const, title: "Knowledge", text: "What the AI is allowed to say" },
                { href: "/inbox", icon: "inbox" as const, title: "Inbox", text: "Every conversation in one place" },
                { href: "/workflows", icon: "zap" as const, title: "Workflows", text: "Texts and emails on autopilot" },
              ].map((f) => (
                <Link key={f.href} href={f.href} className="flex items-center gap-3 rounded-xl bg-white/10 p-3 ring-1 ring-white/15 transition-colors hover:bg-white/15">
                  <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-white text-brand"><Icon name={f.icon} size={17} /></span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold">{f.title}</span>
                    <span className="block truncate text-[12px] text-white/75">{f.text}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      default:
        return undefined; // the note is drawn in the browser
    }
  }

  const nodes: Record<string, ReactNode> = {};
  for (const w of layout) {
    const n = render(w);
    if (n !== undefined) nodes[w.id] = n;
  }

  return (
    <DashboardGrid
      layout={layout}
      isDefault={!saved}
      nodes={nodes}
      canEdit={can(ws, "settings.manage")}
      pipelines={pipelines.map((p) => ({ id: p.id, name: p.name }))}
      header={
        <>
          <div>
            <div className="text-[13px] text-muted">{today}</div>
            <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.035em] sm:text-[32px]">
              {greeting()}, <span className="text-gradient">{ws.firstName}</span>
            </h1>
          </div>
          <div className="ml-auto flex gap-2">
            <Button href="/tasks" icon="tasks">New task</Button>
            {can(ws, "contacts.edit") && <Button href="/contacts?new=1" variant="primary" icon="plus">New contact</Button>}
          </div>
          {can(ws, "ai.manage") && <AiToday accountId={ws.account.id} />}
        </>
      }
    />
  );
}
