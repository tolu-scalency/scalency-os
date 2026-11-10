import { ComingSoon, comingSoonMetadata } from "@/components/coming-soon";

export const metadata = comingSoonMetadata("notifications");

export default function Page() {
  return <ComingSoon feature="notifications" bare />;
}
