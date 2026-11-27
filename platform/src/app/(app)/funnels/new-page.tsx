"use client";

// The "New page" dialog: a template, a blank page, or a draft from the AI.
// Everything opens in Page Studio as a draft.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { Icon, type IconName } from "@/components/icon";
import { PageView } from "@/components/page-view";
import type { PageDefinition } from "@/lib/page-builder";
import { PAGE_TEMPLATES, pageFromDraft, type AiPageDraft, type PageTemplate } from "@/lib/page-templates";
import { createClient } from "@/lib/supabase/browser";
import { createPage } from "./actions";

type Mode = "templates" | "ai" | "scratch";
type FormOption = { id: string; name: string };

const AI_EXAMPLES = [
  "A landing page for a Manchester aesthetics clinic offering a free consultation for anti-wrinkle treatment. Warm, trustworthy, with prices from £180.",
  "A page for a builder in Liverpool getting quote requests for kitchen extensions, with reviews and a 10-year guarantee.",
  "A registration page for a free live webinar on getting more clients with automation, next Thursday at 7pm.",
  "A sales page for a 12-week coaching programme for small business owners, with three price options and a money-back guarantee.",
];

function Submit({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className="btn-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-[14px] font-semibold disabled:opacity-60">
      {pending ? "Opening Page Studio…" : children}
    </button>
  );
}

/** A live, scaled-down, non-clickable picture of a page. */
export function Thumb({ def, height = 220 }: { def: PageDefinition; height?: number }) {
  const scale = 0.3;
  return (
    <div className="pointer-events-none relative overflow-hidden" style={{ height, background: def.theme.background }} aria-hidden inert>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: `${100 / scale}%`, transform: `scale(${scale})` }}>
        <PageView def={def} sample />
      </div>
    </div>
  );
}

