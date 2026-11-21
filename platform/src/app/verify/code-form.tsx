"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendLoginCode, verifyLoginCode } from "./actions";

export function CodeForm({ next }: { next: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(verifyLoginCode, {});
  const [code, setCode] = useState("");
  const [note, setNote] = useState<{ ok?: string; error?: string }>({});
  const [wait, setWait] = useState(60);
  const [sending, start] = useTransition();
  const sent = useRef(false);
  const form = useRef<HTMLFormElement>(null);

  // Send the first code as soon as the page opens.
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    start(async () => {
      const r = await sendLoginCode(false);
      if (r.error) setNote({ error: r.error });
    });
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  useEffect(() => {
    if (state.ok === "verified") {
      router.replace(state.next ?? "/dashboard");
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="flex flex-col gap-4">
      <form ref={form} action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          Code
          <input
            name="code"
            value={code}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(v);
              if (v.length === 6) requestAnimationFrame(() => form.current?.requestSubmit());
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000000"
            aria-describedby="code-help"
            className="field h-14 text-center font-mono text-[26px] tracking-[0.5em]"
          />
          <span id="code-help" className="text-[12px] font-normal text-muted">
            It works for 10 minutes. Can&apos;t see it? Check spam or promotions.
          </span>
        </label>
        {(state.error || note.error) && <p role="alert" className="rounded-xl border border-bad/20 bg-bad-bg px-3 py-2 text-[13px] text-bad">{state.error ?? note.error}</p>}
        {note.ok && !state.error && <p role="status" className="text-[13px] font-medium text-ok">{note.ok}</p>}
        <button type="submit" disabled={pending || code.length !== 6 || state.ok === "verified"} className="btn-primary min-h-12 rounded-xl text-[15px] font-semibold disabled:opacity-60">
          {pending || state.ok === "verified" ? "Checking…" : "Continue"}
        </button>
      </form>
      <div className="flex items-center justify-between text-[13px]">
        <button
          type="button"
          disabled={wait > 0 || sending}
          onClick={() =>
            start(async () => {
              const r = await sendLoginCode(true);
              setNote(r.error ? { error: r.error } : { ok: "A new code is on its way." });
              if (!r.error) setWait(60);
            })
          }
          className="font-semibold text-brand disabled:text-faint"
        >
          {sending ? "Sending…" : wait > 0 ? `Send a new code (${wait}s)` : "Send a new code"}
        </button>
        <form action="/auth/signout" method="post">
          <button type="submit" className="font-semibold text-muted hover:text-navy">Use a different account</button>
        </form>
      </div>
    </div>
  );
}
