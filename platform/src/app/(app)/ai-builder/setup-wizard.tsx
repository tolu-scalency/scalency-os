"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Icon, type IconName } from "@/components/icon";
import { createClient } from "@/lib/supabase/browser";
import type { Blueprint, SetupResult } from "@/lib/setup";
import { applySetup, undoSetup } from "./actions";

export type LastSetup = { id: string; appliedAt: string | null };
type Template = { key: string; name: string; description: string };
type CurrentPipeline = { name: string; stages: string[]; deals: number } | null;
type Step = "input" | "thinking" | "review" | "done";
type Pdf = { name: string; data: string; size: number };

const MAX_PDF = 8 * 1024 * 1024;
const EXAMPLES = [
  "We're a dental clinic in Leeds. People enquire on our website or by phone, book a free consultation, get a treatment plan, then pay a deposit. Booking link: https://example.com/book",
  "I run a small marketing agency. Leads come from LinkedIn and referrals. We have a discovery call, send a proposal, then sign a contract and onboard the client.",
];
const THINKING = ["Reading about your business", "Mapping your sales steps", "Choosing useful fields and tags", "Picking starter workflows"];

/* Speech recognition is not in the TypeScript DOM types yet. */
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function getRecognition(): Recognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

const noopSubscribe = () => () => {};
function hasSpeech() {
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

function readAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function functionError(error: unknown) {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
    } catch {
      /* fall through */
    }
  }
  return "We couldn't reach the AI just now. Please try again.";
}

