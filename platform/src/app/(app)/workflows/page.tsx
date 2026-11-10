import type { Metadata } from "next";
import { NotConnected } from "@/components/states";

export const metadata: Metadata = { title: "Workflows" };

// Designed in the prototype, connected in Step 4. Until then this page shows what it will do, not made-up data.
export default function WorkflowsPage() {
  return (
    <NotConnected
      icon="zap"
      tone="pink"
      title="Workflows"
      step="Step 4"
      points={[
        "Runs every minute and never double-sends",
        "Quiet hours in the lead's time zone",
        "Enrolment history and an execution log",
        "Can't switch on until client-approved",
      ]}
    >
      The automation engine runs the follow-ups L1 to L7: texts, emails, waits, stage moves and team alerts, all in test mode until approved.
    </NotConnected>
  );
}
