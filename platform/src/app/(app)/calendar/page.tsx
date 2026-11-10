import { ComingSoon, comingSoonMetadata } from "@/components/coming-soon";

export const metadata = comingSoonMetadata("calendar");

export default function Page() {
  return <ComingSoon feature="calendar" />;
}