export function SetupWizard({
  accountId,
  templates,
  pipeline,
  lastSetup,
  welcome,
}: {
  accountId: string;
  templates: Template[];
  pipeline: CurrentPipeline;
  lastSetup: LastSetup | null;
  welcome: boolean;
}) {
  const [step, setStep] = useState<Step>("input");
  const [text, setText] = useState("");
  const [usedVoice, setUsedVoice] = useState(false);
  const [pdf, setPdf] = useState<Pdf | null>(null);
  const [error, setError] = useState("");
  const [setupId, setSetupId] = useState("");
  const [plan, setPlan] = useState<Blueprint | null>(null);
  const [replace, setReplace] = useState(Boolean(pipeline && pipeline.deals === 0));
  const [result, setResult] = useState<{ id: string; data: SetupResult } | null>(null);

  async function suggest() {
    setError("");
    if (!text.trim() && !pdf) {
      setError("Tell us a little about your business first, or attach a document.");
      return;
    }
    setStep("thinking");
    const supabase = createClient();
    const { data, error: fnError } = await supabase.functions.invoke("ai-setup", {
      body: {
        account_id: accountId,
        text: usedVoice ? "" : text,
        voice: usedVoice ? text : "",
        file: pdf ? { name: pdf.name, type: "application/pdf", data: pdf.data } : undefined,
      },
    });
    if (fnError || !data?.blueprint) {
      setError(fnError ? await functionError(fnError) : "The AI did not return a setup. Please try again.");
      setStep("input");
      return;
    }
    setSetupId(data.setup_id);
    setPlan(data.blueprint as Blueprint);
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (step === "thinking") return <Thinking />;
  if (step === "review" && plan)
    return (
      <Review
        plan={plan}
        setPlan={setPlan}
        templates={templates}
        pipeline={pipeline}
        replace={replace}
        setReplace={setReplace}
        onBack={() => setStep("input")}
        onBuild={async () => {
          const out = await applySetup(setupId, plan, replace);
          if (out.error || !out.result) return out.error ?? "We couldn't build the setup.";
          setResult({ id: setupId, data: out.result });
          setStep("done");
          window.scrollTo({ top: 0, behavior: "smooth" });
          return "";
        }}
      />
    );
  if (step === "done" && result) return <Done result={result} onAgain={() => { setText(""); setPdf(null); setPlan(null); setResult(null); setStep("input"); }} />;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px] [&>*]:min-w-0">
      <section className="card flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <h2 className="text-[16px] font-semibold">Tell us about your business</h2>
          <p className="mt-1 text-[13.5px] text-muted">
            What you sell, where leads come from, and the steps from first contact to paying customer. Paste your process, speak it, or attach a PDF such as an SOP or sales script.
          </p>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
          maxLength={40000}
          placeholder="For example: we're a cleaning company in Manchester. Leads come from Google and Facebook. We call them, send a quote, book a first clean, then move them to a monthly plan."
          className="field min-h-[200px] resize-y leading-relaxed"
          aria-label="About your business"
        />
        <div className="flex flex-wrap items-center gap-2">
          <VoiceButton
            onText={(t) => {
              setUsedVoice(true);
              setText((prev) => (prev ? `${prev.trimEnd()} ${t}` : t));
            }}
            onError={setError}
          />
          <FileButton
            onText={(name, t) => setText((prev) => `${prev ? `${prev.trimEnd()}\n\n` : ""}From ${name}:\n${t}`)}
            onPdf={setPdf}
            onError={setError}
          />
          {pdf && (
            <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-chip px-3 py-1.5 text-[12.5px] font-semibold text-brand">
              <Icon name="file" size={14} />
              <span className="truncate">{pdf.name}</span>
              <button type="button" onClick={() => setPdf(null)} aria-label="Remove the PDF" className="rounded-full p-0.5 hover:bg-white/60">
                <Icon name="x" size={13} />
              </button>
            </span>
          )}
        </div>
        {error && <p role="alert" className="rounded-xl bg-bad-bg px-4 py-3 text-[13.5px] text-bad">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-[12.5px] text-muted">Nothing changes until you review it and click Build.</p>
          <button type="button" onClick={suggest} className="btn-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-[14px] font-semibold">
            <Icon name="spark" size={16} /> Suggest my setup
          </button>
        </div>
      </section>

      <aside className="flex flex-col gap-4">
        <section className="card p-5">
          <h3 className="text-[14px] font-semibold">Not sure what to write?</h3>
          <p className="mt-1 text-[13px] text-muted">Start from an example and change the details.</p>
          <div className="mt-3 flex flex-col gap-2">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => setText(ex)} className="rounded-xl border border-line p-3 text-left text-[12.5px] leading-relaxed text-muted hover:border-brand hover:text-ink">
                {ex.slice(0, 110)}…
              </button>
            ))}
          </div>
        </section>
        <section className="card p-5 text-[13px] text-muted">
          <h3 className="text-[14px] font-semibold text-ink">What it sets up</h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            <li>Pipeline stages for your sales steps</li>
            <li>Contact fields and tags</li>
            <li>Starter workflows, switched off until you approve them</li>
            <li>Your first tasks and saved details like a booking link</li>
          </ul>
        </section>
        {lastSetup && !welcome && <UndoCard setup={lastSetup} />}
      </aside>
    </div>
  );
}

/* ---------------------------------------------------------------- input helpers */

