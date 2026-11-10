import { ComingSoon, comingSoonMetadata } from "@/components/coming-soon";

export const metadata = comingSoonMetadata("workflows");

export default function Page() {
  return <ComingSoon feature="workflows" />;
}
