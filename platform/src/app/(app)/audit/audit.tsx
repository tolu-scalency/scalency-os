"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { notify } from "@/components/toast";

type Inputs = {
  enquiries: number;
  bookNow: number;
  bookAi: number;
  missedCalls: number;
  missedBook: number;
  showNow: number;
  showAi: number;
  convert: number;
  value: number;
  currency: "GBP" | "USD";
};

const START: Inputs = { enquiries: 120, bookNow: 15, bookAi: 25, missedCalls: 10, missedBook: 25, showNow: 70, showAi: 85, convert: 60, value: 300, currency: "GBP" };

export function audit(i: Inputs) {
  const p = (n: number) => Math.max(0, Math.min(100, n)) / 100;
  const missedPerMonth = i.missedCalls * 4.33;
  const nowBooked = i.enquiries * p(i.bookNow);
  const aiBooked = i.enquiries * p(i.bookAi) + missedPerMonth * p(i.missedBook);
  const nowShown = nowBooked * p(i.showNow);
  const aiShown = aiBooked * p(i.showAi);
  const nowRevenue = nowShown * p(i.convert) * i.value;
  const aiRevenue = aiShown * p(i.convert) * i.value;
  return {
    extraBookings: Math.max(0, aiBooked - nowBooked),
    extraShows: Math.max(0, aiShown - nowShown),
    nowRevenue,
    aiRevenue,
    gain: Math.max(0, aiRevenue - nowRevenue),
    parts: {
      speed: i.enquiries * Math.max(0, p(i.bookAi) - p(i.bookNow)) * p(i.showNow) * p(i.convert) * i.value,
      calls: missedPerMonth * p(i.missedBook) * p(i.showNow) * p(i.convert) * i.value,
      shows: aiBooked * Math.max(0, p(i.showAi) - p(i.showNow)) * p(i.convert) * i.value,
    },
  };
}

export function Audit() {
  const [i, setI] = useState<Inputs>(START);
  const [clinic, setClinic] = useState("");
  const r = useMemo(() => audit(i), [i]);
  const money = (n: number) => new Intl.NumberFormat(i.currency === "GBP" ? "en-GB" : "en-US", { style: "currency", currency: i.currency, maximumFractionDigits: 0 }).format(n);
  const num = (k: keyof Inputs, l: string, h: string, suffix = "") => (
    <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-navy">
      {l}
      <span className="relative">
        <input type="number" min={0} value={i[k] as number} onChange={(e) => setI((x) => ({ ...x, [k]: Math.max(0, Number(e.target.value) || 0) }))} className="field h-10 w-full pr-10 font-mono text-[14px]" />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted">{suffix}</span>}
      </span>
      <span className="text-[11.5px] font-normal text-muted">{h}</span>
    </label>
  );
  const summary = `${clinic || "Your clinic"}: free missed-revenue audit
- Extra consultations a month: ${Math.round(r.extraBookings)}
- Extra patients through the door a month: ${Math.round(r.extraShows)}
- Revenue won back a month: ${money(r.gain)} (${money(r.gain * 12)} a year)
  - Replying in under a minute: ${money(r.parts.speed)}
  - Texting back missed calls: ${money(r.parts.calls)}
  - Fewer no-shows: ${money(r.parts.shows)}
Based on ${i.enquiries} enquiries and ${i.missedCalls} missed calls a week, an average treatment of ${money(i.value)}, and the clinic's own booking and show rates.`;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
      <section className="card flex flex-col gap-5 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-navy">
            Clinic name
            <input value={clinic} onChange={(e) => setClinic(e.target.value)} placeholder="Glow Aesthetics" className="field h-10 w-full text-[14px]" />
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-navy">
            Currency
            <select value={i.currency} onChange={(e) => setI((x) => ({ ...x, currency: e.target.value === "USD" ? "USD" : "GBP" }))} className="field h-10 w-full text-[14px]">
              <option value="GBP">£ GBP</option>
              <option value="USD">$ USD</option>
            </select>
          </label>
        </div>
        <div>
          <div className="eyebrow mb-3">Their enquiries today</div>
          <div className="grid gap-4 sm:grid-cols-3">
            {num("enquiries", "Enquiries a month", "Forms, DMs, web chat, calls")}
            {num("bookNow", "Book a consultation now", "Of all enquiries", "%")}
            {num("showNow", "Turn up now", "Of those booked", "%")}
            {num("missedCalls", "Missed calls a week", "Unanswered, no callback")}
            {num("convert", "Go ahead with treatment", "After the consultation", "%")}
            {num("value", "Average treatment value", "First treatment only")}
          </div>
        </div>
        <div>
          <div className="eyebrow mb-3">With the AI system</div>
          <div className="grid gap-4 sm:grid-cols-3">
            {num("bookAi", "Book a consultation", "Every enquiry answered within a minute, followed up for 16 days", "%")}
            {num("missedBook", "Missed calls that book", "Texted back straight away", "%")}
            {num("showAi", "Turn up", "With reminders and deposits", "%")}
          </div>
          <p className="mt-3 text-[11.5px] text-muted">These are your assumptions: change them to match what you&apos;re comfortable promising. The results update as you type.</p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="card overflow-hidden">
          <div className="bg-[linear-gradient(135deg,#0a3fa6_0%,#0a5fe3_70%,#29b0f8_130%)] p-6 text-white">
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/70">Revenue won back each month</div>
            <div className="mt-2 font-mono text-[44px] font-semibold leading-none tracking-tight">{money(r.gain)}</div>
            <div className="mt-2 text-[13px] text-white/80">{money(r.gain * 12)} a year</div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-line border-b border-line">
            <div className="p-4">
              <div className="font-mono text-[22px] font-semibold text-navy">+{Math.round(r.extraBookings)}</div>
              <div className="text-[12px] text-muted">consultations a month</div>
            </div>
            <div className="p-4">
              <div className="font-mono text-[22px] font-semibold text-navy">+{Math.round(r.extraShows)}</div>
              <div className="text-[12px] text-muted">patients through the door</div>
            </div>
          </div>
          <div className="flex flex-col gap-3 p-5">
            {(
              [
                ["Replying in under a minute", r.parts.speed],
                ["Texting back missed calls", r.parts.calls],
                ["Fewer no-shows", r.parts.shows],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <div className="mb-1 flex justify-between text-[13px]">
                  <span className="text-navy">{k}</span>
                  <span className="font-mono font-semibold">{money(v)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#29b0f8,#0a5fe3)]" style={{ width: `${r.gain ? Math.max(2, (v / r.gain) * 100) : 0}%` }} />
                </div>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t border-line pt-3 text-[12.5px] text-muted">
              <span>Today: {money(r.nowRevenue)} a month</span>
              <span>With AI: {money(r.aiRevenue)}</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(summary).then(() => notify("Copied. Paste it into your follow-up email.", "ok"), () => notify("Couldn't copy.", "bad"))}
          className="btn-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-semibold"
        >
          <Icon name="copy" size={15} /> Copy the audit for an email
        </button>
      </section>
    </div>
  );
}
