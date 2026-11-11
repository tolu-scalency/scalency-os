import type { WorkflowTrigger } from "@/lib/data";

/** Plain-English description of what starts a workflow. */
export function triggerLabel(t: WorkflowTrigger, stages: { id: string; name: string }[]) {
  switch (t.type) {
    case "contact_created":
      return "When a contact is added";
    case "stage_entered":
      return `When a contact enters ${stages.find((s) => s.id === t.stage_id)?.name ?? "a stage"}`;
    case "tag_added":
      return `When the tag “${t.tag}” is added`;
    case "tag_removed":
      return `When the tag “${t.tag}” is removed`;
    case "deal_won":
      return "When a deal is won";
    case "deal_lost":
      return "When a deal is lost";
    case "message_received":
      return t.channel === "sms" ? "When the lead replies by text" : t.channel === "email" ? "When the lead replies by email" : "When the lead replies";
    case "webhook":
      return "When a webhook is received";
    default:
      return "When you add someone by hand";
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
};
