import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { can, getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { cleanPage } from "@/lib/page-builder";
import { PageStudio } from "./studio/page-studio";

export const metadata: Metadata = { title: "Page Studio" };

export default async function PageStudioRoute({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, ws] = await Promise.all([params, getWorkspace()]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: site }, { data: pages }, { data: forms }, { data: acc }] = await Promise.all([
    supabase.from("sites").select("id, name, slug, status").eq("id", id).eq("account_id", ws.account.id).maybeSingle(),
    supabase.from("site_pages").select("id, definition").eq("site_id", id).eq("account_id", ws.account.id).order("position").limit(1),
    supabase.from("forms").select("id, name").eq("account_id", ws.account.id).eq("status", "live").order("name"),
    supabase.from("accounts").select("slug").eq("id", ws.account.id).single(),
  ]);
  if (!site || !pages?.[0]) notFound();
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://os.scalency.us").replace(/\/$/, "");
  return (
    <PageStudio
      site={{ id: site.id, name: site.name, slug: site.slug, status: site.status, pageId: pages[0].id, definition: cleanPage(pages[0].definition) }}
      base={base}
      workspaceSlug={(acc?.slug as string) ?? ""}
      forms={(forms ?? []).map((f) => ({ id: f.id as string, name: f.name as string }))}
      canEdit={can(ws, "sites.manage")}
    />
  );
}
