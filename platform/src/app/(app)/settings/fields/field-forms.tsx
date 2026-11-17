"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Icon } from "@/components/icon";
import { FIELD_TYPES, OPTION_TYPES, type FieldType } from "@/lib/field-types";
import { addCustomField, updateCustomField } from "../actions";

/** Add a field: name, type, and options when it's a dropdown. */
export function AddFieldForm({ object = "contact" }: { object?: "contact" | "opportunity" }) {
  const [type, setType] = useState<FieldType>("text");
  const needsOptions = OPTION_TYPES.includes(type);
  const hint = FIELD_TYPES.find((t) => t.type === type)?.hint;
  return (
    <ActionForm action={addCustomField} resetOnOk className="flex flex-col gap-2.5 rounded-xl border border-dashed border-line p-3">
      <input type="hidden" name="object" value={object} />
      <div className="grid gap-2 sm:grid-cols-[1fr_200px]">
        <input name="label" required maxLength={60} placeholder="New field, e.g. Budget" aria-label="Field name" className="field min-w-0" />
        <select name="type" value={type} onChange={(e) => setType(e.target.value as FieldType)} aria-label="Field type" className="field">
          {FIELD_TYPES.map((t) => (
            <option key={t.type} value={t.type}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      {hint && <p className="text-[12.5px] text-muted">{hint}</p>}
      {needsOptions && (
        <textarea
          name="options"
          required
          rows={4}
          placeholder={"One option per line, e.g.\nSocial media\nPaid ads\nSEO"}
          aria-label="Options"
          className="field resize-y"
        />
      )}
      <div className="flex justify-end">
        <SubmitButton icon="plus" pendingText="Adding…">
          Add field
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Rename a field and, for dropdowns, edit its options. */
export function EditFieldForm({ id, label, type, options }: { id: string; label: string; type: string; options: string[] }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost inline-flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold">
        <Icon name="edit" size={13} /> Edit
      </button>
    );
  return (
    <ActionForm action={updateCustomField} className="flex basis-full flex-col gap-2 pt-1">
      <input type="hidden" name="id" value={id} />
      <input name="label" required maxLength={60} defaultValue={label} aria-label="Field name" className="field" />
      {(OPTION_TYPES as string[]).includes(type) && (
        <textarea name="options" rows={Math.min(10, options.length + 1)} defaultValue={options.join("\n")} aria-label="Options, one per line" className="field resize-y" />
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost min-h-9 rounded-lg px-3 text-[13px] font-semibold">
          Close
        </button>
        <SubmitButton variant="ghost" pendingText="Saving…">
          Save
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
