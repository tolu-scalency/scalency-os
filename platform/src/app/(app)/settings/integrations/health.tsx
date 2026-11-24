"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { callSetter } from "@/lib/call-setter";

export type Check = { group: string; name: string; status: "ok" | "warn" | "bad" | "off"; detail: string; at: string | null; fix?: { label: string; href: string } };

const LOOK = {
  ok: { dot: "bg-ok", chip: "bg-ok-bg text-ok", label: "Working" },
  warn: { dot: "bg-warn", chip: "bg-warn-bg text-warn", label: "Check" },
  bad: { dot: "bg-bad", chip: "bg-bad-bg text-bad", label: "Broken" },
  off: { dot: "bg-line-strong", chip: "bg-surface text-muted", label: "Not set up" },
} as const;

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} h ago`;
  return `${Math.floor(m / 1440)} days ago`;
}

/** The health board, plus live checks of the AI function and the minute clock (the scheduler). */
export function Health({ checks, accountId }: { checks: Check[]; accountId: string }) {
  const [live, setLive] = useState<Check[]>([]);
  useEffect(() => {
    let on = true;
    callSetter({ action: "health", account_id: accountId }).then((r) => {
      if (!on) return;
      if ("error" in r && r.error) {
        setLive([{ group: "AI", name: "AI function", status: "bad", detail: String(r.error), at: null }]);
        return;
      }
      const env = (r.env ?? {}) as Record<string, boolean>;
      const clock = r.clock as string | null;
      const late = !clock || Date.now() - new Date(clock).getTime() > 5 * 60_000;
      setLive([
        { group: "AI", name: "AI function", status: "ok", detail: `Running ${String(r.version ?? "").split(":")[0]}`, at: null },
        { group: "AI", name: "Claude key", status: env.anthropic ? "ok" : "bad", detail: env.anthropic ? "Set" : "ANTHROPIC_API_KEY is missing in Supabase secrets", at: null },
        { group: "Scheduler", name: "Minute clock", status: late ? "bad" : "ok", detail: late ? "The clock hasn't run in the last 5 minutes: follow-ups and reminders are paused. Check the Netlify scheduled function (clock)." : "Running every minute: follow-ups, reminders and reactivation go out on time", at: clock },
        { group: "Sending", name: "Alert emails", status: env.resend ? "ok" : "off", detail: env.resend ? "Team alert emails ready" : "Optional: RESEND_API_KEY and ALERT_FROM_EMAIL in Supabase secrets", at: null },
        { group: "AI", name: "Voice provider keys", status: env.vapi || env.retell ? "ok" : "off", detail: env.vapi ? "Vapi keys set" : env.retell ? "Retell keys set" : "Waiting for Vapi or Retell", at: null },
      ]);
    });
    return () => {
      on = false;
    };
  }, [accountId]);
  const all = useMemo(() => [...live, ...checks], [live, checks]);
  const groups = [...new Set(all.map((c) => c.group))];
  const bad = all.filter((c) => c.status === "bad").length;
  const warn = all.filter((c) => c.status === "warn").length;
  return (
    <div className="flex flex-col gap-4">
      <section className={`card flex flex-wrap items-center gap-4 p-5 ${bad ? "ring-2 ring-bad/30" : ""}`}>
        <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${bad ? "bg-bad-bg text-bad" : warn ? "bg-warn-bg text-warn" : "bg-ok-bg text-ok"}`}>
          <Icon name={bad ? "warning" : warn ? "bell" : "checkCircle"} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-semibold">{bad ? `${bad} thing${bad === 1 ? "" : "s"} broken` : warn ? `All working, ${warn} to check` : "Everything's working"}</div>
          <div className="text-[13px] text-muted">Every connection this workspace relies on, checked each time you open this page.</div>
        </div>
        <div className="flex gap-2 font-mono text-[12px]">
          {(["ok", "warn", "bad"] as const).map((s) => (
            <span key={s} className={`rounded-full px-2.5 py-1 ${LOOK[s].chip}`}>
              {all.filter((c) => c.status === s).length} {LOOK[s].label.toLowerCase()}
            </span>
          ))}
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((g) => (
          <section key={g} className="card overflow-hidden">
            <div className="border-b border-line px-5 py-3 text-[13px] font-semibold">{g}</div>
            <ul className="divide-y divide-line">
              {all
                .filter((c) => c.group === g)
                .map((c) => (
                  <li key={c.name} className="flex flex-wrap items-start gap-3 px-5 py-3">
                    <span className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full ${LOOK[c.status].dot} ${c.status === "bad" ? "animate-pulse" : ""}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-semibold text-navy">{c.name}</span>
                      <span className="block text-[12.5px] text-muted">
                        {c.detail}
                        {c.at ? ` · ${ago(c.at)}` : ""}
                      </span>
                    </span>
                    {c.fix && (
                      <Link href={c.fix.href} className="text-[12.5px] font-semibold text-brand hover:underline">
                        {c.fix.label}
                      </Link>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
