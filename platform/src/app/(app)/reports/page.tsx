import type { Metadata } from "next";
import { NotConnected } from "@/components/states";

export const metadata: Metadata = { title: "Reports & ads" };

// Designed in the prototype, connected in Later. Until then this page shows what it will do, not made-up data.
export default function ReportsPage() {
  return (
    <NotConnected
      icon="chart"
      tone="red"
      title="Reports & ads"
      step="Later"
      points={[
        "Connect Meta ad accounts",
        "Cost per lead and per booked call",
        "Top creatives",
        "Shareable client reports",
      ]}
    >
      Spend, cost per lead and booked calls across every Meta ad account, with reports you can share with clients.
    </NotConnected>
  );
}
