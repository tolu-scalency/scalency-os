"use client";

import { useActionState, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { finishOnboarding, type OnboardingState } from "./actions";
import { GOALS, HEARD_FROM, INDUSTRIES, MONTHLY_LEADS, ROLES, TEAM_SIZES } from "./options";

const STEPS: { title: string; text: string; icon: IconName }[] = [
  { title: "About you", text: "So your team knows who's who.", icon: "user" },
  { title: "Your business", text: "We'll name your workspace after it.", icon: "building" },
  { title: "Your goals", text: "So we can point you to the right place first.", icon: "spark" },
];

const goalIcons: IconName[] = ["form", "zap", "calendar", "hash", "spark", "chart"];

// Three short steps after sign-up. All fields stay in one form; only the current step is shown.
// The form uses noValidate because the browser would otherwise refuse to move on while
// required fields on later (hidden) steps are still empty. Each step is checked by stepIsValid().
export function WelcomeForm({ defaultName, email }: { defaultName: string; email: string }) {
  const [step, setStep] = useState(0);
  const [hint, setHint] = useState("");
  const [state, action, pending] = useActionState<OnboardingState, FormData>(finishOnboarding, {});
  const steps = useRef<(HTMLFieldSetElement | null)[]>([]);
  const last = STEPS.length - 1;

  function stepIsValid() {
    const box = steps.current[step];
    if (!box) return true;
    for (const el of Array.from(box.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select"))) {
      if (!el.checkValidity()) {
        // Show our own message next to the form (the browser's bubble can't point at the tap-to-choose buttons).
        const label = el.closest<HTMLElement>("[data-label]")?.dataset.label ?? "this field";
        setHint(el.validity.valueMissing ? `Please fill in: ${label}.` : `Please check: ${label}.`);
        el.focus();
        return false;
      }
    }
    if (step === 2 && !box.querySelector<HTMLInputElement>('input[name="goals"]:checked')) {
      setHint("Choose at least one.");
      return false;
    }
    setHint("");
    return true;
  }

  return (
    <form
      action={action}
      noValidate
      onSubmit={(e) => {
        if (step < last) {
          e.preventDefault();
          if (stepIsValid()) setStep(step + 1);
        } else if (!stepIsValid()) {
          e.preventDefault();
        }
      }}
      className="rise flex flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-[var(--shadow-pop)]"
    >
      <div className="flex items-center gap-2 border-b border-line px-6 py-4 sm:px-8">
        {STEPS.map((s, i) => (
          <div key={s.title} className="flex flex-1 items-center gap-2">
            <span
              className={`inline-flex h-7 w-7 flex-none items-center justify-center rounded-full text-[12px] font-semibold transition-colors ${
                i < step ? "bg-ok text-white" : i === step ? "bg-[linear-gradient(135deg,#29b0f8,#0a5fe3)] text-white" : "bg-surface text-faint"
              }`}
            >
              {i < step ? <Icon name="check" size={13} strokeWidth={3} /> : i + 1}
            </span>
            <span className={`hidden text-[13px] sm:block ${i === step ? "font-semibold text-navy" : "text-faint"}`}>{s.title}</span>
            {i < last && <span className={`h-px flex-1 ${i < step ? "bg-ok" : "bg-line"}`} />}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-6 px-6 py-7 sm:px-8">
        <div className="flex items-center gap-3.5">
          <span className="tile h-11 w-11 rounded-[14px]">
            <Icon name={STEPS[step].icon} size={20} />
          </span>
          <div>
            <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.03em]">{STEPS[step].title}</h1>
            <p className="text-[14px] text-muted">{STEPS[step].text}</p>
          </div>
        </div>

        {(state.error || hint) && (
          <p role="alert" className="rounded-xl border border-bad/20 bg-bad-bg px-3.5 py-2.5 text-[13px] text-bad">
            {state.error || hint}
          </p>
        )}

        <fieldset ref={(el) => { steps.current[0] = el; }} hidden={step !== 0} className="flex flex-col gap-4">
          <Field label="Full name">
            <input name="full_name" required maxLength={120} defaultValue={defaultName} autoComplete="name" className="field h-12" />
          </Field>
          <Field label="Your role">
            <Chips name="role" options={ROLES} required />
          </Field>
          <Field label="Mobile number" optional>
            <input name="phone" type="tel" autoComplete="tel" placeholder="07700 900123" className="field h-12" />
          </Field>
          <p className="text-[13px] text-muted">Signed in as <strong className="font-medium text-navy">{email}</strong></p>
        </fieldset>

        <fieldset ref={(el) => { steps.current[1] = el; }} hidden={step !== 1} className="flex flex-col gap-4">
          <Field label="Business name">
            <input name="business_name" required minLength={2} maxLength={80} autoComplete="organization" placeholder="Acme Clinics" className="field h-12" />
          </Field>
          <Field label="Website" optional>
            <input name="website" autoComplete="url" placeholder="acme.co.uk" className="field h-12" />
          </Field>
          <Field label="Industry">
            <select name="industry" required defaultValue="" className="field h-12">
              <option value="" disabled>Choose…</option>
              {INDUSTRIES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Team size">
            <Chips name="team_size" options={TEAM_SIZES} required />
          </Field>
        </fieldset>

        <fieldset ref={(el) => { steps.current[2] = el; }} hidden={step !== 2} className="flex flex-col gap-5">
          <Field label="What do you want help with?">
            <div className="grid gap-2 sm:grid-cols-2">
              {GOALS.map((g, i) => (
                <label
                  key={g}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-line-strong px-3.5 py-3 text-[13.5px] transition-colors hover:border-sky has-[:checked]:border-brand has-[:checked]:bg-chip has-[:checked]:text-brand"
                >
                  <input type="checkbox" name="goals" value={g} className="sr-only" />
                  <Icon name={goalIcons[i] ?? "check"} size={17} />
                  {g}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Leads each month">
            <Chips name="monthly_leads" options={MONTHLY_LEADS} required />
          </Field>
          <Field label="How did you hear about us?" optional>
            <Chips name="heard_from" options={HEARD_FROM} />
          </Field>
        </fieldset>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line bg-surface/60 px-6 py-4 sm:px-8">
        {step > 0 ? (
          <button type="button" onClick={() => { setHint(""); setStep(step - 1); }} className="inline-flex items-center gap-2 text-[14px] font-semibold text-muted hover:text-navy">
            <Icon name="arrowLeft" size={16} /> Back
          </button>
        ) : (
          <span className="text-[13px] text-faint">Takes about a minute</span>
        )}
        <button type="submit" disabled={pending} className="btn-primary inline-flex min-h-12 items-center gap-2 rounded-xl px-6 text-[15px] font-semibold disabled:opacity-70">
          {step < last ? "Continue" : pending ? "Creating your workspace…" : "Create my workspace"}
          <Icon name="arrowRight" size={16} />
        </button>
      </div>
    </form>
  );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div data-label={label} className="flex flex-col gap-2">
      <span className="text-[13.5px] font-semibold">
        {label} {optional && <span className="font-normal text-faint">(optional)</span>}
      </span>
      {children}
    </div>
  );
}

/** One-tap choices instead of a dropdown. */
function Chips({ name, options, required }: { name: string; options: readonly string[]; required?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o, i) => (
        <label
          key={o}
          className="cursor-pointer rounded-full border border-line-strong px-3.5 py-2 text-[13.5px] transition-colors hover:border-sky has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:text-white"
        >
          <input type="radio" name={name} value={o} required={required && i === 0} className="sr-only" />
          {o}
        </label>
      ))}
    </div>
  );
}
