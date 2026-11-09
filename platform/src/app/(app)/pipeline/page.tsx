import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Avatar, Button, Pill, Segmented } from "@/components/ui";
import { findContact, pipelineColumns } from "@/lib/sample-data";

export const metadata: Metadata = { title: "Pipeline" };

export default function PipelinePage() {
  return (
    <main className="dots flex min-h-full flex-col gap-[18px] px-7 pb-8 pt-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Lead gen pipeline · 32 open</div>
          <div className="mt-2.5 flex flex-wrap items-baseline gap-3.5">
            <h1 className="text-[30px] font-semibold tracking-[-0.035em]">£30,000</h1>
            <span className="text-sm text-muted">potential monthly value</span>
            <Pill tone="green" mono>+£7.5K THIS WEEK</Pill>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented options={["Board", "List", "Forecast"]} active="Board" />
          <Button icon="filter">Filter</Button>
          <Button variant="primary" icon="plus">New deal</Button>
        </div>
      </div>

      <div className="overflow-x-auto pb-1.5">
        <div className="flex min-w-min items-start gap-3">
          {pipelineColumns.map((col) => (
            <section key={col.name} aria-label={col.name} className="flex min-h-[640px] w-[272px] flex-none flex-col gap-2.5 rounded-[18px] border border-line bg-white/80 p-3 backdrop-blur-sm">
              <span className="h-[3px] rounded-[3px]" style={{ background: col.colour, boxShadow: `0 0 10px ${col.colour}` }} />
              <div className="flex items-center gap-2 px-1 pt-0.5">
                <h2 className="flex-1 text-[13.5px] font-semibold">{col.name}</h2>
                <span className="rounded-md border border-line-strong px-1.5 py-px font-mono text-[11px] text-muted">{col.ids.length}</span>
              </div>
              <div className="px-1 pb-1 font-mono text-[10.5px] tracking-wide text-muted">{col.note}</div>
              {col.ids.map((id, i) => {
                const c = findContact(id)!;
                const hot = c.score >= 60;
                return (
                  <Link
                    key={id}
                    href={`/contacts/${id}`}
                    className={`block rounded-[14px] border bg-white p-[13px] shadow-[0_10px_24px_-16px_rgba(11,36,71,0.35)] ${hot ? "border-sky/60 shadow-[0_0_0_1px_rgba(47,168,235,0.15),0_10px_24px_-12px_rgba(47,168,235,0.5)]" : "border-line-strong"}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar initials={c.initials} tone={c.tone} size={30} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-semibold">{c.name}</div>
                        <div className="truncate text-[11.5px] text-muted">{c.business}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-mono text-[12.5px] font-semibold">{col.values[i]}</span>
                      <span className="font-mono text-[10.5px] text-muted">SCORE <span className="text-brand">{c.score}</span></span>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2.5">
                      <Pill>{c.source}</Pill>
                      <span className="font-mono text-[10.5px] text-muted">{c.lastActive}</span>
                    </div>
                  </Link>
                );
              })}
              <button type="button" className="min-h-[38px] rounded-xl border border-dashed border-line-strong text-[12.5px] text-muted hover:border-brand hover:text-brand">
                <Icon name="plus" size={13} className="mr-1 inline" />Add
              </button>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
