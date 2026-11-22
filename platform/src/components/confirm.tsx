"use client";

// A proper "are you sure?" box for deleting and other things that can't be undone.
// Call ask() from anywhere; <ConfirmHost /> in the app shell shows it.
//   if (!(await ask({ title: "Delete this contact?", text: "This can't be undone." }))) return;

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";

export type AskOptions = { title: string; text?: string; confirm?: string; cancel?: string; danger?: boolean };
type Pending = AskOptions & { resolve: (ok: boolean) => void };

let show: ((p: Pending) => void) | null = null;

/** Asks the person to confirm. Resolves true if they confirm, false if they cancel or close it. */
export function ask(opts: AskOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (show) show({ danger: true, confirm: "Delete", cancel: "Cancel", ...opts, resolve });
    // No host on this page (for example a public page): fall back to the browser's own box.
    else resolve(window.confirm([opts.title, opts.text].filter(Boolean).join("\n\n")));
  });
}

export function ConfirmHost() {
  const [p, setP] = useState<Pending | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    show = (next) => setP(next);
    return () => {
      show = null;
    };
  }, []);
  useEffect(() => {
    if (!p) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);
  function close(ok: boolean) {
    p?.resolve(ok);
    setP(null);
  }
  if (!p) return null;
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3.5">
          <span className={`inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl ${p.danger ? "bg-bad-bg text-bad" : "bg-chip text-brand"}`}>
            <Icon name={p.danger ? "trash" : "spark"} size={18} />
          </span>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-[16px] font-semibold text-navy">
              {p.title}
            </h2>
            {p.text && <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{p.text}</p>}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => close(false)} className="btn-ghost min-h-10 rounded-xl px-4 text-[13.5px] font-semibold">
            {p.cancel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => close(true)}
            className={`min-h-10 rounded-xl px-4 text-[13.5px] font-semibold text-white ${p.danger ? "bg-bad hover:opacity-90" : "btn-primary"}`}
          >
            {p.confirm}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
