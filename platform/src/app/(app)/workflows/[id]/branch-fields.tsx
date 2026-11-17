"use client";

// If / else settings: named branches, each with its own conditions (all or any),
// checked from the top. Anyone who matches none goes down the last branch.

import { Icon } from "@/components/icon";
import type { Condition, ConditionField, ConditionOp, CustomField, Stage } from "@/lib/data";
import { MAX_BRANCHES, newId, type BranchNode, type Route } from "@/lib/flow";
import type { Option } from "./step-fields";

type Input = "none" | "tag" | "text" | "stage" | "pipeline" | "deal_status" | "member" | "number" | "days" | "time" | "field";
type OpChoice = { key: string; label: string; op?: ConditionOp; negate?: boolean; noValue?: boolean };
type Def = { field: ConditionField; label: string; group: string; input: Input; ops: OpChoice[] };

const yesNo = (yes: string, no: string): OpChoice[] => [
  { key: "yes", label: yes },
  { key: "no", label: no, negate: true },
];

export const CONDITION_DEFS: Def[] = [
  { field: "has_tag", label: "Tag", group: "Contact", input: "tag", ops: yesNo("has the tag", "does not have the tag") },
  { field: "contact_field", label: "Contact field", group: "Contact", input: "field", ops: [
    { key: "is", label: "is", op: "is" },
    { key: "is_not", label: "is not", op: "is_not" },
    { key: "contains", label: "contains", op: "contains" },
    { key: "not_contains", label: "does not contain", op: "not_contains" },
    { key: "empty", label: "is empty", op: "empty", noValue: true },
    { key: "not_empty", label: "is not empty", op: "not_empty", noValue: true },
    { key: "gt", label: "is more than", op: "gt" },
    { key: "lt", label: "is less than", op: "lt" },
  ] },
  { field: "source_is", label: "Source", group: "Contact", input: "text", ops: [
    { key: "yes", label: "is" },
    { key: "no", label: "is not", negate: true },
    { key: "contains", label: "contains", op: "contains" },
  ] },
  { field: "has_email", label: "Email address", group: "Contact", input: "none", ops: yesNo("has one", "has none") },
  { field: "has_phone", label: "Phone number", group: "Contact", input: "none", ops: yesNo("has one", "has none") },
  { field: "has_owner", label: "Assigned", group: "Contact", input: "none", ops: yesNo("to anyone", "to nobody") },
  { field: "owner_is", label: "Assigned user", group: "Contact", input: "member", ops: yesNo("is", "is not") },
  { field: "replied", label: "Reply", group: "Conversations", input: "none", ops: yesNo("has replied since starting", "has not replied") },
  { field: "in_pipeline", label: "Pipeline", group: "Pipeline", input: "pipeline", ops: yesNo("has a deal in", "has no deal in") },
  { field: "in_stage", label: "Pipeline stage", group: "Pipeline", input: "stage", ops: yesNo("is in", "is not in") },
  { field: "deal_status", label: "Deal status", group: "Pipeline", input: "deal_status", ops: yesNo("is", "is not") },
  { field: "deal_value", label: "Deal value (£)", group: "Pipeline", input: "number", ops: [
    { key: "gt", label: "is more than", op: "gt" },
    { key: "lt", label: "is less than", op: "lt" },
    { key: "is", label: "is exactly", op: "is" },
  ] },
  { field: "day_of_week", label: "Day of the week", group: "Date and time", input: "days", ops: yesNo("today is", "today is not") },
  { field: "time_of_day", label: "Time of day", group: "Date and time", input: "time", ops: [
    { key: "lt", label: "is before", op: "lt" },
    { key: "gt", label: "is after", op: "gt" },
  ] },
];
const DEF_GROUPS = ["Contact", "Conversations", "Pipeline", "Date and time"];
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
  const value = d.input === "stage" ? stages[0]?.id : d.input === "deal_status" ? "won" : d.input === "days" ? "1,2,3,4,5" : d.input === "time" ? "09:00" : "";
  return { field, op: first.op, negate: first.negate || undefined, key: d.input === "field" ? "email" : undefined, value };
}

