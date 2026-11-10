"use client";

import { useActionState, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { Notice, inputClass } from "@/components/auth-shell";
import { finishOnboarding, type OnboardingState } from "./actions";
import { GOALS, HEARD_FROM, INDUSTRIES, MONTHLY_LEADS, ROLES, TEAM_SIZES } from "./options";

const STEPS = [
  { title: "About you", text: "So your team knows who's who." },
  { title: "Your business", text: "We set up your workspace around it." },
  { title: "Your goals", text: "So we can show you the right things first." },
];

// Three short steps after sign-up. All fields stay in one form; only the current step is shown.
export function WelcomeForm({ defaultName, email }: { defaultName: string; email: string }) {
  const [step, setStep] = useState(0);
  const [hint, setHint] = useState("");
  const [state, action, pending] = useActionState<OnboardingState, FormData>(finishOnboarding, {});
  const steps = useRef<(HTMLFieldSetElement | null)[]>([]);

  // Check the fields on the current step before moving on.
  function stepIsValid() {
    const box = steps.current[step];
    if (!box) return true;
    for (const el of Array.from(box.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select"))) {
      if (!el.checkValidity()) {
        el.reportValidity();
        return false;
      }
    }
    if (step === 2 && !box.querySelector<HTMLInputElement>('input[name="goals"]:checked')) {
      setHint("Choose at least one goal.");
      return false;
    }
    setHint("");
    return true;
  }

  function next() {
    if (stepIsValid()) setStep(step + 1);
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (step < STEPS.length - 1 || !stepIsValid()) {
          e.preventDefault();
          if (step < STEPS.length - 1) next();
        }
      }}
      className="card flex flex-col gap-6 p-6 sm:p-8"
    >
      <div>
        <div className="eyebrow">STEP {step + 1} OF {STEPS.length}</div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {STEPS.map((s, i) => (
            <span key={s.title} className={`h-1.5 rounded-full ${i <= step ? "bg-brand" : "bg-line"}`} />
          ))}
        </div>
        <h1 className="mt-5 text-[28px] font-semibold tracking-[-0.03em]">{STEPS[step].title}</h1>
        <p className="mt-1 text-[15px] text-muted">{STEPS[step].text}</p>
      </div>

      {(state.error || hint) && <Notice>{state.error || hint}</Notice>}

      <fieldset ref={(el) => { steps.current[0] = el; }} hidden={step !== 0} className="flex flex-col gap-4">
        <Field label="Full name">
          <input name="full_name" required maxLength={120} defaultValue={defaultName} autoComplete="name" className={inputClass} />
        </Field>
        <Field label="Your role">
          <Select name="role" options={ROLES} required />
        </Field>
        <Field label="Mobile number" optional>
          <input name="phone" type="tel" autoComplete="tel" placeholder="07700 900123" className={inputClass} />
        </Field>
        <p className="text-[13px] text-muted">Logged in as <strong className="text-navy">{email}</strong></p>
      </fieldset>

      <fieldset ref={(el) => { steps.current[1] = el; }} hidden={step !== 1} className="flex flex-col gap-4">
        <Field label="Business name">
          <input name="business_name" required minLength={2} maxLength={80} autoComplete="organization" className={inputClass} />
        </Field>
        <Field label="Website" optional>
          <input name="website" autoComplete="url" placeholder="yourbusiness.co.uk" className={inputClass} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Industry">
            <Select name="industry" options={INDUSTRIES} required />
          </Field>
          <Field label="Team size">
            <Select name="team_size" options={TEAM_SIZES} required />
          </Field>
        </div>
      </fieldset>

      <fieldset ref={(el) => { steps.current[2] = el; }} hidden={step !== 2} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold">What do you want Scalency OS to help with?</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {GOALS.map((g) => (
              <label key={g} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line-strong px-3.5 py-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-chip">
                <input type="checkbox" name="goals" value={g} className="h-4 w-4 accent-[#0465c7]" />
                {g}
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Leads each month">
            <Select name="monthly_leads" options={MONTHLY_LEADS} required />
          </Field>
          <Field label="How did you hear about us?" optional>
            <Select name="heard_from" options={HEARD_FROM} />
          </Field>
        </div>
      </fieldset>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-5">
        {step > 0 ? (
          <button type="button" onClick={() => { setHint(""); setStep(step - 1); }} className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-navy">
            <Icon name="arrowLeft" size={16} /> Back
          </button>
        ) : <span />}
        <button type="submit" disabled={pending} className="btn-primary inline-flex min-h-[48px] items-center gap-2 rounded-xl px-5 text-[15px] font-semibold disabled:opacity-70">
          {step < STEPS.length - 1 ? "Continue" : pending ? "Creating your workspace…" : "Create my workspace"}
          <Icon name="arrowRight" size={16} />
        </button>
      </div>
    </form>
  );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </span>
      {children}
    </label>
  );
}

function Select({ name, options, required }: { name: string; options: readonly string[]; required?: boolean }) {
  return (
    <select name={name} required={required} defaultValue="" className={inputClass}>
      <option value="" disabled>Choose…</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
