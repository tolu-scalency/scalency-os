import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Button, PageHeader, Pill, Segmented, Tile } from "@/components/ui";
import { workflows } from "@/lib/sample-data";

export const metadata: Metadata = { title: "Workflows" };

export default function WorkflowsPage() {
  return (
    <main className="flex flex-col gap-5 px-7 pb-10 pt-7">
      <PageHeader
        eyebrow="Automation · 7 workflows · 0 live"
        title="Workflows"
        subtitle="Every path a lead can take, automated. Switches unlock once Tolu approves."
        actions={
          <>
            <Button href="/workflows/builder" icon="plus">Blank</Button>
            <Button href="/workflows/builder" variant="primary" icon="spark">Build with AI</Button>
          </>
        }
      />

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        {[
          { label: "Runs today", value: "142", cls: "" },
          { label: "Messages sent (test)", value: "58", cls: "" },
          { label: "Step success rate", value: "99.3%", cls: "text-ok" },
          { label: "Waiting approval", value: "2", cls: "text-warn" },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className="eyebrow">{s.label}</div>
            <div className={`mt-1.5 text-2xl font-semibold tracking-[-0.03em] ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented options={["All 7", "Live 0", "Testing 2", "Draft 5"]} active="All 7" />
        <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-muted">
          <Icon name="lock" size={13} /> LOCKED UNTIL CLIENT-APPROVED
        </span>
      </div>

      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(330px,1fr))]">
        {workflows.map((w) => (
          <Link key={w.code} href="/workflows/builder" className="card flex flex-col gap-4 p-5 hover:border-sky">
            <div className="flex items-start gap-3.5">
              <Tile icon={w.icon} tone={w.tone} size={42} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-muted">{w.code}</span>
                  <strong className="text-[15px] font-semibold tracking-[-0.01em]">{w.name}</strong>
                </div>
                <div className="mt-1 text-[12.5px] leading-snug text-muted">{w.trigger}</div>
              </div>
              <span className="relative h-[22px] w-[38px] flex-none rounded-full border border-line-strong bg-surface" aria-label="Off, locked until approved" role="img">
                <span className="absolute left-[3px] top-[3px] h-3.5 w-3.5 rounded-full bg-muted/50" />
              </span>
            </div>
            <div className="flex items-center gap-1" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="h-[22px] w-[22px] rounded-[7px] border border-line-strong bg-surface" />
                  {i < 4 && <span className="h-px w-2.5 bg-line-strong" />}
                </span>
              ))}
              <span className="ml-1.5 font-mono text-[10.5px] text-muted">{w.steps} STEPS</span>
            </div>
            <div className="flex items-center justify-between border-t border-line pt-3.5">
              <Pill tone={w.status === "Testing" ? "blue" : w.status === "Live" ? "green" : "neutral"}>{w.status}</Pill>
              <span className="font-mono text-[10.5px] text-muted">{w.inNow} IN · {w.done} DONE</span>
            </div>
          </Link>
        ))}
      </div>

      <section>
        <div className="eyebrow mb-3">Start from a template</div>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
          {[
            { icon: "calendar" as const, tone: "violet" as const, title: "Webinar reminders", text: "24h, 1h and live-now texts" },
            { icon: "pound" as const, tone: "green" as const, title: "New client won", text: "Welcome email and onboarding link" },
            { icon: "refresh" as const, tone: "orange" as const, title: "Reactivate old leads", text: "90-day quiet leads, gentle nudge" },
          ].map((t) => (
            <div key={t.title} className="flex items-center gap-3 rounded-[14px] border border-line bg-surface p-3.5">
              <Tile icon={t.icon} tone={t.tone} size={34} />
              <div>
                <div className="text-[13.5px] font-semibold">{t.title}</div>
                <div className="text-xs text-muted">{t.text}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
