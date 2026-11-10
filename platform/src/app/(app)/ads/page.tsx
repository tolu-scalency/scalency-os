import { ComingSoon, comingSoonMetadata } from "@/components/coming-soon";

export const metadata = comingSoonMetadata("ads");

export default function Page() {
  return <ComingSoon feature="ads" />;
}
