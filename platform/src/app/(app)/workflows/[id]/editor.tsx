"use client";

import { useState, useTransition } from "react";
import { Icon, type IconName } from "@/components/icon";
import type { Condition, ConditionField, Stage, StepType, WorkflowStep, WorkflowTrigger } from "@/lib/data";
import { saveWorkflow } from "../actions";

type Editable = { id: string; name: string; description: string; trigger: WorkflowTrigger; steps: WorkflowStep[]; stopOnReply: boolean };
type Option = { id: string; name: string };

type Kind = { type: StepType; label: string; icon: IconName; tone: string; group: string };
const kinds: Kind[] = [
  { type: "sms", label: "Send a text", icon: "phone", tone: "from-[#6ee7b7] to-[#059669]", group: "Messages" },
  { type: "email", label: "Send an email", icon: "mail", tone: "from-[#55e3ec] to-[#0a5fe3]", group: "Messages" },
  { type: "notify_team", label: "Alert the team", icon: "hash", tone: "from-[#fdba74] to-[#ea580c]", group: "Messages" },
  { type: "wait", label: "Wait", icon: "clock", tone: "from-[#cbd5e1] to-[#64748b]", group: "Timing" },
  { type: "wait_until", label: "Wait until a time", icon: "calendar", tone: "from-[#cbd5e1] to-[#64748b]", group: "Timing" },
  { type: "wait_for_reply", label: "Wait for a reply", icon: "inbox", tone: "from-[#cbd5e1] to-[#64748b]", group: "Timing" },
  { type: "if_else", label: "If / else", icon: "branch", tone: "from-[#c4b5fd] to-[#7c3aed]", group: "Logic" },
  { type: "end", label: "End workflow", icon: "stop", tone: "from-[#fca5a5] to-[#dc2626]", group: "Logic" },
  { type: "add_tag", label: "Add a tag", icon: "tag", tone: "from-[#93c5fd] to-[#2563eb]", group: "Contact" },
  { type: "remove_tag", label: "Remove a tag", icon: "tag", tone: "from-[#cbd5e1] to-[#475569]", group: "Contact" },
  { type: "assign", label: "Assign to someone", icon: "user", tone: "from-[#a5b4fc] to-[#4f46e5]", group: "Contact" },
  { type: "task", label: "Create a task", icon: "tasks", tone: "from-[#a5b4fc] to-[#4f46e5]", group: "Contact" },
  { type: "note", label: "Add a note", icon: "edit", tone: "from-[#fde68a] to-[#d97706]", group: "Contact" },
  { type: "move_stage", label: "Move stage", icon: "pipeline", tone: "from-[#f0abfc] to-[#c026d3]", group: "Pipeline" },
  { type: "set_status", label: "Mark deal won or lost", icon: "thumbsUp", tone: "from-[#86efac] to-[#16a34a]", group: "Pipeline" },
  { type: "add_to_workflow", label: "Add to another workflow", icon: "zap", tone: "from-[#7dd3fc] to-[#0284c7]", group: "Workflows" },
  { type: "remove_from_workflow", label: "Remove from a workflow", icon: "x", tone: "from-[#cbd5e1] to-[#475569]", group: "Workflows" },
  { type: "webhook", label: "Send a webhook", icon: "link", tone: "from-[#5eead4] to-[#0d9488]", group: "Apps" },
];
const groups = ["Messages", "Timing", "Logic", "Contact", "Pipeline", "Workflows", "Apps"];

const conditions: { field: ConditionField; label: string }[] = [
  { field: "replied", label: "has replied" },
  { field: "has_tag", label: "has the tag" },
  { field: "in_stage", label: "is in the stage" },
  { field: "deal_status", label: "has a deal that is" },
  { field: "has_email", label: "has an email address" },
  { field: "has_phone", label: "has a phone number" },
  { field: "has_owner", label: "is assigned to someone" },
  { field: "source_is", label: "came from (source)" },
];

const newId = () => Math.random().toString(36).slice(2, 10);

