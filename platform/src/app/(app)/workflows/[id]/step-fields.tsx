"use client";

import { TimeSelect } from "@/components/time-select";
// Settings for each kind of step, shown in the builder's side panel.

import { TagsInput } from "@/components/editor/tags-input";
import { type IconName } from "@/components/icon";
import type { CustomField, Stage, StepType, WorkflowStep } from "@/lib/data";
import { type MergeField } from "@/lib/merge-fields";
import { EmailDesigner } from "@/components/editor/email-designer";
import { MergeText } from "@/components/editor/field-picker";
import { newId, type ActionNode } from "@/lib/flow";

export type Option = { id: string; name: string };

export type Kind = { type: StepType; label: string; icon: IconName; tone: string; group: string };
export const kinds: Kind[] = [
  { type: "sms", label: "Send a text", icon: "phone", tone: "from-[#6ee7b7] to-[#059669]", group: "Messages" },
  { type: "email", label: "Send an email", icon: "mail", tone: "from-[#55e3ec] to-[#0a5fe3]", group: "Messages" },
  { type: "notify_team", label: "Alert the team", icon: "hash", tone: "from-[#fdba74] to-[#ea580c]", group: "Messages" },
  { type: "email_team", label: "Email the team", icon: "mail", tone: "from-[#fdba74] to-[#ea580c]", group: "Messages" },
  { type: "wait", label: "Wait", icon: "clock", tone: "from-[#cbd5e1] to-[#64748b]", group: "Timing" },
  { type: "wait_until", label: "Wait until a time", icon: "calendar", tone: "from-[#cbd5e1] to-[#64748b]", group: "Timing" },
  { type: "wait_for_reply", label: "Wait for a reply", icon: "inbox", tone: "from-[#cbd5e1] to-[#64748b]", group: "Timing" },
  { type: "if_else", label: "If / else (branches)", icon: "branch", tone: "from-[#c4b5fd] to-[#7c3aed]", group: "Logic" },
  { type: "end", label: "End workflow", icon: "stop", tone: "from-[#fca5a5] to-[#dc2626]", group: "Logic" },
  { type: "add_tag", label: "Add a tag", icon: "tag", tone: "from-[#93c5fd] to-[#2563eb]", group: "Contact" },
  { type: "remove_tag", label: "Remove a tag", icon: "tag", tone: "from-[#cbd5e1] to-[#475569]", group: "Contact" },
  { type: "assign", label: "Assign to someone", icon: "user", tone: "from-[#a5b4fc] to-[#4f46e5]", group: "Contact" },
  { type: "task", label: "Create a task", icon: "tasks", tone: "from-[#a5b4fc] to-[#4f46e5]", group: "Contact" },
  { type: "note", label: "Add a note", icon: "edit", tone: "from-[#fde68a] to-[#d97706]", group: "Contact" },
  { type: "update_field", label: "Update a field", icon: "database", tone: "from-[#93c5fd] to-[#2563eb]", group: "Contact" },
  { type: "move_stage", label: "Move stage", icon: "pipeline", tone: "from-[#f0abfc] to-[#c026d3]", group: "Pipeline" },
  { type: "set_status", label: "Mark deal won or lost", icon: "thumbsUp", tone: "from-[#86efac] to-[#16a34a]", group: "Pipeline" },
  { type: "add_to_workflow", label: "Add to another workflow", icon: "zap", tone: "from-[#7dd3fc] to-[#0284c7]", group: "Workflows" },
  { type: "remove_from_workflow", label: "Remove from a workflow", icon: "x", tone: "from-[#cbd5e1] to-[#475569]", group: "Workflows" },
  { type: "webhook", label: "Send a webhook", icon: "link", tone: "from-[#5eead4] to-[#0d9488]", group: "Apps" },
];
export const groups = ["Messages", "Timing", "Logic", "Contact", "Pipeline", "Workflows", "Apps"];


