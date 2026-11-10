"use client";

import { useState, useTransition } from "react";
import { Icon, type IconName } from "@/components/icon";
import type { Stage, WorkflowStep, WorkflowTrigger } from "@/lib/data";
import { saveWorkflow } from "../actions";

type Editable = { id: string; name: string; description: string; trigger: WorkflowTrigger; steps: WorkflowStep[] };

const kinds: { type: WorkflowStep["type"]; label: string; icon: IconName; tone: string }[] = [
  { type: "sms", label: "Send a text", icon: "phone", tone: "from-[#6ee7b7] to-[#059669]" },
  { type: "email", label: "Send an email", icon: "mail", tone: "from-[#55e3ec] to-[#0a5fe3]" },
  { type: "wait", label: "Wait", icon: "clock", tone: "from-[#cbd5e1] to-[#64748b]" },
  { type: "notify_team", label: "Alert the team", icon: "hash", tone: "from-[#fdba74] to-[#ea580c]" },
  { type: "task", label: "Create a task", icon: "tasks", tone: "from-[#a5b4fc] to-[#4f46e5]" },
  { type: "move_stage", label: "Move stage", icon: "pipeline", tone: "from-[#f0abfc] to-[#c026d3]" },
  { type: "note", label: "Add a note", icon: "edit", tone: "from-[#fde68a] to-[#d97706]" },
];

function blank(type: WorkflowStep["type"], stages: Stage[]): WorkflowStep {
  switch (type) {
    case "wait": return { type, amount: 1, unit: "hours" };
    case "email": return { type, subject: "", body: "" };
    case "sms": return { type, body: "" };
    case "task": return { type, title: "Follow up with {{first_name}}", due_in_days: 0 };
    case "move_stage": return { type, stage_id: stages[0]?.id ?? "" };
    case "note": return { type, text: "" };
    case "notify_team": return { type, text: "New lead: {{name}}" };
  }
}

const fields = "{{first_name}} {{last_name}} {{name}} {{email}} {{phone}} {{workspace}}";

