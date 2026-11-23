"use client";

// If / else settings: named branches, each with its own conditions (all or any),
// checked from the top. Anyone who matches none goes down the last branch.

import { useRef, useState } from "react";
import { TimeSelect } from "@/components/time-select";
import { Icon, type IconName } from "@/components/icon";
import { Popover, useListKeys } from "@/components/popover";
import type { Condition, ConditionField, ConditionOp, CustomField, Stage } from "@/lib/data";
import { MAX_BRANCHES, newId, type BranchNode, type Route } from "@/lib/flow";
import { StagePicker, type Option } from "./step-fields";

type Input = "none" | "tag" | "text" | "stage" | "pipeline" | "deal_status" | "member" | "number" | "days" | "time" | "field" | "form" | "workflow" | "date" | "channel" | "daynum" | "count";
type OpChoice = { key: string; label: string; op?: ConditionOp; negate?: boolean; noValue?: boolean };
type Def = { field: ConditionField; label: string; group: string; input: Input; ops: OpChoice[]; icon: IconName; hint: string };

const yesNo = (yes: string, no: string): OpChoice[] => [
  { key: "yes", label: yes },
  { key: "no", label: no, negate: true },
];

const compare = (more: string, less: string, exact?: string): OpChoice[] => [
  { key: "gt", label: more, op: "gt" },
  { key: "lt", label: less, op: "lt" },
  ...(exact ? [{ key: "is", label: exact, op: "is" as const }] : []),
];

