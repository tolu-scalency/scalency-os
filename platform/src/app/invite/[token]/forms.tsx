"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/components/password-input";
import type { ActionResult } from "@/lib/forms";
import { acceptInvite, createAccountAndJoin } from "./actions";

const button = "btn-primary flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold disabled:opacity-70";

function Problem({ state }: { state: ActionResult }) {
  return state.error ? <p role="alert" className="rounded-xl border border-bad/20 bg-bad-bg px-4 py-3 text-[13.5px] text-bad">{state.error}</p> : null;
}

export function JoinButton({ token, workspace }: { token: string; workspace: string }) {
  const [state, action, pending] = useActionState(acceptInvite, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <Problem state={state} />
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Joining…" : `Join ${workspace}`}
      </button>
    </form>
  );
}

export function CreateAccountForm({ token, email, workspace }: { token: string; email: string; workspace: string }) {
  const [state, action, pending] = useActionState(createAccountAndJoin, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Email</span>
        <input value={email} readOnly className="field h-12 bg-surface text-muted" aria-readonly />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Your name</span>
        <input name="full_name" required maxLength={120} autoComplete="name" placeholder="Jane Smith" className="field h-12" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Create a password</span>
        <PasswordInput name="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" className="field h-12" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Confirm password</span>
        <PasswordInput name="confirm" required minLength={8} autoComplete="new-password" className="field h-12" />
      </label>
      <Problem state={state} />
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Setting up…" : `Create login and join ${workspace}`}
      </button>
      <p className="text-center text-[12.5px] text-muted">Next time, log in with this email and password.</p>
    </form>
  );
}
