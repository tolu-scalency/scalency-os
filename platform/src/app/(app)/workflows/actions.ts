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
    description: "Reply to every new lead within minutes and tell the team.",
    trigger: { type: "contact_created" },
    steps: [
      { type: "sms", body: "Hi {{first_name}}, thanks for getting in touch with {{workspace}}. When's a good time for a quick call?" },
      { type: "email", subject: "Thanks for your enquiry, {{first_name}}", body: "Hi {{first_name}},\n\nThanks for reaching out. We'll be in touch shortly to book a quick call.\n\n{{workspace}}" },
      { type: "notify_team", text: "New lead: {{name}} ({{phone}})" },
      { type: "task", title: "Call {{first_name}}", due_in_days: 0 },
      { type: "wait", amount: 1, unit: "days" },
      { type: "sms", body: "Hi {{first_name}}, just checking you saw our message. Reply here and we'll find a time." },
    ],
  },
  noshow: {
    name: "No-show follow-up",
    description: "Win back people who miss their call.",
    trigger: { type: "manual" },
    steps: [
      { type: "sms", body: "Hi {{first_name}}, sorry we missed you today. Would you like to rebook?" },
      { type: "wait", amount: 1, unit: "days" },
      { type: "email", subject: "Shall we find another time?", body: "Hi {{first_name}},\n\nWe missed you on our call. Reply to this email and we'll find a time that suits you.\n\n{{workspace}}" },
      { type: "task", title: "Try calling {{first_name}} again", due_in_days: 2 },
    ],
  },
  alert: {
    name: "New lead alert",
    description: "Post every new lead in #leads so nobody misses one.",
    trigger: { type: "contact_created" },
    steps: [{ type: "notify_team", text: "New lead: {{name}} · {{email}} · {{phone}}" }],
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
  const { data, error } = await supabase.from("workflows").insert({ account_id: ws.account.id, name, description: t.description, trigger: t.trigger, steps: t.steps }).select("id").single();
  if (error || !data) redirect("/workflows?error=1");
  redirect(`/workflows/${data.id}`);
}

const STEP_TYPES = new Set(["wait", "email", "sms", "task", "move_stage", "note", "notify_team"]);

function cleanSteps(raw: unknown): WorkflowStep[] | string {
  if (!Array.isArray(raw)) return "Steps are missing.";
  if (raw.length > 50) return "Keep it to 50 steps or fewer.";
  const out: WorkflowStep[] = [];
  for (const [i, s] of raw.entries()) {
    const n = i + 1;
    if (!s || typeof s !== "object" || !STEP_TYPES.has((s as { type: string }).type)) return `Step ${n} isn't valid.`;
    const st = s as Record<string, unknown>;
    const str = (k: string, max: number) => String(st[k] ?? "").slice(0, max);
    switch (st.type) {
      case "wait": {
        const amount = Math.round(Number(st.amount));
        if (!(amount >= 1 && amount <= 365)) return `Step ${n}: wait between 1 and 365.`;
        const unit = ["minutes", "hours", "days"].includes(String(st.unit)) ? (st.unit as "minutes") : "hours";
        out.push({ type: "wait", amount, unit });
        break;
      }
      case "email":
        if (!str("subject", 200).trim() || !str("body", 5000).trim()) return `Step ${n}: the email needs a subject and a message.`;
        out.push({ type: "email", subject: str("subject", 200), body: str("body", 5000) });
        break;
      case "sms":
        if (!str("body", 640).trim()) return `Step ${n}: the text needs a message.`;
        out.push({ type: "sms", body: str("body", 640) });
        break;
      case "task":
        if (!str("title", 200).trim()) return `Step ${n}: the task needs a title.`;
        out.push({ type: "task", title: str("title", 200), due_in_days: Math.max(0, Math.min(365, Math.round(Number(st.due_in_days) || 0))) });
        break;
      case "move_stage":
        if (!str("stage_id", 40)) return `Step ${n}: choose a stage.`;
        out.push({ type: "move_stage", stage_id: str("stage_id", 40) });
        break;
      case "note":
        if (!str("text", 2000).trim()) return `Step ${n}: the note is empty.`;
        out.push({ type: "note", text: str("text", 2000) });
        break;
      case "notify_team":
        out.push({ type: "notify_team", text: str("text", 1000) || "New lead: {{name}}" });
        break;
    }
  }
  return out;
}

/** Saves the workflow from the editor. */
export async function saveWorkflow(id: string, input: { name: string; description: string; trigger: WorkflowTrigger; steps: unknown }): Promise<ActionResult> {
  const name = String(input.name ?? "").trim().slice(0, 80);
  if (!name) return { error: "Give the workflow a name." };
  const steps = cleanSteps(input.steps);
  if (typeof steps === "string") return { error: steps };
  const ws = await getWorkspace();
  let trigger: WorkflowTrigger = { type: "manual" };
  if (input.trigger?.type === "contact_created") trigger = { type: "contact_created" };
  if (input.trigger?.type === "stage_entered") {
    const pipeline = await getPipeline(ws.account.id);
    const stageId = (input.trigger as { stage_id?: string }).stage_id ?? "";
    if (!pipeline?.stages.some((s) => s.id === stageId)) return { error: "Choose the stage that starts this workflow." };
    trigger = { type: "stage_entered", stage_id: stageId };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("workflows")
    .update({ name, description: String(input.description ?? "").slice(0, 300) || null, trigger, steps })
    .eq("id", id)
    .eq("account_id", ws.account.id);
  if (error) return { error: error.code === "23505" ? "You already have a workflow with that name." : "We couldn't save the workflow." };
  refresh();
  return { ok: "Saved." };
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
