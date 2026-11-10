"use client";

import { useActionState, useState } from "react";
import { Icon } from "@/components/icon";
import { addContact, type AddContactState } from "./actions";

const input = "min-h-10 rounded-[11px] border border-line-strong bg-white px-3 text-[13.5px] outline-none focus:border-brand";

export function AddContact() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<AddContactState, FormData>(addContact, {});

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary inline-flex min-h-10 items-center gap-2 rounded-[11px] px-4 text-[13.5px] font-medium">
        <Icon name="plus" size={15} />Add contact
      </button>
    );
  }

  return (
    <form action={action} className="card flex w-full flex-col gap-3 p-4 sm:w-[560px]">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">Add a contact</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-muted hover:text-navy"><Icon name="x" size={16} /></button>
      </div>
      {state.error && <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] text-bad">{state.error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5"><span className="eyebrow">First name</span><input name="first_name" required className={input} /></label>
        <label className="flex flex-col gap-1.5"><span className="eyebrow">Last name</span><input name="last_name" className={input} /></label>
        <label className="flex flex-col gap-1.5"><span className="eyebrow">Email</span><input name="email" type="email" className={input} /></label>
        <label className="flex flex-col gap-1.5"><span className="eyebrow">Phone (with country code)</span><input name="phone" type="tel" placeholder="+44 7700 900123" className={input} /></label>
      </div>
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" name="is_test" defaultChecked className="h-4 w-4 accent-[#0465c7]" />
        This is a test contact (made-up details)
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-[11px] border border-line-strong bg-surface px-4 text-[13.5px]">Cancel</button>
        <button type="submit" disabled={pending} className="btn-primary min-h-10 rounded-[11px] px-4 text-[13.5px] font-medium disabled:opacity-70">
          {pending ? "Saving…" : "Save contact"}
        </button>
      </div>
    </form>
  );
}
