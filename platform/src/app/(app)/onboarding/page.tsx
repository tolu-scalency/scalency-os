import type { Metadata } from "next";
import { NotConnected } from "@/components/states";

export const metadata: Metadata = { title: "Client onboarding" };

// Designed in the prototype, connected in Later. Until then this page shows what it will do, not made-up data.
export default function OnboardingPage() {
  return (
    <NotConnected
      icon="onboarding"
      tone="orange"
      title="Client onboarding"
      step="Later"
      points={[
        "Reusable onboarding flow",
        "Questionnaire and file uploads",
        "Access requests",
        "Progress tracking per client",
      ]}
    >
      One link for each new client to collect their details, access and agreement, and to book the kickoff call.
    </NotConnected>
  );
}
