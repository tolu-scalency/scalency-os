import { ComingSoon, comingSoonMetadata } from "@/components/coming-soon";

export const metadata = comingSoonMetadata("companies");

export default function Page() {
  return <ComingSoon feature="companies" />;
}
