import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { LivePage, loadDomainPage, pageMetadata, pageViewport } from "../../../p/public-page";

// Another page of a site on its own domain: https://<domain>/<page>.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ host: string; page: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { host, page } = await params;
  return pageMetadata(await loadDomainPage(decodeURIComponent(host), page));
}
export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { host, page } = await params;
  return pageViewport(await loadDomainPage(decodeURIComponent(host), page));
}
export default async function DomainPage({ params }: Props) {
  const { host, page: slug } = await params;
  const page = await loadDomainPage(decodeURIComponent(host), slug);
  if (!page) notFound();
  return <LivePage page={page} />;
}
