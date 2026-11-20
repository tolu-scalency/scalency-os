import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { FormPage, formMetadata, formViewport, loadBySlug } from "../../public-form";

// A form by its workspace and link name: os.scalency.us/f/<workspace>/<form>.
// ("id" here is the workspace's short name.)

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string; form: string }>; searchParams: Promise<{ embed?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, form } = await params;
  return formMetadata(await loadBySlug(id, form));
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { id, form } = await params;
  return formViewport(await loadBySlug(id, form));
}

export default async function PublicFormBySlug({ params, searchParams }: Props) {
  const [{ id, form: slug }, { embed }] = await Promise.all([params, searchParams]);
  const form = await loadBySlug(id, slug);
  if (!form) notFound();
  return <FormPage form={form} embedded={embed === "1"} />;
}
