"use client";

// Choosing what starts a workflow: a searchable list, then that trigger's filters.

import { useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import type { Stage, WorkflowTrigger } from "@/lib/data";
import { StagePicker, type Option } from "./step-fields";

type TriggerDef = { type: WorkflowTrigger["type"] | string; label: string; hint: string; group: string; icon: IconName; soon?: boolean };

export const TRIGGERS: TriggerDef[] = [
  { type: "contact_created", label: "Contact created", hint: "Someone new is added, by hand, import, form or webhook", group: "Contacts", icon: "user" },
  { type: "tag_added", label: "Tag added", hint: "A chosen tag is added to a contact", group: "Contacts", icon: "tag" },
  { type: "tag_removed", label: "Tag removed", hint: "A chosen tag is taken off a contact", group: "Contacts", icon: "tag" },
  { type: "contact_changed", label: "Contact field changed", hint: "A field you choose changes", group: "Contacts", icon: "edit", soon: true },
  { type: "birthday", label: "Birthday or date reminder", hint: "Days before or after a date field", group: "Contacts", icon: "calendar", soon: true },
  { type: "note_added", label: "Note added", hint: "Someone adds a note to a contact", group: "Contacts", icon: "edit", soon: true },
  { type: "task_completed", label: "Task completed", hint: "A task on a contact is ticked off", group: "Contacts", icon: "tasks", soon: true },

  { type: "deal_created", label: "Deal created", hint: "A new deal is added to a pipeline", group: "Pipeline", icon: "pipeline" },
  { type: "stage_entered", label: "Pipeline stage changed", hint: "A deal moves into a stage you choose, or any stage", group: "Pipeline", icon: "pipeline" },
  { type: "deal_won", label: "Deal won", hint: "A deal is marked won", group: "Pipeline", icon: "star" },
  { type: "deal_lost", label: "Deal lost", hint: "A deal is marked lost", group: "Pipeline", icon: "x" },
  { type: "deal_stale", label: "Deal has been idle", hint: "No movement for a number of days", group: "Pipeline", icon: "clock", soon: true },

  { type: "message_received", label: "Customer replied", hint: "The lead texts or emails back", group: "Conversations", icon: "inbox" },
  { type: "email_opened", label: "Email opened", hint: "A workflow or campaign email is opened", group: "Conversations", icon: "eye", soon: true },
  { type: "email_clicked", label: "Email link clicked", hint: "A link in an email is clicked", group: "Conversations", icon: "link", soon: true },
  { type: "email_bounced", label: "Email bounced or unsubscribed", hint: "Delivery failed or they opted out", group: "Conversations", icon: "warning", soon: true },
  { type: "call_status", label: "Call completed or missed", hint: "An inbound or outbound call ends", group: "Conversations", icon: "phone", soon: true },

  { type: "form_submitted", label: "Form submitted", hint: "One of your forms is filled in", group: "Forms and bookings", icon: "file" },
  { type: "appointment_booked", label: "Appointment booked", hint: "A booking is made on a calendar", group: "Forms and bookings", icon: "calendar", soon: true },
  { type: "appointment_status", label: "Appointment cancelled or no-show", hint: "A booking changes status", group: "Forms and bookings", icon: "calendar", soon: true },
  { type: "trigger_link", label: "Trigger link clicked", hint: "A tracked link is clicked", group: "Forms and bookings", icon: "link", soon: true },

  { type: "payment_received", label: "Payment received", hint: "A Stripe payment comes in", group: "Payments", icon: "pound", soon: true },
  { type: "invoice_paid", label: "Invoice paid or overdue", hint: "An invoice changes status", group: "Payments", icon: "pound", soon: true },

  { type: "webhook", label: "Inbound webhook", hint: "Another app sends you a lead", group: "Other", icon: "globe" },
  { type: "manual", label: "Added by hand or by another workflow", hint: "Only starts when someone adds a contact to it", group: "Other", icon: "users" },
];
const GROUPS = ["Contacts", "Pipeline", "Conversations", "Forms and bookings", "Payments", "Other"];

export function triggerDef(type: string) {
  return TRIGGERS.find((t) => t.type === type);
}

export function TriggerPicker({ onPick }: { onPick: (type: string) => void }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const found = TRIGGERS.filter((t) => !term || `${t.label} ${t.hint} ${t.group}`.toLowerCase().includes(term));
  return (
    <div>
      <div className="relative mb-3">
        <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search triggers" className="field h-10 w-full pl-9" aria-label="Search triggers" />
      </div>
      {GROUPS.map((g) => {
        const list = found.filter((t) => t.group === g);
        if (!list.length) return null;
        return (
          <div key={g} className="mb-3 last:mb-0">
            <div className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">{g}</div>
            <div className="flex flex-col gap-1">
              {list.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  disabled={t.soon}
                  onClick={() => onPick(t.type)}
                  className="flex items-center gap-3 rounded-xl border border-line p-2.5 text-left transition-colors enabled:hover:border-sky enabled:hover:bg-surface disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-chip text-brand">
                    <Icon name={t.icon} size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold">{t.label}</span>
                    <span className="block truncate text-[12px] text-muted">{t.hint}</span>
                  </span>
                  {t.soon && <span className="rounded-md bg-surface px-1.5 py-px text-[10.5px] font-medium text-muted">Soon</span>}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {!found.length && <p className="py-6 text-center text-[13px] text-muted">Nothing matches “{q}”.</p>}
    </div>
  );
}

/** A fresh trigger of the chosen kind, with sensible first choices. */
export function newTrigger(type: string, stages: Stage[], pipelines: Option[], oldToken?: string): WorkflowTrigger {
  switch (type) {
    case "stage_entered": {
      const p = pipelines[0]?.id ?? stages[0]?.pipelineId ?? "";
      return { type, pipeline_id: p, stage_id: stages.find((s) => s.pipelineId === p)?.id ?? stages[0]?.id ?? "" };
    }
    case "tag_added":
    case "tag_removed":
      return { type, tag: "" };
    case "message_received":
      return { type, channel: "any" };
    case "webhook":
      return { type, token: oldToken ?? "" };
    default:
      return { type } as WorkflowTrigger;
  }
}

/** Filters for the chosen trigger. */
export function TriggerFilters({
  trigger,
  onChange,
  stages,
  pipelines,
  forms = [],
}: {
  trigger: WorkflowTrigger;
  onChange: (t: WorkflowTrigger) => void;
  stages: Stage[];
  pipelines: Option[];
  forms?: Option[];
}) {
  const pipelineSelect = (value: string | undefined, set: (v: string | undefined) => void) => (
    <label className="flex flex-col gap-1.5 text-[12px] font-medium text-muted">
      In pipeline
      <select value={value ?? "any"} onChange={(e) => set(e.target.value === "any" ? undefined : e.target.value)} className="field h-10 text-[13.5px] font-normal text-ink">
        <option value="any">Any pipeline</option>
        {pipelines.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </label>
  );

  switch (trigger.type) {
    case "stage_entered":
      return stages.length ? (
        <StagePicker
          stages={stages}
          pipelines={pipelines}
          value={trigger.stage_id}
          pipelineId={trigger.pipeline_id}
          allowAny
          onChange={(v) => onChange({ type: "stage_entered", pipeline_id: v.pipelineId, stage_id: v.stageId })}
        />
      ) : (
        <p className="text-[13px] text-muted">Set up a pipeline first.</p>
      );
    case "deal_created":
    case "deal_won":
    case "deal_lost":
      return pipelineSelect(trigger.pipeline_id, (v) => onChange({ type: trigger.type, ...(v ? { pipeline_id: v } : {}) }));
    case "form_submitted":
      return (
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-muted">
          Which form
          <select
            value={trigger.form_id ?? "any"}
            onChange={(e) => onChange(e.target.value === "any" ? { type: "form_submitted" } : { type: "form_submitted", form_id: e.target.value })}
            className="field h-10 text-[13.5px] font-normal text-ink"
          >
            <option value="any">Any form</option>
            {forms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          {!forms.length && <span className="font-normal">You haven&apos;t made a form yet. Create one in Forms.</span>}
        </label>
      );
    case "tag_added":
    case "tag_removed":
      return (
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-muted">
          Tag
          <input list="wf-tags" value={trigger.tag} onChange={(e) => onChange({ ...trigger, tag: e.target.value })} placeholder="e.g. Hot lead" className="field h-10 text-[13.5px] font-normal text-ink" />
        </label>
      );
    case "message_received":
      return (
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-muted">
          Replies by
          <select value={trigger.channel} onChange={(e) => onChange({ type: "message_received", channel: e.target.value as "any" })} className="field h-10 text-[13.5px] font-normal text-ink">
            <option value="any">Text or email</option>
            <option value="sms">Text only</option>
            <option value="email">Email only</option>
          </select>
        </label>
      );
    default:
      return null;
  }
}
