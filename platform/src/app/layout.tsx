import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

// Geist for the interface, Geist Mono for small labels, dates and numbers.
// The fonts are bundled with the app (the "geist" package), so nothing is fetched from Google at build time.
// docs/brand.md confirms Montserrat for Scalency's public brand. Using Geist in the app needs Tolu's OK.

export const metadata: Metadata = {
  title: { default: "Scalency OS", template: "%s · Scalency OS" },
  description: "Scalency's internal operating system.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
