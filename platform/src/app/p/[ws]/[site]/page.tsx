import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { LivePage, loadPage, pageMetadata, pageViewport } from "../../public-page";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ ws: string; site: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ws, site } = await params;
  return pageMetadata(await loadPage(ws, site));
}
export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { ws, site } = await params;
  return pageViewport(await loadPage(ws, site));
}
export default async function SiteHome({ params }: Props) {
  const { ws, site } = await params;
  const page = await loadPage(ws, site);
  if (!page) notFound();
  return <LivePage page={page} />;
}
