"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { notify } from "@/components/toast";
import { callSetter } from "@/lib/call-setter";

export type LiveThread = {
  id: string;
  agentId: string;
  name: string;
  clinic: string;
  assistant: string;
  state: "active" | "paused" | "handed_over" | "booked";
  channel: string;
  origin: string;
  score: number | null;
  qualification: Record<string, unknown>;
  appointmentAt: string | null;
  lastAt: string;
  waiting: boolean;
  ghlLink: string;
  turns: { role: string; body: string; at: string }[];
};

const STATE: Record<LiveThread["state"], { label: string; chip: string }> = {
  active: { label: "AI talking", chip: "bg-chip text-brand" },
  paused: { label: "Team took over", chip: "bg-warn-bg text-warn" },
  handed_over: { label: "Needs a person", chip: "bg-bad-bg text-bad" },
  booked: { label: "Booked", chip: "bg-ok-bg text-ok" },
};
const FILTERS = [
  ["all", "All"],
  ["active", "AI talking"],
  ["handed_over", "Needs a person"],
  ["paused", "Team took over"],
  ["booked", "Booked"],
] as const;

function ago(iso: string, now: number) {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}
const clock = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

export function CommandCentre({ items }: { items: LiveThread[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);
  const [now, setNow] = useState(() => Date.now());
  const [summary, setSummary] = useState<Record<string, { summary: string; next: string }>>({});
  const [busy, setBusy] = useState("");
  const [, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    const reload = setInterval(() => start(() => router.refresh()), 20_000);
    return () => {
      clearInterval(tick);
      clearInterval(reload);
    };
  }, [router]);

  const list = useMemo(
    () => items.filter((t) => (filter === "all" || t.state === filter) && (!q.trim() || `${t.name} ${t.clinic}`.toLowerCase().includes(q.trim().toLowerCase()))),
    [items, filter, q],
  );
  const open = items.find((t) => t.id === openId) ?? list[0] ?? null;
  // Keep the newest message in view when switching conversations or when new ones arrive.
  const lastAt = open?.turns.at(-1)?.at;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [open?.id, lastAt]);
  const counts = { active: items.filter((t) => t.state === "active").length, handed_over: items.filter((t) => t.state === "handed_over").length, waiting: items.filter((t) => t.waiting && t.state === "active").length, booked: items.filter((t) => t.state === "booked").length };

  const summarise = async (t: LiveThread) => {
    setBusy(`s${t.id}`);
    const res = await callSetter({ agent_id: t.agentId, action: "summary", thread_id: t.id });
    setBusy("");
    if ("error" in res && res.error) return void notify(String(res.error), "bad");
    setSummary((s) => ({ ...s, [t.id]: { summary: String(res.summary ?? ""), next: String(res.next ?? "") } }));
  };
  const setState = async (t: LiveThread, to: "paused" | "active") => {
    setBusy(`t${t.id}`);
    const res = await callSetter({ agent_id: t.agentId, action: "thread_state", thread_id: t.id, to });
    setBusy("");
    if ("error" in res && res.error) return void notify(String(res.error), "bad");
    notify(to === "paused" ? "You've taken over. The AI won't message them." : "Handed back to the AI.", "ok");
    start(() => router.refresh());
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {(
          [
            ["AI talking now", counts.active, "spark", "text-brand"],
            ["Waiting on the AI", counts.waiting, "clock", "text-navy"],
            ["Need a person", counts.handed_over, "warning", "text-bad"],
            ["Booked", counts.booked, "checkCircle", "text-ok"],
          ] as const
        ).map(([k, v, icon, c]) => (
          <div key={k} className="card flex items-center gap-3 px-4 py-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface">
              <Icon name={icon} size={17} />
            </span>
            <div>
              <div className={`font-mono text-[22px] font-semibold leading-none tracking-tight ${c}`}>{v}</div>
              <div className="mt-1 text-[12px] text-muted">{k}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:h-[calc(100dvh-300px)] lg:min-h-[480px] lg:grid-cols-[340px_1fr]">
        <section className="card flex max-h-[60dvh] min-h-0 flex-col overflow-hidden lg:max-h-none">
          <div className="flex flex-col gap-2.5 border-b border-line p-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or clinic" aria-label="Search conversations" className="field h-10 w-full text-[13px]" />
            <div className="flex flex-wrap gap-1">
              {FILTERS.map(([k, l]) => (
                <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-lg px-2.5 py-1 text-[12px] font-semibold ${filter === k ? "bg-navy text-white" : "text-muted hover:bg-surface"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {list.length === 0 ? (
              <div className="p-5 text-center text-[13px] text-muted">No conversations here yet. As soon as the AI messages a lead, it shows up live.</div>
            ) : (
              list.map((t) => {
                const last = t.turns.filter((x) => x.role !== "event").at(-1);
                return (
                  <button key={t.id} type="button" onClick={() => setOpenId(t.id)} className={`flex w-full items-start gap-3 border-b border-line px-3.5 py-3 text-left hover:bg-surface ${open?.id === t.id ? "bg-chip/60" : ""}`}>
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-surface text-[13px] font-semibold text-navy">{t.name.slice(0, 1).toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[13.5px] font-semibold text-navy">{t.name}</span>
                        {t.waiting && t.state === "active" && <span className="h-2 w-2 flex-none animate-pulse rounded-full bg-brand" aria-label="Waiting for the AI" />}
                        <span className="ml-auto flex-none font-mono text-[11px] text-faint">{ago(t.lastAt, now)}</span>
                      </span>
                      <span className="block truncate text-[12px] text-muted">{last ? `${last.role === "ai" ? `${t.assistant}: ` : ""}${last.body}` : "No messages yet"}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATE[t.state].chip}`}>{STATE[t.state].label}</span>
                        {t.score != null && <span className="font-mono text-[10.5px] text-muted">{t.score}/100</span>}
                        {t.clinic && <span className="truncate text-[10.5px] text-faint">{t.clinic}</span>}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="card flex h-[75dvh] min-h-0 flex-col overflow-hidden lg:h-auto">
          {!open ? (
            <div className="flex flex-1 items-center justify-center p-5 text-center text-[13px] text-muted">Choose a conversation to read along.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-[16px] font-semibold">{open.name}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATE[open.state].chip}`}>{STATE[open.state].label}</span>
                  </div>
                  <div className="text-[12px] text-muted">
                    {open.clinic} · {open.channel === "Live_Chat" ? "Web chat" : open.channel}
                    {open.origin !== "lead" ? ` · ${open.origin === "missed_call" ? "Missed call" : open.origin === "reactivation" ? "Reactivation" : open.origin === "rebooking" ? "Rebooking" : "Messaged in"}` : ""}
                    {open.appointmentAt ? ` · Appointment ${clock(open.appointmentAt)}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {open.ghlLink && (
                    <a href={open.ghlLink} target="_blank" rel="noreferrer" className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold">
                      <Icon name="phone" size={13} /> Open in GHL
                    </a>
                  )}
                  {open.state === "active" || open.state === "booked" ? (
                    <button type="button" disabled={busy === `t${open.id}`} onClick={() => setState(open, "paused")} className="btn-primary inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold">
                      <Icon name="user" size={13} /> Take over
                    </button>
                  ) : (
                    <button type="button" disabled={busy === `t${open.id}`} onClick={() => setState(open, "active")} className="btn-primary inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold">
                      <Icon name="spark" size={13} /> Hand back to AI
                    </button>
                  )}
                </div>
              </div>

              <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_280px]">
                <div className="flex min-h-0 flex-col">
                <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto bg-surface/60 p-5">
                  {open.turns.length === 0 && <div className="m-auto text-[13px] text-muted">No messages yet.</div>}
                  {open.turns.map((m, i) =>
                    m.role === "event" ? (
                      <div key={i} className="self-center rounded-full bg-white px-3 py-1 text-[11.5px] text-muted ring-1 ring-line">
                        {m.body}
                      </div>
                    ) : (
                      <div key={i} className={`flex max-w-[78%] flex-col ${m.role === "lead" ? "self-start" : "self-end items-end"}`}>
                        <div className={`whitespace-pre-line rounded-xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${m.role === "lead" ? "bg-white text-navy ring-1 ring-line" : m.role === "team" ? "bg-navy text-white" : "bg-brand text-white"}`}>{m.body}</div>
                        <div className="mt-1 px-1 font-mono text-[10.5px] text-faint">
                          {m.role === "ai" ? `${open.assistant} (AI)` : m.role === "team" ? "Team" : open.name.split(" ")[0]} · {clock(m.at)}
                        </div>
                      </div>
                    ),
                  )}
                  <div ref={endRef} />
                </div>
                <Composer thread={open} onSent={() => start(() => router.refresh())} onTakeOver={() => setState(open, "paused")} busy={busy === `t${open.id}`} />
                </div>
                <aside className="flex flex-col gap-4 border-t border-line p-5 lg:border-l lg:border-t-0">
                  <div>
                    <div className="eyebrow mb-2">AI summary</div>
                    {summary[open.id] ? (
                      <div className="flex flex-col gap-2 text-[13px] leading-relaxed">
                        <p>{summary[open.id].summary}</p>
                        {summary[open.id].next && (
                          <p className="rounded-xl bg-chip px-3 py-2 text-brand">
                            <strong>Next: </strong>
                            {summary[open.id].next}
                          </p>
                        )}
                      </div>
                    ) : (
                      <button type="button" disabled={busy === `s${open.id}`} onClick={() => summarise(open)} className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold">
                        <Icon name="spark" size={13} /> {busy === `s${open.id}` ? "Summarising…" : "Summarise this conversation"}
                      </button>
                    )}
                  </div>
                  <div>
                    <div className="eyebrow mb-2">What the AI learnt</div>
                    <div className="flex flex-wrap gap-1.5">
                      {open.score != null && <span className="rounded-full bg-chip px-2 py-0.5 font-mono text-[11.5px] font-semibold text-brand">score {open.score}/100</span>}
                      {Object.entries(open.qualification)
                        .filter(([k, v]) => k !== "score" && v !== null && v !== "" && v !== false && typeof v !== "object")
                        .map(([k, v]) => (
                          <span key={k} className="rounded-full bg-surface px-2 py-0.5 text-[11.5px]">
                            <span className="text-muted">{k.replace(/_/g, " ")}:</span> {v === true ? "yes" : String(v)}
                          </span>
                        ))}
                      {open.score == null && Object.keys(open.qualification).length === 0 && <span className="text-[12.5px] text-muted">Nothing yet.</span>}
                    </div>
                  </div>
                  <p className="mt-auto text-[11.5px] text-muted">Taking over stops the AI messaging this lead until you hand it back. Your replies go out through GHL on the channel they used.</p>
                </aside>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/** The team's reply box: shown once a person has taken over. The AI can draft a reply to edit first. */
function Composer({ thread, onSent, onTakeOver, busy }: { thread: LiveThread; onSent: () => void; onTakeOver: () => void; busy: boolean }) {
  const [text, setText] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const team = thread.state === "paused" || thread.state === "handed_over";
  if (!team)
    return (
      <div className="flex flex-wrap items-center gap-3 border-t border-line bg-white px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-chip text-brand">
          <Icon name="spark" size={14} />
        </span>
        <span className="min-w-0 flex-1 text-[13px] text-muted">The AI is handling this conversation. Take over to reply yourself.</span>
        <button type="button" disabled={busy} onClick={onTakeOver} className="btn-primary inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3.5 text-[12.5px] font-semibold">
          <Icon name="user" size={13} /> Take over and reply
        </button>
      </div>
    );
  const draft = async () => {
    setDrafting(true);
    const r = await callSetter({ agent_id: thread.agentId, action: "draft_reply", thread_id: thread.id });
    setDrafting(false);
    if ("error" in r && r.error) return void notify(String(r.error), "bad");
    setText(String(r.draft ?? ""));
  };
  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    const r = await callSetter({ agent_id: thread.agentId, action: "team_send", thread_id: thread.id, text });
    setSending(false);
    if ("error" in r && r.error) return void notify(String(r.error), "bad");
    setText("");
    notify("Sent", "ok");
    onSent();
  };
  return (
    <div className="border-t border-line bg-white p-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
        }}
        rows={3}
        maxLength={1600}
        placeholder={`Reply to ${thread.name.split(" ")[0]} as the team (${thread.channel === "Live_Chat" ? "web chat" : thread.channel})…`}
        className="field w-full resize-none py-2.5 text-[13.5px] leading-relaxed"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" disabled={drafting} onClick={draft} className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold">
          <Icon name="spark" size={13} /> {drafting ? "Drafting…" : text ? "Redraft with AI" : "Draft with AI"}
        </button>
        <span className="text-[11.5px] text-muted">Edit anything before sending. Ctrl + Enter sends.</span>
        <span className="ml-auto font-mono text-[11px] text-faint">{text.length}/1600</span>
        <button type="button" disabled={sending || !text.trim()} onClick={send} className="btn-primary inline-flex min-h-9 items-center gap-1.5 rounded-xl px-4 text-[12.5px] font-semibold disabled:opacity-50">
          <Icon name="send" size={13} /> {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