function blank(type: StepType, stages: Stage[], members: Option[], workflows: Option[]): WorkflowStep {
  const id = newId();
  switch (type) {
    case "wait": return { id, type, amount: 1, unit: "hours" };
    case "wait_until": return { id, type, hour: 9, minute: 0, weekdays_only: true };
    case "wait_for_reply": return { id, type, amount: 1, unit: "days" };
    case "email": return { id, type, subject: "", body: "" };
    case "sms": return { id, type, body: "" };
    case "task": return { id, type, title: "Follow up with {{first_name}}", due_in_days: 0 };
    case "move_stage": return { id, type, stage_id: stages[0]?.id ?? "" };
    case "set_status": return { id, type, status: "won" };
    case "note": return { id, type, text: "" };
    case "notify_team": return { id, type, text: "New lead: {{name}}" };
    case "add_tag": return { id, type, tag: "" };
    case "remove_tag": return { id, type, tag: "" };
    case "assign": return { id, type, user_id: members.length > 1 ? "round_robin" : (members[0]?.id ?? "round_robin") };
    case "if_else": return { id, type, condition: { field: "replied" }, else: "end" };
    case "add_to_workflow": return { id, type, workflow_id: workflows[0]?.id ?? "" };
    case "remove_from_workflow": return { id, type, workflow_id: workflows[0]?.id ?? "" };
    case "webhook": return { id, type, url: "" };
    case "end": return { id, type };
  }
}

// Trigger choices, written as the select's value.
function triggerValue(t: WorkflowTrigger) {
  return t.type === "stage_entered" ? `stage:${t.stage_id}` : t.type;
}

const fields = ["{{first_name}}", "{{last_name}}", "{{name}}", "{{email}}", "{{phone}}", "{{source}}", "{{workspace}}"];

