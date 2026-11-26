"use server";

import { shortId } from "@/lib/short-id-shared";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deliverPending } from "@/lib/deliver";
import { can, getWorkspace, type Condition, type WorkflowStep, type WorkflowTrigger, listAllStages } from "@/lib/data";
import { compile, countNodes, MAX_BRANCHES, MAX_NODES, newId, toTree, type FlowNode } from "@/lib/flow";
import { actionLabel } from "./labels";
import { text, type ActionResult } from "@/lib/forms";
import { TEMPLATES, newHookToken } from "@/lib/workflow-templates";

/** Creates a workflow from a template and opens it. */
export async function createWorkflow(fd: FormData) {
  const key = text(fd, "template", 20);
  const t = TEMPLATES[key] ?? TEMPLATES.blank;
  const ws = await getWorkspace();
  const supabase = await createClient();
  let name = t.name;
  for (let i = 2; i < 50; i++) {
    const { count } = await supabase.from("workflows").select("id", { count: "exact", head: true }).eq("account_id", ws.account.id).eq("name", name);
    if (!count) break;
    name = `${t.name} ${i}`;
  }
  const trigger = t.trigger.type === "webhook" ? { type: "webhook", token: newHookToken() } : t.trigger;
  const { data, error } = await supabase.from("workflows").insert({ account_id: ws.account.id, name, description: t.description, trigger, steps: t.steps }).select("id").single();
  if (error || !data) redirect("/workflows?error=1");
  redirect(`/workflows/${shortId(data.id)}`);
}

const STEP_TYPES = new Set([
  "wait", "wait_until", "wait_for_reply", "wait_appointment", "email", "sms", "task", "move_stage", "set_status", "note", "notify_team",
  "add_tag", "remove_tag", "assign", "if_else", "add_to_workflow", "remove_from_workflow", "webhook", "end",
  "update_field", "email_team",
]);
const CONDITIONS = new Set([
  "has_tag", "has_email", "has_phone", "replied", "in_stage", "deal_status", "source_is", "has_owner", "contact_field", "owner_is", "deal_value", "in_pipeline", "day_of_week", "time_of_day",
  "email_unsubscribed", "sms_unsubscribed", "contact_age", "reply_contains", "reply_channel", "submitted_form", "in_workflow", "finished_workflow", "has_open_deal", "deal_owner_is", "day_of_month", "date_is",
  "has_appointment", "appointment_status",
]);
const OPS = new Set(["is", "is_not", "contains", "not_contains", "empty", "not_empty", "gt", "lt"]);
const UNITS = ["minutes", "hours", "days"];

function stepId() {
  return Math.random().toString(36).slice(2, 10);
}

