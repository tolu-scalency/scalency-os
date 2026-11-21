import type { Metadata } from "next";

// Pages on their own domain: no Scalency name or icon in the browser tab. Each page sets its own.
export const metadata: Metadata = {
  title: { absolute: "Page" },
  applicationName: null,
  icons: { icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/%3E", apple: [], shortcut: [] },
};

export default function DomainPagesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