function VoiceButton({ onText, onError }: { onText: (t: string) => void; onError: (e: string) => void }) {
  const [on, setOn] = useState(false);
  const supported = useSyncExternalStore(noopSubscribe, hasSpeech, () => false);
  const rec = useRef<Recognition | null>(null);

  useEffect(() => () => rec.current?.stop(), []);

  function toggle() {
    if (on) {
      rec.current?.stop();
      return;
    }
    const r = getRecognition();
    if (!r) {
      onError("Voice isn't available in this browser. Try Chrome, Edge or Safari, or type instead.");
      return;
    }
    r.lang = "en-GB";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      let said = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) said += e.results[i][0].transcript;
      if (said.trim()) onText(said.trim());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") onError("Allow microphone access to speak, or type instead.");
      setOn(false);
    };
    r.onend = () => setOn(false);
    rec.current = r;
    onError("");
    r.start();
    setOn(true);
  }

  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-[13.5px] font-semibold ${on ? "bg-bad-bg text-bad" : "btn-ghost"}`}
    >
      {on ? <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-bad" /> : <Icon name="mic" size={15} />}
      {on ? "Stop recording" : "Speak instead"}
    </button>
  );
}

function FileButton({ onText, onPdf, onError }: { onText: (name: string, t: string) => void; onPdf: (p: Pdf) => void; onError: (e: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  async function picked(file: File | undefined) {
    if (!file) return;
    onError("");
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith(".pdf")) {
        if (file.size > MAX_PDF) return onError("That PDF is too large. Keep it under 8 MB.");
        onPdf({ name: file.name, data: await readAsBase64(file), size: file.size });
      } else if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv")) {
        onText(file.name, (await file.text()).slice(0, 30000));
      } else if (name.endsWith(".docx") || name.endsWith(".doc")) {
        onError("Word files aren't supported yet. In Word, choose File, Save as, PDF, then attach the PDF.");
      } else {
        onError("Attach a PDF or a text file.");
      }
    } catch {
      onError("We couldn't read that file.");
    } finally {
      if (input.current) input.current.value = "";
    }
  }
  return (
    <>
      <input ref={input} type="file" accept=".pdf,.txt,.md,.csv,.doc,.docx" className="hidden" onChange={(e) => picked(e.target.files?.[0])} />
      <button type="button" onClick={() => input.current?.click()} className="btn-ghost inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-[13.5px] font-semibold">
        <Icon name="paperclip" size={15} /> Attach a document
      </button>
    </>
  );
}

function Thinking() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, THINKING.length - 1)), 4000);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="card flex flex-col items-center gap-4 px-6 py-16 text-center" aria-live="polite">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-chip text-brand">
        <Icon name="spark" size={26} className="animate-pulse" />
      </span>
      <div>
        <p className="text-[16px] font-semibold">{THINKING[i]}…</p>
        <p className="mt-1 text-[13.5px] text-muted">This usually takes 20 to 40 seconds. Keep this page open.</p>
      </div>
      <div className="flex gap-1.5">
        {THINKING.map((_, n) => (
          <span key={n} className={`h-1.5 w-8 rounded-full ${n <= i ? "bg-brand" : "bg-line"}`} />
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- review */

function Section({ icon, title, hint, children }: { icon: IconName; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card grid gap-4 p-5 sm:p-6 md:grid-cols-[220px_1fr] [&>*]:min-w-0">
      <div>
        <div className="flex items-center gap-2">
          <Icon name={icon} size={16} className="text-brand" />
          <h2 className="text-[15px] font-semibold">{title}</h2>
        </div>
        {hint && <p className="mt-1 text-[12.5px] text-muted">{hint}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-3">{children}</div>
    </section>
  );
}

function AddRow({ placeholder, onAdd, max = 60 }: { placeholder: string; onAdd: (v: string) => void; max?: number }) {
  const [v, setV] = useState("");
  const add = () => {
    if (v.trim()) onAdd(v.trim());
    setV("");
  };
  return (
    <div className="flex gap-2">
      <input
        value={v}
        maxLength={max}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="field min-w-0 flex-1"
      />
      <button type="button" onClick={add} className="btn-ghost inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold">
        <Icon name="plus" size={14} /> Add
      </button>
    </div>
  );
}

function Chips({ items, onRemove, empty }: { items: string[]; onRemove: (i: number) => void; empty: string }) {
  if (!items.length) return <p className="text-[13px] text-muted">{empty}</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((t, i) => (
        <li key={`${t}-${i}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-3 pr-1.5 text-[13px]">
          <span className="truncate">{t}</span>
          <button type="button" onClick={() => onRemove(i)} aria-label={`Remove ${t}`} className="rounded-full p-1 text-muted hover:bg-line hover:text-ink">
            <Icon name="x" size={12} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function Review({
  plan,
  setPlan,
  templates,
  pipeline,
  replace,
  setReplace,
  onBack,
  onBuild,
}: {
  plan: Blueprint;
  setPlan: (b: Blueprint) => void;
  templates: Template[];
  pipeline: CurrentPipeline;
  replace: boolean;
  setReplace: (v: boolean) => void;
  onBack: () => void;
  onBuild: () => Promise<string>;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const set = (patch: Partial<Blueprint>) => setPlan({ ...plan, ...patch });
  const stages = plan.pipeline.stages;
  const moveStage = (i: number, d: -1 | 1) => {
    const next = [...stages];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set({ pipeline: { ...plan.pipeline, stages: next } });
  };
  const chosen = new Set(plan.workflows.map((w) => w.template));
  const why = Object.fromEntries(plan.workflows.map((w) => [w.template, w.why ?? ""]));
  const stagesUsed = !pipeline || replace;

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-3 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-chip text-brand">
            <Icon name="spark" size={16} />
          </span>
          <h2 className="text-[16px] font-semibold">Here’s what we suggest</h2>
        </div>
        {plan.summary && <p className="text-[14px] leading-relaxed text-muted">{plan.summary}</p>}
        {plan.questions && plan.questions.length > 0 && (
          <div className="rounded-xl bg-surface p-4 text-[13px]">
            <p className="font-semibold">Worth checking</p>
            <ul className="mt-1 list-disc pl-5 text-muted">
              {plan.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-[12.5px] text-muted">Change anything below. Remove what you don’t need.</p>
      </section>

      <Section icon="pipeline" title="Pipeline" hint="The steps a lead moves through, in order.">
        {pipeline && (
          <label className={`flex items-start gap-3 rounded-xl border border-line p-3 text-[13px] ${pipeline.deals ? "opacity-70" : ""}`}>
            <input type="checkbox" checked={replace} disabled={pipeline.deals > 0} onChange={(e) => setReplace(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>
              <span className="font-semibold">Replace my current stages</span>
              <span className="block text-muted">
                {pipeline.deals > 0
                  ? `Your pipeline already has ${pipeline.deals} deal${pipeline.deals === 1 ? "" : "s"}, so we’ll keep your stages as they are.`
                  : `You have ${pipeline.stages.length} stage${pipeline.stages.length === 1 ? "" : "s"} now: ${pipeline.stages.join(", ") || "none"}.`}
              </span>
            </span>
          </label>
        )}
        <div className={`flex flex-col gap-3 ${stagesUsed ? "" : "pointer-events-none opacity-50"}`}>
          <input
            value={plan.pipeline.name}
            maxLength={40}
            onChange={(e) => set({ pipeline: { ...plan.pipeline, name: e.target.value } })}
            aria-label="Pipeline name"
            className="field"
          />
          <ol className="flex flex-col gap-2 [&_li]:gap-1 sm:[&_li]:gap-2">
            {stages.map((s, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-surface text-[12px] font-semibold text-muted">{i + 1}</span>
                <input
                  value={s}
                  maxLength={40}
                  onChange={(e) => {
                    const next = [...stages];
                    next[i] = e.target.value;
                    set({ pipeline: { ...plan.pipeline, stages: next } });
                  }}
                  aria-label={`Stage ${i + 1}`}
                  className="field min-w-0 flex-1"
                />
                <button type="button" onClick={() => moveStage(i, -1)} disabled={i === 0} aria-label="Move up" className="rounded-lg p-1.5 text-muted hover:bg-surface disabled:opacity-30 sm:p-2">
                  <Icon name="up" size={14} />
                </button>
                <button type="button" onClick={() => moveStage(i, 1)} disabled={i === stages.length - 1} aria-label="Move down" className="rounded-lg p-1.5 text-muted hover:bg-surface disabled:opacity-30 sm:p-2">
                  <Icon name="down" size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => set({ pipeline: { ...plan.pipeline, stages: stages.filter((_, j) => j !== i) } })}
                  aria-label={`Remove stage ${s}`}
                  className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-bad sm:p-2"
                >
                  <Icon name="trash" size={14} />
                </button>
              </li>
            ))}
          </ol>
          {stages.length < 10 && <AddRow placeholder="Add a stage" max={40} onAdd={(v) => set({ pipeline: { ...plan.pipeline, stages: [...stages, v] } })} />}
        </div>
      </Section>

      <Section icon="form" title="Contact fields" hint="Extra details saved on every contact.">
        <Chips items={plan.fields.map((f) => f.label)} empty="No extra fields." onRemove={(i) => set({ fields: plan.fields.filter((_, j) => j !== i) })} />
        <AddRow placeholder="Add a field, e.g. Budget" onAdd={(v) => set({ fields: [...plan.fields, { label: v }] })} />
      </Section>

      <Section icon="tag" title="Tags" hint="Labels for sorting contacts, like lead source.">
        <Chips items={plan.tags} empty="No tags." onRemove={(i) => set({ tags: plan.tags.filter((_, j) => j !== i) })} />
        <AddRow placeholder="Add a tag" max={40} onAdd={(v) => set({ tags: [...plan.tags, v] })} />
      </Section>

      <Section icon="zap" title="Starter workflows" hint="Created switched off. Check the messages, then turn each one on.">
        <ul className="flex flex-col gap-2">
          {templates.map((t) => (
            <li key={t.key}>
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${chosen.has(t.key) ? "border-brand bg-chip/40" : "border-line"}`}>
                <input
                  type="checkbox"
                  checked={chosen.has(t.key)}
                  onChange={(e) =>
                    set({ workflows: e.target.checked ? [...plan.workflows, { template: t.key }] : plan.workflows.filter((w) => w.template !== t.key) })
                  }
                  className="mt-0.5 h-4 w-4"
                />
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold">{t.name}</span>
                  <span className="block text-[12.5px] text-muted">{why[t.key] || t.description}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon="tasks" title="First tasks" hint="Added to your task list.">
        {plan.tasks.length === 0 ? (
          <p className="text-[13px] text-muted">No tasks.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {plan.tasks.map((t, i) => (
              <li key={i} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-[13.5px]">
                <Icon name="check" size={14} className="text-muted" />
                <span className="min-w-0 flex-1">{t.title}</span>
                <span className="text-[12px] text-muted">{t.due_in_days === 0 ? "Today" : `In ${t.due_in_days} day${t.due_in_days === 1 ? "" : "s"}`}</span>
                <button type="button" onClick={() => set({ tasks: plan.tasks.filter((_, j) => j !== i) })} aria-label={`Remove ${t.title}`} className="rounded-lg p-1.5 text-muted hover:bg-surface">
                  <Icon name="x" size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <AddRow placeholder="Add a task" max={200} onAdd={(v) => set({ tasks: [...plan.tasks, { title: v, due_in_days: 1 }] })} />
      </Section>

      <Section icon="database" title="Saved details" hint="Use these in any message, like {{custom_values.booking_link}}.">
        {plan.values.length === 0 ? (
          <p className="text-[13px] text-muted">None found. You can add them later in Settings, Custom fields.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {plan.values.map((v, i) => (
              <li key={v.key} className="flex flex-col gap-1.5 rounded-xl border border-line p-3 sm:flex-row sm:items-center">
                <code className="min-w-0 break-all text-[12px] text-muted sm:w-44">{v.key}</code>
                <input
                  value={v.value}
                  maxLength={1000}
                  onChange={(e) => set({ values: plan.values.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })}
                  aria-label={v.key}
                  className="field min-w-0 flex-1"
                />
                <button type="button" onClick={() => set({ values: plan.values.filter((_, j) => j !== i) })} aria-label={`Remove ${v.key}`} className="self-end rounded-lg p-2 text-muted hover:bg-surface sm:self-auto">
                  <Icon name="trash" size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {error && <p role="alert" className="rounded-xl bg-bad-bg px-4 py-3 text-[13.5px] text-bad">{error}</p>}
      <div className="sticky bottom-[calc(var(--nav-h)+12px)] z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white/95 p-3 shadow-lg backdrop-blur">
        <button type="button" onClick={onBack} disabled={pending} className="btn-ghost inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-[13.5px] font-semibold">
          Start again
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError("");
              const msg = await onBuild();
              if (msg) setError(msg);
            })
          }
          className="btn-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-[14px] font-semibold disabled:opacity-70"
        >
          <Icon name="check" size={16} /> {pending ? "Building…" : "Build my workspace"}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- done and undo */

function Done({ result, onAgain }: { result: { id: string; data: SetupResult }; onAgain: () => void }) {
  const r = result.data;
  const [undone, setUndone] = useState<string>("");
  const [pending, start] = useTransition();
  const lines = [
    r.pipeline_created || r.stages_replaced ? `${r.stages} pipeline stage${r.stages === 1 ? "" : "s"}` : "",
    r.field_ids.length ? `${r.field_ids.length} contact field${r.field_ids.length === 1 ? "" : "s"}` : "",
    r.tag_ids.length ? `${r.tag_ids.length} tag${r.tag_ids.length === 1 ? "" : "s"}` : "",
    r.workflow_ids.length ? `${r.workflow_ids.length} workflow${r.workflow_ids.length === 1 ? "" : "s"}, switched off` : "",
    r.task_ids.length ? `${r.task_ids.length} task${r.task_ids.length === 1 ? "" : "s"}` : "",
    r.value_keys.length ? `${r.value_keys.length} saved detail${r.value_keys.length === 1 ? "" : "s"}` : "",
  ].filter(Boolean);

  if (undone)
    return (
      <section className="card flex flex-col items-start gap-3 p-6">
        <h2 className="text-[16px] font-semibold">Setup undone</h2>
        <p className="text-[14px] text-muted">{undone}</p>
        <button type="button" onClick={onAgain} className="btn-primary inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-[13.5px] font-semibold">
          <Icon name="spark" size={15} /> Try again
        </button>
      </section>
    );

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-4 p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-ok-bg text-ok">
            <Icon name="check" size={20} />
          </span>
          <div>
            <h2 className="text-[17px] font-semibold">Your workspace is set up</h2>
            <p className="text-[13.5px] text-muted">{lines.length ? `Added ${lines.join(", ")}.` : "Everything you chose was already in place."}</p>
          </div>
        </div>
        {r.skipped.length > 0 && (
          <ul className="list-disc rounded-xl bg-surface p-4 pl-8 text-[13px] text-muted">
            {r.skipped.map((s) => (
              <li key={s}>{s}.</li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-6">
        <h3 className="text-[15px] font-semibold">Next steps</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <NextLink href="/workflows" icon="zap" title="Check your workflows" text="Read each message, then turn the workflow on." />
          <NextLink href="/pipeline" icon="pipeline" title="Open your pipeline" text="Add your first deals." />
          <NextLink href="/tasks" icon="tasks" title="See your tasks" text="Your first jobs are waiting." />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              if (!window.confirm("Remove what this setup added? Anything you've already started using is kept.")) return;
              const out = await undoSetup(result.id);
              setUndone(out.error ?? `Removed ${out.removed} item${out.removed === 1 ? "" : "s"}.${out.kept?.length ? ` Kept: ${out.kept.join(", ")}.` : ""}`);
            })
          }
          className="btn-ghost inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-[13.5px] font-semibold"
        >
          <Icon name="undo" size={15} /> {pending ? "Undoing…" : "Undo this setup"}
        </button>
        <Link href="/dashboard" className="text-[13.5px] font-semibold text-brand">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}

function NextLink({ href, icon, title, text }: { href: string; icon: IconName; title: string; text: string }) {
  return (
    <Link href={href} className="flex flex-col gap-1 rounded-xl border border-line p-4 hover:border-brand">
      <Icon name={icon} size={18} className="text-brand" />
      <span className="mt-1 text-[14px] font-semibold">{title}</span>
      <span className="text-[12.5px] text-muted">{text}</span>
    </Link>
  );
}

function UndoCard({ setup }: { setup: LastSetup }) {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const when = setup.appliedAt ? new Date(setup.appliedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
  if (msg) return <section className="card p-5 text-[13px] text-muted">{msg}</section>;
  return (
    <section className="card p-5">
      <h3 className="text-[14px] font-semibold">Last AI setup</h3>
      <p className="mt-1 text-[13px] text-muted">Built {when}. Undo removes what it added, unless you’ve started using it.</p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            if (!window.confirm("Remove what the last setup added? Anything you've already started using is kept.")) return;
            const out = await undoSetup(setup.id);
            setMsg(out.error ?? `Removed ${out.removed} item${out.removed === 1 ? "" : "s"}.${out.kept?.length ? ` Kept: ${out.kept.join(", ")}.` : ""}`);
          })
        }
        className="btn-ghost mt-3 inline-flex min-h-9 items-center gap-2 rounded-xl px-3 text-[13px] font-semibold"
      >
        <Icon name="undo" size={14} /> {pending ? "Undoing…" : "Undo it"}
      </button>
    </section>
  );
}
