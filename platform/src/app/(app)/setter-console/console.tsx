"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { notify } from "@/components/toast";
import { claimHandoff, finishHandoff, type Outcome } from "./actions";

export type QueueItem = {
  id: string;
  clinic: string;
  priority: "urgent" | "high" | "medium";
  category: string;
  reason: string;
  summary: string;
  status: "open" | "claimed" | "done";
  mine: boolean;
  claimed: boolean;
  claimedAt: string | null;
  doneAt: string | null;
  outcome: string | null;
  createdAt: string;
  name: string;
  channel: string;
  score: number | null;
  qualification: Record<string, string | number | boolean>;
  ghlLink: string | null;
  recent: { role: string; body: string; at: string }[];
};

const LOOK = {
  urgent: { label: "Urgent", dot: "bg-bad", ring: "ring-bad/30", chip: "bg-bad-bg text-bad" },
  high: { label: "Call now", dot: "bg-warn", ring: "ring-warn/30", chip: "bg-warn-bg text-warn" },
  medium: { label: "Today", dot: "bg-brand", ring: "ring-line", chip: "bg-chip text-brand" },
} as const;

const CATEGORY: Record<string, string> = {
  person: "Asked for a person",
  high_value: "Hot or high-value lead",
  stalled: "Not booking",
  price: "Price objection",
  medical: "Medical question",
  complication: "Possible complication",
  complaint: "Complaint",
  appointment: "Appointment change",
  question: "Question the AI can't answer",
  other: "Other",
};

const OUTCOMES: [Outcome, string][] = [
  ["booked", "Booked"],
  ["callback", "Calling back later"],
  ["no_answer", "No answer"],
  ["not_interested", "Not interested"],
  ["resolved", "Sorted (other)"],
  ["handed_back", "Hand back to the AI"],
];

