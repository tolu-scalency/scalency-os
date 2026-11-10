import type { Metadata } from "next";
import { NotConnected } from "@/components/states";

export const metadata: Metadata = { title: "Team chat" };

// Designed in the prototype, connected in Step 5. Until then this page shows what it will do, not made-up data.
export default function ChatPage() {
  return (
    <NotConnected
      icon="hash"
      tone="green"
      title="Team chat"
      step="Step 5"
      points={[
        "Alert channels per event",
        "Lead cards with Open contact",
        "Direct messages and mentions",
        "Live updates without refreshing",
      ]}
    >
      Scalency&apos;s own Slack. Workflows post lead cards to channels like #new-leads and #booked-calls, and the team can claim and discuss each lead.
    </NotConnected>
  );
}
