import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { FormPage, formMetadata, formViewport, loadById } from "../public-form";

// A form by its id: os.scalency.us/f/<id>. Embeds use this address.
// Add ?embed=1 inside an iframe for a see-through background that fits the page around it.

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ embed?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return formMetadata(await loadById((await params).id));
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  return formViewport(await loadById((await params).id));
}

export default async function PublicFormById({ params, searchParams }: Props) {
  const [{ id }, { embed }] = await Promise.all([params, searchParams]);
  const form = await loadById(id);
  if (!form) notFound();
  return <FormPage form={form} embedded={embed === "1"} />;
}
