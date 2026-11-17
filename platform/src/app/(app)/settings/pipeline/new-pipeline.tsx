"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Icon } from "@/components/icon";
import { createPipeline } from "../../pipeline/actions";

/** Adds another pipeline from a template or your own stages. */
export function NewPipelineForm() {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState("sales");
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-dashed border-sky/60 px-4 text-[13.5px] font-semibold text-brand hover:bg-chip">
        <Icon name="plus" size={14} /> New pipeline
      </button>
    );
  return (
    <ActionForm action={createPipeline} resetOnOk className="rise mt-4 grid gap-3 rounded-2xl border border-line bg-surface/50 p-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-muted">Name</span>
        <input name="name" required maxLength={60} placeholder="e.g. Projects" className="field" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-muted">Start from</span>
        <select name="template" value={template} onChange={(e) => setTemplate(e.target.value)} className="field">
          <option value="sales">Sales stages</option>
          <option value="leadgen">Lead generation stages</option>
          <option value="clients">Client delivery stages</option>
          <option value="custom">My own stages</option>
        </select>
      </label>
      {template === "custom" && (
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-[12.5px] font-medium text-muted">Stages, one per line</span>
          <textarea name="stages" rows={5} required placeholder={"Requested\nPlanning\nIn progress\nReview\nDone"} className="field resize-y" />
        </label>
      )}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost min-h-10 rounded-xl px-4 text-[13px] font-semibold">Cancel</button>
        <SubmitButton icon="plus" pendingText="Creating…">Create pipeline</SubmitButton>
      </div>
    </ActionForm>
  );
}
