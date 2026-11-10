import { ComingSoon, comingSoonMetadata } from "@/components/coming-soon";

export const metadata = comingSoonMetadata("inbox");

export default function Page() {
  return <ComingSoon feature="inbox" />;
}
