import type { Metadata } from "next";
import { NotConnected } from "@/components/states";

export const metadata: Metadata = { title: "Funnels & forms" };

// Designed in the prototype, connected in Step 3. Until then this page shows what it will do, not made-up data.
export default function FunnelsPage() {
  return (
    <NotConnected
      icon="funnel"
      tone="violet"
      title="Funnels & forms"
      step="Step 3"
      points={[
        "Hosted application form",
        "Step 1 saved the moment it's sent",
        "Qualified and unqualified routing",
        "Answers stored on the opportunity",
      ]}
    >
      The application form that saves step 1 straight away, qualifies the lead and routes them. The AI funnel builder follows later.
    </NotConnected>
  );
}
