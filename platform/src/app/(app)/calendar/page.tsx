import type { Metadata } from "next";
import { NotConnected } from "@/components/states";

export const metadata: Metadata = { title: "Calendar" };

// Designed in the prototype, connected in Later. Until then this page shows what it will do, not made-up data.
export default function CalendarPage() {
  return (
    <NotConnected
      icon="calendar"
      tone="violet"
      title="Calendar"
      step="Later"
      points={[
        "Week view of every booked call",
        "Round robin across closers",
        "24 hours' minimum notice",
        "Google Calendar sync",
      ]}
    >
      Bookings still run through the GoHighLevel calendar for Phase 1. This screen shows booked calls once bookings are connected.
    </NotConnected>
  );
}
