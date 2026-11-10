import { ComingSoon, comingSoonMetadata } from "@/components/coming-soon";

export const metadata = comingSoonMetadata("forms");

export default function Page() {
  return <ComingSoon feature="forms" />;
}
