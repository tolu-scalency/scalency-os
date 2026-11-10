import { ComingSoon, comingSoonMetadata } from "@/components/coming-soon";

export const metadata = comingSoonMetadata("campaigns");

export default function Page() {
  return <ComingSoon feature="campaigns" />;
}