export function blank(type: StepType, stages: Stage[], members: Option[], workflows: Option[]): ActionNode {
  const id = newId();
  return make() as ActionNode;
  function make(): WorkflowStep {
  switch (type) {
    case "wait": return { id, type, amount: 1, unit: "hours" };
    case "wait_until": return { id, type, hour: 9, minute: 0, weekdays_only: true };
    case "wait_for_reply": return { id, type, amount: 1, unit: "days" };
    case "email": return { id, type, subject: "", body: "", html: "", mode: "design" };
    case "email_team": return { id, type, to: "owner", subject: "Update on {{name}}", body: "{{name}} ({{phone}}) needs a call." };
    case "update_field": return { id, type, field: "source", value: "" };
    case "sms": return { id, type, body: "" };
    case "task": return { id, type, title: "Follow up with {{first_name}}", due_in_days: 0 };
    case "move_stage": return { id, type, stage_id: stages[0]?.id ?? "" };
    case "set_status": return { id, type, status: "won" };
    case "note": return { id, type, text: "" };
    case "notify_team": return { id, type, text: "New lead: {{name}}" };
    case "add_tag": return { id, type, tags: [] };
    case "remove_tag": return { id, type, tags: [] };
    case "assign": return { id, type, user_id: members.length > 1 ? "round_robin" : (members[0]?.id ?? "round_robin") };
    case "add_to_workflow": return { id, type, workflow_id: workflows[0]?.id ?? "" };
    case "remove_from_workflow": return { id, type, workflow_id: workflows[0]?.id ?? "" };
    case "webhook": return { id, type, url: "" };
    case "end": return { id, type };
    default: return { id, type: "end" };
  }
  }
}

function Amount({ amount, unit, onChange }: { amount: number; unit: string; onChange: (p: { amount?: number; unit?: "hours" }) => void }) {
  return (
    <>
      <input type="number" min={1} max={365} value={amount} onChange={(e) => onChange({ amount: Number(e.target.value) })} className="field h-10 w-24" aria-label="Amount" />
      <select value={unit} onChange={(e) => onChange({ unit: e.target.value as "hours" })} className="field h-10 w-32" aria-label="Unit">
        <option value="minutes">minutes</option>
        <option value="hours">hours</option>
        <option value="days">days</option>
      </select>
    </>
  );
}

