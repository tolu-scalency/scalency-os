"use client";

import { useState, useTransition } from "react";
import { ask } from "@/components/confirm";
import { Icon } from "@/components/icon";
import { notify } from "@/components/toast";
import { callSetter } from "@/lib/call-setter";
import { deleteAudit, saveAudit } from "./actions";

export type Report = {
  headline: string;
  summary: string;
  scores: { area: string; score: number; note: string }[];
  findings: { area: string; issue: string; fix: string; monthly: number; effort: "low" | "medium" | "high" }[];
  roadmap: { phase: string; items: string[] }[];
  monthlyTotal: number;
};
export type SavedAudit = { id: string; business_name: string; website: string | null; report: Report; monthly_total: number; created_at: string };

const QUESTIONS: { key: string; label: string; placeholder: string; wide?: boolean }[] = [
  { key: "business", label: "Business name", placeholder: "Glow Aesthetics" },
  { key: "website", label: "Website", placeholder: "https://www.glowaesthetics.co.uk" },
  { key: "niche", label: "What they do", placeholder: "Aesthetic clinic, 2 practitioners, Cardiff" },
  { key: "monthly_enquiries", label: "Enquiries a month", placeholder: "120" },
  { key: "average_value", label: "Average treatment or job value (£)", placeholder: "300" },
  { key: "reply_time", label: "How fast they reply now", placeholder: "Within a few hours, never at weekends" },
  { key: "missed_calls", label: "Missed calls a week", placeholder: "10" },
  { key: "no_shows", label: "No-show rate", placeholder: "About 1 in 5" },
  { key: "reviews", label: "Google reviews", placeholder: "4.8 stars, 60 reviews, they don't ask for them" },
  { key: "tools", label: "Tools they use", placeholder: "Pabau, Instagram, a booking page, Meta ads at £1,500 a month", wide: true },
  { key: "goals", label: "What they want", placeholder: "Fill weekday afternoons, more lip and skin booster clients", wide: true },
];

const money = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
const tone = (n: number) => (n >= 75 ? "#059669" : n >= 50 ? "#0465C7" : n >= 30 ? "#b45309" : "#b42318");

