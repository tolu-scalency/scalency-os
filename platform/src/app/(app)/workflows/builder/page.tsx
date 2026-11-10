import type { Metadata } from "next";
import { NotConnected } from "@/components/states";

export const metadata: Metadata = { title: "AI workflow builder" };

// Designed in the prototype, connected in Step 6. Until then this page shows what it will do, not made-up data.
export default function WorkflowsBuilderPage() {
  return (
    <NotConnected
      icon="spark"
      tone="blue"
      title="AI workflow builder"
      step="Step 6"
      points={[
        "Plain-English prompt to workflow",
        "Uses your approved templates",
        "Explain or change any step by chat",
        "Saved as a draft for approval",
      ]}
    >
      Describe a follow-up in plain English and Claude drafts the steps in the engine&apos;s format. Nothing goes live until it&apos;s tested and approved.
    </NotConnected>
  );
}