export function newRoute(n: number): Route {
  return { id: newId(), name: `Branch ${n}`, match: "all", conditions: [newCondition()], steps: [] };
}

/** Plain-English line for a condition, used on the canvas. */
export function conditionText(c: Condition, ctx: { stages: Stage[]; members: Option[]; pipelines: Option[]; customFields: CustomField[] }) {
  const d = defFor(c.field);
  const op = d.ops.find((o) => o.key === opKey(c)) ?? d.ops[0];
  let v = c.value ?? "";
  if (d.input === "stage") v = ctx.stages.find((s) => s.id === v)?.name ?? "a stage";
  if (d.input === "pipeline") v = ctx.pipelines.find((s) => s.id === v)?.name ?? "a pipeline";
  if (d.input === "member") v = ctx.members.find((s) => s.id === v)?.name ?? "someone";
  if (d.input === "days") v = v.split(",").filter(Boolean).map((x) => DAYS[Number(x) - 1]).join(", ");
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
}: {
  node: BranchNode;
  onChange: (n: BranchNode) => void;
  stages: Stage[];
  pipelines: Option[];
  members: Option[];
  customFields: CustomField[];
  tags?: string[];
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
}: {
  c: Condition;
  onChange: (c: Condition) => void;
  onRemove?: () => void;
  stages: Stage[];
  pipelines: Option[];
  members: Option[];
  customFields: CustomField[];
}) {
  const d = defFor(c.field);
  const key = opKey(c);
  const op = d.ops.find((o) => o.key === key) ?? d.ops[0];
  const showValue = d.input !== "none" && !op.noValue;
  const set = (p: Partial<Condition>) => onChange({ ...c, ...p });

  return (
    <div className="rounded-lg bg-white p-2 ring-1 ring-line">
      <div className="flex items-center gap-1.5">
        <select
          value={c.field}
          onChange={(e) => onChange(newCondition(e.target.value as ConditionField, stages))}
          className="field h-9 min-w-0 flex-1 text-[13px]"
          aria-label="What to check"
        >
          {DEF_GROUPS.map((g) => (
            <optgroup key={g} label={g}>
              {CONDITION_DEFS.filter((x) => x.group === g).map((x) => (
                <option key={x.field} value={x.field}>{x.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
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
        {showValue && <ValueInput c={c} input={d.input} set={set} stages={stages} pipelines={pipelines} members={members} customFields={customFields} />}
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
}: {
  c: Condition;
  input: Input;
  set: (p: Partial<Condition>) => void;
  stages: Stage[];
  pipelines: Option[];
  members: Option[];
  customFields: CustomField[];
}) {
  const cls = "field h-9 min-w-0 flex-[1_1_140px] text-[13px]";
  const v = c.value ?? "";
  switch (input) {
    case "tag":
      return <input list="wf-tags" value={v} maxLength={40} onChange={(e) => set({ value: e.target.value })} placeholder="Tag name" className={cls} aria-label="Tag" />;
    case "stage":
      return (
        <select value={v} onChange={(e) => set({ value: e.target.value })} className={cls} aria-label="Stage">
          {stages.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
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
          <option value="">Choose someone</option>
          {members.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      );
    case "deal_status":
      return (
        <select value={v || "won"} onChange={(e) => set({ value: e.target.value })} className={cls} aria-label="Deal status">
          <option value="open">open</option>
          <option value="won">won</option>
          <option value="lost">lost</option>
        </select>
      );
    case "number":
      return <input type="number" min={0} value={v} onChange={(e) => set({ value: e.target.value })} placeholder="e.g. 1000" className={cls} aria-label="Amount" />;
    case "time":
      return <input type="time" value={v || "09:00"} onChange={(e) => set({ value: e.target.value })} className={cls} aria-label="Time" />;
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
