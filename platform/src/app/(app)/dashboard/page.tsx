import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Avatar, Button, PageHeader, Pill, SampleNote, Segmented, Sparkline, Tile } from "@/components/ui";
import { activity, findContact, funnel, insights, kpis, todaysCalls } from "@/lib/sample-data";

export const metadata: Metadata = { title: "Dashboard" };

// One smooth curve per series for the main chart (sample data).
const leadsPath =
  "M0 150 C30 146 40 140 50 140 S90 146 100 145 S140 121 150 120 S190 126 200 125 S240 101 250 100 S290 111 300 110 S340 86 350 85 S390 91 400 90 S440 71 450 70 S490 76 500 75 S540 56 550 55 S590 46 600 42";
const bookedPath =
  "M0 186 S40 180 50 180 S90 183 100 182 S140 171 150 170 S190 173 200 172 S240 161 250 160 S290 166 300 165 S340 151 350 150 S390 153 400 152 S440 141 450 140 S490 143 500 142 S540 131 550 130 S590 123 600 120";

export default function DashboardPage() {
  return (
    <main className="relative overflow-hidden px-7 pb-10 pt-7">
      <div className="dots pointer-events-none absolute inset-x-0 top-0 h-[340px] [mask-image:linear-gradient(#000,transparent)]" />
      <div className="pointer-events-none absolute -right-28 top-5 h-80 w-[520px] bg-[radial-gradient(closest-side,rgba(47,168,235,0.14),transparent)]" />

      <div className="relative flex flex-col gap-5">
        <PageHeader
          eyebrow="Sat 07 Nov 2026 · 14:52 GMT"
          title="Good afternoon, Tolu"
          subtitle="3 leads need a call in the next hour. 2 workflows are waiting for your approval."
          actions={
            <>
              <Button href="/reports" icon="chart">Reports</Button>
              <Button href="/workflows/builder" variant="primary" icon="spark">New workflow</Button>
            </>
          }
        />

        {/* AI command bar */}
        <div className="rounded-[19px] bg-[linear-gradient(110deg,rgba(100,231,239,0.8),rgba(47,168,235,0.25)_35%,rgba(140,175,225,0.15)_60%,rgba(4,101,199,0.7))] p-px shadow-[0_0_40px_-12px_rgba(47,168,235,0.5)]">
          <div className="flex flex-col gap-3 rounded-[18px] bg-white px-[18px] py-4">
            <form className="flex items-center gap-3">
              <Tile icon="spark" size={34} />
              <label className="flex-1">
                <span className="sr-only">Ask Scalency AI</span>
                <input
                  type="text"
                  placeholder="Ask Scalency AI to build a workflow, find a lead, or summarise your week…"
                  className="h-10 w-full bg-transparent text-[15px] text-navy outline-none placeholder:text-muted"
                />
              </label>
              <kbd className="rounded-md border border-line-strong px-2 py-0.5 font-mono text-[11px] text-muted">↵ Enter</kbd>
            </form>
            <div className="flex flex-wrap gap-2 pl-[46px]">
              {[
                { href: "/workflows/builder", icon: "zap" as const, text: "Follow up leads who drop off the form" },
                { href: "/contacts", icon: "users" as const, text: "Who booked this week?" },
                { href: "/funnels", icon: "funnel" as const, text: "Build a funnel for solar installers" },
              ].map((s) => (
                <Link key={s.text} href={s.href} className="inline-flex h-[30px] items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs text-muted hover:border-brand hover:text-brand">
                  <Icon name={s.icon} size={14} className="text-brand" />
                  {s.text}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
          {kpis.map((k) => (
            <div key={k.label} className="card flex flex-col gap-3.5 p-[18px]">
              <div className="flex items-center justify-between">
                <Tile icon={k.icon} tone={k.tone} size={38} />
                <Pill tone="green" mono>{k.delta}</Pill>
              </div>
              <div>
                <div className="eyebrow">{k.label}</div>
                <div className="mt-1.5 text-[30px] font-semibold tracking-[-0.04em]">{k.value}</div>
              </div>
              <Sparkline points={k.points} />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3.5">
          {/* Main chart */}
          <section className="card min-w-0 flex-[2_1_520px] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold">Leads and bookings</h2>
                <div className="mt-2 flex gap-4 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-sky" />Leads</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-turquoise" />Calls booked</span>
                </div>
              </div>
              <Segmented options={["7D", "30D", "90D"]} active="30D" mono />
            </div>
            <div className="relative mt-[18px]">
              <svg viewBox="0 0 600 200" preserveAspectRatio="none" className="block h-[230px] w-full" aria-label="Leads and calls booked over the last 30 days, both rising" role="img">
                <defs>
                  <linearGradient id="dash-leads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#2fa8eb" stopOpacity={0.3} />
                    <stop offset="1" stopColor="#2fa8eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <path d="M0 50H600M0 100H600M0 150H600" stroke="#e1e9f3" strokeDasharray="3 5" fill="none" />
                <path d={`${leadsPath} L600 200 L0 200 Z`} fill="url(#dash-leads)" />
                <path d={leadsPath} fill="none" stroke="#0465c7" strokeWidth={2.5} />
                <path d={bookedPath} fill="none" stroke="#64e7ef" strokeWidth={2.5} />
              </svg>
              <div className="mt-2 flex justify-between font-mono text-[10.5px] text-muted">
                <span>08 OCT</span><span>15 OCT</span><span>22 OCT</span><span>29 OCT</span><span>07 NOV</span>
              </div>
            </div>
          </section>

          {/* AI insights */}
          <section className="card relative flex min-w-0 flex-[1_1_320px] flex-col gap-3 overflow-hidden p-5">
            <div className="flex items-center gap-2.5">
              <Tile icon="spark" tone="violet" size={30} />
              <h2 className="text-[15px] font-semibold">AI insights</h2>
              <span className="ml-auto"><Pill mono>LIVE</Pill></span>
            </div>
            {insights.map((i) => (
              <div key={i.title} className="rounded-[14px] border border-line bg-surface p-3.5">
                <div className="text-[13.5px] font-semibold">{i.title}</div>
                <div className="mt-1 text-[12.5px] leading-relaxed text-muted">{i.text}</div>
                {i.action && i.href && (
                  <Button href={i.href} size="sm" iconRight="arrowRight" className="mt-2.5">{i.action}</Button>
                )}
              </div>
            ))}
          </section>
        </div>

        <div className="flex flex-wrap gap-3.5">
          {/* Funnel */}
          <section className="card min-w-0 flex-[1_1_340px] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Conversion funnel</h2>
              <Link href="/pipeline" className="font-mono text-[11px] text-muted hover:text-brand">PIPELINE →</Link>
            </div>
            <div className="flex flex-col gap-3">
              {funnel.map((f) => (
                <div key={f.label}>
                  <div className="mb-1.5 flex justify-between text-[13px]">
                    <span>{f.label}</span>
                    <span className="font-mono"><strong>{f.n}</strong> <span className="text-muted">· {f.pct}%</span></span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand via-sky to-turquoise" style={{ width: `${f.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Today's calls */}
          <section className="card min-w-0 flex-[1_1_320px] p-5">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Today&apos;s calls</h2>
              <Link href="/calendar" className="font-mono text-[11px] text-muted hover:text-brand">CALENDAR →</Link>
            </div>
            {todaysCalls.map((c) => {
              const contact = findContact(c.contactId)!;
              return (
                <Link key={c.time} href={`/contacts/${contact.id}`} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
                  <span className="w-[46px] font-mono text-xs font-semibold">{c.time}</span>
                  <Avatar initials={contact.initials} tone={contact.tone} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold">{contact.name}</div>
                    <div className="text-xs text-muted">{c.detail}</div>
                  </div>
                  <Pill tone={c.tone}>{c.status}</Pill>
                </Link>
              );
            })}
          </section>

          {/* Live activity */}
          <section className="card min-w-0 flex-[1_1_320px] p-5">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Live activity</h2>
              <SampleNote />
            </div>
            {activity.map((a) => (
              <div key={a.text} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
                <Tile icon={a.icon} tone={a.tone} size={30} />
                <div className="min-w-0 flex-1 text-[13px] leading-snug">{a.text}</div>
                <span className="font-mono text-[11px] text-muted">{a.when}</span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
