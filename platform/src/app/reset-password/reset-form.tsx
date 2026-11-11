"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { Notice, inputClass } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/browser";

// Opened from the password reset email (the link signs the person in first).
export function ResetForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setMessage("Use at least 8 characters.");
    setBusy(true);
    setMessage("");
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setBusy(false);
      setMessage(/same/i.test(error.message) ? "That's your current password. Choose a different one." : "We couldn't save it. Open the link from your email again.");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-[18px]">
      {message && <Notice>{message}</Notice>}
      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold">New password</span>
        <span className="relative">
          <input type={show ? "text" : "password"} required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} w-full pr-16`} />
          <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-brand">
            {show ? "Hide" : "Show"}
          </button>
        </span>
      </label>
      <button type="submit" disabled={busy} className="btn-primary flex min-h-[50px] items-center justify-center gap-2 rounded-xl text-[15px] font-semibold disabled:opacity-70">
        {busy ? "Saving…" : "Save and continue"} <Icon name="arrowRight" size={16} />
      </button>
    </form>
  );
}
