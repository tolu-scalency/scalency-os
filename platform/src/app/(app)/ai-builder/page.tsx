import { ComingSoon, comingSoonMetadata } from "@/components/coming-soon";

export const metadata = comingSoonMetadata("ai-builder");

export default function Page() {
  return <ComingSoon feature="ai-builder" />;
}
