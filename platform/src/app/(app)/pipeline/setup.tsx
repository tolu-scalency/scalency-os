"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { createPipeline } from "./actions";

const templates = [
  { key: "sales", title: "Sales", stages: ["New lead", "Contacted", "Call booked", "Proposal sent", "Won", "Lost"] },
  { key: "leadgen", title: "Lead generation", stages: ["Application started", "Qualified, not booked", "Call booked", "Confirmed", "No answer", "No-show", "Unqualified", "Follow-up", "Closed", "Lost"] },
  { key: "clients", title: "Client delivery", stages: ["Onboarding", "In progress", "Review", "Live", "Paused"] },
  { key: "custom", title: "Build your own", stages: [] },
];

/** First visit to the pipeline: choose a starting point. Stages can be changed any time. */
export function PipelineSetup() {
  const [choice, setChoice] = useState("sales");

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6 py-4">
      <div className="text-center">
        <span className="tile mx-auto h-14 w-14 rounded-[18px]"><Icon name="pipeline" size={24} /></span>
        <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.03em]">Set up your pipeline</h1>
        <p className="mt-1 text-[15px] text-muted">Choose a starting point. You can rename, reorder or add stages any time.</p>
      </div>

      <ActionForm action={createPipeline} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => {
            const on = choice === t.key;
            return (
              <label
                key={t.key}
                className={`card cursor-pointer p-4 transition-all ${on ? "border-sky ring-2 ring-sky/30" : "hover:border-line-strong"}`}
              >
                <input type="radio" name="template" value={t.key} checked={on} onChange={() => setChoice(t.key)} className="sr-only" />
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-semibold">{t.title}</span>
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border-2 ${on ? "border-brand bg-brand" : "border-line-strong"}`}>
                    {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                </div>
                {t.stages.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.stages.map((s) => (
                      <span key={s} className="rounded-full bg-surface px-2.5 py-1 text-[12px] text-muted">{s}</span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-[13px] text-muted">Type your own stages.</p>
                )}
              </label>
            );
          })}
        </div>

        {choice === "custom" && (
          <div className="card rise grid gap-3 p-4 sm:grid-cols-[1fr_2fr]">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">Pipeline name</span>
              <input name="name" placeholder="Sales" className="field" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">Stages, one per line</span>
              <textarea name="stages" rows={5} placeholder={"New lead\nQualified\nWon\nLost"} className="field resize-y py-2.5" />
            </label>
          </div>
        )}

        <div className="flex justify-center">
          <SubmitButton icon="check" pendingText="Creating…" className="min-h-11 px-6">Create pipeline</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
