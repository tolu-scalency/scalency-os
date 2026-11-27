"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { Pill } from "@/components/ui";
import { notify } from "@/components/toast";
import { connectCalendly, disconnectCalendar, setConnectionOptions, syncCalendlyNow } from "../actions";

export type ConnView = {
  id: string;
  userId: string;
  who: string;
  provider: "google" | "microsoft" | "calendly";
  email: string | null;
  checkConflicts: boolean;
  addBookings: boolean;
  status: string;
  lastError: string | null;
  lastSynced: string | null;
};

const LOOK = {
  google: { name: "Google Calendar", sub: "with Google Meet", mark: "G", bg: "linear-gradient(135deg,#4285F4,#34A853)", text: "Blocks your busy times and adds every booking to your Google Calendar with a Meet link." },
  microsoft: { name: "Outlook and Microsoft 365", sub: "with Microsoft Teams", mark: "O", bg: "linear-gradient(135deg,#0A66C2,#28A8EA)", text: "Blocks your busy times and adds every booking to Outlook. Work accounts get a Teams link." },
  calendly: { name: "Calendly", sub: "bookings come into Scalency", mark: "C", bg: "linear-gradient(135deg,#006BFF,#64E7EF)", text: "Your Calendly bookings appear in this calendar, block those times, create contacts and start workflows." },
} as const;

function said(r: { error?: string; ok?: string }) {
  if (r.error) notify(r.error, "bad");
  else if (r.ok) notify(r.ok);
}

