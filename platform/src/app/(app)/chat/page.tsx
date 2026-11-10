import { ComingSoon, comingSoonMetadata } from "@/components/coming-soon";

export const metadata = comingSoonMetadata("chat");

export default function Page() {
  return <ComingSoon feature="chat" />;
}
