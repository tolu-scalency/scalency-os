"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/icon";
import { createClient } from "@/lib/supabase/browser";

const errors: Record<string, string> = {
  link: "That login link has expired or was already used. Ask for a new one below.",
  setup: "Scalency OS isn't connected to its database yet. Add the Supabase settings to platform/.env.local, then restart the app.",
};

// Invite-only email login: Supabase emails a one-time link. No new accounts are created from this form.
export function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState(errors[params.get("error") ?? ""] ?? "");

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setMessage("");
    const next = params.get("next") ?? "/dashboard";
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setState("error");
      // Supabase says "Signups not allowed" when the email isn't invited. Say that plainly.
      setMessage(
        /signup|not allowed|not found/i.test(error.message)
          ? "That email isn't on the team yet. Ask the workspace owner to invite you."
          : error.message,
      );
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
        <button type="button" onClick={() => setState("idle")} className="w-fit text-sm font-semibold text-brand">Use a different email</button>
      </div>
    );
  }

  return (
    <form onSubmit={sendLink} className="flex flex-col gap-[18px]">
      {message && (
        <p role="alert" className="rounded-xl border border-[#d99600]/35 bg-warn-bg px-3.5 py-3 text-[13px] text-warn">{message}</p>
      )}
      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold">Work email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@scalency.co.uk"
          className="min-h-[50px] rounded-xl border border-line-strong px-3.5 text-[15px] outline-none focus:border-brand"
        />
      </label>
      <button
        type="submit"
        disabled={state === "sending"}
        className="btn-primary flex min-h-[50px] items-center justify-center gap-2 rounded-xl text-[15px] font-semibold disabled:opacity-70"
      >
        {state === "sending" ? "Sending…" : "Email me a login link"}
        <Icon name="arrowRight" size={16} />
      </button>
      <p className="text-[13px] leading-relaxed text-muted">Invite only. Ask your workspace owner to add you if you don&apos;t have access.</p>
    </form>
  );
}
