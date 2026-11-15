"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deliverPending } from "@/lib/deliver";
import { getPipeline, getWorkspace, type WorkflowStep, type WorkflowTrigger } from "@/lib/data";
import { text, type ActionResult } from "@/lib/forms";

const TEMPLATES: Record<string, { name: string; description: string; trigger: WorkflowTrigger; steps: WorkflowStep[] }> = {
  speed: {
    name: "Speed to lead",
    description: "Reply to every new lead within minutes, tell the team, and follow up if they go quiet.",
    trigger: { type: "contact_created" },
    steps: [
      { id: "s1", type: "assign", user_id: "round_robin" },
      { id: "s2", type: "sms", body: "Hi {{first_name}}, thanks for getting in touch with {{workspace}}. When's a good time for a quick call?" },
      { id: "s3", type: "email", subject: "Thanks for your enquiry, {{first_name}}", body: "Hi {{first_name}},\n\nThanks for reaching out. We'll be in touch shortly to book a quick call.\n\n{{workspace}}" },
      { id: "s4", type: "notify_team", text: "New lead: {{name}} ({{phone}})" },
      { id: "s5", type: "task", title: "Call {{first_name}}", due_in_days: 0 },
      { id: "s6", type: "wait_for_reply", amount: 1, unit: "days" },
      { id: "s7", type: "if_else", condition: { field: "replied", negate: true }, else: "end" },
      { id: "s8", type: "sms", body: "Hi {{first_name}}, just checking you saw our message. Reply here and we'll find a time." },
    ],
  },
  reply: {
    name: "Lead replied",
    description: "When a lead replies, tag them, alert the team and create a task to answer.",
    trigger: { type: "message_received", channel: "any" },
    steps: [
      { id: "r1", type: "add_tag", tag: "Replied" },
      { id: "r2", type: "notify_team", text: "{{name}} just replied. Open their conversation in the Inbox." },
      { id: "r3", type: "task", title: "Reply to {{first_name}}", due_in_days: 0 },
    ],
  },
  noshow: {
    name: "No-show follow-up",
    description: "Win back people who miss their call. Add the tag “No show” to start it.",
    trigger: { type: "tag_added", tag: "No show" },
    steps: [
      { id: "n1", type: "sms", body: "Hi {{first_name}}, sorry we missed you today. Would you like to rebook?" },
      { id: "n2", type: "wait_for_reply", amount: 1, unit: "days" },
      { id: "n3", type: "if_else", condition: { field: "replied", negate: true }, else: "end" },
      { id: "n4", type: "email", subject: "Shall we find another time?", body: "Hi {{first_name}},\n\nWe missed you on our call. Reply to this email and we'll find a time that suits you.\n\n{{workspace}}" },
      { id: "n5", type: "task", title: "Try calling {{first_name}} again", due_in_days: 2 },
    ],
  },
  won: {
    name: "Deal won",
    description: "Thank new customers, tag them and tell the team.",
    trigger: { type: "deal_won" },
    steps: [
      { id: "w1", type: "add_tag", tag: "Customer" },
      { id: "w2", type: "email", subject: "Welcome aboard, {{first_name}}", body: "Hi {{first_name}},\n\nThank you for choosing {{workspace}}. We'll be in touch with your next steps shortly.\n\n{{workspace}}" },
      { id: "w3", type: "notify_team", text: "Deal won: {{name}}" },
    ],
  },
  hook: {
    name: "Leads from another app",
    description: "Send leads in from your website, Zapier, Make or an ad platform using a webhook link.",
    trigger: { type: "webhook", token: "" },
    steps: [
      { id: "h1", type: "add_tag", tag: "Webhook" },
      { id: "h2", type: "notify_team", text: "New lead from {{source}}: {{name}}" },
    ],
  },
  alert: {
    name: "New lead alert",
    description: "Post every new lead in #leads so nobody misses one.",
    trigger: { type: "contact_created" },
    steps: [{ id: "a1", type: "notify_team", text: "New lead: {{name}} · {{email}} · {{phone}}" }],
  },
  blank: { name: "Untitled workflow", description: "", trigger: { type: "manual" }, steps: [] },
};

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
  const trigger = t.trigger.type === "webhook" ? { type: "webhook", token: newToken() } : t.trigger;
  const { data, error } = await supabase.from("workflows").insert({ account_id: ws.account.id, name, description: t.description, trigger, steps: t.steps }).select("id").single();
  if (error || !data) redirect("/workflows?error=1");
  redirect(`/workflows/${data.id}`);
}

const STEP_TYPES = new Set([
  "wait", "wait_until", "wait_for_reply", "email", "sms", "task", "move_stage", "set_status", "note", "notify_team",
  "add_tag", "remove_tag", "assign", "if_else", "add_to_workflow", "remove_from_workflow", "webhook", "end",
  "update_field", "email_team",
]);
const CONDITIONS = new Set(["has_tag", "has_email", "has_phone", "replied", "in_stage", "deal_status", "source_is", "has_owner"]);
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

