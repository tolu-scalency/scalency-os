"use client";

// The "New form" dialog: start from a template, from scratch, or let the AI
// draft it. Everything opens in Form Studio as a draft.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";
import { Icon, type IconName } from "@/components/icon";
import { LeadForm } from "@/components/lead-form";
import { allFields, type FormDefinition } from "@/lib/form-builder";
import { FORM_TEMPLATES, definitionFromDraft, type AiDraft, type FormTemplate } from "@/lib/form-templates";
import { createClient } from "@/lib/supabase/browser";
import { createForm } from "./actions";

type Mode = "templates" | "scratch" | "ai";

const AI_EXAMPLES = [
  "A free strategy call application for a business coach. Qualify by monthly revenue and budget, and only send good fits to the booking page.",
  "Quote request for a cleaning company: type of property, number of bedrooms, how often, postcode and preferred start date.",
  "Consultation booking for a skin clinic, asking which treatment they're interested in and whether they've had it before.",
  "Waitlist sign-up for a new online course, with name, email and what they most want to learn.",
];

function SubmitButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className="btn-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-[14px] font-semibold disabled:opacity-60">
      {pending ? "Opening Form Studio..." : children}
    </button>
  );
}

/** A small, live, non-clickable picture of a form. */
function Thumb({ def, height = 190 }: { def: FormDefinition; height?: number }) {
  const scale = 0.42;
  return (
    <div className="pointer-events-none relative overflow-hidden" style={{ height, background: def.theme.background }} aria-hidden inert>
      <div className="absolute left-1/2 top-3 origin-top" style={{ width: def.theme.width, transform: `translateX(-50%) scale(${scale})` }}>
        <div className={def.theme.card ? "rounded-2xl p-6 shadow-sm" : "p-2"} style={{ background: def.theme.card ? (def.theme.dark ? "#111827" : "#fff") : "transparent" }}>
          <LeadForm formId="thumb" def={def} preview />
        </div>
      </div>
    </div>
  );
}

function Summary({ def }: { def: FormDefinition }) {
  const n = allFields(def).length;
  return (
    <span className="text-[12px] text-muted">
      {def.steps.length > 1 ? `${def.steps.length} steps · ` : ""}
      {n} {n === 1 ? "question" : "questions"}
      {def.qualify.enabled ? " · scores leads" : ""}
    </span>
  );
}

