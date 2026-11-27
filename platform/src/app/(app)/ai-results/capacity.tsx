"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { callSetter } from "@/lib/call-setter";

type Cap = { full: number; free: number; total: number; advice: string; days: { date: string; free: number; total: number }[] };

/** How full the diary is for the next 14 days (from GHL), and what to do about it. */
export function Capacity({ setterId }: { setterId: string }) {
  const [cap, setCap] = useState<Cap | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    callSetter({ agent_id: setterId, action: "capacity" }).then((r) => {
      if (!live) return;
      if ("error" in r && r.error) setError(String(r.error));
      else setCap(r as unknown as Cap);
    });
    return () => {
      live = false;
    };
  }, [setterId]);
  if (error) return null;
  const day = (d: string) => new Intl.DateTimeFormat("en-GB", { weekday: "narrow" }).format(new Date(`${d}T12:00:00Z`));
  return (
    <section className="card flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
      <div className="flex items-center gap-4 lg:w-[300px]">
        <div className="relative h-20 w-20 flex-none">
          <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-surface)" strokeWidth="4" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="url(#capg)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${((cap?.full ?? 0) / 100) * 97.4} 97.4`} />
            <defs>
              <linearGradient id="capg" x1="0" x2="1">
                <stop offset="0" stopColor="#29b0f8" />
                <stop offset="1" stopColor="#0a5fe3" />
              </linearGradient>
            </defs>
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-mono text-[18px] font-semibold text-navy">{cap ? `${cap.full}%` : "…"}</span>
        </div>
        <div>
          <div className="eyebrow mb-1">Diary, next 14 days</div>
          <div className="text-[15px] font-semibold">{cap ? `${cap.total - cap.free} of ${cap.total} slots taken` : "Reading the calendar…"}</div>
        </div>
      </div>
      {cap && (
        <>
          <div className="flex h-16 flex-1 items-end gap-1">
            {cap.days.map((d) => {
              const full = d.total ? 1 - d.free / d.total : 0;
              return (
                <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.date}: ${d.total - d.free} of ${d.total} taken`}>
                  <div className="w-full rounded-t-md bg-[linear-gradient(180deg,#29b0f8,#0a5fe3)]" style={{ height: `${Math.max(4, full * 100)}%`, opacity: d.total ? 1 : 0.2 }} />
                  <span className="text-[10px] text-faint">{day(d.date)}</span>
                </div>
              );
            })}
          </div>
          <p className="flex items-start gap-2 rounded-xl bg-chip px-4 py-3 text-[13px] text-brand lg:w-[320px]">
            <Icon name="spark" size={15} /> {cap.advice}
          </p>
        </>
      )}
    </section>
  );
}
