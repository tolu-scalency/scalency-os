"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { notify } from "@/components/toast";
import { callSetter } from "@/lib/call-setter";

export type GradedThread = { id: string; contact_name: string | null; qa_score: number; qa_notes: { scores?: Record<string, number>; strengths?: string[]; issues?: string[] } | null; qa_at: string; state: string; channel: string };
export type LabRun = { scenario: number; passed: boolean; score: number | null; created_at: string; result: { title?: string; checks?: { name: string; ok: boolean }[]; qa?: { issues?: string[]; scores?: Record<string, number> }; turns?: { who: string; text: string }[] } };
type Scenario = { id: number; title: string; first: string; expect: string[] };

const PARTS: [string, string][] = [
  ["listening", "Listening"],
  ["questions", "One question at a time"],
  ["pricing", "No pushed prices"],
  ["compliance", "Compliance"],
  ["booking", "Booking"],
  ["handoffs", "Handoffs"],
  ["tone", "Tone"],
];
const tone = (n: number) => (n >= 85 ? "text-ok" : n >= 70 ? "text-brand" : n >= 50 ? "text-warn" : "text-bad");

export function Qa({ setterId, graded, runs, waiting }: { setterId: string; graded: GradedThread[]; runs: LabRun[]; waiting: number }) {
  const router = useRouter();
  const [tab, setTab] = useState<"lab" | "live">("lab");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [running, setRunning] = useState<number[]>([]);
  const [current, setCurrent] = useState<number | null>(null);
  const [results, setResults] = useState<Record<number, LabRun>>(() => Object.fromEntries(runs.map((r) => [r.scenario, r])));
  const [open, setOpen] = useState<number | null>(null);
  const [scoring, setScoring] = useState(false);

  useEffect(() => {
    if (!setterId) return;
    callSetter({ agent_id: setterId, action: "lab_list" }).then((r) => {
      if (Array.isArray(r.scenarios)) setScenarios(r.scenarios as Scenario[]);
    });
  }, [setterId]);

  const runList = async (ids: number[]) => {
    setRunning(ids);
    for (const id of ids) {
      setCurrent(id);
      const r = await callSetter({ agent_id: setterId, action: "lab_run", scenario: id });
      if ("error" in r && r.error) {
        notify(`Test ${id}: ${r.error}`, "bad");
        continue;
      }
      setResults((x) => ({ ...x, [id]: { scenario: id, passed: Boolean(r.passed), score: (r.qa as { score?: number })?.score ?? null, created_at: new Date().toISOString(), result: r as LabRun["result"] } }));
    }
    setCurrent(null);
    setRunning([]);
  };
  const scoreLive = async () => {
    setScoring(true);
    const r = await callSetter({ agent_id: setterId, action: "qa_score", limit: 6 });
    setScoring(false);
    if ("error" in r && r.error) return void notify(String(r.error), "bad");
    notify(`Graded ${(r.done as unknown[])?.length ?? 0} conversations`, "ok");
    router.refresh();
  };

  const done = Object.values(results);
  const passed = done.filter((r) => r.passed).length;
  const scores = done.map((r) => r.score ?? 0).sort((a, b) => a - b);
  const median = scores.length ? scores[Math.floor((scores.length - 1) / 2)] : null;
  const breaches = done.filter((r) => (r.result.qa?.scores?.compliance ?? 10) < 8).length;
  const avgLive = useMemo(() => (graded.length ? Math.round(graded.reduce((n, g) => n + g.qa_score, 0) / graded.length) : null), [graded]);
  const partAvg = (k: string) => {
    const v = graded.map((g) => g.qa_notes?.scores?.[k]).filter((x): x is number => typeof x === "number");
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) : null;
  };
  const ready = done.length >= 50 && passed >= 48 && breaches === 0;

  if (!setterId) return <div className="card p-8 text-center text-[13.5px] text-muted">Set up an AI setter first.</div>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1 self-start rounded-2xl bg-white p-1 ring-1 ring-line">
        {(
          [
            ["lab", "Test lab (50 conversations)"],
            ["live", "Live conversations"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`min-h-9 rounded-xl px-4 text-[13px] font-semibold ${tab === k ? "bg-navy text-white" : "text-muted hover:text-navy"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "lab" && (
        <>
          <section className="grid gap-3 md:grid-cols-4">
            <div className={`card col-span-full p-5 md:col-span-1 ${ready ? "bg-[linear-gradient(135deg,#0a3fa6,#0a5fe3)] text-white" : ""}`}>
              <div className={`text-[12px] font-semibold uppercase tracking-[0.1em] ${ready ? "text-white/75" : "text-muted"}`}>Ready to go live?</div>
              <div className="mt-2 text-[22px] font-semibold">{ready ? "Yes" : done.length < 50 ? "Run all 50 tests" : "Not yet"}</div>
              <div className={`mt-1 text-[12px] ${ready ? "text-white/75" : "text-muted"}`}>Spec: 48 of 50 pass, no compliance breaches.</div>
            </div>
            {(
              [
                ["Passed", `${passed} of ${done.length || 50}`],
                ["Median quality score", median != null ? `${median}/100` : "–"],
                ["Compliance breaches", String(breaches)],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="card p-5">
                <div className="text-[12px] font-medium text-muted">{k}</div>
                <div className="mt-1.5 font-mono text-[26px] font-semibold tracking-tight text-navy">{v}</div>
              </div>
            ))}
          </section>

          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h2 className="text-[16px] font-semibold">The 50 test leads</h2>
                <p className="text-[12.5px] text-muted">A pretend lead (played by AI) talks to your setter with its current settings and Knowledge. Each takes about a minute.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={running.length > 0} onClick={() => runList(scenarios.filter((s) => !results[s.id]?.passed).map((s) => s.id))} className="btn-ghost inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold">
                  <Icon name="refresh" size={14} /> Run failed and new
                </button>
                <button type="button" disabled={running.length > 0 || !scenarios.length} onClick={() => runList(scenarios.map((s) => s.id))} className="btn-primary inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold">
                  <Icon name="play" size={14} /> {running.length ? `Running ${running.indexOf(current ?? 0) + 1} of ${running.length}…` : "Run all 50"}
                </button>
              </div>
            </div>
            {running.length > 0 && (
              <div className="h-1 bg-surface">
                <div className="h-full bg-brand transition-all" style={{ width: `${((running.indexOf(current ?? 0) + 1) / running.length) * 100}%` }} />
              </div>
            )}
            <ul className="divide-y divide-line">
              {scenarios.map((s) => {
                const r = results[s.id];
                return (
                  <li key={s.id}>
                    <div className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <span className="w-7 font-mono text-[12px] text-faint">{s.id}</span>
                      <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full ${current === s.id ? "animate-pulse bg-chip text-brand" : !r ? "bg-surface text-faint" : r.passed ? "bg-ok-bg text-ok" : "bg-bad-bg text-bad"}`}>
                        <Icon name={!r || current === s.id ? "circle" : r.passed ? "check" : "x"} size={12} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-semibold text-navy">{s.title}</span>
                        <span className="block truncate text-[12px] text-muted">&quot;{s.first}&quot;</span>
                      </span>
                      {r?.score != null && <span className={`font-mono text-[13px] font-semibold ${tone(r.score)}`}>{r.score}</span>}
                      {r && (
                        <button type="button" onClick={() => setOpen(open === s.id ? null : s.id)} className="text-[12px] font-semibold text-brand hover:underline">
                          {open === s.id ? "Hide" : "See it"}
                        </button>
                      )}
                      <button type="button" disabled={running.length > 0} onClick={() => runList([s.id])} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-navy" aria-label="Run this test">
                        <Icon name="play" size={13} />
                      </button>
                    </div>
                    {open === s.id && r && (
                      <div className="grid gap-4 bg-surface/60 px-5 py-4 lg:grid-cols-[1fr_320px]">
                        <div className="flex flex-col gap-2">
                          {(r.result.turns ?? []).map((t, i) => (
                            <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] ${t.who === "lead" ? "self-start bg-white ring-1 ring-line" : "self-end bg-brand text-white"}`}>
                              {t.text}
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-col gap-2">
                          {(r.result.checks ?? []).map((c) => (
                            <div key={c.name} className={`flex items-center gap-2 text-[12.5px] ${c.ok ? "text-ok" : "text-bad"}`}>
                              <Icon name={c.ok ? "check" : "x"} size={12} /> {c.name}
                            </div>
                          ))}
                          {(r.result.qa?.issues ?? []).map((i) => (
                            <div key={i} className="rounded-lg bg-warn-bg px-2.5 py-1.5 text-[12px] text-warn">
                              {i}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {tab === "live" && (
        <>
          <section className="grid gap-3 md:grid-cols-[1fr_2fr]">
            <div className="card flex flex-col justify-between gap-3 p-5">
              <div>
                <div className="text-[12px] font-medium text-muted">Average quality, live conversations</div>
                <div className={`mt-1.5 font-mono text-[40px] font-semibold tracking-tight ${avgLive != null ? tone(avgLive) : "text-navy"}`}>{avgLive ?? "–"}</div>
                <div className="text-[12px] text-muted">
                  {graded.length} graded · {waiting} waiting
                </div>
              </div>
              <button type="button" disabled={scoring || !waiting} onClick={scoreLive} className="btn-primary inline-flex min-h-10 w-fit items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-50">
                <Icon name="spark" size={14} /> {scoring ? "Grading…" : "Grade the latest 6"}
              </button>
            </div>
            <div className="card grid gap-3 p-5 sm:grid-cols-2">
              {PARTS.map(([k, l]) => {
                const v = partAvg(k);
                return (
                  <div key={k}>
                    <div className="mb-1 flex justify-between text-[12.5px]">
                      <span>{l}</span>
                      <span className={`font-mono font-semibold ${v != null ? tone(v) : ""}`}>{v ?? "–"}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface">
                      <div className="h-full rounded-full bg-[linear-gradient(90deg,#29b0f8,#0a5fe3)]" style={{ width: `${v ?? 0}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="card divide-y divide-line">
            {graded.length === 0 && <div className="p-8 text-center text-[13px] text-muted">No graded conversations yet. Click Grade the latest 6.</div>}
            {graded.map((g) => (
              <div key={g.id} className="flex flex-wrap items-start gap-3 px-5 py-3.5">
                <span className={`w-12 font-mono text-[20px] font-semibold ${tone(g.qa_score)}`}>{g.qa_score}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-navy">{g.contact_name || "Lead"}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {(g.qa_notes?.issues ?? []).map((i) => (
                      <span key={i} className="rounded-full bg-warn-bg px-2 py-0.5 text-[11.5px] text-warn">
                        {i}
                      </span>
                    ))}
                    {(g.qa_notes?.strengths ?? []).map((i) => (
                      <span key={i} className="rounded-full bg-ok-bg px-2 py-0.5 text-[11.5px] text-ok">
                        {i}
                      </span>
                    ))}
                  </span>
                </span>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