/** The workflow builder: a trigger, then steps that run from top to bottom. */
export function WorkflowEditor({
  workflow,
  stages,
  members,
  workflows,
  tags,
  hookBase,
  locked,
}: {
  workflow: Editable;
  stages: Stage[];
  members: Option[];
  workflows: Option[];
  tags: string[];
  hookBase: string;
  locked: boolean;
}) {
  const [name, setName] = useState(workflow.name);
  const [description, setDescription] = useState(workflow.description);
  const [trigger, setTrigger] = useState<WorkflowTrigger>(workflow.trigger);
  const [stopOnReply, setStopOnReply] = useState(workflow.stopOnReply);
  const [steps, setSteps] = useState<WorkflowStep[]>(() => workflow.steps.map((s) => (s.id ? s : { ...s, id: newId() })));
  const [adding, setAdding] = useState<number | null>(null);
  const [message, setMessage] = useState<{ error?: string; ok?: string }>({});
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const others = workflows.filter((w) => w.id !== workflow.id);

  function change(fn: () => void) {
    fn();
    setDirty(true);
    setMessage({});
  }
  function update(i: number, patch: Partial<WorkflowStep>) {
    change(() => setSteps((s) => s.map((st, j) => (j === i ? ({ ...st, ...patch } as WorkflowStep) : st))));
  }
  function insert(at: number, type: StepType) {
    change(() => setSteps((s) => [...s.slice(0, at), blank(type, stages, members, others), ...s.slice(at)]));
    setAdding(null);
  }
  function move(i: number, d: -1 | 1) {
    change(() =>
      setSteps((s) => {
        const j = i + d;
        if (j < 0 || j >= s.length) return s;
        const copy = [...s];
        [copy[i], copy[j]] = [copy[j], copy[i]];
        return copy;
      }),
    );
  }
  function remove(i: number) {
    change(() =>
      setSteps((s) => {
        const gone = s[i].id;
        // Anything that pointed at the removed step now ends the workflow instead.
        return s.filter((_, j) => j !== i).map((st) => (st.type === "if_else" && st.else === gone ? { ...st, else: "end" } : st));
      }),
    );
  }
  function setTriggerFrom(v: string) {
    change(() => {
      if (v.startsWith("stage:")) return setTrigger({ type: "stage_entered", stage_id: v.slice(6) });
      if (v === "tag_added" || v === "tag_removed") return setTrigger({ type: v, tag: trigger.type === "tag_added" || trigger.type === "tag_removed" ? trigger.tag : "" });
      if (v === "message_received") return setTrigger({ type: v, channel: "any" });
      if (v === "webhook") return setTrigger({ type: v, token: workflow.trigger.type === "webhook" ? workflow.trigger.token : "" });
      setTrigger({ type: v } as WorkflowTrigger);
    });
  }
  function save() {
    start(async () => {
      const result = await saveWorkflow(workflow.id, { name, description, trigger, steps, stopOnReply }).catch(() => ({ error: "We couldn't save. Check your connection and try again.", token: undefined }));
      setMessage(result);
      if (!result.error) {
        setDirty(false);
        if (result.token) setTrigger({ type: "webhook", token: result.token });
      }
    });
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const disabled = locked;
  const hookUrl = trigger.type === "webhook" && trigger.token ? `${hookBase}/api/hooks/${trigger.token}` : "";

  return (
    <div className="flex flex-col gap-4">
      <datalist id="wf-tags">
        {tags.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      <section className="card p-5 sm:p-6">
        <div className="grid gap-3 md:grid-cols-[1fr_1.4fr]">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Name</span>
            <input value={name} disabled={disabled} onChange={(e) => change(() => setName(e.target.value))} className="field h-11 text-[15px] font-semibold" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">What it&apos;s for</span>
            <input value={description} disabled={disabled} onChange={(e) => change(() => setDescription(e.target.value))} placeholder="Optional" className="field h-11" />
          </label>
        </div>
        <label className="mt-4 flex w-fit cursor-pointer items-start gap-3">
          <input type="checkbox" checked={stopOnReply} disabled={disabled} onChange={(e) => change(() => setStopOnReply(e.target.checked))} className="mt-0.5 h-4 w-4 accent-[#0a5fe3]" />
          <span className="text-[13.5px]">
            <span className="font-medium">Stop when the lead replies</span>
            <span className="block text-[12.5px] text-muted">So nobody gets chased after they&apos;ve answered. “Wait for a reply” steps still carry on.</span>
          </span>
        </label>
        {locked && (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-muted">
            <Icon name="lock" size={14} /> This workflow is on. Pause it to make changes.
          </p>
        )}
      </section>

      {/* The flow */}
      <div className="relative mx-auto flex w-full max-w-[680px] flex-col items-stretch">
        <div className="rounded-2xl border-2 border-dashed border-sky/50 bg-white p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <span className="tile h-10 w-10 rounded-xl"><Icon name="play" size={17} /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand">Trigger</div>
              <select value={triggerValue(trigger)} disabled={disabled} onChange={(e) => setTriggerFrom(e.target.value)} aria-label="Trigger" className="mt-1 w-full bg-transparent text-[15px] font-semibold outline-none">
                <optgroup label="Contacts">
                  <option value="contact_created">When a contact is added</option>
                  <option value="tag_added">When a tag is added</option>
                  <option value="tag_removed">When a tag is removed</option>
                </optgroup>
                <optgroup label="Pipeline">
                  {stages.map((s) => (
                    <option key={s.id} value={`stage:${s.id}`}>When a contact enters “{s.name}”</option>
                  ))}
                  <option value="deal_won">When a deal is won</option>
                  <option value="deal_lost">When a deal is lost</option>
                </optgroup>
                <optgroup label="Conversations">
                  <option value="message_received">When the lead replies</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="webhook">When a webhook is received (other apps)</option>
                  <option value="manual">When you add someone by hand</option>
                </optgroup>
              </select>
            </div>
          </div>

          {(trigger.type === "tag_added" || trigger.type === "tag_removed") && (
            <label className="mt-3 flex items-center gap-2 text-[14px]">
              Tag
              <input list="wf-tags" value={trigger.tag} disabled={disabled} onChange={(e) => change(() => setTrigger({ ...trigger, tag: e.target.value }))} placeholder="e.g. Hot lead" className="field h-10 flex-1" aria-label="Trigger tag" />
            </label>
          )}
          {trigger.type === "message_received" && (
            <label className="mt-3 flex items-center gap-2 text-[14px]">
              Replies by
              <select value={trigger.channel} disabled={disabled} onChange={(e) => change(() => setTrigger({ type: "message_received", channel: e.target.value as "any" }))} className="field h-10 w-44" aria-label="Reply channel">
                <option value="any">text or email</option>
                <option value="sms">text only</option>
                <option value="email">email only</option>
              </select>
            </label>
          )}
          {trigger.type === "webhook" && (
            <div className="mt-3 rounded-xl bg-surface p-3 text-[13px]">
              {hookUrl ? (
                <>
                  <div className="mb-1.5 font-medium">Send leads to this address (POST):</div>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-2.5 py-2 text-[12px] ring-1 ring-line">{hookUrl}</code>
                    <button type="button" onClick={() => copy(hookUrl)} className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold">
                      <Icon name={copied ? "check" : "link"} size={13} /> {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-2 text-muted">
                    Send JSON with <code>first_name</code>, <code>last_name</code>, <code>email</code>, <code>phone</code>, and optionally <code>source</code> and <code>tags</code>. The contact is created or updated, then this workflow runs. Keep this address private.
                  </p>
                </>
              ) : (
                <p className="text-muted">Save to get the address other apps send leads to.</p>
              )}
            </div>
          )}
        </div>

        <Connector onAdd={disabled ? undefined : () => setAdding(adding === 0 ? null : 0)} open={adding === 0} onPick={(t) => insert(0, t)} />

        {steps.map((step, i) => {
          const k = kinds.find((x) => x.type === step.type) ?? kinds[0];
          return (
            <div key={step.id ?? i}>
              <div className="rise rounded-2xl border border-line bg-white p-4 shadow-[var(--shadow-card)]">
                <div className="mb-3 flex items-center gap-3">
                  <span className={`inline-flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-gradient-to-br text-white ${k.tone}`}>
                    <Icon name={k.icon} size={16} />
                  </span>
                  <div className="flex-1 text-[14px] font-semibold">
                    <span className="mr-1.5 text-faint">{i + 1}.</span>
                    {k.label}
                  </div>
                  {!disabled && (
                    <div className="flex items-center">
                      <IconBtn icon="arrowUp" label="Move up" onClick={() => move(i, -1)} hidden={i === 0} />
                      <IconBtn icon="arrowDown" label="Move down" onClick={() => move(i, 1)} hidden={i === steps.length - 1} />
                      <IconBtn icon="trash" label="Remove step" onClick={() => remove(i)} danger />
                    </div>
                  )}
                </div>
                <fieldset disabled={disabled} className="flex flex-col gap-2.5">
                  <StepFields step={step} index={i} steps={steps} stages={stages} members={members} workflows={others} onChange={(p) => update(i, p)} />
                </fieldset>
              </div>
              <Connector
                onAdd={disabled ? undefined : () => setAdding(adding === i + 1 ? null : i + 1)}
                open={adding === i + 1}
                onPick={(t) => insert(i + 1, t)}
                label={step.type === "if_else" ? "Yes" : undefined}
              />
            </div>
          );
        })}

        <div className="mx-auto flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-medium text-muted shadow-[var(--shadow-card)] ring-1 ring-line">
          <Icon name="checkCircle" size={15} className="text-ok" /> End of workflow
        </div>
      </div>

      {!disabled && (
        <div className="sticky bottom-4 z-20 mx-auto flex w-full max-w-[680px] items-center justify-between gap-3 rounded-2xl border border-line bg-white/95 p-3 pl-4 shadow-[var(--shadow-pop)] backdrop-blur">
          <span className={`text-[13px] ${message.error ? "text-bad" : message.ok ? "text-ok" : "text-muted"}`}>
            {message.error ?? message.ok ?? (dirty ? "You have unsaved changes." : `Use ${fields.slice(0, 3).join(", ")} and more in messages.`)}
          </span>
          <button type="button" onClick={save} disabled={pending} className="btn-primary inline-flex min-h-10 items-center gap-2 rounded-xl px-5 text-[13.5px] font-semibold disabled:opacity-70">
            <Icon name="check" size={15} /> {pending ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

function Connector({ onAdd, open, onPick, label }: { onAdd?: () => void; open: boolean; onPick: (t: StepType) => void; label?: string }) {
  return (
    <div className="relative flex flex-col items-center py-1">
      <span className="connector h-5" />
      {label && <span className="mb-1 rounded-full bg-ok-bg px-2 py-0.5 text-[11px] font-semibold text-ok">{label}</span>}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add a step here"
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full border bg-white shadow-sm transition-colors ${open ? "border-brand text-brand" : "border-line-strong text-muted hover:border-sky hover:text-brand"}`}
        >
          <Icon name={open ? "x" : "plus"} size={14} />
        </button>
      )}
      <span className="connector h-5" />
      {open && (
        <div className="rise absolute top-12 z-30 max-h-[60vh] w-[min(600px,94vw)] overflow-y-auto rounded-2xl border border-line bg-white p-3 shadow-[var(--shadow-pop)]">
          {groups.map((g) => (
            <div key={g} className="mb-2 last:mb-0">
              <div className="px-1.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">{g}</div>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                {kinds
                  .filter((k) => k.group === g)
                  .map((k) => (
                    <button key={k.type} type="button" onClick={() => onPick(k.type)} className="flex items-center gap-2.5 rounded-xl p-2 text-left text-[13px] font-medium hover:bg-surface">
                      <span className={`inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-gradient-to-br text-white ${k.tone}`}>
                        <Icon name={k.icon} size={15} />
                      </span>
                      {k.label}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IconBtn({ icon, label, onClick, hidden, danger }: { icon: IconName; label: string; onClick: () => void; hidden?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${hidden ? "invisible" : ""} ${danger ? "text-faint hover:bg-bad-bg hover:text-bad" : "text-muted hover:bg-surface hover:text-navy"}`}
    >
      <Icon name={icon} size={15} />
    </button>
  );
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

function stepName(s: WorkflowStep) {
  return kinds.find((k) => k.type === s.type)?.label ?? s.type;
}

function StepFields({
  step,
  index,
  steps,
  stages,
  members,
  workflows,
  onChange,
}: {
  step: WorkflowStep;
  index: number;
  steps: WorkflowStep[];
  stages: Stage[];
  members: Option[];
  workflows: Option[];
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
          <input
            type="time"
            value={`${String(step.hour).padStart(2, "0")}:${String(step.minute).padStart(2, "0")}`}
            onChange={(e) => {
              const [h, m] = e.target.value.split(":").map(Number);
              onChange({ hour: h || 0, minute: m || 0 });
            }}
            className="field h-10 w-32"
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
        <>
          <input value={step.subject} onChange={(e) => onChange({ subject: e.target.value })} placeholder="Subject, e.g. Thanks {{first_name}}" className="field" aria-label="Subject" />
          <textarea value={step.body} onChange={(e) => onChange({ body: e.target.value })} rows={4} placeholder="Hi {{first_name}}, …" className="field resize-y py-2.5" aria-label="Email message" />
          <span className="text-[12px] text-faint">Fields: {fields.join(" ")}</span>
        </>
      );
    case "sms":
      return (
        <>
          <textarea value={step.body} onChange={(e) => onChange({ body: e.target.value })} rows={3} maxLength={640} placeholder="Hi {{first_name}}, …" className="field resize-y py-2.5" aria-label="Text message" />
          <span className="flex justify-between gap-3 text-[12px] text-faint">
            <span>Only sends inside your texting hours (Settings).</span>
            <span>{step.body.length}/640</span>
          </span>
        </>
      );
    case "task":
      return (
        <div className="flex flex-wrap items-center gap-2 text-[14px]">
          <input value={step.title} onChange={(e) => onChange({ title: e.target.value })} className="field min-w-0 flex-[1_1_220px]" aria-label="Task title" />
          due in
          <input type="number" min={0} max={365} value={step.due_in_days} onChange={(e) => onChange({ due_in_days: Number(e.target.value) })} className="field h-10 w-20" aria-label="Days" />
          days
        </div>
      );
    case "move_stage":
      return stages.length ? (
        <select value={step.stage_id} onChange={(e) => onChange({ stage_id: e.target.value })} className="field" aria-label="Stage">
          {stages.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
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
      return <textarea value={step.text} onChange={(e) => onChange({ text: e.target.value })} rows={2} placeholder="Note to add to the contact" className="field resize-y py-2.5" aria-label="Note" />;
    case "notify_team":
      return (
        <>
          <input value={step.text} onChange={(e) => onChange({ text: e.target.value })} className="field" aria-label="Alert message" />
          <span className="text-[12px] text-faint">Posts in #leads in Team chat.</span>
        </>
      );
    case "add_tag":
    case "remove_tag":
      return <input list="wf-tags" value={step.tag} onChange={(e) => onChange({ tag: e.target.value })} placeholder="Tag name, e.g. Hot lead" className="field" aria-label="Tag" />;
    case "assign":
      return (
        <select value={step.user_id} onChange={(e) => onChange({ user_id: e.target.value })} className="field" aria-label="Assign to">
          <option value="round_robin">Share evenly across the team (round robin)</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      );
    case "if_else": {
      const c = step.condition;
      const set = (p: Partial<Condition>) => onChange({ condition: { ...c, ...p } } as Partial<WorkflowStep>);
      const later = steps.slice(index + 1);
      return (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[14px]">
            <select value={c.negate ? "not" : "yes"} onChange={(e) => set({ negate: e.target.value === "not" })} className="field h-10 w-56" aria-label="If or if not">
              <option value="yes">If the contact</option>
              <option value="not">If the contact does NOT</option>
            </select>
            <select value={c.field} onChange={(e) => set({ field: e.target.value as ConditionField, value: e.target.value === "in_stage" ? stages[0]?.id : e.target.value === "deal_status" ? "won" : "" })} className="field h-10 min-w-0 flex-[1_1_180px]" aria-label="Condition">
              {conditions.map((x) => (
                <option key={x.field} value={x.field}>{x.label}</option>
              ))}
            </select>
            {(c.field === "has_tag" || c.field === "source_is") && (
              <input list={c.field === "has_tag" ? "wf-tags" : undefined} value={c.value ?? ""} onChange={(e) => set({ value: e.target.value })} placeholder={c.field === "has_tag" ? "Tag name" : "e.g. Facebook"} className="field h-10 min-w-0 flex-[1_1_140px]" aria-label="Value" />
            )}
            {c.field === "in_stage" && (
              <select value={c.value ?? ""} onChange={(e) => set({ value: e.target.value })} className="field h-10 min-w-0 flex-[1_1_140px]" aria-label="Stage">
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
            {c.field === "deal_status" && (
              <select value={c.value ?? "won"} onChange={(e) => set({ value: e.target.value })} className="field h-10 w-32" aria-label="Deal status">
                <option value="won">won</option>
                <option value="lost">lost</option>
                <option value="open">open</option>
              </select>
            )}
          </div>
          <div className="grid gap-2 rounded-xl bg-surface p-3 text-[13px] sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-ok-bg px-2 py-0.5 text-[11px] font-semibold text-ok">Yes</span> carry on to the next step
            </div>
            <label className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-bad-bg px-2 py-0.5 text-[11px] font-semibold text-bad">No</span>
              <select value={step.else} onChange={(e) => onChange({ else: e.target.value })} className="field h-9 min-w-0 flex-1 text-[13px]" aria-label="Otherwise">
                <option value="end">end the workflow</option>
                {later.map((s, j) => (
                  <option key={s.id} value={s.id}>skip to step {index + j + 2}: {stepName(s)}</option>
                ))}
              </select>
            </label>
          </div>
        </>
      );
    }
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
  }
}
