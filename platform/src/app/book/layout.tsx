import type { Metadata } from "next";

// Public booking pages: the workspace's name in the tab, not Scalency's.
export const metadata: Metadata = {
  title: { absolute: "Book a time" },
  applicationName: null,
  robots: { index: false, follow: false },
};

export default function PublicBookingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
