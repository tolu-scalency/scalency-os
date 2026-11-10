import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { NavProgress } from "@/components/shell/nav-progress";
import "./globals.css";

// Geist for the interface, Geist Mono for small labels and numbers. Bundled with the app, so nothing loads from Google.

export const metadata: Metadata = {
  metadataBase: new URL("https://os.scalency.us"),
  title: { default: "Scalency OS", template: "%s · Scalency OS" },
  description: "Leads, pipeline, tasks and your team in one place. Every enquiry answered, followed up and booked.",
  applicationName: "Scalency OS",
};

export const viewport: Viewport = {
  themeColor: "#0a5fe3",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
