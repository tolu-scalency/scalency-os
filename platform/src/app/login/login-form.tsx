"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { Notice, inputClass } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/browser";

const errors: Record<string, string> = {
  link: "That login link has expired or was already used. Log in with your password, or ask for a new link.",
  setup: "Scalency OS isn't connected to its database yet. Add the Supabase settings in Netlify, then redeploy.",
};

function plain(message: string) {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match. Check them and try again.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email first. Open the link we sent when you signed up.";
  if (/rate limit/i.test(message)) return "Too many emails were sent in the last hour. Log in with your password, or try the link again later.";
  if (/signup|not allowed|not found/i.test(message)) return "There's no account with that email yet. Create one below.";
  return message;
}

// Log in with email and password, or ask for a one-time login link by email.
export function LoginForm() {
  const router = useRouter();
  const [next, setNext] = useState("/dashboard");
  const [mode, setMode] = useState<"password" | "link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [message, setMessage] = useState("");

  // Read ?next= and ?error= after the page shows, so the form appears straight away instead of a blank box.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNext(safeNext(params.get("next")));
    const error = errors[params.get("error") ?? ""];
    if (error) setMessage(error);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setMessage("");
    const supabase = createClient();
    if (mode === "password") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setState("idle");
        setMessage(plain(error.message));
        return;
      }
      router.replace(next);
      router.refresh();
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setState("idle");
      setMessage(plain(error.message));
      return;
    }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6">
        <span className="tile h-10 w-10 rounded-xl"><Icon name="mail" size={18} /></span>
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="text-sm text-muted">
          We sent a login link to <strong className="text-navy">{email}</strong>. Open it on this device. It works once and expires after an hour.
        </p>
        <button type="button" onClick={() => setState("idle")} className="w-fit text-sm font-semibold text-brand">Back to log in</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-[18px]">
      {message && <Notice>{message}</Notice>}
      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold">Email</span>
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.co.uk" className={inputClass} />
      </label>
      {mode === "password" && (
        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold">Password</span>
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </label>
      )}
      <button type="submit" disabled={state === "busy"} className="btn-primary flex min-h-[50px] items-center justify-center gap-2 rounded-xl text-[15px] font-semibold disabled:opacity-70">
        {state === "busy" ? "Please wait…" : mode === "password" ? "Log in" : "Email me a login link"}
        <Icon name="arrowRight" size={16} />
      </button>
      <button type="button" onClick={() => { setMode(mode === "password" ? "link" : "password"); setMessage(""); }} className="w-fit text-sm font-semibold text-brand">
        {mode === "password" ? "Email me a login link instead" : "Log in with a password instead"}
      </button>
      <p className="border-t border-line pt-4 text-sm text-muted">
        New to Scalency OS? <Link href="/signup" className="font-semibold text-brand">Create an account</Link>
      </p>
    </form>
  );
}

/** Only allow redirects inside the app, never to another site. */
function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}