/** Only public https addresses, so a workflow can't be pointed at internal systems. */
function safeUrl(raw: string) {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:") return null;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^[\d.]+$/.test(h) || h.includes(":")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

type Ctx = { stageIds: Set<string>; pipelineIds: Set<string>; memberIds: Set<string>; workflowIds: Set<string>; formIds: Set<string>; fieldKeys: Set<string>; selfId: string };

/** Plain text from HTML, for the text copy sent alongside a designed email. */
function stripHtml(html: string) {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Checks one action step. Returns the clean step, or a message saying what's missing. */
function cleanStep(s: unknown, ctx: Ctx, seen: Set<string>): WorkflowStep | string {
  if (!s || typeof s !== "object" || !STEP_TYPES.has((s as { type: string }).type) || (s as { type: string }).type === "if_else") return "One of the steps isn't valid.";
  const st = s as Record<string, unknown>;
  const str = (k: string, max: number) => String(st[k] ?? "").slice(0, max);
  let id = str("id", 20).replace(/[^a-z0-9]/gi, "");
  if (!id || seen.has(id)) id = stepId();
  seen.add(id);
  const label = str("label", 60).trim() || undefined;
  const n = `"${label ?? actionLabel[String(st.type)] ?? "A step"}"`;
  const out: WorkflowStep[] = [];
  const amount = Math.round(Number(st.amount));
  const unit = (UNITS.includes(String(st.unit)) ? st.unit : "hours") as "hours";
  switch (st.type) {
    case "wait":
    case "wait_for_reply":
      if (!(amount >= 1 && amount <= 365)) return `${n}: wait between 1 and 365.`;
      out.push({ id, type: st.type, amount, unit });
      return { ...out[0], label } as WorkflowStep;
    case "wait_appointment":
      if (!(amount >= 0 && amount <= 365)) return `${n}: choose between 0 and 365.`;
      out.push({ id, type: "wait_appointment", amount, unit, when: st.when === "after" ? "after" : "before" });
      return { ...out[0], label } as WorkflowStep;
    case "wait_until": {
      const hour = Math.round(Number(st.hour));
      const minute = Math.round(Number(st.minute) || 0);
      if (!(hour >= 0 && hour <= 23) || !(minute >= 0 && minute <= 59)) return `${n}: choose a time.`;
      out.push({ id, type: "wait_until", hour, minute, weekdays_only: Boolean(st.weekdays_only) });
      return { ...out[0], label } as WorkflowStep;
    }
    case "email": {
      const mode = ["text", "design", "code"].includes(String(st.mode)) ? (st.mode as "text") : st.html ? "design" : "text";
      const subject = str("subject", 200);
      if (!subject.trim()) return `${n}: the email needs a subject.`;
      if (mode === "text") {
        if (!str("body", 5000).trim()) return `${n}: the email needs a message.`;
        out.push({ id, type: "email", subject, body: str("body", 5000), mode });
      } else {
        const html = String(st.html ?? "");
        if (html.length > 200000) return `${n}: the design is too big. Keep it under 200 KB.`;
        const body = stripHtml(html).slice(0, 5000);
        if (!body.trim() && !/<img/i.test(html)) return `${n}: the email design is empty.`;
        out.push({ id, type: "email", subject, body: body || " ", html, mode });
      }
      return { ...out[0], label } as WorkflowStep;
    }
    case "email_team": {
      const to = str("to", 40);
      if (to !== "owner" && to !== "everyone" && !ctx.memberIds.has(to)) return `${n}: choose who to email.`;
      if (!str("subject", 200).trim() || !str("body", 5000).trim()) return `${n}: the team email needs a subject and a message.`;
      out.push({ id, type: "email_team", to, subject: str("subject", 200), body: str("body", 5000) });
      return { ...out[0], label } as WorkflowStep;
    }
    case "update_field": {
      const field = str("field", 60);
      const ok = ["first_name", "last_name", "source"].includes(field) || (field.startsWith("custom:") && ctx.fieldKeys.has(field.slice(7)));
      if (!ok) return `${n}: choose a field to update.`;
      out.push({ id, type: "update_field", field, value: str("value", 500) });
      return { ...out[0], label } as WorkflowStep;
    }
    case "sms":
      if (!str("body", 640).trim()) return `${n}: the text needs a message.`;
      out.push({ id, type: "sms", body: str("body", 640) });
      return { ...out[0], label } as WorkflowStep;
    case "task":
      if (!str("title", 200).trim()) return `${n}: the task needs a title.`;
      out.push({ id, type: "task", title: str("title", 200), due_in_days: Math.max(0, Math.min(365, Math.round(Number(st.due_in_days) || 0))) });
      return { ...out[0], label } as WorkflowStep;
    case "move_stage":
      if (!ctx.stageIds.has(str("stage_id", 40))) return `${n}: choose a stage.`;
      out.push({ id, type: "move_stage", stage_id: str("stage_id", 40) });
      return { ...out[0], label } as WorkflowStep;
    case "set_status": {
      const status = str("status", 10);
      if (!["open", "won", "lost"].includes(status)) return `${n}: choose won, lost or open.`;
      out.push({ id, type: "set_status", status: status as "won" });
      return { ...out[0], label } as WorkflowStep;
    }
    case "note":
      if (!str("text", 2000).trim()) return `${n}: the note is empty.`;
      out.push({ id, type: "note", text: str("text", 2000) });
      return { ...out[0], label } as WorkflowStep;
    case "notify_team":
      out.push({ id, type: "notify_team", text: str("text", 1000) || "New lead: {{name}}" });
      return { ...out[0], label } as WorkflowStep;
    case "add_tag":
    case "remove_tag": {
      const list = (Array.isArray(st.tags) ? st.tags : [st.tag])
        .map((t) => String(t ?? "").trim().slice(0, 40))
        .filter((t, i, all) => t && all.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i)
        .slice(0, 10);
      if (!list.length) return `${n}: add at least one tag.`;
      out.push({ id, type: st.type, tags: list });
      return { ...out[0], label } as WorkflowStep;
    }
    case "assign": {
      const user = str("user_id", 40);
      if (user !== "round_robin" && !ctx.memberIds.has(user)) return `${n}: choose who to assign.`;
      out.push({ id, type: "assign", user_id: user });
      return { ...out[0], label } as WorkflowStep;
    }
    case "add_to_workflow":
    case "remove_from_workflow": {
      const wf = str("workflow_id", 40);
      if (!ctx.workflowIds.has(wf) || wf === ctx.selfId) return `${n}: choose another workflow.`;
      out.push({ id, type: st.type, workflow_id: wf });
      return { ...out[0], label } as WorkflowStep;
    }
    case "webhook": {
      const url = safeUrl(str("url", 500));
      if (!url) return `${n}: enter a web address starting with https://`;
      out.push({ id, type: "webhook", url });
      return { ...out[0], label } as WorkflowStep;
    }
    case "end":
      out.push({ id, type: "end" });
      return { ...out[0], label } as WorkflowStep;
  }
  return "One of the steps isn't valid.";
}

/** Checks one condition in an If / else branch. */
function cleanCondition(raw: unknown, ctx: Ctx, where: string): Condition | string {
  const c = (raw ?? {}) as Record<string, unknown>;
  const field = String(c.field ?? "");
  if (!CONDITIONS.has(field)) return `${where}: choose what to check.`;
  const op = OPS.has(String(c.op)) ? (String(c.op) as Condition["op"]) : undefined;
  const value = String(c.value ?? "").slice(0, 100).trim();
  const key = String(c.key ?? "").slice(0, 60);
  const out: Condition = { field: field as Condition["field"], negate: Boolean(c.negate) || undefined, op, value: value || undefined };
  const needsValue =
    ["has_tag", "source_is", "in_stage", "deal_status", "owner_is", "deal_value", "in_pipeline", "day_of_week", "time_of_day",
     "contact_age", "reply_contains", "reply_channel", "submitted_form", "in_workflow", "finished_workflow", "deal_owner_is", "day_of_month", "date_is", "appointment_status"].includes(field) ||
    (field === "contact_field" && op !== "empty" && op !== "not_empty");
  if (needsValue && !value) return `${where}: finish the condition.`;
  if (field === "in_stage" && !ctx.stageIds.has(value)) return `${where}: choose a stage.`;
  if (field === "in_pipeline" && !ctx.pipelineIds.has(value)) return `${where}: choose a pipeline.`;
  if ((field === "owner_is" || field === "deal_owner_is") && !ctx.memberIds.has(value)) return `${where}: choose a team member.`;
  if (field === "submitted_form" && !ctx.formIds.has(value)) return `${where}: choose a form.`;
  if ((field === "in_workflow" || field === "finished_workflow") && (!ctx.workflowIds.has(value) || value === ctx.selfId)) return `${where}: choose another workflow.`;
  if (field === "reply_channel" && !["email", "sms"].includes(value)) return `${where}: choose email or text.`;
  if (field === "contact_age") {
    if (!/^\d{1,5}$/.test(value)) return `${where}: enter a number of days.`;
    if (op !== "gt" && op !== "lt") out.op = "gt";
  }
  if (field === "day_of_month") {
    if (!/^([1-9]|[12]\d|3[01])$/.test(value)) return `${where}: choose a day from 1 to 31.`;
    if (op !== "gt" && op !== "lt" && op !== "is") out.op = "is";
  }
  if (field === "date_is") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${where}: choose a date.`;
    if (op !== "gt" && op !== "lt" && op !== "is") out.op = "is";
  }
  if (field === "deal_status" && !["open", "won", "lost"].includes(value)) return `${where}: choose a deal status.`;
  if (field === "appointment_status" && !["booked", "showed", "no_show", "cancelled"].includes(value)) return `${where}: choose an appointment status.`;
  if (field === "has_appointment") out.value = undefined;
  if ((field === "deal_value" || ((op === "gt" || op === "lt") && field === "contact_field")) && Number.isNaN(Number(value))) return `${where}: enter a number.`;
  if (field === "deal_value" && !op) out.op = "gt";
  if (field === "day_of_week" && !/^[1-7](,[1-7])*$/.test(value)) return `${where}: pick at least one day.`;
  if (field === "time_of_day") {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return `${where}: choose a time.`;
    if (op !== "gt" && op !== "lt") out.op = "lt";
  }
  if (field === "contact_field") {
    if (!(["first_name", "last_name", "email", "phone", "source"].includes(key) || (key.startsWith("custom:") && ctx.fieldKeys.has(key.slice(7))))) return `${where}: choose a field.`;
    out.key = key;
    if (!op) out.op = "is";
  }
  return out;
}

/** Checks the whole tree: action steps, and If / else branches with their own steps. */
function cleanTree(raw: unknown, ctx: Ctx, seen: Set<string>, depth = 0): FlowNode[] | string {
  if (!Array.isArray(raw)) return "Steps are missing.";
  if (depth > 8) return "If / else steps can only be nested 8 deep.";
  const out: FlowNode[] = [];
  for (const node of raw) {
    const n = (node ?? {}) as Record<string, unknown>;
    if (n.type !== "branch") {
      const step = cleanStep(n, ctx, seen);
      if (typeof step === "string") return step;
      out.push(step as FlowNode);
      continue;
    }
    let id = String(n.id ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 20);
    if (!id || seen.has(id)) id = newId();
    seen.add(id);
    const label = String(n.label ?? "").slice(0, 60).trim() || undefined;
    const title = `"${label ?? "If / else"}"`;
    const routes = Array.isArray(n.branches) ? n.branches : [];
    if (!routes.length) return `${title}: add at least one branch.`;
    if (routes.length > MAX_BRANCHES) return `${title}: keep it to ${MAX_BRANCHES} branches.`;
    const branches = [];
    for (const [i, r0] of routes.entries()) {
      const r = (r0 ?? {}) as Record<string, unknown>;
      const name = String(r.name ?? "").trim().slice(0, 40) || `Branch ${i + 1}`;
      const where = `${title}, branch "${name}"`;
      const conds = Array.isArray(r.conditions) ? r.conditions.slice(0, 10) : [];
      if (!conds.length) return `${where}: add a condition.`;
      const conditions: Condition[] = [];
      for (const c of conds) {
        const cc = cleanCondition(c, ctx, where);
        if (typeof cc === "string") return cc;
        conditions.push(cc);
      }
      const steps = cleanTree(r.steps ?? [], ctx, seen, depth + 1);
      if (typeof steps === "string") return steps;
      branches.push({ id: String(r.id ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 20) || newId(), name, match: r.match === "any" ? ("any" as const) : ("all" as const), conditions, steps });
    }
    const o = (n.otherwise ?? {}) as Record<string, unknown>;
    const otherSteps = cleanTree(o.steps ?? [], ctx, seen, depth + 1);
    if (typeof otherSteps === "string") return otherSteps;
    out.push({ id, type: "branch", label, branches, otherwise: { name: String(o.name ?? "").trim().slice(0, 40) || "None", steps: otherSteps } });
  }
  return out;
}

/** Saves the workflow from the editor. */
export async function saveWorkflow(
  id: string,
  input: { name: string; description: string; trigger: WorkflowTrigger; graph?: unknown; steps?: unknown; stopOnReply?: boolean },
): Promise<ActionResult & { token?: string }> {
  const name = String(input.name ?? "").trim().slice(0, 80);
  if (!name) return { error: "Give the workflow a name." };
  const ws = await getWorkspace();
  const supabase = await createClient();
  const [pipeline, { data: members }, { data: flows }, { data: current }, { data: cf }, { data: pipes }, { data: formList }] = await Promise.all([
    listAllStages(ws.account.id),
    supabase.from("account_members").select("user_id").eq("account_id", ws.account.id),
    supabase.from("workflows").select("id").eq("account_id", ws.account.id).neq("status", "archived"),
    supabase.from("workflows").select("trigger").eq("id", id).eq("account_id", ws.account.id).maybeSingle(),
    supabase.from("custom_fields").select("key").eq("account_id", ws.account.id).eq("object", "contact"),
    supabase.from("pipelines").select("id").eq("account_id", ws.account.id),
    supabase.from("forms").select("id").eq("account_id", ws.account.id),
  ]);
  if (!current) return { error: "This workflow no longer exists." };
  const stageIds = new Set(pipeline.map((s) => s.id));
  // The builder sends a tree; older pages may still send a flat list.
  const rawTree = Array.isArray(input.graph) ? input.graph : toTree(Array.isArray(input.steps) ? (input.steps as WorkflowStep[]) : []);
  if (countNodes(rawTree as FlowNode[]) > MAX_NODES) return { error: `Keep it to ${MAX_NODES} steps or fewer.` };
  const ctx: Ctx = {
    stageIds,
    pipelineIds: new Set((pipes ?? []).map((p) => p.id as string)),
    memberIds: new Set((members ?? []).map((m) => m.user_id as string)),
    workflowIds: new Set((flows ?? []).map((f) => f.id as string)),
    formIds: new Set((formList ?? []).map((f) => f.id as string)),
    fieldKeys: new Set((cf ?? []).map((f) => f.key as string)),
    selfId: id,
  };
  const graph = cleanTree(rawTree, ctx, new Set());
  if (typeof graph === "string") return { error: graph };
  const steps = compile(graph);

  const t = (input.trigger ?? { type: "none" }) as Record<string, unknown>;
  const pipelineIds = new Set((pipes ?? []).map((p) => p.id as string));
  const pipeFilter = () => (pipelineIds.has(String(t.pipeline_id ?? "")) ? { pipeline_id: String(t.pipeline_id) } : {});
  let trigger: WorkflowTrigger = { type: "none" };
  switch (t.type) {
    case "manual":
      trigger = { type: "manual" };
      break;
    case "contact_created":
      trigger = { type: t.type };
      break;
    case "deal_created":
    case "deal_won":
    case "deal_lost":
      trigger = { type: t.type, ...pipeFilter() };
      break;
    case "form_submitted":
    case "form_started": {
      const fid = String(t.form_id ?? "");
      if (fid) {
        const { data: f } = await supabase.from("forms").select("id").eq("id", fid).eq("account_id", ws.account.id).maybeSingle();
        if (!f) return { error: "Choose a form that still exists." };
        trigger = { type: t.type, form_id: fid };
      } else trigger = { type: t.type };
      break;
    }
    case "appointment_booked":
    case "appointment_cancelled":
    case "appointment_no_show":
    case "appointment_showed": {
      const cid = String(t.calendar_id ?? "");
      if (cid) {
        const { data: c } = await supabase.from("calendars").select("id").eq("id", cid).eq("account_id", ws.account.id).maybeSingle();
        if (!c) return { error: "Choose a calendar that still exists." };
        trigger = { type: t.type, calendar_id: cid };
      } else trigger = { type: t.type };
      break;
    }
    case "stage_entered": {
      if (t.stage_id === "any") {
        if (!pipelineIds.has(String(t.pipeline_id ?? ""))) return { error: "Choose the pipeline that starts this workflow." };
        trigger = { type: "stage_entered", stage_id: "any", pipeline_id: String(t.pipeline_id) };
        break;
      }
      const st = pipeline.find((s) => s.id === String(t.stage_id ?? ""));
      if (!st) return { error: "Choose the stage that starts this workflow." };
      trigger = { type: "stage_entered", stage_id: st.id, pipeline_id: st.pipelineId };
      break;
    }
    case "tag_added":
    case "tag_removed": {
      const tag = String(t.tag ?? "").trim().slice(0, 40);
      if (!tag) return { error: "Type the tag that starts this workflow." };
      trigger = { type: t.type, tag };
      break;
    }
    case "message_received":
      trigger = { type: "message_received", channel: (["sms", "email"].includes(String(t.channel)) ? t.channel : "any") as "any" };
      break;
    case "webhook": {
      const old = current.trigger as { type?: string; token?: string };
      trigger = { type: "webhook", token: old?.type === "webhook" && old.token ? old.token : newHookToken() };
      break;
    }
  }

  // Trigger filters: only let people in who match these when the trigger fires.
  if (trigger.type !== "none" && Array.isArray(t.filters) && t.filters.length) {
    const filters: Condition[] = [];
    for (const [i, raw] of (t.filters as unknown[]).slice(0, 10).entries()) {
      const c = cleanCondition(raw, ctx, `Trigger filter ${i + 1}`);
      if (typeof c === "string") return { error: c };
      filters.push(c);
    }
    trigger = { ...trigger, filters, filter_match: t.filter_match === "any" ? "any" : "all" };
  }

  const { error } = await supabase
    .from("workflows")
    .update({ name, description: String(input.description ?? "").slice(0, 300) || null, trigger, steps, graph, stop_on_reply: input.stopOnReply !== false })
    .eq("id", id)
    .eq("account_id", ws.account.id);
  if (error) return { error: error.code === "23505" ? "You already have a workflow with that name." : "We couldn't save the workflow." };
  refresh();
  return { ok: "Saved.", token: trigger.type === "webhook" ? trigger.token : undefined };
}

/** Approve and turn on, pause, or archive. Turning on records who approved it. */
export async function setWorkflowStatus(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = text(fd, "id", 40);
  const status = text(fd, "status", 10);
  const ws = await getWorkspace();
  const supabase = await createClient();
  if (status === "active") {
    const { data: wf } = await supabase.from("workflows").select("steps, trigger").eq("id", id).eq("account_id", ws.account.id).maybeSingle();
    if (!wf || !(wf.steps as unknown[]).length) return { error: "Add at least one step before turning it on." };
    if ((wf.trigger as { type?: string } | null)?.type === "none")
      return { error: "Choose a trigger first. If it should only start when someone is added to it, choose “Added by hand or by another workflow”." };
    const { error } = await supabase
      .from("workflows")
      .update({ status: "active", client_approved_at: new Date().toISOString(), client_approved_by: ws.fullName ?? ws.userEmail })
      .eq("id", id)
      .eq("account_id", ws.account.id);
    if (error) return { error: "We couldn't turn it on." };
  } else if (status === "paused" || status === "archived") {
    const { error } = await supabase.from("workflows").update({ status }).eq("id", id).eq("account_id", ws.account.id);
    if (error) return { error: "We couldn't update it." };
    if (status === "archived") redirect("/workflows");
  }
  refresh();
  return {};
}

/** Puts one contact into a workflow straight away. */
export async function enrollContact(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const workflowId = text(fd, "workflow_id", 40);
  const contactId = text(fd, "contact_id", 40);
  const ws = await getWorkspace();
  const supabase = await createClient();
  const { data: wf } = await supabase.from("workflows").select("status").eq("id", workflowId).eq("account_id", ws.account.id).maybeSingle();
  if (!wf) return { error: "Choose a workflow." };
  if (wf.status !== "active") return { error: "Turn the workflow on first." };
  // Added by hand: the trigger's filters don't apply.
  const { data, error } = await supabase.rpc("enroll_contact_by_hand", { target_workflow: workflowId, target_contact: contactId });
  if (error) return { error: "We couldn't add them." };
  if (!data) return { error: "They're already in this workflow." };
  await supabase.rpc("run_due_workflows", { target_account: ws.account.id });
  await deliverPending(supabase, ws.account.id);
  refresh();
  return { ok: "Added. The first steps have run." };
}

/** Runs any steps that are due now (the clock also does this every minute). */
export async function runDueNow(): Promise<void> {
  const ws = await getWorkspace();
  const supabase = await createClient();
  await supabase.rpc("run_due_workflows", { target_account: ws.account.id });
  await deliverPending(supabase, ws.account.id);
  refresh();
}

// ---------------------------------------------------------------------------
// Delete, duplicate, and copy or move to another workspace
// ---------------------------------------------------------------------------

const NO_WF_ACCESS = "You don't have access to change workflows here. Ask the workspace owner.";
type Db = Awaited<ReturnType<typeof createClient>>;

async function freeWorkflowName(supabase: Db, accountId: string, base: string) {
  const root = base.slice(0, 110);
  for (let i = 1; i < 60; i++) {
    const name = i === 1 ? root : `${root} ${i}`;
    const { count } = await supabase.from("workflows").select("id", { count: "exact", head: true }).eq("account_id", accountId).eq("name", name);
    if (!count) return name;
  }
  return `${root} ${Date.now().toString(36)}`;
}

/** A webhook trigger gets its own new address, so the copy never receives the original's leads. */
function freshTrigger(trigger: unknown) {
  const t = (trigger ?? {}) as Record<string, unknown>;
  return t.type === "webhook" ? { ...t, token: newHookToken() } : t;
}

export async function deleteWorkflow(id: string): Promise<ActionResult> {
  const ws = await getWorkspace();
  if (!can(ws, "workflows.manage")) return { error: NO_WF_ACCESS };
  const supabase = await createClient();
  const { error, count } = await supabase.from("workflows").delete({ count: "exact" }).eq("id", id).eq("account_id", ws.account.id);
  if (error || !count) return { error: "We couldn't delete that workflow. Try again." };
  refresh();
  return { ok: "Workflow deleted." };
}

export async function duplicateWorkflow(id: string): Promise<ActionResult> {
  const ws = await getWorkspace();
  if (!can(ws, "workflows.manage")) return { error: NO_WF_ACCESS };
  const supabase = await createClient();
  const { data: w } = await supabase.from("workflows").select("name, description, trigger, steps, graph, allow_re_entry, stop_on_reply").eq("id", id).eq("account_id", ws.account.id).maybeSingle();
  if (!w) return { error: "We couldn't find that workflow." };
  const name = await freeWorkflowName(supabase, ws.account.id, `${w.name} (copy)`);
  const { error } = await supabase
    .from("workflows")
    .insert({ account_id: ws.account.id, name, description: w.description, trigger: freshTrigger(w.trigger), steps: w.steps, graph: w.graph, allow_re_entry: w.allow_re_entry, stop_on_reply: w.stop_on_reply, status: "draft" });
  if (error) return { error: "We couldn't copy it. Try again." };
  refresh();
  return { ok: `Copied as "${name}". It's a draft until you switch it on.` };
}

/** Copies a workflow into another workspace you manage, as a draft. With move, it's then deleted here. */
export async function copyWorkflowTo(id: string, targetAccountId: string, move: boolean): Promise<ActionResult> {
  const ws = await getWorkspace();
  if (!can(ws, "workflows.manage")) return { error: NO_WF_ACCESS };
  if (!/^[0-9a-f-]{36}$/i.test(targetAccountId) || targetAccountId === ws.account.id) return { error: "Choose another workspace." };
  const target = ws.workspaces.find((w) => w.id === targetAccountId);
  if (!target) return { error: "You're not in that workspace." };
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("has_permission", { target: targetAccountId, perm: "workflows.manage" });
  if (allowed !== true) return { error: `You don't have access to add workflows in ${target.name}.` };
  const { data: w } = await supabase.from("workflows").select("name, description, trigger, steps, graph, allow_re_entry, stop_on_reply").eq("id", id).eq("account_id", ws.account.id).maybeSingle();
  if (!w) return { error: "We couldn't find that workflow." };
  const name = await freeWorkflowName(supabase, targetAccountId, w.name);
  const { error } = await supabase
    .from("workflows")
    .insert({ account_id: targetAccountId, name, description: w.description, trigger: freshTrigger(w.trigger), steps: w.steps, graph: w.graph, allow_re_entry: w.allow_re_entry, stop_on_reply: w.stop_on_reply, status: "draft" });
  if (error) return { error: `We couldn't add it to ${target.name}. Try again.` };
  if (move) {
    const { error: delErr } = await supabase.from("workflows").delete().eq("id", id).eq("account_id", ws.account.id);
    if (delErr) return { error: `It was copied to ${target.name}, but we couldn't remove it here. Delete it by hand.` };
  }
  refresh();
  return {
    ok: `${move ? "Moved" : "Copied"} to ${target.name} as a draft. Check any stages, tags, forms and team members in its steps, as they belong to this workspace.`,
  };
}
