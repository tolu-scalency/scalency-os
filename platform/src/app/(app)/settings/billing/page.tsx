import { ComingSoon, comingSoonMetadata } from "@/components/coming-soon";

export const metadata = comingSoonMetadata("billing");

export default function Page() {
  return <ComingSoon feature="billing" bare />;
}
