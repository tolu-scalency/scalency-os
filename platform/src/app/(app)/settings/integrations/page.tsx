import { ComingSoon, comingSoonMetadata } from "@/components/coming-soon";

export const metadata = comingSoonMetadata("integrations");

export default function Page() {
  return <ComingSoon feature="integrations" bare />;
}
