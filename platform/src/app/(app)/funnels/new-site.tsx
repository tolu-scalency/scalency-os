"use client";

// "New funnel" and "New website": pick a ready-made set of pages, see every page,
// name it and open its overview. Everything is a draft until it's published.

import { useEffect, useMemo, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { Icon, type IconName } from "@/components/icon";
import { PageView } from "@/components/page-view";
import { FUNNEL_TEMPLATES, WEBSITE_TEMPLATES, type SiteTemplate } from "@/lib/site-builder";
import { createSite } from "./actions";
import { Thumb } from "./new-page";

type Kind = "funnel" | "website";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-[14px] font-semibold disabled:opacity-60">
      {pending ? "Creating…" : children}
    </button>
  );
}

export function NewSiteButton({ kind, variant = "ghost" }: { kind: Kind; variant?: "ghost" | "primary" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${variant === "primary" ? "btn-primary" : "btn-ghost"} inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-[14px] font-semibold`}
      >
        <Icon name={kind === "funnel" ? "zap" : "layout"} size={15} /> New {kind}
      </button>
      {open && <Dialog kind={kind} onClose={() => setOpen(false)} />}
    </>
  );
}

function Dialog({ kind, onClose }: { kind: Kind; onClose: () => void }) {
  const list = kind === "funnel" ? FUNNEL_TEMPLATES : WEBSITE_TEMPLATES;
  const built = useMemo(() => list.map((t) => ({ t, plan: t.build() })), [list]);
  const [picked, setPicked] = useState<{ t: SiteTemplate; plan: ReturnType<SiteTemplate["build"]> } | null>(null);
  const [step, setStep] = useState(0);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
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
  const word = kind === "funnel" ? "step" : "page";

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-ink/55 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={`New ${kind}`} className="flex h-full w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl sm:h-[min(880px,92vh)] sm:rounded-3xl">
        <div className="flex flex-none items-center gap-3 border-b border-line px-5 py-3.5">
          <div>
            <div className="text-[16px] font-semibold">New {kind}</div>
            <div className="text-[12.5px] text-muted">
              {kind === "funnel" ? "Pages in steps: people move from one to the next. " : "Several pages with a shared header, menu and footer. "}
              Nothing goes live until you publish.
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="btn-ghost ml-auto inline-flex h-9 w-9 items-center justify-center rounded-xl">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {picked ? (
            <div className="grid min-h-full lg:grid-cols-[1fr_320px]">
              <div className="flex flex-col gap-3 overflow-auto bg-surface p-3 sm:p-5">
                <div className="flex flex-wrap gap-1.5">
                  {picked.plan.steps.map((s, i) => (
                    <button key={i} type="button" onClick={() => setStep(i)} className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold ${step === i ? "bg-navy text-white" : "bg-white text-muted ring-1 ring-line hover:text-navy"}`}>
                      {kind === "funnel" && <span className="opacity-70">{i + 1}.</span>} {s.name}
                    </button>
                  ))}
                </div>
                <div className="mx-auto w-full overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-line" style={{ maxWidth: device === "mobile" ? 390 : "100%" }}>
                  <PageView def={picked.plan.steps[step].def} sample header={picked.plan.settings?.header} footer={picked.plan.settings?.footer} />
                </div>
              </div>
              <form action={createSite} className="flex flex-col gap-4 border-l border-line p-5">
                <button type="button" onClick={() => setPicked(null)} className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-muted hover:text-navy">
                  <Icon name="arrowLeft" size={14} /> All {kind}s
                </button>
                <div>
                  <div className="text-[18px] font-semibold">{picked.t.name}</div>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{picked.t.blurb}</p>
                </div>
                <ol className="flex flex-col gap-1.5 text-[13px]">
                  {picked.plan.steps.map((s, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-surface text-[11.5px] font-bold text-muted">{i + 1}</span>
                      {s.name}
                    </li>
                  ))}
                </ol>
                <div className="flex gap-1 rounded-xl bg-surface p-1 text-[12.5px] font-semibold">
                  {(["desktop", "mobile"] as const).map((d) => (
                    <button key={d} type="button" onClick={() => setDevice(d)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 ${device === d ? "bg-white text-brand shadow-sm" : "text-muted"}`}>
                      <Icon name={d === "desktop" ? "monitor" : "smartphone"} size={13} /> {d === "desktop" ? "Desktop" : "Mobile"}
                    </button>
                  ))}
                </div>
                <p className="rounded-xl bg-surface px-3.5 py-3 text-[12.5px] leading-relaxed text-muted">
                  {kind === "funnel"
                    ? "Forms on each step send people to the next one. Choose your form in each form block once it opens."
                    : "The menu lists your pages by itself. Add, rename and reorder pages from the overview."}
                </p>
                <input type="hidden" name="kind" value={kind} />
                <input type="hidden" name="template" value={picked.t.key} />
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                  {kind === "funnel" ? "Funnel" : "Website"} name
                  <input name="name" maxLength={100} defaultValue={picked.t.name} className="field h-11" />
                </label>
                <div>
                  <Submit>
                    Create {kind} <Icon name="arrowRight" size={15} />
                  </Submit>
                </div>
              </form>
            </div>
          ) : (
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {built.map(({ t, plan }) => (
                <div
                  key={t.key}
                  role="button"
                  tabIndex={0}
                  aria-label={`Preview ${t.name}`}
                  onClick={() => {
                    setPicked({ t, plan });
                    setStep(0);
                  }}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setPicked({ t, plan }), setStep(0))}
                  className="group cursor-pointer overflow-hidden rounded-2xl border border-line bg-white text-left transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <div className="relative border-b border-line">
                    <Thumb def={{ ...plan.steps[0].def, sections: [...(plan.settings?.header ?? []), ...plan.steps[0].def.sections] }} />
                    <span className="absolute right-2 top-2 rounded-full bg-navy/85 px-2.5 py-1 text-[11.5px] font-semibold text-white">
                      {plan.steps.length} {word}s
                    </span>
                  </div>
                  <div className="flex items-start gap-3 p-4">
                    <span className="mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg text-white" style={{ background: t.accent }}>
                      <Icon name={t.icon as IconName} size={15} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[14.5px] font-semibold">{t.name}</div>
                      <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{t.blurb}</div>
                      <div className="mt-1.5 truncate text-[11.5px] text-faint">{plan.steps.map((s) => s.name).join(" → ")}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
