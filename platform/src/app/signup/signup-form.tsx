"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { Notice, inputClass } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/browser";

// Step 1 of joining: name, email and password. The next steps (about you, your business,
// your goals) are on /welcome, straight after this.
export function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [state, setState] = useState<"idle" | "busy" | "confirm">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) {
      setMessage("Use at least 8 characters for your password.");
      return;
    }
    setState("busy");
    setMessage("");
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: { full_name: form.fullName.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/welcome`,
      },
    });
    if (error) {
      setState("idle");
      setMessage(
        /already registered|already exists/i.test(error.message)
          ? "There's already an account with that email. Log in instead."
          : /rate limit/i.test(error.message)
            ? "We can't send more emails right now. Please try again in an hour."
            : error.message,
      );
      return;
    }
    // Supabase hides whether an email is taken: it returns a user with no identities instead of an error.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setState("idle");
      setMessage("There's already an account with that email. Log in instead, with your password or an email link.");
      return;
    }
    // With email confirmation on, Supabase returns no session until the email link is opened.
    if (!data.session) {
      setState("confirm");
      return;
    }
    router.replace("/welcome");
    router.refresh();
  }

  if (state === "confirm") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6">
        <span className="tile h-10 w-10 rounded-xl"><Icon name="mail" size={18} /></span>
        <h2 className="text-lg font-semibold">Confirm your email</h2>
        <p className="text-sm text-muted">
          We sent a link to <strong className="text-navy">{form.email}</strong>. Open it on this device to finish setting up your workspace.
        </p>
      </div>
    );
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={submit} className="flex flex-col gap-[18px]">
      {message && <Notice>{message}</Notice>}
      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold">Full name</span>
        <input required autoComplete="name" maxLength={120} value={form.fullName} onChange={set("fullName")} placeholder="Alex Morgan" className={inputClass} />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold">Work email</span>
        <input type="email" required autoComplete="email" value={form.email} onChange={set("email")} placeholder="you@company.co.uk" className={inputClass} />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold">Password</span>
        <input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set("password")} placeholder="At least 8 characters" className={inputClass} />
      </label>
      <button type="submit" disabled={state === "busy"} className="btn-primary flex min-h-[50px] items-center justify-center gap-2 rounded-xl text-[15px] font-semibold disabled:opacity-70">
        {state === "busy" ? "Creating your account…" : "Create account"}
        <Icon name="arrowRight" size={16} />
      </button>
      <p className="text-[13px] leading-relaxed text-muted">
        Your workspace starts in test mode, so no message reaches a real lead until you switch it off.
      </p>
      <p className="border-t border-line pt-4 text-sm text-muted">
        Already have an account? <Link href="/login" className="font-semibold text-brand">Log in</Link>
      </p>
    </form>
  );
}