export function NewFormButton({ accountId, label = "New form", big = false }: { accountId: string; label?: string; big?: boolean }) {
  const [open, setOpen] = useState<Mode | null>(null);
  if (big)
    return (
      <>
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["templates", "layout", "Start from a template", "Ready-made forms for coaching, clinics, quotes, events and more."],
              ["ai", "spark", "Build with AI", "Describe the form in a sentence. We draft the questions, steps and scoring."],
              ["scratch", "plus", "Start from scratch", "A clean canvas. Drag in sections, columns and questions."],
            ] as const
          ).map(([mode, icon, title, text]) => (
            <button key={mode} type="button" onClick={() => setOpen(mode)} className="card group flex flex-col items-start gap-3 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md">
              <span className={`tile ${mode === "ai" ? "tile-violet" : ""}`} style={{ width: 40, height: 40, borderRadius: 12 }}>
                <Icon name={icon} size={18} />
              </span>
              <span className="text-[15px] font-semibold">{title}</span>
              <span className="text-[13px] leading-relaxed text-muted">{text}</span>
            </button>
          ))}
        </div>
        {open && <NewFormDialog accountId={accountId} initial={open} onClose={() => setOpen(null)} />}
      </>
    );
  return (
    <>
      <button type="button" onClick={() => setOpen("templates")} className="btn-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-[14px] font-semibold">
        <Icon name="plus" size={15} /> {label}
      </button>
      {open && <NewFormDialog accountId={accountId} initial={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function NewFormDialog({ accountId, initial, onClose }: { accountId: string; initial: Mode; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>(initial);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-ink/55 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="New form" className="flex h-full w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl sm:h-[min(860px,92vh)] sm:rounded-3xl">
        <div className="flex flex-none flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
          <div>
            <div className="text-[16px] font-semibold">New form</div>
            <div className="text-[12.5px] text-muted">Everything opens in Form Studio as a draft. Nothing goes live until you publish.</div>
          </div>
          <div className="ml-auto flex items-center gap-0.5 rounded-xl bg-surface p-1">
            {(
              [
                ["templates", "layout", "Templates"],
                ["ai", "spark", "Build with AI"],
                ["scratch", "plus", "From scratch"],
              ] as const
            ).map(([m, icon, text]) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold ${mode === m ? "bg-white text-brand shadow-sm" : "text-muted hover:text-navy"}`}>
                <Icon name={icon} size={14} /> {text}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="btn-ghost inline-flex h-9 w-9 items-center justify-center rounded-xl">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {mode === "templates" && <Templates />}
          {mode === "ai" && <AiBuilder accountId={accountId} />}
          {mode === "scratch" && <Scratch />}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Templates() {
  const built = useMemo(() => FORM_TEMPLATES.map((t) => ({ t, def: t.build() })), []);
  const cats = ["All", ...new Set(FORM_TEMPLATES.map((t) => t.category))];
  const [cat, setCat] = useState("All");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<{ t: FormTemplate; def: FormDefinition } | null>(null);

  if (picked)
    return (
      <div className="grid min-h-full lg:grid-cols-[1fr_340px]">
        <div className="overflow-auto p-4 sm:p-8" style={{ background: picked.def.theme.background }}>
          <div className="mx-auto" style={{ maxWidth: picked.def.theme.width }}>
            <div className={picked.def.theme.card ? "rounded-2xl p-6 shadow-sm sm:p-8" : ""} style={{ background: picked.def.theme.card ? (picked.def.theme.dark ? "#111827" : "#fff") : "transparent" }}>
              <LeadForm formId="preview" def={picked.def} preview />
            </div>
          </div>
        </div>
        <form action={createForm} className="flex flex-col gap-4 border-l border-line p-5">
          <button type="button" onClick={() => setPicked(null)} className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-muted hover:text-navy">
            <Icon name="arrowLeft" size={14} /> All templates
          </button>
          <div>
            <div className="text-[18px] font-semibold">{picked.t.name}</div>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{picked.t.blurb}</p>
            <div className="mt-2">
              <Summary def={picked.def} />
            </div>
          </div>
          <p className="rounded-xl bg-surface px-3.5 py-3 text-[12.5px] leading-relaxed text-muted">Try it on the left like a visitor would. You can change every question, colour and step once it opens.</p>
          <input type="hidden" name="template" value={picked.t.key} />
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Form name
            <input name="name" maxLength={80} defaultValue={picked.t.name} className="field h-11" />
          </label>
          <div>
            <SubmitButton>
              Use this template <Icon name="arrowRight" size={15} />
            </SubmitButton>
          </div>
        </form>
      </div>
    );

  const q = query.trim().toLowerCase();
  const shown = built.filter(({ t }) => (cat === "All" || t.category === cat) && (!q || `${t.name} ${t.blurb} ${t.category}`.toLowerCase().includes(q)));
  return (
    <div className="p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {cats.map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} className={`min-h-9 rounded-full px-3.5 text-[13px] font-semibold ${cat === c ? "bg-navy text-white" : "bg-surface text-muted hover:text-navy"}`}>
            {c}
          </button>
        ))}
        <label className="relative ml-auto">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <Icon name="search" size={14} />
          </span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search templates" className="field h-9 w-52 pl-8 text-[13px]" aria-label="Search templates" />
        </label>
      </div>
      {!shown.length ? (
        <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-[13.5px] text-muted">No templates match. Try Build with AI instead.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(({ t, def }) => (
            <div
              key={t.key}
              role="button"
              tabIndex={0}
              aria-label={`Preview ${t.name}`}
              onClick={() => setPicked({ t, def })}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setPicked({ t, def }))}
              className="group cursor-pointer overflow-hidden rounded-2xl border border-line bg-white text-left transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand">
              <div className="relative">
                <Thumb def={def} />
                <span className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent" />
              </div>
              <div className="flex items-start gap-3 p-4">
                <span className="mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg text-white" style={{ background: t.accent }}>
                  <Icon name={t.icon as IconName} size={15} />
                </span>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold">{t.name}</div>
                  <div className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted">{t.blurb}</div>
                  <div className="mt-1.5">
                    <Summary def={def} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Scratch() {
  const [start, setStart] = useState<"basic" | "empty">("basic");
  return (
    <form action={createForm} className="mx-auto flex max-w-xl flex-col gap-5 p-6 sm:p-10">
      <div>
        <div className="text-[18px] font-semibold">Start from scratch</div>
        <p className="mt-1 text-[13.5px] text-muted">Drag in sections of one to four columns, then drop questions, text and images where you want them.</p>
      </div>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        Form name
        <input name="name" maxLength={80} placeholder="e.g. Free AI audit" className="field h-11" autoFocus />
      </label>
      <input type="hidden" name="start" value={start} />
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["basic", "Name, email and phone", "The contact details most forms need, ready to build on."],
            ["empty", "Empty canvas", "Only an email question, so you can build it your way."],
          ] as const
        ).map(([key, title, text]) => (
          <button key={key} type="button" onClick={() => setStart(key)} className={`rounded-2xl border p-4 text-left transition ${start === key ? "border-brand bg-brand/5 ring-2 ring-brand/20" : "border-line hover:border-line-strong"}`}>
            <div className="text-[14px] font-semibold">{title}</div>
            <div className="mt-1 text-[12.5px] leading-relaxed text-muted">{text}</div>
          </button>
        ))}
      </div>
      <div>
        <SubmitButton>
          Open Form Studio <Icon name="arrowRight" size={15} />
        </SubmitButton>
      </div>
    </form>
  );
}

type Problem = { message: string; detail?: string };

async function functionError(error: unknown): Promise<Problem> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.text === "function") {
    try {
      const raw = await ctx.text();
      try {
        const body = JSON.parse(raw);
        if (body?.error) return { message: String(body.error), detail: body.detail ? String(body.detail) : undefined };
        if (body?.msg || body?.message) return { message: "Please sign out, sign in again, then try once more.", detail: `${ctx.status} ${body.msg ?? body.message}` };
      } catch {
        return { message: "We couldn't reach the AI just now. Please try again.", detail: `${ctx.status} ${raw.slice(0, 120)}` };
      }
    } catch {
      /* fall through */
    }
  }
  return { message: "We couldn't reach the AI just now. Please try again.", detail: error instanceof Error ? error.message : undefined };
}

function AiBuilder({ accountId }: { accountId: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [draft, setDraft] = useState<{ name: string; def: FormDefinition } | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  async function run() {
    const brief = text.trim();
    if (brief.length < 10) {
      setProblem({ message: "Describe the form in a sentence or two first." });
      return;
    }
    setProblem(null);
    setBusy(true);
    const { data, error } = await createClient().functions.invoke("ai-form", { body: { account_id: accountId, text: brief } });
    setBusy(false);
    if (error || !data?.draft) {
      setProblem(error ? await functionError(error) : { message: data?.error ?? "The AI did not return a form. Please try again." });
      return;
    }
    const d = data.draft as AiDraft;
    setDraft({ name: d.name, def: definitionFromDraft(d) });
  }

  if (busy)
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-10 text-center">
        <span className="tile tile-violet animate-pulse" style={{ width: 52, height: 52, borderRadius: 16 }}>
          <Icon name="spark" size={22} />
        </span>
        <div className="text-[16px] font-semibold">Drafting your form</div>
        <p className="max-w-sm text-[13.5px] text-muted">Choosing the questions, splitting it into steps and setting up scoring if you asked for it. This takes about 15 seconds.</p>
      </div>
    );

  if (draft)
    return (
      <div className="grid min-h-full lg:grid-cols-[1fr_340px]">
        <div className="overflow-auto p-4 sm:p-8" style={{ background: draft.def.theme.background }}>
          <div className="mx-auto" style={{ maxWidth: draft.def.theme.width }}>
            <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
              <LeadForm formId="preview" def={draft.def} preview />
            </div>
          </div>
        </div>
        <form action={createForm} className="flex flex-col gap-4 border-l border-line p-5">
          <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-violet-50 px-2.5 py-1 text-[12px] font-semibold text-violet-700">
            <Icon name="spark" size={12} /> AI draft
          </div>
          <div>
            <Summary def={draft.def} />
            <p className="mt-2 text-[13px] leading-relaxed text-muted">Try it on the left. Open it in Form Studio to change anything, or describe what to change and draft again.</p>
          </div>
          <input type="hidden" name="definition" value={JSON.stringify(draft.def)} />
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Form name
            <input name="name" maxLength={80} defaultValue={draft.name} className="field h-11" />
          </label>
          <SubmitButton>
            Open in Form Studio <Icon name="arrowRight" size={15} />
          </SubmitButton>
          <div className="mt-auto border-t border-line pt-4">
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setTimeout(() => area.current?.focus(), 0);
              }}
              className="btn-ghost inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold"
            >
              <Icon name="edit" size={14} /> Change the description
            </button>
          </div>
        </form>
      </div>
    );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 p-6 sm:p-10">
      <div>
        <div className="flex items-center gap-2 text-[18px] font-semibold">
          <Icon name="spark" size={18} /> Build with AI
        </div>
        <p className="mt-1 text-[13.5px] text-muted">Say who the form is for, what you need to know, and whether to score leads. The more you say, the better the draft.</p>
      </div>
      <textarea
        ref={area}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 6000))}
        onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && run()}
        rows={6}
        autoFocus
        placeholder="e.g. An application form for my 12-week coaching programme. Ask about their business, revenue and goals, and only send good fits to my booking page."
        className="field min-h-36 resize-y py-3 text-[14px] leading-relaxed"
        aria-label="Describe your form"
      />
      {problem && (
        <p className="rounded-xl border border-bad/30 bg-bad-bg px-4 py-3 text-[13px] text-bad">
          {problem.message}
          {problem.detail && <span className="mt-1 block text-[11.5px] opacity-70">{problem.detail}</span>}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={run} className="btn-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-[14px] font-semibold">
          <Icon name="spark" size={15} /> Draft my form
        </button>
        <span className="text-[12px] text-muted">Ctrl + Enter</span>
      </div>
      <div>
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">Try one of these</div>
        <div className="flex flex-col gap-2">
          {AI_EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => setText(ex)} className="rounded-xl border border-line px-3.5 py-2.5 text-left text-[13px] leading-relaxed text-navy/80 transition hover:border-brand/40 hover:bg-surface">
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