export function Connections({ me, canManage, conns, ready }: { me: string; canManage: boolean; conns: ConnView[]; ready: { google: boolean; microsoft: boolean } }) {
  const [pending, start] = useTransition();
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const mine = (p: ConnView["provider"]) => conns.find((c) => c.userId === me && c.provider === p);
  const others = conns.filter((c) => c.userId !== me);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-3">
        {(["google", "microsoft", "calendly"] as const).map((p) => {
          const c = mine(p);
          const l = LOOK[p];
          const off = p !== "calendly" && !ready[p];
          return (
            <div key={p} className="card relative flex flex-col overflow-hidden p-6">
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20 blur-2xl" style={{ background: l.bg }} />
              <div className="relative flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl text-[18px] font-bold text-white" style={{ background: l.bg }}>{l.mark}</span>
                <div>
                  <div className="text-[15.5px] font-semibold tracking-[-0.01em]">{l.name}</div>
                  <div className="text-[12px] text-muted">{l.sub}</div>
                </div>
              </div>
              <p className="relative mt-4 text-[13px] leading-relaxed text-muted">{l.text}</p>
              <div className="relative mt-auto pt-5">
                {c ? (
                  <ConnRow c={c} pending={pending} start={start} />
                ) : p === "calendly" ? (
                  showToken ? (
                    <div className="flex flex-col gap-2">
                      <ol className="list-decimal pl-4 text-[12px] leading-relaxed text-muted">
                        <li>In Calendly, open <b>Integrations and apps</b>, then <b>API and webhooks</b>.</li>
                        <li>Click <b>Generate new token</b>, name it Scalency, and copy it.</li>
                        <li>Paste it here. It&apos;s stored encrypted and never shown again.</li>
                      </ol>
                      <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste your Calendly token" autoComplete="off" className="field h-10 w-full font-mono text-[12.5px]" />
                      <button type="button" disabled={pending || token.length < 20} onClick={() => start(async () => { const r = await connectCalendly(token); said(r); if (!r.error) setToken(""); })} className="btn-primary inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-[13.5px] font-semibold">
                        <Icon name="link" size={14} /> Connect Calendly
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setShowToken(true)} className="btn-primary inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-[13.5px] font-semibold"><Icon name="plus" size={14} /> Connect Calendly</button>
                  )
                ) : off ? (
                  <div className="rounded-xl bg-surface px-3 py-2.5 text-[12.5px] text-muted">Waiting for setup: the {p === "google" ? "Google" : "Microsoft"} keys need adding in Netlify (see the deploy guide).</div>
                ) : (
                  <a href={`/api/calendar/oauth/${p}/start`} className="btn-primary inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-[13.5px] font-semibold"><Icon name="plus" size={14} /> Connect {p === "google" ? "Google" : "Outlook"}</a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {canManage && others.length > 0 && (
        <section className="card overflow-hidden p-0">
          <div className="border-b border-line px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">The team&apos;s connections</div>
          <div className="divide-y divide-line">
            {others.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                <span className="grid h-8 w-8 place-items-center rounded-xl text-[13px] font-bold text-white" style={{ background: LOOK[c.provider].bg }}>{LOOK[c.provider].mark}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">{c.who}</div>
                  <div className="truncate text-[12px] text-muted">{LOOK[c.provider].name}{c.email ? ` · ${c.email}` : ""}</div>
                </div>
                <Pill tone={c.status === "connected" && !c.lastError ? "green" : "amber"}>{c.status === "connected" && !c.lastError ? "Working" : "Needs a look"}</Pill>
                <button type="button" disabled={pending} onClick={() => start(async () => said(await disconnectCalendar(c.id)))} className="btn-ghost inline-flex h-8 items-center rounded-lg px-2.5 text-[12px] font-semibold">Disconnect</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card grid gap-4 p-6 md:grid-cols-3">
        {[
          { icon: "shield" as const, title: "Private by design", text: "We only read free and busy times, and only write the bookings made in Scalency. Tokens are encrypted." },
          { icon: "zap" as const, title: "Instant and automatic", text: "Bookings, moves and cancellations update the calendar and send the invite straight away." },
          { icon: "refresh" as const, title: "One place for everything", text: "Booking pages, Calendly, and bookings by the team or the AI all show in Scalency's calendar." },
        ].map((x) => (
          <div key={x.title} className="flex gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eef6fd] text-brand"><Icon name={x.icon} size={16} /></span>
            <div>
              <div className="text-[14px] font-semibold">{x.title}</div>
              <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{x.text}</div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function ConnRow({ c, pending, start }: { c: ConnView; pending: boolean; start: (fn: () => Promise<void>) => void }) {
  const ok = c.status === "connected" && !c.lastError;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold">{c.email ?? "Connected"}</div>
          <div className="text-[11.5px] text-muted">{c.provider === "calendly" && c.lastSynced ? `Last import ${new Date(c.lastSynced).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ok ? "Working" : "Needs a look"}</div>
        </div>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ok ? "bg-[#12b76a]" : "bg-[#f79009]"}`} />
      </div>
      {c.lastError && <p className="rounded-xl bg-[#fff8e6] px-3 py-2 text-[12px] text-[#8a5a00]">{c.lastError}</p>}
      {c.provider !== "calendly" && (
        <>
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={c.checkConflicts} disabled={pending} onChange={(e) => start(async () => said(await setConnectionOptions(c.id, e.target.checked, c.addBookings)))} className="h-4 w-4 accent-[#0465C7]" /> Block my busy times</label>
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={c.addBookings} disabled={pending} onChange={(e) => start(async () => said(await setConnectionOptions(c.id, c.checkConflicts, e.target.checked)))} className="h-4 w-4 accent-[#0465C7]" /> Add bookings to this calendar</label>
        </>
      )}
      <div className="flex gap-2">
        {c.provider === "calendly" && (
          <button type="button" disabled={pending} onClick={() => start(async () => said(await syncCalendlyNow()))} className="btn-ghost inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold"><Icon name="refresh" size={13} /> Import now</button>
        )}
        <button type="button" disabled={pending} onClick={() => start(async () => said(await disconnectCalendar(c.id)))} className="inline-flex h-9 items-center rounded-xl px-3 text-[12.5px] font-semibold text-bad hover:bg-[#fff1f1]">Disconnect</button>
      </div>
    </div>
  );
}