function waited(from: string, now: number) {
  const m = Math.max(0, Math.round((now - new Date(from).getTime()) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d`;
}

export function Console({ items, view }: { items: QueueItem[]; view: "open" | "done" }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [pending, start] = useTransition();
  // Live: the clock ticks every 30 seconds and the queue refreshes every minute.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    const r = setInterval(() => router.refresh(), 60_000);
    return () => {
      clearInterval(t);
      clearInterval(r);
    };
  }, [router]);
  const run = (p: Promise<{ ok?: string; error?: string }>) =>
    start(async () => {
      const r = await p;
      notify(r.error ?? r.ok ?? "Done", r.error ? "bad" : "ok");
      router.refresh();
    });

  const open = items.filter((i) => i.status !== "done");
  const counts = { urgent: open.filter((i) => i.priority === "urgent").length, high: open.filter((i) => i.priority === "high").length, medium: open.filter((i) => i.priority === "medium").length };
  const oldest = open.length ? waited(open.reduce((a, b) => (a.createdAt < b.createdAt ? a : b)).createdAt, now) : "–";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ["Urgent", counts.urgent, "text-bad"],
            ["Call now", counts.high, "text-warn"],
            ["Today", counts.medium, "text-brand"],
            ["Longest wait", oldest, "text-navy"],
          ] as const
        ).map(([k, v, c]) => (
          <div key={k} className="card p-4">
            <div className="text-[12px] font-medium text-muted">{k}</div>
            <div className={`mt-1 font-mono text-[26px] font-semibold tracking-tight ${c}`}>{v}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 self-start rounded-xl bg-surface p-1">
        <Link href="/setter-console" className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${view === "open" ? "bg-white text-navy shadow-sm" : "text-muted"}`}>
          Waiting ({open.length})
        </Link>
        <Link href="/setter-console?show=done" className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${view === "done" ? "bg-white text-navy shadow-sm" : "text-muted"}`}>
          Done this week
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-12 text-center">
          <span className="tile h-12 w-12 rounded-2xl">
            <Icon name="check" size={20} />
          </span>
          <div className="text-[15px] font-semibold">{view === "open" ? "Nothing waiting" : "Nothing closed this week"}</div>
          <p className="max-w-[420px] text-[13.5px] text-muted">
            When the AI passes a lead to a person (they ask for someone, a medical question, a hot lead, or a conversation that isn&apos;t booking), it shows here straight away.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((i) => {
            const look = LOOK[i.priority] ?? LOOK.medium;
            const q = i.qualification;
            const facts = (["treatment", "timeline", "budget", "concern", "preferred_times"] as const).map((k) => q[k]).filter((v): v is string => typeof v === "string" && v.length > 0);
            return (
              <li key={i.id} className={`card overflow-hidden ring-1 ${look.ring}`}>
                <div className="flex flex-wrap items-start gap-4 p-4 sm:p-5">
                  <div className="min-w-0 flex-[1_1_320px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${look.chip}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${look.dot} ${i.status === "open" && i.priority !== "medium" ? "animate-pulse" : ""}`} />
                        {look.label}
                      </span>
                      <span className="text-[12px] font-medium text-muted">{CATEGORY[i.category] ?? i.category}</span>
                      <span className="text-[12px] text-faint">·</span>
                      <span className="text-[12px] font-medium text-muted">{i.clinic}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-[17px] font-semibold tracking-tight">{i.name}</span>
                      {i.score != null && <span className="font-mono text-[12px] text-muted">score {i.score}/100</span>}
                      <span className="text-[12px] text-muted">{i.channel}</span>
                    </div>
                    <p className="mt-1 text-[13.5px] text-navy">{i.reason}</p>
                    {i.summary && <p className="mt-0.5 text-[13px] text-muted">{i.summary}</p>}
                    {facts.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {facts.slice(0, 5).map((f) => (
                          <span key={f} className="rounded-lg bg-surface px-2 py-0.5 text-[12px] text-navy">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-none flex-col items-end gap-2 text-right">
                    <div className="font-mono text-[12px] text-muted">
                      {i.status === "done" ? `closed: ${OUTCOMES.find(([k]) => k === i.outcome)?.[1] ?? i.outcome ?? "done"}` : `waiting ${waited(i.createdAt, now)}`}
                    </div>
                    {i.status === "claimed" && <div className="text-[12px] font-medium text-ok">{i.mine ? "You've got this one" : "Picked up"}</div>}
                    <div className="flex flex-wrap justify-end gap-2">
                      {i.ghlLink && (
                        <a href={i.ghlLink} target="_blank" rel="noopener noreferrer" className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold">
                          <Icon name="phone" size={13} /> Call in GHL
                        </a>
                      )}
                      {i.status === "open" && (
                        <button type="button" disabled={pending} onClick={() => run(claimHandoff(i.id))} className="btn-primary inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold">
                          <Icon name="check" size={13} /> Pick up
                        </button>
                      )}
                      {i.status !== "done" && (
                        <select
                          disabled={pending}
                          defaultValue=""
                          aria-label={`Close ${i.name}`}
                          onChange={(e) => {
                            const v = e.target.value as Outcome;
                            e.target.value = "";
                            if (v) run(finishHandoff(i.id, v));
                          }}
                          className="field h-9 w-auto min-w-[150px] text-[12.5px]"
                        >
                          <option value="" disabled>
                            Close as…
                          </option>
                          {OUTCOMES.map(([k, l]) => (
                            <option key={k} value={k}>
                              {l}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
                {i.recent.length > 0 && (
                  <div className="flex flex-col gap-1.5 border-t border-line bg-surface/50 px-4 py-3 sm:px-5">
                    {i.recent.map((m, n) => (
                      <div key={n} className={`max-w-[85%] rounded-xl px-3 py-1.5 text-[12.5px] ${m.role === "ai" ? "self-end bg-brand text-white" : "self-start bg-white ring-1 ring-line"}`}>
                        <span className="opacity-70">{m.role === "ai" ? "AI: " : `${i.name.split(" ")[0]}: `}</span>
                        {m.body.length > 220 ? `${m.body.slice(0, 220)}…` : m.body}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
