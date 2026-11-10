import { ComingSoon, comingSoonMetadata } from "@/components/coming-soon";

export const metadata = comingSoonMetadata("contracts");

export default function Page() {
  return <ComingSoon feature="contracts" />;
}
