"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";
import { ActionForm, SubmitButton } from "@/components/action-form";
import type { Stage } from "@/lib/data";
import { addContact } from "./actions";

/** "New contact" button that opens a side panel with the form. */
export function AddContact({ stages, defaultOpen = false }: { stages: Stage[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  // The panel is drawn on top of the whole page (outside the page's layout), once the browser is ready.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-[13.5px] font-semibold">
        <Icon name="plus" size={16} />
        New contact
      </button>

      {open && mounted && createPortal(
        <div className="fixed inset-0 z-[60]">
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]" />
          <div role="dialog" aria-modal="true" aria-labelledby="new-contact-title" className="rise absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <h2 id="new-contact-title" className="text-[18px] font-semibold tracking-[-0.02em]">New contact</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-navy">
                <Icon name="x" size={18} />
              </button>
            </div>
            <ActionForm action={addContact} className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name">
                  <input name="first_name" required autoFocus autoComplete="off" className="field" />
                </Field>
                <Field label="Last name">
                  <input name="last_name" autoComplete="off" className="field" />
                </Field>
              </div>
              <Field label="Email">
                <input name="email" type="email" autoComplete="off" placeholder="name@company.com" className="field" />
              </Field>
              <Field label="Phone">
                <input name="phone" type="tel" autoComplete="off" placeholder="07700 900123" className="field" />
              </Field>
              {stages.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Pipeline stage">
                    <select name="stage_id" defaultValue={stages[0].id} className="field">
                      <option value="">Not in pipeline</option>
                      {stages.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Deal value (£)">
                    <input name="value" inputMode="decimal" placeholder="0" className="field" />
                  </Field>
                </div>
              )}
              <div className="mt-auto flex justify-end gap-2 border-t border-line pt-4">
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost min-h-10 rounded-xl px-4 text-[13.5px] font-semibold">Cancel</button>
                <SubmitButton pendingText="Saving…">Save contact</SubmitButton>
              </div>
            </ActionForm>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      {children}
    </label>
  );
}