export function NewPageButton({ accountId, forms, big = false }: { accountId: string; forms: FormOption[]; big?: boolean }) {
  const [open, setOpen] = useState<Mode | null>(null);
  return (
    <>
      {big ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["templates", "layout", "Start from a template", "Pages for clinics, dentists, builders, estate agents, coaches, webinars and more."],
              ["ai", "spark", "Build with AI", "Describe the business and the offer. We draft the whole page for you to edit."],
              ["scratch", "plus", "Start from scratch", "A blank page. Drag in ready-made sections or build your own."],
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
      ) : (
        <button type="button" onClick={() => setOpen("templates")} className="btn-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-[14px] font-semibold">
          <Icon name="plus" size={15} /> New page
        </button>
      )}
      {open && <Dialog accountId={accountId} forms={forms} initial={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function Dialog({ accountId, forms, initial, onClose }: { accountId: string; forms: FormOption[]; initial: Mode; onClose: () => void }) {
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
      <div role="dialog" aria-modal="true" aria-label="New page" className="flex h-full w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl sm:h-[min(880px,92vh)] sm:rounded-xl">
        <div className="flex flex-none flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
          <div>
            <div className="text-[16px] font-semibold">New page</div>
            <div className="text-[12.5px] text-muted">It opens in Page Studio as a draft. Nothing goes live until you publish.</div>
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
          {mode === "ai" && <AiBuilder accountId={accountId} forms={forms} />}
          {mode === "scratch" && <Scratch />}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Templates() {
  const built = useMemo(() => PAGE_TEMPLATES.map((t) => ({ t, def: t.build() })), []);
  const cats = ["All", ...new Set(PAGE_TEMPLATES.map((t) => t.category))];
  const [cat, setCat] = useState("All");
  const [picked, setPicked] = useState<{ t: PageTemplate; def: PageDefinition } | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  if (picked)
    return (
      <div className="grid min-h-full lg:grid-cols-[1fr_320px]">
        <div className="overflow-auto bg-surface p-3 sm:p-5">
          <div className="mx-auto overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-line" style={{ maxWidth: device === "mobile" ? 390 : "100%" }}>
            <PageView def={picked.def} sample />
          </div>
        </div>
        <form action={createPage} className="flex flex-col gap-4 border-l border-line p-5">
          <button type="button" onClick={() => setPicked(null)} className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-muted hover:text-navy">
            <Icon name="arrowLeft" size={14} /> All templates
          </button>
          <div>
            <div className="text-[18px] font-semibold">{picked.t.name}</div>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{picked.t.blurb}</p>
            <p className="mt-2 text-[12px] text-muted">{picked.def.sections.length} sections</p>
          </div>
          <div className="flex gap-1 rounded-xl bg-surface p-1 text-[12.5px] font-semibold">
            {(["desktop", "mobile"] as const).map((d) => (
              <button key={d} type="button" onClick={() => setDevice(d)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 ${device === d ? "bg-white text-brand shadow-sm" : "text-muted"}`}>
                <Icon name={d === "desktop" ? "monitor" : "smartphone"} size={13} /> {d === "desktop" ? "Desktop" : "Mobile"}
              </button>
            ))}
          </div>
          <p className="rounded-xl bg-surface px-3.5 py-3 text-[12.5px] leading-relaxed text-muted">Change any words, pictures, colours and sections once it opens. Choose which form to use in each form block.</p>
          <input type="hidden" name="template" value={picked.t.key} />
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Page name
            <input name="name" maxLength={100} defaultValue={picked.t.name} className="field h-11" />
          </label>
          <div>
            <Submit>
              Use this template <Icon name="arrowRight" size={15} />
            </Submit>
          </div>
        </form>
      </div>
    );

  const shown = built.filter(({ t }) => cat === "All" || t.category === cat);
  return (
    <div className="p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {cats.map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} className={`min-h-9 rounded-full px-3.5 text-[13px] font-semibold ${cat === c ? "bg-navy text-white" : "bg-surface text-muted hover:text-navy"}`}>
            {c}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map(({ t, def }) => (
          <div
            key={t.key}
            role="button"
            tabIndex={0}
            aria-label={`Preview ${t.name}`}
            onClick={() => setPicked({ t, def })}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setPicked({ t, def }))}
            className="group cursor-pointer overflow-hidden rounded-xl border border-line bg-white text-left transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand"
          >
            <div className="relative border-b border-line">
              <Thumb def={def} />
            </div>
            <div className="flex items-start gap-3 p-4">
              <span className="mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg text-white" style={{ background: t.accent }}>
                <Icon name={t.icon as IconName} size={15} />
              </span>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold">{t.name}</div>
                <div className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted">{t.blurb}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Scratch() {
  return (
    <form action={createPage} className="mx-auto flex max-w-xl flex-col gap-5 p-6 sm:p-10">
      <div>
        <div className="text-[18px] font-semibold">Start from scratch</div>
        <p className="mt-1 text-[13.5px] text-muted">You get one simple section to start. Drag in ready-made sections, or build your own from rows, columns and blocks.</p>
      </div>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        Page name
        <input name="name" maxLength={100} placeholder="e.g. Summer offer" className="field h-11" autoFocus />
      </label>
      <div>
        <Submit>
          Open Page Studio <Icon name="arrowRight" size={15} />
        </Submit>
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
      } catch {
        return { message: "We couldn't reach the AI just now. Please try again.", detail: `${ctx.status} ${raw.slice(0, 120)}` };
      }
    } catch {
      /* fall through */
    }
  }
  return { message: "We couldn't reach the AI just now. Please try again." };
}

function AiBuilder({ accountId, forms }: { accountId: string; forms: FormOption[] }) {
  const [text, setText] = useState("");
  const [formId, setFormId] = useState(forms[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [draft, setDraft] = useState<{ name: string; def: PageDefinition } | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const area = useRef<HTMLTextAreaElement>(null);

  async function run() {
    const brief = text.trim();
    if (brief.length < 15) {
      setProblem({ message: "Describe the business and the offer in a sentence or two first." });
      return;
    }
    setProblem(null);
    setBusy(true);
    const { data, error } = await createClient().functions.invoke("ai-page", { body: { account_id: accountId, text: brief } });
    setBusy(false);
    if (error || !data?.draft) {
      setProblem(error ? await functionError(error) : { message: data?.error ?? "The AI did not return a page. Please try again." });
      return;
    }
    const d = data.draft as AiPageDraft;
    setDraft({ name: d.name, def: pageFromDraft(d, formId) });
  }

  if (busy)
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="tile tile-violet animate-pulse" style={{ width: 52, height: 52, borderRadius: 16 }}>
          <Icon name="spark" size={22} />
        </span>
        <div className="text-[16px] font-semibold">Drafting your page</div>
        <p className="max-w-sm text-[13.5px] text-muted">Writing the headline, choosing the sections and filling in the words. This takes about 20 seconds.</p>
      </div>
    );

  if (draft)
    return (
      <div className="grid min-h-full lg:grid-cols-[1fr_320px]">
        <div className="overflow-auto bg-surface p-3 sm:p-5">
          <div className="mx-auto overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-line" style={{ maxWidth: device === "mobile" ? 390 : "100%" }}>
            <PageView def={draft.def} sample={!draft.def.sections.some((x) => x.rows.some((r) => r.columns.some((c) => c.blocks.some((bl) => bl.kind === "form" && bl.formId))))} />
          </div>
        </div>
        <form action={createPage} className="flex flex-col gap-4 border-l border-line p-5">
          <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-violet-50 px-2.5 py-1 text-[12px] font-semibold text-violet-700">
            <Icon name="spark" size={12} /> AI draft
          </div>
          <div className="flex gap-1 rounded-xl bg-surface p-1 text-[12.5px] font-semibold">
            {(["desktop", "mobile"] as const).map((d) => (
              <button key={d} type="button" onClick={() => setDevice(d)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 ${device === d ? "bg-white text-brand shadow-sm" : "text-muted"}`}>
                <Icon name={d === "desktop" ? "monitor" : "smartphone"} size={13} /> {d === "desktop" ? "Desktop" : "Mobile"}
              </button>
            ))}
          </div>
          <p className="text-[13px] leading-relaxed text-muted">Check the words and add your own pictures in Page Studio. Prices and claims are examples, so make sure they&apos;re right before publishing.</p>
          <input type="hidden" name="definition" value={JSON.stringify(draft.def)} />
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Page name
            <input name="name" maxLength={100} defaultValue={draft.name} className="field h-11" />
          </label>
          <Submit>
            Open in Page Studio <Icon name="arrowRight" size={15} />
          </Submit>
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
        <p className="mt-1 text-[13.5px] text-muted">Say what the business does, where, who it&apos;s for and what the page should get people to do.</p>
      </div>
      <textarea
        ref={area}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 6000))}
        onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && run()}
        rows={6}
        autoFocus
        placeholder="e.g. A landing page for a dental practice in Leeds offering a £49 new patient check-up. Friendly and modern, with reviews and a booking form."
        className="field min-h-36 resize-y py-3 text-[14px] leading-relaxed"
        aria-label="Describe your page"
      />
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        Form to use on the page
        <select value={formId} onChange={(e) => setFormId(e.target.value)} className="field h-11">
          <option value="">{forms.length ? "None for now" : "No live forms yet (add one later)"}</option>
          {forms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      {problem && (
        <p className="rounded-xl border border-bad/30 bg-bad-bg px-4 py-3 text-[13px] text-bad">
          {problem.message}
          {problem.detail && <span className="mt-1 block text-[11.5px] opacity-70">{problem.detail}</span>}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={run} className="btn-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-[14px] font-semibold">
          <Icon name="spark" size={15} /> Draft my page
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
