"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/action-form";
import { deleteContact, updateContact } from "../actions";

type Editable = { id: string; firstName: string; lastName: string; email: string; phone: string };

/** Shows the contact header, with "Edit" to change details and "Delete" to remove them. */
export function ContactEditor({ contact, children }: { contact: Editable; children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className="relative">
        {children}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-brand"
        >
          <Icon name="edit" size={14} /> Edit details
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-semibold">Edit contact</h2>
        <button type="button" onClick={() => setEditing(false)} aria-label="Close" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface">
          <Icon name="x" size={18} />
        </button>
      </div>
      <ActionForm action={updateContact} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={contact.id} />
        <label className="flex flex-col gap-1.5"><span className="text-[13px] font-medium">First name</span><input name="first_name" required defaultValue={contact.firstName} className="field" /></label>
        <label className="flex flex-col gap-1.5"><span className="text-[13px] font-medium">Last name</span><input name="last_name" defaultValue={contact.lastName} className="field" /></label>
        <label className="flex flex-col gap-1.5"><span className="text-[13px] font-medium">Email</span><input name="email" type="email" defaultValue={contact.email} className="field" /></label>
        <label className="flex flex-col gap-1.5"><span className="text-[13px] font-medium">Phone</span><input name="phone" type="tel" defaultValue={contact.phone} className="field" /></label>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={() => setEditing(false)} className="btn-ghost min-h-10 rounded-xl px-4 text-[13.5px] font-semibold">Done</button>
          <SubmitButton>Save changes</SubmitButton>
        </div>
      </ActionForm>
      <ActionForm action={deleteContact} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bad/15 bg-bad-bg/40 p-3">
        <input type="hidden" name="id" value={contact.id} />
        <span className="text-[13px] text-muted">Delete this contact, their notes and tasks.</span>
        <ConfirmSubmit message="Delete this contact? This can't be undone.">
          <Icon name="trash" size={15} /> Delete
        </ConfirmSubmit>
      </ActionForm>
    </div>
  );
}
