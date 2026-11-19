import type { WorkflowTrigger } from "@/lib/data";

/** Plain-English description of what starts a workflow. */
export function triggerLabel(t: WorkflowTrigger, stages: { id: string; name: string }[], pipelines: { id: string; name: string }[] = [], forms: { id: string; name: string }[] = []) {
  const pipe = (id?: string) => (id && id !== "any" ? pipelines.find((p) => p.id === id)?.name : undefined);
  switch (t.type) {
    case "none":
      return "No trigger yet";
    case "contact_created":
      return "When a contact is added";
    case "form_submitted": {
      const f = t.form_id ? forms.find((x) => x.id === t.form_id)?.name : undefined;
      return f ? `When “${f}” is submitted` : "When a form is submitted";
    }
    case "deal_created":
      return pipe(t.pipeline_id) ? `When a deal is created in ${pipe(t.pipeline_id)}` : "When a deal is created";
    case "stage_entered":
      if (t.stage_id === "any") return `When a deal moves stage in ${pipe(t.pipeline_id) ?? "a pipeline"}`;
      return `When a contact enters ${stages.find((s) => s.id === t.stage_id)?.name ?? "a stage"}`;
    case "tag_added":
      return `When the tag “${t.tag}” is added`;
    case "tag_removed":
      return `When the tag “${t.tag}” is removed`;
    case "deal_won":
      return pipe(t.pipeline_id) ? `When a deal is won in ${pipe(t.pipeline_id)}` : "When a deal is won";
    case "deal_lost":
      return pipe(t.pipeline_id) ? `When a deal is lost in ${pipe(t.pipeline_id)}` : "When a deal is lost";
    case "message_received":
      return t.channel === "sms" ? "When the lead replies by text" : t.channel === "email" ? "When the lead replies by email" : "When the lead replies";
    case "webhook":
      return "When a webhook is received";
    default:
      return "Added by hand or by another workflow";
  }
}

/** Short names for steps, used in the run history. */
export const actionLabel: Record<string, string> = {
  wait: "Wait",
  wait_until: "Wait until",
  wait_for_reply: "Wait for reply",
  email: "Email",
  sms: "Text",
  task: "Task",
  move_stage: "Move stage",
  set_status: "Deal status",
  note: "Note",
  notify_team: "Team alert",
  add_tag: "Add tag",
  remove_tag: "Remove tag",
  assign: "Assign",
  if_else: "If / else",
  add_to_workflow: "Add to workflow",
  remove_from_workflow: "Remove from workflow",
  webhook: "Webhook",
  end: "End",
  update_field: "Update field",
  email_team: "Team email",
  branch: "If / else",
  goto: "Jump",
};
