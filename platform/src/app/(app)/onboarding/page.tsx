import { ComingSoon, comingSoonMetadata } from "@/components/coming-soon";

export const metadata = comingSoonMetadata("onboarding");

export default function Page() {
  return <ComingSoon feature="onboarding" />;
}
