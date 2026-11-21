import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { LivePage, loadPage, pageMetadata, pageViewport } from "../../../public-page";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ ws: string; site: string; page: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ws, site, page } = await params;
  return pageMetadata(await loadPage(ws, site, page));
}
export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { ws, site, page } = await params;
  return pageViewport(await loadPage(ws, site, page));
}
export default async function SitePage({ params }: Props) {
  const { ws, site, page: slug } = await params;
  const page = await loadPage(ws, site, slug);
  if (!page) notFound();
  return <LivePage page={page} />;
}