type Ctx = { stageIds: Set<string>; memberIds: Set<string>; workflowIds: Set<string>; fieldKeys: Set<string>; selfId: string };

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

function cleanSteps(raw: unknown, ctx: Ctx): WorkflowStep[] | string {
  if (!Array.isArray(raw)) return "Steps are missing.";
  if (raw.length > 50) return "Keep it to 50 steps or fewer.";
  const out: WorkflowStep[] = [];
  const seen = new Set<string>();
  for (const [i, s] of raw.entries()) {
    const n = i + 1;
    if (!s || typeof s !== "object" || !STEP_TYPES.has((s as { type: string }).type)) return `Step ${n} isn't valid.`;
    const st = s as Record<string, unknown>;
    const str = (k: string, max: number) => String(st[k] ?? "").slice(0, max);
    let id = str("id", 20).replace(/[^a-z0-9]/gi, "");
    if (!id || seen.has(id)) id = stepId();
    seen.add(id);
    const amount = Math.round(Number(st.amount));
    const unit = (UNITS.includes(String(st.unit)) ? st.unit : "hours") as "hours";
    switch (st.type) {
      case "wait":
      case "wait_for_reply":
        if (!(amount >= 1 && amount <= 365)) return `Step ${n}: wait between 1 and 365.`;
        out.push({ id, type: st.type, amount, unit });
        break;
      case "wait_until": {
        const hour = Math.round(Number(st.hour));
        const minute = Math.round(Number(st.minute) || 0);
        if (!(hour >= 0 && hour <= 23) || !(minute >= 0 && minute <= 59)) return `Step ${n}: choose a time.`;
        out.push({ id, type: "wait_until", hour, minute, weekdays_only: Boolean(st.weekdays_only) });
        break;
      }
      case "email": {
        const mode = ["text", "design", "code"].includes(String(st.mode)) ? (st.mode as "text") : st.html ? "design" : "text";
        const subject = str("subject", 200);
        if (!subject.trim()) return `Step ${n}: the email needs a subject.`;
        if (mode === "text") {
          if (!str("body", 5000).trim()) return `Step ${n}: the email needs a message.`;
          out.push({ id, type: "email", subject, body: str("body", 5000), mode });
        } else {
          const html = String(st.html ?? "");
          if (html.length > 200000) return `Step ${n}: the design is too big. Keep it under 200 KB.`;
          const body = stripHtml(html).slice(0, 5000);
          if (!body.trim() && !/<img/i.test(html)) return `Step ${n}: the email design is empty.`;
          out.push({ id, type: "email", subject, body: body || " ", html, mode });
        }
        break;
      }
      case "email_team": {
        const to = str("to", 40);
        if (to !== "owner" && to !== "everyone" && !ctx.memberIds.has(to)) return `Step ${n}: choose who to email.`;
        if (!str("subject", 200).trim() || !str("body", 5000).trim()) return `Step ${n}: the team email needs a subject and a message.`;
        out.push({ id, type: "email_team", to, subject: str("subject", 200), body: str("body", 5000) });
        break;
      }
      case "update_field": {
        const field = str("field", 60);
        const ok = ["first_name", "last_name", "source"].includes(field) || (field.startsWith("custom:") && ctx.fieldKeys.has(field.slice(7)));
        if (!ok) return `Step ${n}: choose a field to update.`;
        out.push({ id, type: "update_field", field, value: str("value", 500) });
        break;
      }
      case "sms":
        if (!str("body", 640).trim()) return `Step ${n}: the text needs a message.`;
        out.push({ id, type: "sms", body: str("body", 640) });
        break;
      case "task":
        if (!str("title", 200).trim()) return `Step ${n}: the task needs a title.`;
        out.push({ id, type: "task", title: str("title", 200), due_in_days: Math.max(0, Math.min(365, Math.round(Number(st.due_in_days) || 0))) });
        break;
      case "move_stage":
        if (!ctx.stageIds.has(str("stage_id", 40))) return `Step ${n}: choose a stage.`;
        out.push({ id, type: "move_stage", stage_id: str("stage_id", 40) });
        break;
      case "set_status": {
        const status = str("status", 10);
        if (!["open", "won", "lost"].includes(status)) return `Step ${n}: choose won, lost or open.`;
        out.push({ id, type: "set_status", status: status as "won" });
        break;
      }
      case "note":
        if (!str("text", 2000).trim()) return `Step ${n}: the note is empty.`;
        out.push({ id, type: "note", text: str("text", 2000) });
        break;
      case "notify_team":
        out.push({ id, type: "notify_team", text: str("text", 1000) || "New lead: {{name}}" });
        break;
      case "add_tag":
      case "remove_tag": {
        const tag = str("tag", 40).trim();
        if (!tag) return `Step ${n}: type a tag.`;
        out.push({ id, type: st.type, tag });
        break;
      }
      case "assign": {
        const user = str("user_id", 40);
        if (user !== "round_robin" && !ctx.memberIds.has(user)) return `Step ${n}: choose who to assign.`;
        out.push({ id, type: "assign", user_id: user });
        break;
      }
      case "if_else": {
        const c = (st.condition ?? {}) as Record<string, unknown>;
        const field = String(c.field ?? "");
        if (!CONDITIONS.has(field)) return `Step ${n}: choose a condition.`;
        const value = String(c.value ?? "").slice(0, 60).trim();
        if (["has_tag", "source_is", "in_stage", "deal_status"].includes(field) && !value) return `Step ${n}: finish the condition.`;
        if (field === "in_stage" && !ctx.stageIds.has(value)) return `Step ${n}: choose a stage.`;
        out.push({ id, type: "if_else", condition: { field: field as "has_tag", value: value || undefined, negate: Boolean(c.negate) }, else: str("else", 20) || "end" });
        break;
      }
      case "add_to_workflow":
      case "remove_from_workflow": {
        const wf = str("workflow_id", 40);
        if (!ctx.workflowIds.has(wf) || wf === ctx.selfId) return `Step ${n}: choose another workflow.`;
        out.push({ id, type: st.type, workflow_id: wf });
        break;
      }
      case "webhook": {
        const url = safeUrl(str("url", 500));
        if (!url) return `Step ${n}: enter a web address starting with https://`;
        out.push({ id, type: "webhook", url });
        break;
      }
      case "end":
        out.push({ id, type: "end" });
        break;
    }
  }
  // "Otherwise" in an if/else may only jump forward to a step that exists.
  for (const [i, s] of out.entries()) {
    if (s.type !== "if_else" || s.else === "end") continue;
    const j = out.findIndex((x) => x.id === s.else);
    if (j <= i) return `Step ${i + 1}: choose a later step for "otherwise".`;
  }
  return out;
}

function newToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

/** Saves the workflow from the editor. */
export async function saveWorkflow(
  id: string,
  input: { name: string; description: string; trigger: WorkflowTrigger; steps: unknown; stopOnReply?: boolean },
): Promise<ActionResult & { token?: string }> {
  const name = String(input.name ?? "").trim().slice(0, 80);
  if (!name) return { error: "Give the workflow a name." };
  const ws = await getWorkspace();
  const supabase = await createClient();
  const [pipeline, { data: members }, { data: flows }, { data: current }, { data: cf }] = await Promise.all([
    getPipeline(ws.account.id),
    supabase.from("account_members").select("user_id").eq("account_id", ws.account.id),
    supabase.from("workflows").select("id").eq("account_id", ws.account.id).neq("status", "archived"),
    supabase.from("workflows").select("trigger").eq("id", id).eq("account_id", ws.account.id).maybeSingle(),
    supabase.from("custom_fields").select("key").eq("account_id", ws.account.id).eq("object", "contact"),
  ]);
  if (!current) return { error: "This workflow no longer exists." };
  const stageIds = new Set((pipeline?.stages ?? []).map((s) => s.id));
  const steps = cleanSteps(input.steps, {
    stageIds,
    memberIds: new Set((members ?? []).map((m) => m.user_id as string)),
    workflowIds: new Set((flows ?? []).map((f) => f.id as string)),
    fieldKeys: new Set((cf ?? []).map((f) => f.key as string)),
    selfId: id,
  });
  if (typeof steps === "string") return { error: steps };

  const t = (input.trigger ?? { type: "manual" }) as Record<string, unknown>;
  let trigger: WorkflowTrigger = { type: "manual" };
  switch (t.type) {
    case "contact_created":
    case "deal_won":
    case "deal_lost":
      trigger = { type: t.type };
      break;
    case "stage_entered":
      if (!stageIds.has(String(t.stage_id ?? ""))) return { error: "Choose the stage that starts this workflow." };
      trigger = { type: "stage_entered", stage_id: String(t.stage_id) };
      break;
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
      trigger = { type: "webhook", token: old?.type === "webhook" && old.token ? old.token : newToken() };
      break;
    }
  }

  const { error } = await supabase
    .from("workflows")
    .update({ name, description: String(input.description ?? "").slice(0, 300) || null, trigger, steps, stop_on_reply: input.stopOnReply !== false })
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
    const { data: wf } = await supabase.from("workflows").select("steps").eq("id", id).eq("account_id", ws.account.id).maybeSingle();
    if (!wf || !(wf.steps as unknown[]).length) return { error: "Add at least one step before turning it on." };
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
  const { data, error } = await supabase.rpc("enroll_contact", { target_workflow: workflowId, target_contact: contactId });
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