export const CONDITION_DEFS: Def[] = [
  // Contact
  { field: "has_tag", label: "Tag", group: "Contact", icon: "tag", hint: "Has or doesn't have a tag", input: "tag", ops: yesNo("has the tag", "does not have the tag") },
  { field: "contact_field", label: "Contact field", group: "Contact", icon: "list", hint: "Any detail or custom field", input: "field", ops: [
    { key: "is", label: "is", op: "is" },
    { key: "is_not", label: "is not", op: "is_not" },
    { key: "contains", label: "contains", op: "contains" },
    { key: "not_contains", label: "does not contain", op: "not_contains" },
    { key: "empty", label: "is empty", op: "empty", noValue: true },
    { key: "not_empty", label: "is not empty", op: "not_empty", noValue: true },
    { key: "gt", label: "is more than", op: "gt" },
    { key: "lt", label: "is less than", op: "lt" },
  ] },
  { field: "source_is", label: "Source", group: "Contact", icon: "share", hint: "Where they came from", input: "text", ops: [
    { key: "yes", label: "is" },
    { key: "no", label: "is not", negate: true },
    { key: "contains", label: "contains", op: "contains" },
  ] },
  { field: "has_email", label: "Email address", group: "Contact", icon: "mail", hint: "Has an email address or not", input: "none", ops: yesNo("has one", "has none") },
  { field: "has_phone", label: "Phone number", group: "Contact", icon: "phone", hint: "Has a phone number or not", input: "none", ops: yesNo("has one", "has none") },
  { field: "contact_age", label: "Date added", group: "Contact", icon: "clock", hint: "How long ago they became a contact", input: "count", ops: compare("was more than", "was less than") },
  { field: "has_owner", label: "Assigned", group: "Contact", icon: "user", hint: "Assigned to anyone or nobody", input: "none", ops: yesNo("to anyone", "to nobody") },
  { field: "owner_is", label: "Assigned user", group: "Contact", icon: "users", hint: "Assigned to a particular teammate", input: "member", ops: yesNo("is", "is not") },
  // Consent
  { field: "email_unsubscribed", label: "Email unsubscribed", group: "Consent", icon: "mail", hint: "Opted out of emails", input: "none", ops: yesNo("has unsubscribed", "has not unsubscribed") },
  { field: "sms_unsubscribed", label: "Texts unsubscribed", group: "Consent", icon: "phone", hint: "Replied STOP or opted out", input: "none", ops: yesNo("has unsubscribed", "has not unsubscribed") },
  // Conversations
  { field: "replied", label: "Replied", group: "Conversations", icon: "inbox", hint: "Any reply since entering this workflow", input: "none", ops: yesNo("has replied since starting", "has not replied") },
  { field: "reply_contains", label: "Reply contains", group: "Conversations", icon: "search", hint: "A word or phrase in their reply", input: "text", ops: yesNo("contains", "does not contain") },
  { field: "reply_channel", label: "Last reply channel", group: "Conversations", icon: "send", hint: "Whether they last replied by email or text", input: "channel", ops: yesNo("was", "was not") },
  // Forms and workflows
  { field: "submitted_form", label: "Form submitted", group: "Forms and workflows", icon: "form", hint: "Has ever sent a particular form", input: "form", ops: yesNo("has submitted", "has not submitted") },
  { field: "in_workflow", label: "In workflow", group: "Forms and workflows", icon: "zap", hint: "Currently running in another workflow", input: "workflow", ops: yesNo("is in", "is not in") },
  { field: "finished_workflow", label: "Finished workflow", group: "Forms and workflows", icon: "checkCircle", hint: "Has completed another workflow", input: "workflow", ops: yesNo("has finished", "has not finished") },
  // Pipeline
  { field: "in_pipeline", label: "Pipeline", group: "Deals", icon: "pipeline", hint: "Has a deal in a pipeline", input: "pipeline", ops: yesNo("has a deal in", "has no deal in") },
  { field: "in_stage", label: "Pipeline stage", group: "Deals", icon: "columns", hint: "A deal is in a particular stage", input: "stage", ops: yesNo("is in", "is not in") },
  { field: "has_open_deal", label: "Open deal", group: "Deals", icon: "card", hint: "Has a deal that's still open", input: "none", ops: yesNo("has one", "has none") },
  { field: "deal_status", label: "Deal status", group: "Deals", icon: "checkCircle", hint: "Open, won or lost", input: "deal_status", ops: yesNo("is", "is not") },
  { field: "deal_value", label: "Deal value (£)", group: "Deals", icon: "pound", hint: "Their latest deal's value", input: "number", ops: compare("is more than", "is less than", "is exactly") },
  { field: "deal_owner_is", label: "Deal owner", group: "Deals", icon: "users", hint: "Who the latest deal is assigned to", input: "member", ops: yesNo("is", "is not") },
  // Date and time
  { field: "day_of_week", label: "Day of the week", group: "Date and time", icon: "calendar", hint: "In your workspace's time zone", input: "days", ops: yesNo("today is", "today is not") },
  { field: "time_of_day", label: "Time of day", group: "Date and time", icon: "clock", hint: "Before or after a time", input: "time", ops: [
    { key: "lt", label: "is before", op: "lt" },
    { key: "gt", label: "is after", op: "gt" },
  ] },
  { field: "day_of_month", label: "Day of the month", group: "Date and time", icon: "calendar", hint: "e.g. the 1st, or after the 25th", input: "daynum", ops: [
    { key: "is", label: "is", op: "is" },
    { key: "gt", label: "is after", op: "gt" },
    { key: "lt", label: "is before", op: "lt" },
  ] },
  { field: "date_is", label: "Date", group: "Date and time", icon: "calendar", hint: "Before, on or after a date", input: "date", ops: [
    { key: "lt", label: "is before", op: "lt" },
    { key: "is", label: "is", op: "is" },
    { key: "gt", label: "is after", op: "gt" },
  ] },
];
const DEF_GROUPS = ["Contact", "Consent", "Conversations", "Forms and workflows", "Deals", "Date and time"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function defFor(field: ConditionField) {
  return CONDITION_DEFS.find((d) => d.field === field) ?? CONDITION_DEFS[0];
}
function opKey(c: Condition) {
  const d = defFor(c.field);
  return (d.ops.find((o) => (o.op ? o.op === c.op : !c.op && Boolean(o.negate) === Boolean(c.negate))) ?? d.ops[0]).key;
}

export function newCondition(field: ConditionField = "has_tag", stages: Stage[] = []): Condition {
  const d = defFor(field);
  const first = d.ops[0];
  const value =
    d.input === "stage" ? stages[0]?.id
    : d.input === "deal_status" ? "won"
    : d.input === "days" ? "1,2,3,4,5"
    : d.input === "time" ? "09:00"
    : d.input === "channel" ? "email"
    : d.input === "count" ? "7"
    : d.input === "daynum" ? "1"
    : "";
  return { field, op: first.op, negate: first.negate || undefined, key: d.input === "field" ? "email" : undefined, value };
}

export function newRoute(n: number): Route {
  return { id: newId(), name: `Branch ${n}`, match: "all", conditions: [newCondition()], steps: [] };
}

/** Plain-English line for a condition, used on the canvas. */
type Ctx = { stages: Stage[]; members: Option[]; pipelines: Option[]; customFields: CustomField[]; forms?: Option[]; workflows?: Option[] };

export function conditionText(c: Condition, ctx: Ctx) {
  const d = defFor(c.field);
  const op = d.ops.find((o) => o.key === opKey(c)) ?? d.ops[0];
  let v = c.value ?? "";
  if (d.input === "stage") v = ctx.stages.find((s) => s.id === v)?.name ?? "a stage";
  if (d.input === "pipeline") v = ctx.pipelines.find((s) => s.id === v)?.name ?? "a pipeline";
  if (d.input === "member") v = ctx.members.find((s) => s.id === v)?.name ?? "someone";
  if (d.input === "days") v = v.split(",").filter(Boolean).map((x) => DAYS[Number(x) - 1]).join(", ");
  if (d.input === "form") v = ctx.forms?.find((s) => s.id === v)?.name ?? "a form";
  if (d.input === "workflow") v = ctx.workflows?.find((s) => s.id === v)?.name ?? "a workflow";
  if (d.input === "channel") v = v === "sms" ? "text" : "email";
  if (d.input === "count") v = `${v} days ago`;
  if (d.input === "date" && /^\d{4}-\d{2}-\d{2}$/.test(v)) v = new Date(`${v}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (c.field === "deal_value") v = `£${v}`;
  const name = d.input === "field" ? fieldLabel(c.key ?? "", ctx.customFields) : d.label;
  return `${name} ${op.label}${op.noValue || d.input === "none" ? "" : ` ${v || "…"}`}`;
}

function fieldLabel(key: string, customFields: CustomField[]) {
  const base: Record<string, string> = { first_name: "First name", last_name: "Last name", email: "Email", phone: "Phone", source: "Source" };
  if (base[key]) return base[key];
  return customFields.find((f) => `custom:${f.key}` === key)?.label ?? "Field";
}

export function BranchFields({
  node,
  onChange,
  stages,
  pipelines,
  members,
  customFields,
  forms = [],
  workflows = [],
}: {
  node: BranchNode;
  onChange: (n: BranchNode) => void;
  stages: Stage[];
  pipelines: Option[];
  members: Option[];
  customFields: CustomField[];
  tags?: string[];
  forms?: Option[];
  workflows?: Option[];
}) {
  const setRoute = (id: string, patch: Partial<Route>) => onChange({ ...node, branches: node.branches.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const moveRoute = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= node.branches.length) return;
    const copy = [...node.branches];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange({ ...node, branches: copy });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-muted">Branches are checked from the top. A contact goes down the first one they match. Anyone who matches none goes down the last branch.</p>

      {node.branches.map((r, i) => (
        <div key={r.id} className="rounded-xl border border-line bg-surface/60 p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-[#ede9fe] px-1.5 text-[11px] font-bold text-[#6d28d9]">{i + 1}</span>
            <input value={r.name} maxLength={40} onChange={(e) => setRoute(r.id, { name: e.target.value })} className="field h-9 min-w-0 flex-1 text-[13.5px] font-semibold" aria-label="Branch name" />
            <button type="button" title="Move up" aria-label="Move branch up" disabled={i === 0} onClick={() => moveRoute(i, -1)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-white disabled:opacity-30">
              <Icon name="arrowUp" size={14} />
            </button>
            <button type="button" title="Move down" aria-label="Move branch down" disabled={i === node.branches.length - 1} onClick={() => moveRoute(i, 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-white disabled:opacity-30">
              <Icon name="arrowDown" size={14} />
            </button>
            {node.branches.length > 1 && (
              <button
                type="button"
                title="Remove branch"
                aria-label="Remove branch"
                onClick={() => {
                  if (r.steps.length && !confirm(`Remove "${r.name}" and the ${r.steps.length} step${r.steps.length === 1 ? "" : "s"} inside it?`)) return;
                  onChange({ ...node, branches: node.branches.filter((x) => x.id !== r.id) });
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-faint hover:bg-bad-bg hover:text-bad"
              >
                <Icon name="trash" size={14} />
              </button>
            )}
          </div>

          {r.conditions.length > 1 && (
            <div className="mb-2 inline-flex rounded-lg bg-white p-0.5 text-[12px] font-semibold ring-1 ring-line">
              {(["all", "any"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setRoute(r.id, { match: m })} className={`rounded-md px-2.5 py-1 ${r.match === m ? "bg-navy text-white" : "text-muted"}`}>
                  {m === "all" ? "Match all (AND)" : "Match any (OR)"}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {r.conditions.map((c, ci) => (
              <div key={ci}>
                {ci > 0 && <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#7c3aed]">{r.match === "all" ? "and" : "or"}</div>}
                <ConditionRow
                  c={c}
                  onChange={(nc) => setRoute(r.id, { conditions: r.conditions.map((x, j) => (j === ci ? nc : x)) })}
                  onRemove={r.conditions.length > 1 ? () => setRoute(r.id, { conditions: r.conditions.filter((_, j) => j !== ci) }) : undefined}
                  stages={stages}
                  pipelines={pipelines}
                  members={members}
                  customFields={customFields}
                  forms={forms}
                  workflows={workflows}
                />
              </div>
            ))}
          </div>
          {r.conditions.length < 10 && (
            <button type="button" onClick={() => setRoute(r.id, { conditions: [...r.conditions, newCondition("has_tag", stages)] })} className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand">
              <Icon name="plus" size={13} /> Add condition
            </button>
          )}
        </div>
      ))}

      {node.branches.length < MAX_BRANCHES && (
        <button type="button" onClick={() => onChange({ ...node, branches: [...node.branches, newRoute(node.branches.length + 1)] })} className="btn-ghost inline-flex min-h-10 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold">
          <Icon name="branch" size={14} /> Add another branch
        </button>
      )}

      <div className="rounded-xl border border-dashed border-line-strong p-3">
        <div className="mb-1.5 text-[12px] font-semibold text-muted">When none match</div>
        <input value={node.otherwise.name} maxLength={40} onChange={(e) => onChange({ ...node, otherwise: { ...node.otherwise, name: e.target.value } })} className="field h-9 w-full text-[13.5px] font-semibold" aria-label="Name of the none branch" />
      </div>
    </div>
  );
}

function ConditionRow({
  c,
  onChange,
  onRemove,
  stages,
  pipelines,
  members,
  customFields,
  forms,
  workflows,
}: {
  c: Condition;
  onChange: (c: Condition) => void;
  onRemove?: () => void;
  stages: Stage[];
  pipelines: Option[];
  members: Option[];
  customFields: CustomField[];
  forms: Option[];
  workflows: Option[];
}) {
  const d = defFor(c.field);
  const key = opKey(c);
  const op = d.ops.find((o) => o.key === key) ?? d.ops[0];
  const showValue = d.input !== "none" && !op.noValue;
  const set = (p: Partial<Condition>) => onChange({ ...c, ...p });

  return (
    <div className="rounded-lg bg-white p-2 ring-1 ring-line">
      <div className="flex items-center gap-1.5">
        <ConditionTypePicker value={c.field} onPick={(f) => onChange(newCondition(f, stages))} />
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label="Remove condition" title="Remove condition" className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg text-faint hover:bg-bad-bg hover:text-bad">
            <Icon name="x" size={14} />
          </button>
        )}
      </div>

      {d.input === "field" && (
        <select value={c.key ?? "email"} onChange={(e) => set({ key: e.target.value })} className="field mt-1.5 h-9 w-full text-[13px]" aria-label="Field">
          <option value="first_name">First name</option>
          <option value="last_name">Last name</option>
          <option value="email">Email</option>
          <option value="phone">Phone</option>
          <option value="source">Source</option>
          {customFields.map((f) => (
            <option key={f.key} value={`custom:${f.key}`}>{f.label}</option>
          ))}
        </select>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <select
          value={key}
          onChange={(e) => {
            const o = d.ops.find((x) => x.key === e.target.value) ?? d.ops[0];
            set({ op: o.op, negate: o.negate || undefined });
          }}
          className="field h-9 min-w-0 flex-[1_1_140px] text-[13px]"
          aria-label="Operator"
        >
          {d.ops.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
        {showValue && <ValueInput c={c} input={d.input} set={set} stages={stages} pipelines={pipelines} members={members} customFields={customFields} forms={forms} workflows={workflows} />}
      </div>
    </div>
  );
}

function ValueInput({
  c,
  input,
  set,
  stages,
  pipelines,
  members,
  customFields,
  forms,
  workflows,
}: {
  c: Condition;
  input: Input;
  set: (p: Partial<Condition>) => void;
  stages: Stage[];
  pipelines: Option[];
  members: Option[];
  customFields: CustomField[];
  forms: Option[];
  workflows: Option[];
}) {
  const cls = "field h-9 min-w-0 flex-[1_1_140px] text-[13px]";
  const v = c.value ?? "";
  switch (input) {
    case "tag":
      return <input list="wf-tags" value={v} maxLength={40} onChange={(e) => set({ value: e.target.value })} placeholder="Tag name" className={cls} aria-label="Tag" />;
    case "stage":
      return (
        <div className="w-full">
          <StagePicker stages={stages} pipelines={pipelines} value={v} onChange={(x) => set({ value: x.stageId })} />
        </div>
      );
    case "pipeline":
      return (
        <select value={v} onChange={(e) => set({ value: e.target.value })} className={cls} aria-label="Pipeline">
          <option value="">Choose a pipeline</option>
          {pipelines.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      );
    case "member":
      return (
        <select value={v} onChange={(e) => set({ value: e.target.value })} className={cls} aria-label="Team member">
          <option value="">{members.length ? "Choose a teammate" : "No teammates yet"}</option>
          {members.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      );
    case "deal_status":
      return (
        <select value={v || "won"} onChange={(e) => set({ value: e.target.value })} className={cls} aria-label="Deal status">
          <option value="open">Open</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
      );
    case "form":
      return (
        <select value={v} onChange={(e) => set({ value: e.target.value })} className={cls} aria-label="Form">
          <option value="">{forms.length ? "Choose a form" : "No forms yet"}</option>
          {forms.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      );
    case "workflow":
      return (
        <select value={v} onChange={(e) => set({ value: e.target.value })} className={cls} aria-label="Workflow">
          <option value="">{workflows.length ? "Choose a workflow" : "No other workflows yet"}</option>
          {workflows.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      );
    case "channel":
      return (
        <select value={v || "email"} onChange={(e) => set({ value: e.target.value })} className={cls} aria-label="Channel">
          <option value="email">Email</option>
          <option value="sms">Text message</option>
        </select>
      );
    case "count":
      return (
        <span className="inline-flex flex-[1_1_140px] items-center gap-2">
          <input type="number" min={0} max={36500} value={v} onChange={(e) => set({ value: e.target.value.replace(/\D/g, "").slice(0, 5) })} className="field h-9 w-24 text-[13px]" aria-label="Days" />
          <span className="text-[13px] text-muted">days ago</span>
        </span>
      );
    case "daynum":
      return (
        <select value={v || "1"} onChange={(e) => set({ value: e.target.value })} className={cls} aria-label="Day of the month">
          {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      );
    case "date":
      return <input type="date" value={v} onChange={(e) => set({ value: e.target.value })} className={cls} aria-label="Date" />;
    case "number":
      return <input type="number" min={0} value={v} onChange={(e) => set({ value: e.target.value })} placeholder="e.g. 1000" className={cls} aria-label="Amount" />;
    case "time":
      return <TimeSelect value={v || "09:00"} onChange={(x) => set({ value: x })} className={cls} aria-label="Time" />;
    case "days": {
      const on = new Set(v.split(",").filter(Boolean));
      return (
        <div className="flex flex-wrap gap-1">
          {DAYS.map((d, i) => {
            const k = String(i + 1);
            const active = on.has(k);
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  const next = new Set(on);
                  if (active) next.delete(k);
                  else next.add(k);
                  set({ value: [...next].sort().join(",") });
                }}
                className={`h-8 rounded-lg px-2 text-[12px] font-semibold ring-1 ${active ? "bg-navy text-white ring-navy" : "bg-white text-muted ring-line"}`}
              >
                {d}
              </button>
            );
          })}
        </div>
      );
    }
    case "field": {
      const cf = c.key?.startsWith("custom:") ? customFields.find((f) => `custom:${f.key}` === c.key) : undefined;
      if (cf?.type === "select" || cf?.type === "yes_no")
        return (
          <select value={v} onChange={(e) => set({ value: e.target.value })} className={cls} aria-label="Value">
            <option value="">Choose</option>
            {(cf.type === "yes_no" ? ["yes", "no"] : cf.options).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        );
      return <input value={v} maxLength={100} onChange={(e) => set({ value: e.target.value })} placeholder="Value" className={cls} aria-label="Value" />;
    }
    default:
      return <input value={v} maxLength={100} onChange={(e) => set({ value: e.target.value })} placeholder="e.g. Facebook" className={cls} aria-label="Value" />;
  }
}

/** "What to check": a searchable list of every condition, grouped, with a short hint each. */
function ConditionTypePicker({ value, onPick }: { value: ConditionField; onPick: (f: ConditionField) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const btn = useRef<HTMLButtonElement>(null);
  const current = defFor(value);
  const needle = q.trim().toLowerCase();
  const shown = CONDITION_DEFS.filter((d) => !needle || `${d.label} ${d.group} ${d.hint}`.toLowerCase().includes(needle));
  // Same order as on screen, so arrow keys move down the list as you see it.
  const order = DEF_GROUPS.flatMap((g) => shown.filter((d) => d.group === g));
  const close = () => {
    setOpen(false);
    setQ("");
  };
  const choose = (d: Def) => {
    if (d.field !== value) onPick(d.field);
    close();
  };
  const keys = useListKeys(order.length, (i) => choose(order[i]));

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="What to check"
        className={`flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border bg-white px-2.5 text-left transition hover:border-sky ${open ? "border-sky ring-2 ring-sky/20" : "border-line"}`}
      >
        <span className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-lg bg-chip text-brand">
          <Icon name={current.icon} size={13} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-navy">{current.label}</span>
        <span className="hidden flex-none text-[11.5px] text-faint sm:inline">{current.group}</span>
        <Icon name="chevronDown" size={14} className="flex-none text-faint" />
      </button>
      <Popover anchor={btn} open={open} onClose={close} width={380} label="What to check">
        <div className="flex-none border-b border-line p-2.5">
          <label className="flex h-10 items-center gap-2 rounded-xl bg-surface px-3 ring-1 ring-transparent focus-within:bg-white focus-within:ring-sky">
            <Icon name="search" size={14} className="text-faint" />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                keys.setActive(0);
              }}
              onKeyDown={keys.onKeyDown}
              placeholder="Search conditions, e.g. form, tag, reply"
              className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none focus-visible:outline-none"
              aria-label="Search conditions"
            />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {DEF_GROUPS.filter((g) => shown.some((d) => d.group === g)).map((g) => (
            <div key={g} className="mb-1">
              <div className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-faint">{g}</div>
              {shown
                .filter((d) => d.group === g)
                .map((d) => {
                  const idx = order.indexOf(d);
                  const on = idx === keys.active;
                  const picked = d.field === value;
                  return (
                    <button
                      key={d.field}
                      type="button"
                      onMouseEnter={() => keys.setActive(idx)}
                      onClick={() => choose(d)}
                      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left ${on ? "bg-chip" : ""}`}
                    >
                      <span className={`inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg ${picked ? "bg-brand text-white" : "bg-surface text-muted"}`}>
                        <Icon name={d.icon} size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-navy">{d.label}</span>
                        <span className="block truncate text-[12px] text-muted">{d.hint}</span>
                      </span>
                      {picked && <Icon name="check" size={15} className="flex-none text-brand" />}
                    </button>
                  );
                })}
            </div>
          ))}
          {shown.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-muted">Nothing matches &ldquo;{q}&rdquo;.</p>}
        </div>
      </Popover>
    </>
  );
}
