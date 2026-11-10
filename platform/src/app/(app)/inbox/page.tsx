import type { Metadata } from "next";
import { NotConnected } from "@/components/states";

export const metadata: Metadata = { title: "Conversations" };

// Designed in the prototype, connected in Step 4. Until then this page shows what it will do, not made-up data.
export default function InboxPage() {
  return (
    <NotConnected
      icon="inbox"
      tone="blue"
      title="Conversations"
      step="Step 4"
      points={[
        "Two-way SMS from the Scalency UK number (Twilio)",
        "Email from send.scalency.us (Resend)",
        "Templates and Write with AI",
        "Every message saved on the contact's timeline",
      ]}
    >
      Every text and email with a lead, in one thread per person. Replies like YES are picked up automatically and confirm the call.
    </NotConnected>
  );
}
