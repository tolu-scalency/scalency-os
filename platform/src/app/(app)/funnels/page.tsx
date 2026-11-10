import { ComingSoon, comingSoonMetadata } from "@/components/coming-soon";

export const metadata = comingSoonMetadata("funnels");

export default function Page() {
  return <ComingSoon feature="funnels" />;
}
