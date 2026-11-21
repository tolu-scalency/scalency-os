import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { LivePage, loadDomainPage, pageMetadata, pageViewport } from "../../p/public-page";

// The first page of a site on its own domain. The proxy sends https://<domain>/ here.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ host: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { host } = await params;
  return pageMetadata(await loadDomainPage(decodeURIComponent(host)));
}
export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { host } = await params;
  return pageViewport(await loadDomainPage(decodeURIComponent(host)));
}
export default async function DomainHome({ params }: Props) {
  const { host } = await params;
  const page = await loadDomainPage(decodeURIComponent(host));
  if (!page) notFound();
  return <LivePage page={page} />;
}
