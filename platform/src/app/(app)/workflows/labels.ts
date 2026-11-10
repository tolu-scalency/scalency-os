import type { WorkflowTrigger } from "@/lib/data";

/** Plain-English description of what starts a workflow. */
export function triggerLabel(t: WorkflowTrigger, stages: { id: string; name: string }[]) {
  if (t.type === "contact_created") return "When a contact is added";
  if (t.type === "stage_entered") return `When a contact enters ${stages.find((s) => s.id === t.stage_id)?.name ?? "a stage"}`;
  return "When you add someone by hand";
}
