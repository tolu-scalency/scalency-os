"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { notify } from "@/components/toast";
import { WEEKDAYS, type Override, type Range, type Weekly } from "@/lib/calendar/types";
import { saveAvailability } from "../actions";

const ZONES = ["Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Berlin", "Africa/Lagos", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Toronto", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Australia/Sydney"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function AvailabilityEditor(p: { userId: string; who: string; isMe: boolean; members: { id: string; name: string }[]; timezone: string; weekly: Weekly; overrides: Override[] }) {
  const [tz, setTz] = useState(p.timezone);
  const [weekly, setWeekly] = useState<Weekly>(p.weekly);
  const [overrides, setOverrides] = useState<Override[]>(p.overrides);
  const [newDate, setNewDate] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  const setDay = (d: number, ranges: Range[]) => setWeekly((w) => {
    const next = { ...w };
    if (ranges.length) next[String(d)] = ranges;
    else delete next[String(d)];
    return next;
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="card p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold">{p.isMe ? "Your working hours" : `${p.who}'s working hours`}</h2>
            <p className="mt-0.5 text-[13px] text-muted">People can only book inside these hours.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {p.members.length > 1 && (
              <select value={p.userId} onChange={(e) => router.push(`/calendar/availability?who=${e.target.value}`)} className="field h-10 w-auto text-[13px]" aria-label="Whose hours">
                {p.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
            <select value={tz} onChange={(e) => setTz(e.target.value)} className="field h-10 w-auto text-[13px]" aria-label="Time zone">
              {[...new Set([tz, ...ZONES])].map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
            </select>
          </div>
        </div>
        <div className="divide-y divide-line rounded-xl border border-line">
          {ORDER.map((d) => {
            const ranges = weekly[String(d)] ?? [];
            const on = ranges.length > 0;
            return (
              <div key={d} className="flex flex-wrap items-start gap-4 px-4 py-3.5">
                <label className="flex w-36 items-center gap-3 pt-2">
                  <input type="checkbox" checked={on} onChange={(e) => setDay(d, e.target.checked ? [["09:00", "17:00"]] : [])} className="h-4 w-4 accent-[#0465C7]" />
                  <span className={`text-[14px] font-semibold ${on ? "" : "text-faint"}`}>{WEEKDAYS[d]}</span>
                </label>
                <div className="flex flex-1 flex-col gap-2">
                  {!on && <span className="pt-2 text-[13px] text-faint">Not available</span>}
                  {ranges.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="time" value={r[0]} onChange={(e) => setDay(d, ranges.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))} className="field h-10 w-32" aria-label="From" />
                      <span className="text-muted">to</span>
                      <input type="time" value={r[1]} onChange={(e) => setDay(d, ranges.map((x, j) => (j === i ? [x[0], e.target.value] : x)))} className="field h-10 w-32" aria-label="To" />
                      <button type="button" onClick={() => setDay(d, ranges.filter((_, j) => j !== i))} aria-label="Remove" className="inline-grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-surface"><Icon name="x" size={14} /></button>
                      {i === ranges.length - 1 && ranges.length < 4 && (
                        <button type="button" onClick={() => setDay(d, [...ranges, ["18:00", "20:00"]])} aria-label="Add hours" className="inline-grid h-9 w-9 place-items-center rounded-xl text-brand hover:bg-[#eef6fd]"><Icon name="plus" size={14} /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-5 flex justify-end">
          <button type="button" disabled={pending} onClick={() => start(async () => { const r = await saveAvailability(p.userId, tz, weekly, overrides); notify(r.error ?? r.ok ?? "Saved", r.error ? "bad" : "ok"); })} className="btn-primary inline-flex h-10 items-center gap-1.5 rounded-xl px-5 text-[13.5px] font-semibold">
            <Icon name="check" size={14} /> Save hours
          </button>
        </div>
      </section>

      <aside className="card h-fit p-6">
        <h2 className="text-[16px] font-semibold">Days off and special hours</h2>
        <p className="mt-0.5 text-[13px] text-muted">Holidays, training days, or a day with different hours.</p>
        <div className="mt-4 flex gap-2">
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="field h-10 flex-1" aria-label="Date" />
          <button type="button" disabled={!newDate} onClick={() => { if (newDate && !overrides.some((o) => o.date === newDate)) setOverrides([...overrides, { date: newDate, ranges: [] }].sort((a, b) => a.date.localeCompare(b.date))); setNewDate(""); }} className="btn-ghost inline-flex h-10 items-center rounded-xl px-3 text-[13px] font-semibold">Add</button>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {!overrides.length && <p className="text-[13px] text-faint">None yet.</p>}
          {overrides.map((o, i) => (
            <div key={o.date} className="rounded-xl border border-line p-3">
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-semibold">{new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${o.date}T12:00:00Z`))}</span>
                <button type="button" onClick={() => setOverrides(overrides.filter((_, j) => j !== i))} aria-label="Remove" className="inline-grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface"><Icon name="x" size={13} /></button>
              </div>
              <label className="mt-2 flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={o.ranges.length === 0} onChange={(e) => setOverrides(overrides.map((x, j) => (j === i ? { ...x, ranges: e.target.checked ? [] : [["09:00", "13:00"]] } : x)))} className="h-4 w-4 accent-[#0465C7]" />
                Day off
              </label>
              {o.ranges.map((r, k) => (
                <div key={k} className="mt-2 flex items-center gap-2">
                  <input type="time" value={r[0]} onChange={(e) => setOverrides(overrides.map((x, j) => (j === i ? { ...x, ranges: x.ranges.map((y, m) => (m === k ? [e.target.value, y[1]] : y)) } : x)))} className="field h-9 w-28" aria-label="From" />
                  <span className="text-muted">to</span>
                  <input type="time" value={r[1]} onChange={(e) => setOverrides(overrides.map((x, j) => (j === i ? { ...x, ranges: x.ranges.map((y, m) => (m === k ? [y[0], e.target.value] : y)) } : x)))} className="field h-9 w-28" aria-label="To" />
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12px] text-faint">Click Save hours to keep these.</p>
      </aside>
    </div>
  );
}
