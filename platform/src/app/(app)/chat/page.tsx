import type { Metadata } from "next";
import { Icon } from "@/components/icon";
import { Avatar, Button } from "@/components/ui";

export const metadata: Metadata = { title: "Team chat" };

const alertChannels = [
  { name: "new-leads", count: 3, on: true },
  { name: "booked-calls", count: 1 },
  { name: "unqualified" },
  { name: "no-shows" },
  { name: "sales-won" },
  { name: "system-errors" },
];

function BotHeader({ source, time }: { source: string; time: string }) {
  return (
    <div className="text-[13px]">
      <strong className="font-semibold">Scalency OS</strong>
      <span className="mx-1.5 rounded-[5px] border border-sky/50 px-1 py-px font-mono text-[9.5px] tracking-wider text-brand">BOT</span>
      <span className="font-mono text-[10.5px] text-muted">{source} · {time}</span>
    </div>
  );
}

function LeadCard({ badge, badgeTone, title, rows, actions }: { badge: string; badgeTone: "amber" | "green"; title: string; rows: [string, string][]; actions: React.ReactNode }) {
  return (
    <div className="max-w-[560px] overflow-hidden rounded-2xl border border-line-strong bg-white shadow-[0_20px_40px_-28px_rgba(11,36,71,0.5)]">
      <div className={`h-[3px] ${badgeTone === "green" ? "bg-gradient-to-r from-[#6ee7b7] to-[#34d399]" : "bg-[image:var(--gradient)]"}`} />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2.5">
          <span className={`rounded-[5px] px-1.5 py-0.5 font-mono text-[10px] ${badgeTone === "green" ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn"}`}>{badge}</span>
          <strong className="text-[15px] font-semibold">{title}</strong>
        </div>
        <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-2 text-[13px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
    </div>
  );
}

function BotAvatar() {
  return (
    <span className="tile h-9 w-9 rounded-[11px]">
      <Icon name="zap" size={15} />
    </span>
  );
}

export default function ChatPage() {
  return (
    <main className="flex min-h-full flex-wrap">
      <aside aria-label="Channels" className="flex min-w-0 flex-[1_1_230px] flex-col gap-0.5 border-r border-line bg-surface px-3 py-[18px]">
        <div className="flex items-center justify-between px-2.5 pb-2.5">
          <span className="eyebrow">Alert channels</span>
          <button type="button" aria-label="New channel" className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-lg border border-line-strong bg-white text-muted">
            <Icon name="plus" size={14} />
          </button>
        </div>
        {alertChannels.map((c) => (
          <div key={c.name} className={`flex min-h-9 items-center gap-2 rounded-[10px] px-2.5 text-[13.5px] ${c.on ? "bg-white font-semibold text-brand shadow-sm ring-1 ring-sky/30" : "text-muted"}`}>
            <Icon name="hash" size={15} />
            {c.name}
            {c.count && <span className="ml-auto rounded-md bg-brand px-1.5 py-px font-mono text-[10.5px] font-semibold text-white">{c.count}</span>}
          </div>
        ))}
        <div className="eyebrow px-2.5 pb-2 pt-[18px]">Team</div>
        {["general", "webinar-clients"].map((n) => (
          <div key={n} className="flex min-h-9 items-center gap-2 rounded-[10px] px-2.5 text-[13.5px] text-muted"><Icon name="hash" size={15} />{n}</div>
        ))}
        <div className="eyebrow px-2.5 pb-2 pt-[18px]">Direct</div>
        {[["G", "George", "violet"], ["D", "David", "green"]].map(([i, n, t]) => (
          <div key={n} className="flex min-h-9 items-center gap-2 rounded-[10px] px-2.5 text-[13.5px] text-muted">
            <Avatar initials={i} tone={t as "violet" | "green"} size={22} />
            {n}
            <span className="ml-auto h-[7px] w-[7px] rounded-full bg-[#34d399]" />
          </div>
        ))}
      </aside>

      <section className="dots flex min-w-0 flex-[3_1_480px] flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-white px-6 py-3.5">
          <div className="min-w-0 flex-[1_1_220px]">
            <div className="flex items-center gap-2">
              <Icon name="hash" size={18} className="text-brand" />
              <h1 className="text-lg font-semibold tracking-[-0.02em]">new-leads</h1>
            </div>
            <div className="mt-1 font-mono text-[10.5px] text-muted">POSTED BY L1–L3 · 3 MEMBERS · PUSH ON</div>
          </div>
          <Button size="sm" icon="bell">All messages</Button>
        </div>

        <div className="flex flex-1 flex-col px-6 py-4">
          <div className="flex items-center gap-3 py-2"><span className="h-px flex-1 bg-line" /><span className="eyebrow">Today</span><span className="h-px flex-1 bg-line" /></div>

          <div className="flex items-start gap-3 py-2.5">
            <BotAvatar />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <BotHeader source="L1" time="14:28" />
              <LeadCard
                badge="STEP 1 ONLY"
                badgeTone="amber"
                title="New application started"
                rows={[["Name", "Chris Placeholder"], ["Phone", "+44 7700 900456"], ["Business", "Boiler fitter"], ["Source", "Meta · Heating B"], ["Next", "Text goes out in 10 min"]]}
                actions={<><Button size="sm" href="/contacts/chris-placeholder" variant="primary">Open contact</Button><Button size="sm">I&apos;ll call them</Button></>}
              />
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-line-strong bg-white px-2.5 py-1 text-xs"><Icon name="check" size={13} className="text-ok" />George claimed this</span>
            </div>
          </div>

          <div className="flex items-start gap-3 py-2.5">
            <Avatar initials="G" tone="violet" size={36} />
            <div><div className="text-[13px]"><strong className="font-semibold">George</strong> <span className="font-mono text-[10.5px] text-muted">14:31</span></div><p className="mt-1 text-sm">Calling Chris now. Will update here.</p></div>
          </div>

          <div className="flex items-start gap-3 py-2.5">
            <BotAvatar />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <BotHeader source="L3" time="15:02" />
              <LeadCard
                badge="QUALIFIED · SCORE 64"
                badgeTone="green"
                title="Not booked yet"
                rows={[["Name", "Priya Sample"], ["Business", "Aesthetic clinic, 3–6 sites"], ["Revenue", "£25–50K / MO"]]}
                actions={<><Button size="sm" href="/contacts/priya-sample" variant="primary">Open contact</Button><Button size="sm">Send booking link</Button></>}
              />
            </div>
          </div>

          <div className="flex items-start gap-3 py-2.5">
            <Avatar initials="TA" size={36} />
            <div>
              <div className="text-[13px]"><strong className="font-semibold">Tolu</strong> <span className="font-mono text-[10.5px] text-muted">15:05</span></div>
              <p className="mt-1 text-sm">Good one. <span className="rounded-[5px] bg-chip px-1 text-brand">@George</span> can you take Priya before 5?</p>
              <div className="mt-2 flex gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-white px-2.5 py-1 text-xs"><Icon name="thumbsUp" size={13} className="text-brand" />2</span>
                <span className="rounded-full border border-line-strong bg-white px-2.5 py-1 text-xs">1 reply</span>
              </div>
            </div>
          </div>
        </div>

        <form className="mx-6 mb-[22px] flex flex-col gap-2 rounded-2xl border border-line-strong bg-white px-3 py-2.5 shadow-[var(--shadow-card)]">
          <label>
            <span className="sr-only">Message #new-leads</span>
            <input type="text" placeholder="Message #new-leads" className="min-h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted" />
          </label>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Attach file" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted"><Icon name="paperclip" size={15} /></button>
            <button type="button" aria-label="Mention someone" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted"><Icon name="at" size={15} /></button>
            <button type="button" aria-label="Ask AI" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand"><Icon name="spark" size={15} /></button>
            <Button size="sm" variant="primary" iconRight="send" className="ml-auto">Send</Button>
          </div>
        </form>
      </section>
    </main>
  );
}