export function StepFields({
  step,
  stages,
  pipelines = [],
  members,
  workflows,
  fields: mf,
  customFields,
  allTags,
  onChange,
}: {
  allTags: string[];
  step: WorkflowStep;
  stages: Stage[];
  pipelines?: Option[];
  members: Option[];
  workflows: Option[];
  fields: MergeField[];
  customFields: CustomField[];
  onChange: (p: Partial<WorkflowStep>) => void;
}) {
  switch (step.type) {
    case "wait":
      return (
        <div className="flex flex-wrap items-center gap-2 text-[14px]">
          Wait <Amount amount={step.amount} unit={step.unit} onChange={onChange} /> then carry on.
        </div>
      );
    case "wait_for_reply":
      return (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[14px]">
            Wait up to <Amount amount={step.amount} unit={step.unit} onChange={onChange} /> for a reply.
          </div>
          <span className="text-[12px] text-faint">Carries on as soon as they reply, or when the time is up. Add an If / else “has replied” after it to choose what happens.</span>
        </>
      );
    case "wait_until":
      return (
        <div className="flex flex-wrap items-center gap-2 text-[14px]">
          Wait until
<TimeSelect
            value={`${String(step.hour).padStart(2, "0")}:${String(step.minute).padStart(2, "0")}`}
            onChange={(v) => {
              const [h, m] = v.split(":").map(Number);
              onChange({ hour: h || 0, minute: m || 0 });
            }}
            className="field h-10 w-44"
            aria-label="Time"
          />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={step.weekdays_only} onChange={(e) => onChange({ weekdays_only: e.target.checked })} className="h-4 w-4 accent-[#0a5fe3]" />
            Monday to Friday only
          </label>
        </div>
      );
    case "email":
      return (
        <EmailDesigner
          value={{ subject: step.subject, body: step.body, html: step.html ?? "", mode: step.mode ?? (step.html ? "design" : "text") }}
          onChange={(p) => onChange(p as Partial<WorkflowStep>)}
          fields={mf}
        />
      );
    case "email_team":
      return (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[14px]">
            Email
            <select value={step.to} onChange={(e) => onChange({ to: e.target.value })} className="field h-10 min-w-0 flex-1" aria-label="Who to email">
              <option value="owner">the contact&apos;s owner</option>
              <option value="everyone">everyone in the workspace</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <MergeText value={step.subject} onChange={(subject) => onChange({ subject })} fields={mf} maxLength={200} placeholder="Subject" label="Team email subject" />
          <MergeText value={step.body} onChange={(body) => onChange({ body })} fields={mf} multiline rows={3} maxLength={5000} placeholder="Message to your team" label="Team email message" />
          <span className="text-[12px] text-faint">Goes to your team, not the lead, so it sends even in test mode.</span>
        </>
      );
    case "update_field":
      return (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[14px]">
            Set
            <select value={step.field} onChange={(e) => onChange({ field: e.target.value })} className="field h-10 min-w-0 flex-1" aria-label="Field to update">
              <option value="first_name">First name</option>
              <option value="last_name">Last name</option>
              <option value="source">Source</option>
              {customFields.map((f) => (
                <option key={f.key} value={`custom:${f.key}`}>{f.label}</option>
              ))}
            </select>
            to
          </div>
          {(() => {
            const cf = step.field.startsWith("custom:") ? customFields.find((f) => f.key === step.field.slice(7)) : undefined;
            if (cf?.type === "select")
              return (
                <select value={step.value} onChange={(e) => onChange({ value: e.target.value })} className="field h-10" aria-label="New value">
                  <option value="">Clear the field</option>
                  {cf.options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              );
            if (cf?.type === "yes_no")
              return (
                <select value={step.value} onChange={(e) => onChange({ value: e.target.value })} className="field h-10" aria-label="New value">
                  <option value="">Clear the field</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              );
            if (cf?.type === "date")
              return <input type="date" value={step.value} onChange={(e) => onChange({ value: e.target.value })} className="field h-10" aria-label="New value" />;
            const hint =
              cf?.type === "multi_select"
                ? `Separate options with commas: ${cf.options.slice(0, 3).join(", ")}`
                : cf?.type === "number" || cf?.type === "money"
                  ? "A number, e.g. 2500"
                  : "New value (leave empty to clear)";
            return <MergeText value={step.value} onChange={(value) => onChange({ value })} fields={mf} maxLength={500} placeholder={hint} label="New value" />;
          })()}
          {customFields.length === 0 && <span className="text-[12px] text-faint">Add your own fields in Settings, then Custom fields.</span>}
        </div>
      );
    case "sms":
      return (
        <>
          <MergeText value={step.body} onChange={(body) => onChange({ body })} fields={mf} multiline rows={4} maxLength={640} placeholder={"Hi {{first_name}}, …"} label="Text message" />
          <span className="text-[12px] text-faint">Press Enter for a new line. Only sends inside your texting hours (Settings).</span>
        </>
      );
    case "task":
      return (
        <div className="flex flex-wrap items-center gap-2 text-[14px]">
          <MergeText value={step.title} onChange={(title) => onChange({ title })} fields={mf} maxLength={200} label="Task title" className="min-w-0 flex-[1_1_260px]" />
          due in
          <input type="number" min={0} max={365} value={step.due_in_days} onChange={(e) => onChange({ due_in_days: Number(e.target.value) })} className="field h-10 w-20" aria-label="Days" />
          days
        </div>
      );
    case "move_stage":
      return stages.length ? (
        <StagePicker stages={stages} pipelines={pipelines} value={step.stage_id} onChange={(v) => onChange({ stage_id: v.stageId })} />
      ) : (
        <p className="text-[13px] text-muted">Set up your pipeline first.</p>
      );
    case "set_status":
      return (
        <div className="flex flex-wrap items-center gap-2 text-[14px]">
          Mark their deal as
          <select value={step.status} onChange={(e) => onChange({ status: e.target.value as "won" })} className="field h-10 w-36" aria-label="Deal status">
            <option value="won">won</option>
            <option value="lost">lost</option>
            <option value="open">open again</option>
          </select>
        </div>
      );
    case "note":
      return <MergeText value={step.text} onChange={(text) => onChange({ text })} fields={mf} multiline rows={3} maxLength={2000} placeholder="Note to add to the contact" label="Note" />;
    case "notify_team":
      return (
        <>
          <MergeText value={step.text} onChange={(text) => onChange({ text })} fields={mf} multiline rows={2} maxLength={1000} label="Alert message" />
          <span className="text-[12px] text-faint">Posts in #leads in Team chat.</span>
        </>
      );
    case "add_tag":
    case "remove_tag":
      return (
        <TagsInput
          value={step.tags ?? (step.tag ? [step.tag] : [])}
          onChange={(tags) => onChange({ tags, tag: undefined } as Partial<WorkflowStep>)}
          suggestions={allTags}
          inline
          placeholder={step.type === "add_tag" ? "Type a tag and press Enter, e.g. Hot lead" : "Tags to remove"}
        />
      );
    case "assign":
      return (
        <select value={step.user_id} onChange={(e) => onChange({ user_id: e.target.value })} className="field" aria-label="Assign to">
          <option value="round_robin">Share evenly across the team (round robin)</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      );
    case "add_to_workflow":
    case "remove_from_workflow":
      return workflows.length ? (
        <select value={step.workflow_id} onChange={(e) => onChange({ workflow_id: e.target.value })} className="field" aria-label="Workflow">
          {workflows.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      ) : (
        <p className="text-[13px] text-muted">Create another workflow first.</p>
      );
    case "webhook":
      return (
        <>
          <input value={step.url} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://hooks.zapier.com/…" className="field" aria-label="Webhook address" />
          <span className="text-[12px] text-faint">Sends the contact&apos;s details as JSON to this address, for Zapier, Make, Slack and others.</span>
        </>
      );
    case "end":
      return <p className="text-[13px] text-muted">The workflow stops here for this contact.</p>;
    default:
      return null;
  }
}


/** One line under each card on the canvas, so the flow reads at a glance. */
export function summary(step: WorkflowStep, ctx: { stages: Stage[]; members: Option[]; workflows: Option[]; customFields: CustomField[] }): string {
  const cut = (s: string, n = 70) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  const name = (list: Option[], id: string) => list.find((x) => x.id === id)?.name;
  switch (step.type) {
    case "wait":
      return `Wait ${step.amount} ${step.amount === 1 ? step.unit.replace(/s$/, "") : step.unit}`;
    case "wait_for_reply":
      return `Up to ${step.amount} ${step.amount === 1 ? step.unit.replace(/s$/, "") : step.unit}`;
    case "wait_until":
      return `Until ${String(step.hour).padStart(2, "0")}:${String(step.minute).padStart(2, "0")}${step.weekdays_only ? ", Monday to Friday" : ""}`;
    case "email":
      return step.subject ? cut(step.subject) : "No subject yet";
    case "email_team":
      return step.subject ? cut(step.subject) : "No subject yet";
    case "sms":
      return step.body ? cut(step.body) : "No message yet";
    case "task":
      return cut(step.title || "No title yet");
    case "note":
      return step.text ? cut(step.text) : "Empty note";
    case "notify_team":
      return cut(step.text || "New lead: {{name}}");
    case "add_tag":
    case "remove_tag": {
      const t = step.tags ?? (step.tag ? [step.tag] : []);
      return t.length ? cut(t.join(", ")) : "No tags chosen";
    }
    case "assign":
      return step.user_id === "round_robin" ? "Round robin across the team" : (name(ctx.members, step.user_id) ?? "Choose someone");
    case "move_stage":
      return ctx.stages.find((s) => s.id === step.stage_id)?.name ?? "Choose a stage";
    case "set_status":
      return step.status === "open" ? "Open again" : `Mark ${step.status}`;
    case "add_to_workflow":
    case "remove_from_workflow":
      return name(ctx.workflows, step.workflow_id) ?? "Choose a workflow";
    case "webhook":
      return step.url ? cut(step.url, 50) : "No address yet";
    case "update_field": {
      const label = step.field.startsWith("custom:") ? (ctx.customFields.find((f) => `custom:${f.key}` === step.field)?.label ?? "Field") : step.field.replace("_", " ");
      return cut(`${label} → ${step.value || "empty"}`);
    }
    case "end":
      return "Stops here";
    default:
      return "";
  }
}

/** Unfinished steps, flagged on the canvas before saving. */
export function problem(step: WorkflowStep): string | null {
  switch (step.type) {
    case "email":
      return !step.subject.trim() ? "Needs a subject" : null;
    case "sms":
      return !step.body.trim() ? "Needs a message" : null;
    case "note":
      return !step.text.trim() ? "Needs text" : null;
    case "task":
      return !step.title.trim() ? "Needs a title" : null;
    case "add_tag":
    case "remove_tag":
      return !(step.tags ?? (step.tag ? [step.tag] : [])).length ? "Add a tag" : null;
    case "webhook":
      return !/^https:\/\//.test(step.url) ? "Needs an https address" : null;
    case "move_stage":
      return !step.stage_id ? "Choose a stage" : null;
    case "add_to_workflow":
    case "remove_from_workflow":
      return !step.workflow_id ? "Choose a workflow" : null;
    default:
      return null;
  }
}

/** Strips "Pipeline: " from a stage name when it's shown under its pipeline. */
export function shortStage(s: Stage, pipelines: Option[]) {
  const p = pipelines.find((x) => x.id === s.pipelineId);
  return p && s.name.startsWith(`${p.name}: `) ? s.name.slice(p.name.length + 2) : s.name;
}

/** Choose a pipeline, then a stage in it. `allowAny` adds "Any stage". */
export function StagePicker({
  stages,
  pipelines,
  value,
  pipelineId,
  onChange,
  allowAny = false,
}: {
  stages: Stage[];
  pipelines: Option[];
  value: string;
  pipelineId?: string;
  onChange: (v: { pipelineId: string; stageId: string }) => void;
  allowAny?: boolean;
}) {
  const current = stages.find((s) => s.id === value);
  const pipe = current?.pipelineId ?? pipelineId ?? pipelines[0]?.id ?? stages[0]?.pipelineId ?? "";
  const inPipe = stages.filter((s) => !s.pipelineId || s.pipelineId === pipe);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-muted">
        Pipeline
        <select
          value={pipe}
          onChange={(e) => {
            const first = stages.find((s) => s.pipelineId === e.target.value);
            onChange({ pipelineId: e.target.value, stageId: allowAny ? "any" : (first?.id ?? "") });
          }}
          className="field h-10 text-[13.5px] font-normal text-ink"
        >
          {pipelines.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-muted">
        Stage
        <select value={value} onChange={(e) => onChange({ pipelineId: pipe, stageId: e.target.value })} className="field h-10 text-[13.5px] font-normal text-ink">
          {allowAny && <option value="any">Any stage</option>}
          {!allowAny && !current && <option value="">Choose a stage</option>}
          {inPipe.map((s) => (
            <option key={s.id} value={s.id}>{shortStage(s, pipelines)}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
