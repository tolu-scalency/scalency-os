import { ComingSoon, comingSoonMetadata } from "@/components/coming-soon";

export const metadata = comingSoonMetadata("agents");

export default function Page() {
  return <ComingSoon feature="agents" />;
}