export function AiAudit({ accountId, saved }: { accountId: string; saved: SavedAudit[] }) {
  const [a, setA] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [business, setBusiness] = useState("");
  const [pending, start] = useTransition();

  const run = async () => {
    setBusy(true);
    const r = await callSetter({ action: "opportunity_audit", account_id: accountId, answers: a });
    setBusy(false);
    if ("error" in r && r.error) return void notify(String(r.error), "bad");
    setReport(r.report as Report);
    setBusiness(a.business || "This business");
  };
  const save = () =>
    start(async () => {
      if (!report) return;
      const r = await saveAudit({ business, website: a.website ?? "", answers: a, report, monthly: report.monthlyTotal });
      notify(r.error ?? "Saved to your audits", r.error ? "bad" : "ok");
    });

  return (
    <div className="flex flex-col gap-5">
      {!report && (
        <section className="card flex flex-col gap-5 p-5 sm:p-6">
          <div>
            <div className="eyebrow mb-1">Intake</div>
            <h2 className="text-[17px] font-semibold">Tell the AI about the business</h2>
            <p className="text-[13px] text-muted">It reads their website too, then writes a report with £ estimates and a 90-day roadmap. Takes about a minute.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {QUESTIONS.map((q) => (
              <label key={q.key} className={`flex flex-col gap-1.5 text-[12.5px] font-semibold text-navy ${q.wide ? "sm:col-span-2 lg:col-span-3" : ""}`}>
                {q.label}
                <input value={a[q.key] ?? ""} onChange={(e) => setA({ ...a, [q.key]: e.target.value })} placeholder={q.placeholder} className="field h-10 w-full text-[13.5px]" />
              </label>
            ))}
          </div>
          <button type="button" disabled={busy || !a.business} onClick={run} className="btn-primary inline-flex min-h-11 w-fit items-center gap-2 rounded-xl px-5 text-[14px] font-semibold disabled:opacity-50">
            <Icon name="spark" size={15} /> {busy ? "Reading their website and writing the audit…" : "Write the audit"}
          </button>
        </section>
      )}

      {report && (
        <article className="audit-print flex flex-col gap-5">
          <section className="overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#0a3fa6,#0a5fe3_60%,#29b0f8)] p-6 text-white shadow-[0_30px_60px_-30px_rgba(10,63,166,0.7)] sm:p-8">
            <div className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-white/75">AI opportunity audit · {business}</div>
            <h2 className="mt-3 max-w-[820px] text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">{report.headline}</h2>
            <p className="mt-3 max-w-[820px] text-[15px] leading-relaxed text-white/85">{report.summary}</p>
            <div className="mt-6 flex flex-wrap items-end gap-6">
              <div>
                <div className="font-mono text-[44px] font-semibold leading-none">{money(report.monthlyTotal)}</div>
                <div className="mt-1 text-[13px] text-white/75">a month on the table · {money(report.monthlyTotal * 12)} a year</div>
              </div>
              <div className="ml-auto flex gap-2 print:hidden">
                <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-4 text-[13px] font-semibold text-brand">
                  <Icon name="download" size={14} /> Save as PDF
                </button>
                <button type="button" disabled={pending} onClick={save} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white/15 px-4 text-[13px] font-semibold text-white ring-1 ring-white/25">
                  <Icon name="check" size={14} /> Save
                </button>
                <button type="button" onClick={() => setReport(null)} className="inline-flex min-h-10 items-center rounded-xl px-3 text-[13px] font-semibold text-white/85 hover:text-white">
                  New audit
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {report.scores.map((s) => (
              <div key={s.area} className="card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold">{s.area}</span>
                  <span className="font-mono text-[18px] font-semibold" style={{ color: tone(s.score) }}>
                    {s.score}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
                  <div className="h-full rounded-full" style={{ width: `${s.score}%`, background: tone(s.score) }} />
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-muted">{s.note}</p>
              </div>
            ))}
          </section>

          <section className="card overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <h3 className="text-[16px] font-semibold">What to fix, biggest money first</h3>
            </div>
            <ul className="divide-y divide-line">
              {report.findings.map((f, i) => (
                <li key={i} className="grid gap-3 px-5 py-4 md:grid-cols-[180px_1fr_120px]">
                  <div>
                    <div className="text-[13.5px] font-semibold text-navy">{f.area}</div>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${f.effort === "low" ? "bg-ok-bg text-ok" : f.effort === "medium" ? "bg-chip text-brand" : "bg-warn-bg text-warn"}`}>{f.effort} effort</span>
                  </div>
                  <div className="text-[13.5px] leading-relaxed">
                    <div className="text-navy">{f.issue}</div>
                    <div className="mt-1 text-muted">
                      <strong className="text-brand">Fix:</strong> {f.fix}
                    </div>
                  </div>
                  <div className="text-right font-mono text-[18px] font-semibold text-navy">
                    {money(f.monthly)}
                    <div className="text-[11px] font-normal text-muted">a month</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="grid gap-3 md:grid-cols-3">
            {report.roadmap.map((r, i) => (
              <div key={r.phase} className="card p-5">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#55e3ec,#0a5fe3)] font-mono text-[13px] font-semibold text-white">{i + 1}</span>
                  <span className="text-[14.5px] font-semibold">{r.phase}</span>
                </div>
                <ul className="mt-3 flex flex-col gap-2">
                  {r.items.map((x) => (
                    <li key={x} className="flex gap-2 text-[13px] leading-relaxed">
                      <Icon name="check" size={13} /> {x}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </article>
      )}

      {saved.length > 0 && !report && (
        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-3 text-[14px] font-semibold">Saved audits</div>
          <ul className="divide-y divide-line">
            {saved.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold">{s.business_name}</span>
                  <span className="block text-[12px] text-muted">
                    {s.website || "No website"} · {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(s.created_at))}
                  </span>
                </span>
                <span className="font-mono text-[14px] font-semibold text-navy">{money(Number(s.monthly_total))}/mo</span>
                <button
                  type="button"
                  onClick={() => {
                    setReport(s.report);
                    setBusiness(s.business_name);
                  }}
                  className="text-[12.5px] font-semibold text-brand hover:underline"
                >
                  Open
                </button>
                <button type="button" onClick={async () => (await ask({ title: "Delete this audit?", text: "This can't be undone." })) && start(async () => void (await deleteAudit(s.id)))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-bad-bg hover:text-bad" aria-label="Delete">
                  <Icon name="trash" size={13} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
