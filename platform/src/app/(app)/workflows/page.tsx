import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";
import { Page, PageHeader, Pill, Tile, type Tone } from "@/components/ui";
import { getPipeline, getWorkspace, listWorkflows, timeAgo } from "@/lib/data";
import { createWorkflow } from "./actions";
import { triggerLabel } from "./labels";

export const metadata: Metadata = { title: "Workflows" };

const templates: { key: string; title: string; text: string; icon: IconName; tone: Tone }[] = [
  { key: "speed", title: "Speed to lead", text: "Text and email new leads within minutes, alert the team, add a call task.", icon: "zap", tone: "blue" },
  { key: "alert", title: "New lead alert", text: "Post every new lead in team chat.", icon: "hash", tone: "orange" },
  { key: "noshow", title: "No-show follow-up", text: "Rebook people who missed their call.", icon: "calendar", tone: "violet" },
  { key: "blank", title: "Start from scratch", text: "Pick a trigger and add your own steps.", icon: "plus", tone: "grey" },
];

const statusTone = { active: "green", draft: "neutral", paused: "amber", archived: "neutral" } as const;

export default async function WorkflowsPage() {
  const ws = await getWorkspace();
  const [workflows, pipeline] = await Promise.all([listWorkflows(ws.account.id), getPipeline(ws.account.id)]);
  const stages = pipeline?.stages ?? [];

  return (
    <Page>
      <PageHeader title="Workflows" subtitle="Follow-ups that run themselves. Every step is logged." />

      {ws.account.testMode && (
        <p className="flex items-center gap-2 rounded-xl border border-sky/30 bg-chip px-4 py-3 text-[13.5px] text-navy">
          <Icon name="shield" size={16} className="text-brand" />
          Test mode is on, so emails and texts go to your own test inbox, not to leads. Change it in Settings.
        </p>
      )}

      <section>
        <h2 className="mb-3 text-[15px] font-semibold">Start a new workflow</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map((t) => (
            <form key={t.key} action={createWorkflow}>
              <input type="hidden" name="template" value={t.key} />
              <button type="submit" className="card group flex h-full w-full flex-col items-start gap-3 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-sky/60 hover:shadow-[var(--shadow-pop)]">
                <Tile icon={t.icon} tone={t.tone} size={38} />
                <span className="text-[14.5px] font-semibold">{t.title}</span>
                <span className="text-[13px] text-muted">{t.text}</span>
              </button>
            </form>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-semibold">Your workflows</h2>
        {workflows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong bg-white/60 p-8 text-center text-[14px] text-muted">No workflows yet. Pick a template above.</p>
        ) : (
          <div className="card divide-y divide-line">
            {workflows.map((w) => (
              <Link key={w.id} href={`/workflows/${w.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-surface">
                <Tile icon="zap" tone={w.status === "active" ? "blue" : "grey"} size={38} />
                <div className="min-w-0 flex-[1_1_220px]">
                  <div className="truncate text-[14.5px] font-semibold">{w.name}</div>
                  <div className="truncate text-[12.5px] text-muted">
                    {triggerLabel(w.trigger, stages)} · {w.steps.length} step{w.steps.length === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="text-[12.5px] text-muted">
                  <strong className="text-navy">{w.activeCount}</strong> running · {w.totalCount} total
                </div>
                <Pill tone={statusTone[w.status]}>
                  <span className="capitalize">{w.status === "active" ? "On" : w.status}</span>
                </Pill>
                <span className="hidden text-[12px] text-faint sm:block">{timeAgo(w.updatedAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </Page>
  );
}
