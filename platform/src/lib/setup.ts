// The AI setup assistant's proposal ("blueprint") and how it becomes a plan
// for the database. Shared by the page (client) and the Build action (server).

import { SETUP_TEMPLATE_KEYS, TEMPLATES } from "@/lib/workflow-templates";

export type Blueprint = {
  summary: string;
  business_name?: string;
  industry?: string;
  pipeline: { name: string; stages: string[] };
  fields: { label: string; key?: string; why?: string }[];
  tags: string[];
  workflows: { template: string; why?: string }[];
  tasks: { title: string; due_in_days: number }[];
  values: { key: string; value: string }[];
  questions?: string[];
};

export const SETUP_TEMPLATES = SETUP_TEMPLATE_KEYS.map((key) => ({ key, name: TEMPLATES[key].name, description: TEMPLATES[key].description }));

/** Lower-case snake_case key from a label, matching the database rule ^[a-z][a-z0-9_]*$. */
export function toKey(label: string, max = 40) {
  const k = label.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, max);
  return /^[a-z]/.test(k) ? k : k ? `f_${k}`.slice(0, max) : "";
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

function uniqueBy<T>(items: T[], key: (t: T) => string) {
  const seen = new Set<string>();
  return items.filter((t) => {
    const k = key(t);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Re-checks an edited blueprint. Anything malformed is dropped, never trusted. */
export function cleanBlueprint(raw: unknown): Blueprint | string {
  type Obj = Record<string, unknown>;
  const b = (raw ?? {}) as { pipeline?: Obj; fields?: unknown; tags?: unknown; workflows?: unknown; tasks?: unknown; values?: unknown; summary?: unknown; business_name?: unknown; industry?: unknown };
  const stages = uniqueBy<string>((Array.isArray(b.pipeline?.stages) ? (b.pipeline.stages as unknown[]) : []).map((s: unknown) => str(s, 40)), (s) => s.toLowerCase()).slice(0, 10);
  if (stages.length < 2) return "Add at least two pipeline stages.";

  const fields = uniqueBy(
    (Array.isArray(b.fields) ? b.fields : []).map((f) => ({ label: str((f as Obj)?.label, 60), key: toKey(str((f as Obj)?.label, 60)) })),
    (f) => f.key,
  ).slice(0, 20);

  const tags = uniqueBy<string>((Array.isArray(b.tags) ? b.tags : []).map((t: unknown) => str(t, 40)), (t) => t.toLowerCase()).slice(0, 25);

  const allowed = new Set<string>(SETUP_TEMPLATE_KEYS);
  const workflows = uniqueBy(
    (Array.isArray(b.workflows) ? b.workflows : []).map((w) => ({ template: String((w as Obj)?.template ?? "") })).filter((w: { template: string }) => allowed.has(w.template)),
    (w) => w.template,
  );

  const tasks = (Array.isArray(b.tasks) ? b.tasks : [])
    .map((t) => ({ title: str((t as Obj)?.title, 200), due_in_days: Math.min(30, Math.max(0, Number.parseInt(String((t as Obj)?.due_in_days ?? 0), 10) || 0)) }))
    .filter((t: { title: string }) => t.title)
    .slice(0, 12);

  const values = uniqueBy(
    (Array.isArray(b.values) ? b.values : [])
      .map((v) => { const o = v as Obj; return { key: toKey(String(o?.key ?? "")), value: typeof o?.value === "string" ? o.value.trim().slice(0, 1000) : "" }; })
      .filter((v: { value: string }) => v.value),
    (v) => v.key,
  ).slice(0, 20);

  return {
    summary: str(b.summary, 600),
    business_name: str(b.business_name, 80),
    industry: str(b.industry, 60),
    pipeline: { name: str(b.pipeline?.name, 40) || "Sales", stages },
    fields,
    tags,
    workflows,
    tasks,
    values,
    questions: [],
  };
}

/** Turns a clean blueprint into the plan apply_workspace_setup() expects. Workflows come from our tested templates only. */
export function buildPlan(b: Blueprint, replaceStages: boolean, hookToken: () => string) {
  return {
    pipeline: { name: b.pipeline.name, stages: b.pipeline.stages, replace: replaceStages },
    fields: b.fields.map((f) => ({ key: f.key || toKey(f.label), label: f.label })),
    tags: b.tags,
    workflows: b.workflows.map(({ template }) => {
      const t = TEMPLATES[template];
      return {
        name: t.name,
        description: t.description,
        trigger: t.trigger.type === "webhook" ? { type: "webhook", token: hookToken() } : t.trigger,
        steps: t.steps,
      };
    }),
    tasks: b.tasks,
    values: b.values,
  };
}

export type SetupResult = {
  pipeline_created: boolean;
  stages_replaced: boolean;
  stages: number;
  field_ids: string[];
  tag_ids: string[];
  workflow_ids: string[];
  task_ids: string[];
  value_keys: string[];
  skipped: string[];
};
