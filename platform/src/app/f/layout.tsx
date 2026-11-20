import type { Metadata } from "next";

// Every public form page, including "this form isn't available": no Scalency
// name or icon in the browser tab. Each form sets its own title and icon.
export const metadata: Metadata = {
  title: { absolute: "Form" },
  applicationName: null,
  icons: { icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/%3E", apple: [], shortcut: [] },
  robots: { index: false, follow: false },
};

export default function PublicFormsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