/** The workflow builder: a trigger, then steps that run from top to bottom. */
export function WorkflowEditor({ workflow, stages, locked }: { workflow: Editable; stages: Stage[]; locked: boolean }) {
  const [name, setName] = useState(workflow.name);
  const [description, setDescription] = useState(workflow.description);
  const [trigger, setTrigger] = useState<WorkflowTrigger>(workflow.trigger);
  const [steps, setSteps] = useState<WorkflowStep[]>(workflow.steps);
  const [adding, setAdding] = useState<number | null>(null);
  const [message, setMessage] = useState<{ error?: string; ok?: string }>({});
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();

  function change(fn: () => void) {
    fn();
    setDirty(true);
    setMessage({});
  }
  function update(i: number, patch: Partial<WorkflowStep>) {
    change(() => setSteps((s) => s.map((st, j) => (j === i ? ({ ...st, ...patch } as WorkflowStep) : st))));
  }
  function insert(at: number, type: WorkflowStep["type"]) {
    change(() => setSteps((s) => [...s.slice(0, at), blank(type, stages), ...s.slice(at)]));
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
    change(() => setSteps((s) => s.filter((_, j) => j !== i)));
  }
  function save() {
    start(async () => {
      const result = await saveWorkflow(workflow.id, { name, description, trigger, steps }).catch(() => ({ error: "We couldn't save. Check your connection and try again." }));
      setMessage(result);
      if (!result.error) setDirty(false);
    });
  }

  const disabled = locked;

  return (
    <div className="flex flex-col gap-4">
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
              <select
                value={trigger.type === "stage_entered" ? `stage:${trigger.stage_id}` : trigger.type}
                disabled={disabled}
                onChange={(e) => {
                  const v = e.target.value;
                  change(() => setTrigger(v.startsWith("stage:") ? { type: "stage_entered", stage_id: v.slice(6) } : ({ type: v } as WorkflowTrigger)));
                }}
                className="mt-1 w-full bg-transparent text-[15px] font-semibold outline-none"
              >
                <option value="contact_created">When a contact is added</option>
                {stages.map((s) => (
                  <option key={s.id} value={`stage:${s.id}`}>When a contact enters “{s.name}”</option>
                ))}
                <option value="manual">When you add someone by hand</option>
              </select>
            </div>
          </div>
        </div>

        <Connector onAdd={disabled ? undefined : () => setAdding(adding === 0 ? null : 0)} open={adding === 0} onPick={(t) => insert(0, t)} />

        {steps.map((step, i) => {
          const k = kinds.find((x) => x.type === step.type)!;
          return (
            <div key={i}>
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
                  <StepFields step={step} stages={stages} onChange={(p) => update(i, p)} />
                </fieldset>
              </div>
              <Connector onAdd={disabled ? undefined : () => setAdding(adding === i + 1 ? null : i + 1)} open={adding === i + 1} onPick={(t) => insert(i + 1, t)} />
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
            {message.error ?? message.ok ?? (dirty ? "You have unsaved changes." : `Use ${fields.split(" ").slice(0, 3).join(", ")} and more in messages.`)}
          </span>
          <button type="button" onClick={save} disabled={pending} className="btn-primary inline-flex min-h-10 items-center gap-2 rounded-xl px-5 text-[13.5px] font-semibold disabled:opacity-70">
            <Icon name="check" size={15} /> {pending ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

function Connector({ onAdd, open, onPick }: { onAdd?: () => void; open: boolean; onPick: (t: WorkflowStep["type"]) => void }) {
  return (
    <div className="relative flex flex-col items-center py-1">
      <span className="connector h-5" />
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
        <div className="rise absolute top-12 z-30 grid w-[min(520px,92vw)] grid-cols-2 gap-1.5 rounded-2xl border border-line bg-white p-2 shadow-[var(--shadow-pop)] sm:grid-cols-3">
          {kinds.map((k) => (
            <button key={k.type} type="button" onClick={() => onPick(k.type)} className="flex items-center gap-2.5 rounded-xl p-2 text-left text-[13px] font-medium hover:bg-surface">
              <span className={`inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-gradient-to-br text-white ${k.tone}`}>
                <Icon name={k.icon} size={15} />
              </span>
              {k.label}
            </button>
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

function StepFields({ step, stages, onChange }: { step: WorkflowStep; stages: Stage[]; onChange: (p: Partial<WorkflowStep>) => void }) {
  switch (step.type) {
    case "wait":
      return (
        <div className="flex items-center gap-2 text-[14px]">
          Wait
          <input type="number" min={1} max={365} value={step.amount} onChange={(e) => onChange({ amount: Number(e.target.value) })} className="field h-10 w-24" aria-label="Amount" />
          <select value={step.unit} onChange={(e) => onChange({ unit: e.target.value as "hours" })} className="field h-10 w-32" aria-label="Unit">
            <option value="minutes">minutes</option>
            <option value="hours">hours</option>
            <option value="days">days</option>
          </select>
          then carry on.
        </div>
      );
    case "email":
      return (
        <>
          <input value={step.subject} onChange={(e) => onChange({ subject: e.target.value })} placeholder="Subject, e.g. Thanks {{first_name}}" className="field" aria-label="Subject" />
          <textarea value={step.body} onChange={(e) => onChange({ body: e.target.value })} rows={4} placeholder="Hi {{first_name}}, …" className="field resize-y py-2.5" aria-label="Email message" />
        </>
      );
    case "sms":
      return (
        <>
          <textarea value={step.body} onChange={(e) => onChange({ body: e.target.value })} rows={3} maxLength={640} placeholder="Hi {{first_name}}, …" className="field resize-y py-2.5" aria-label="Text message" />
          <span className="text-right text-[12px] text-faint">{step.body.length}/640</span>
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
    case "note":
      return <textarea value={step.text} onChange={(e) => onChange({ text: e.target.value })} rows={2} placeholder="Note to add to the contact" className="field resize-y py-2.5" aria-label="Note" />;
    case "notify_team":
      return (
        <>
          <input value={step.text} onChange={(e) => onChange({ text: e.target.value })} className="field" aria-label="Alert message" />
          <span className="text-[12px] text-faint">Posts in #leads in Team chat.</span>
        </>
      );
  }
}
