import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoonView } from "@/components/coming-soon";
import { soonPage } from "@/lib/nav";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = soonPage((await params).slug);
  return { title: p ? `${p.title} (coming soon)` : "Coming soon" };
}

export default async function SoonPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = soonPage((await params).slug);
  if (!p) notFound();
  return (
    <ComingSoonView
      f={{ key: p.slug, href: `/soon/${p.slug}`, title: p.title, tagline: p.tagline, icon: p.icon, tone: "blue", points: p.bullets.map((b) => ({ title: b, text: "" })) }}
    />
  );
}
