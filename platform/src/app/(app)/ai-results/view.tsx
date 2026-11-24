import Link from "next/link";
import { Icon } from "@/components/icon";
import { Page } from "@/components/ui";
import { Capacity } from "./capacity";

export type Th = {
  id: string;
  account_id: string;
  origin: string | null;
  channel: string;
  state: string;
  created_at: string;
  first_reply_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  booked_at: string | null;
  appointment_status: string | null;
  guardrail_flags: number | null;
  lead_score: number | null;
  qa_score?: number | null;
};


function pct(n: number, d: number) {
  return d ? Math.round((n / d) * 100) : 0;
}
function quantile(xs: number[], q: number) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))];
}
function secs(s: number | null) {
  if (s == null) return "–";
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}
function ago(iso: string, now: number) {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

/** A tiny line chart, drawn server-side. */
function Spark({ values, w = 260, h = 70, light = false }: { values: number[]; w?: number; h?: number; light?: boolean }) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => [i * step, h - 6 - (v / max) * (h - 14)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const id = light ? "spk-l" : "spk-d";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={light ? "#1a86ee" : "#ffffff"} stopOpacity="0.35" />
          <stop offset="1" stopColor={light ? "#1a86ee" : "#ffffff"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={light ? "#1a86ee" : "#9fe7ff"} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export type Handoff = { id: string; thread_id?: string; priority: string; status: string; created_at: string; claimed_at: string | null; category: string };
export type FeedRow = { id: string; role: string; body: string; channel: string | null; created_at: string; setter_threads: { contact_name: string | null } | null };

/** The dashboard itself, kept separate from the data loading so it can be previewed. */
export type Guarantee = { clinic: string; target: number; days: number; start: string; booked: number };

export function Results({ days, all, clinics, many, name, now, threads, handoffs, feedRows, guarantees = [], setterId = "" }: { days: number; all: boolean; clinics: number; many: boolean; name: string; now: number; threads: Th[]; handoffs: Handoff[]; feedRows: FeedRow[]; guarantees?: Guarantee[]; setterId?: string }) {
  const th = threads;
  const leads = th.filter((t) => (t.origin ?? "lead") === "lead");
  const contacted = th.filter((t) => t.last_outbound_at);
  const replied = th.filter((t) => t.last_inbound_at);
  const booked = th.filter((t) => t.booked_at);
  const showed = th.filter((t) => t.appointment_status === "showed").length;
  const noshow = th.filter((t) => t.appointment_status === "noshow").length;
  const reactivated = th.filter((t) => t.origin === "reactivation");
  const speeds = leads.filter((t) => t.first_reply_at).map((t) => (new Date(t.first_reply_at!).getTime() - new Date(t.created_at).getTime()) / 1000).filter((s) => s >= 0);
  const median = quantile(speeds, 0.5);
  const p90 = quantile(speeds, 0.9);
  const waiting = handoffs.filter((h) => h.status !== "done").length;
  const pickups = handoffs.filter((h) => h.claimed_at).map((h) => (new Date(h.claimed_at as string).getTime() - new Date(h.created_at as string).getTime()) / 1000);
  const guardrails = th.reduce((n, t) => n + (t.guardrail_flags ?? 0), 0);

  // Bookings per day, for the chart.
  const buckets = Math.min(days, 30);
  const perDay = Array.from({ length: buckets }, () => 0);
  for (const t of booked) {
    const d = Math.floor((now - new Date(t.booked_at!).getTime()) / 86_400_000);
    if (d >= buckets) continue;
    perDay[buckets - 1 - Math.min(buckets - 1, Math.max(0, d))]++;
  }
  const leadsPerDay = Array.from({ length: buckets }, () => 0);
  for (const t of leads) {
    const d = Math.floor((now - new Date(t.created_at).getTime()) / 86_400_000);
    if (d < buckets) leadsPerDay[buckets - 1 - Math.max(0, d)]++;
  }
  const channels = Object.entries(contacted.reduce<Record<string, number>>((m, t) => ((m[t.channel] = (m[t.channel] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
  const CHANNEL: Record<string, [string, string]> = { SMS: ["Text messages", "phone"], Email: ["Email", "mail"], WhatsApp: ["WhatsApp", "inbox"], IG: ["Instagram DMs", "inbox"], FB: ["Messenger", "inbox"], Live_Chat: ["Web chat", "inbox"] };

  const feed = feedRows.map((f) => {
    const who = f.setter_threads?.contact_name || "A lead";
    const b = f.body;
    const kind = f.role === "ai" ? "reply" : /booked|moved to/i.test(b) ? "booked" : /guardrail|urgent|complication/i.test(b) ? "guard" : /handed over|stepped back/i.test(b) ? "handoff" : /showed/i.test(b) ? "booked" : "event";
    return { id: f.id, who, body: b, at: f.created_at, kind, channel: f.channel };
  });
  const FEED = {
    reply: { tag: "AI REPLY", label: "Replied", chip: "text-white bg-white/15" },
    booked: { tag: "BOOKING", label: "Booked", chip: "text-[#bff7d6] bg-white/15" },
    handoff: { tag: "SETTER", label: "Handoff", chip: "text-[#ffe7a8] bg-white/15" },
    guard: { tag: "GUARDRAIL", label: "Safety", chip: "text-[#ffd6d6] bg-white/15" },
    event: { tag: "AI", label: "Update", chip: "text-white/85 bg-white/10" },
  } as const;

  const link = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ days: String(days), ...(all ? { scope: "all" } : {}), ...patch });
    if (patch.scope === "") p.delete("scope");
    return `/ai-results?${p.toString()}`;
  };
  const handoffThreads = new Set(handoffs.map((h) => h.thread_id).filter(Boolean));
  const qaScores = th.map((t) => t.qa_score).filter((x): x is number => typeof x === "number");
  const kpis: [string, string, string][] = [
    ["New leads", String(leads.length), `${reactivated.length} old leads reactivated`],
    ["Replied", `${pct(replied.length, contacted.length)}%`, `${replied.length} of ${contacted.length} messaged`],
    ["Booked", String(booked.length), `${pct(booked.length, contacted.length)}% of everyone messaged`],
    ["Showed up", showed + noshow ? `${pct(showed, showed + noshow)}%` : "–", showed + noshow ? `${showed} showed · ${noshow} no-shows` : "Add the appointment status webhook"],
    ["Handoffs", String(handoffs.length), `${waiting} waiting · pickup ${secs(quantile(pickups, 0.5))}`],
    ["Safety catches", String(guardrails), "Guardrail interventions"],
    ["Contact rate", `${pct(contacted.length, leads.length + reactivated.length)}%`, "Leads the AI reached"],
    ["Cancellation rate", booked.length ? `${pct(th.filter((t) => t.appointment_status === "cancelled").length, booked.length)}%` : "–", "Of bookings"],
    ["AI containment", booked.length ? `${pct(booked.filter((t) => !handoffThreads.has(t.id)).length, booked.length)}%` : "–", "Booked with no person needed"],
    ["Handoff response", secs(quantile(pickups, 0.5)), "Median time to pick up"],
    ["No-show rate", showed + noshow ? `${pct(noshow, showed + noshow)}%` : "–", `${noshow} no-shows`],
    ["Conversation quality", qaScores.length ? `${Math.round(qaScores.reduce((a, b) => a + b, 0) / qaScores.length)}` : "–", qaScores.length ? `${qaScores.length} graded (QA)` : "Grade them in QA"],
  ];

  return (
    <Page wide>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-navy px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#55e3ec]" /> Live
          </div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em]">AI results</h1>
          <p className="mt-1 text-[14px] text-muted">{all ? `All ${clinics} clinics` : name} · last {days} days</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {many && (
            <div className="flex gap-1 rounded-xl bg-surface p-1">
              <Link href={link({ scope: "" })} className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${!all ? "bg-white text-navy shadow-sm" : "text-muted"}`}>
                This clinic
              </Link>
              <Link href={link({ scope: "all" })} className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${all ? "bg-white text-navy shadow-sm" : "text-muted"}`}>
                All clinics
              </Link>
            </div>
          )}
          <div className="flex gap-1 rounded-xl bg-surface p-1">
            {["7", "30", "90"].map((d) => (
              <Link key={d} href={link({ days: d })} className={`rounded-lg px-3 py-1.5 font-mono text-[12.5px] font-semibold ${String(days) === d ? "bg-white text-navy shadow-sm" : "text-muted"}`}>
                {d}d
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* The command centre */}
      <section className="relative overflow-hidden rounded-[22px] sidebar-blue text-white shadow-[0_30px_70px_-30px_rgba(10,63,166,0.55)] ring-1 ring-white/10">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.6)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="relative grid gap-px bg-white/5 lg:grid-cols-[280px_1fr_320px]">
          <div className="flex flex-col gap-4 bg-white/[0.04] p-5">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/75">Your AI front desk</div>
            {(channels.length ? channels : [["SMS", 0] as [string, number]]).slice(0, 5).map(([c, n]) => (
              <div key={c} className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/10">
                  <Icon name={(CHANNEL[c]?.[1] ?? "inbox") as never} size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold">{CHANNEL[c]?.[0] ?? c}</div>
                  <div className="text-[11.5px] text-white/75">Leads messaged</div>
                </div>
                <div className="font-mono text-[18px] font-semibold">{n}</div>
              </div>
            ))}
            <div className="mt-auto rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
              <div className="text-[11.5px] text-white/75">Leads per day</div>
              <div className="mt-1 h-14">
                <Spark values={leadsPerDay} />
              </div>
            </div>
          </div>

          <div className="flex min-h-[360px] flex-col gap-2.5 bg-white/[0.02] p-5">
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/75">Live feed</div>
              <Link href="/inbox?view=ai" className="text-[12px] font-semibold text-white hover:underline">
                Open conversations
              </Link>
            </div>
            {feed.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-center text-[13px] text-white/75">As the AI talks to leads, every reply, booking and handoff appears here.</div>
            ) : (
              feed.slice(0, 7).map((f, n) => {
                const look = FEED[f.kind as keyof typeof FEED];
                return (
                  <div key={f.id} className={`flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3.5 py-2.5 ring-1 ring-white/[0.07] ${n === 0 ? "ring-white/30" : ""}`} style={{ opacity: 1 - n * 0.08 }}>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[10px] font-semibold tracking-[0.14em] text-white/65">{look.tag}</div>
                      <div className="truncate text-[13.5px] font-semibold">
                        {f.kind === "reply" ? `Replied to ${f.who}` : f.body.length > 70 ? `${f.body.slice(0, 70)}…` : f.body}
                      </div>
                      <div className="truncate text-[11.5px] text-white/75">{f.kind === "reply" ? f.body.slice(0, 90) : f.who}</div>
                    </div>
                    <span className={`flex-none rounded-full px-2 py-0.5 font-mono text-[10.5px] font-semibold ${look.chip}`}>{ago(f.at, now)}</span>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex flex-col gap-4 bg-white/[0.04] p-5">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/75">Consultations booked</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-[40px] font-semibold leading-none tracking-tight">{booked.length}</span>
                <span className="text-[12px] text-[#bff7d6]">{pct(booked.length, contacted.length)}% booking rate</span>
              </div>
              <div className="mt-3 h-20">
                <Spark values={perDay} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["First reply", secs(median)],
                  ["90% within", secs(p90)],
                  ["Waiting", String(waiting)],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-white/[0.05] px-2.5 py-2 ring-1 ring-white/10">
                  <div className="text-[10.5px] text-white/75">{k}</div>
                  <div className="font-mono text-[17px] font-semibold">{v}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
                <span className="text-white/80">Show rate</span>
                <span className="font-mono font-semibold">{showed + noshow ? `${pct(showed, showed + noshow)}%` : "–"}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#9fe7ff,#ffffff)]" style={{ width: `${showed + noshow ? pct(showed, showed + noshow) : 0}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {guarantees.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {guarantees.map((g) => {
            const start = new Date(`${g.start}T00:00:00Z`).getTime();
            const end = start + g.days * 86_400_000;
            const left = Math.max(0, Math.ceil((end - now) / 86_400_000));
            const elapsed = Math.min(1, Math.max(0, (now - start) / (end - start)));
            const done = Math.min(1, g.booked / g.target);
            const onTrack = done >= elapsed;
            return (
              <div key={g.clinic} className="card flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="eyebrow mb-1">Guarantee{many ? ` · ${g.clinic}` : ""}</div>
                    <div className="text-[15px] font-semibold">
                      {g.target} consultations in {g.days} days
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${g.booked >= g.target ? "bg-ok-bg text-ok" : onTrack ? "bg-chip text-brand" : "bg-warn-bg text-warn"}`}>
                    {g.booked >= g.target ? "Met" : onTrack ? "On track" : "Behind"}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[30px] font-semibold tracking-tight text-navy">{g.booked}</span>
                  <span className="text-[13px] text-muted">of {g.target} booked · {left} days left</span>
                </div>
                <div className="relative h-2.5 overflow-hidden rounded-full bg-surface">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#29b0f8,#0a5fe3)]" style={{ width: `${done * 100}%` }} />
                  <div className="absolute top-0 h-full w-0.5 bg-navy/40" style={{ left: `${elapsed * 100}%` }} title="Where it should be by today" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {setterId && !all && <Capacity setterId={setterId} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map(([k, v, s]) => (
          <div key={k} className="card p-4">
            <div className="text-[12px] font-medium text-muted">{k}</div>
            <div className="mt-1 font-mono text-[26px] font-semibold tracking-tight text-navy">{v}</div>
            <div className="mt-0.5 text-[11.5px] text-muted">{s}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="card p-5">
          <div className="text-[14px] font-semibold">Where leads drop off</div>
          <div className="mt-4 flex flex-col gap-3">
            {(
              [
                ["New leads", leads.length + reactivated.length],
                ["Messaged by the AI", contacted.length],
                ["Replied", replied.length],
                ["Booked", booked.length],
                ["Showed up", showed],
              ] as const
            ).map(([k, v], n, arr) => (
              <div key={k}>
                <div className="mb-1 flex justify-between text-[12.5px]">
                  <span className="text-navy">{k}</span>
                  <span className="font-mono font-semibold">
                    {v}
                    {n > 0 && arr[0][1] ? <span className="ml-2 text-muted">{pct(v, arr[0][1])}%</span> : null}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#1a86ee,#0a5fe3)]" style={{ width: `${arr[0][1] ? Math.max(2, pct(v, arr[0][1])) : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="card flex flex-col p-5">
          <div className="flex items-center justify-between">
            <div className="text-[14px] font-semibold">Setter console</div>
            <Link href="/setter-console" className="text-[12.5px] font-semibold text-brand hover:underline">
              Open the queue
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {(
              [
                ["Urgent", handoffs.filter((h) => h.priority === "urgent").length, "text-bad"],
                ["Call now", handoffs.filter((h) => h.priority === "high").length, "text-warn"],
                ["Today", handoffs.filter((h) => h.priority === "medium").length, "text-brand"],
              ] as const
            ).map(([k, v, c]) => (
              <div key={k} className="rounded-xl bg-surface p-3">
                <div className={`font-mono text-[22px] font-semibold ${c}`}>{v}</div>
                <div className="text-[11.5px] text-muted">{k}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12.5px] text-muted">
            Median time to pick up a handoff: <strong className="font-mono text-navy">{secs(quantile(pickups, 0.5))}</strong>. Target: under 5 minutes in opening hours.
          </p>
        </section>
      </div>
    </Page>
  );
}
