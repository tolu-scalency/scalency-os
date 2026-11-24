import type { Metadata } from "next";
import { Page, PageHeader } from "@/components/ui";
import { can, getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { Studio, type Creative } from "./studio";

export const metadata: Metadata = { title: "Creative studio" };

/** AI-written ads and posts, checked against UK ad rules for aesthetics, with sign-off before use. */
export default async function CreativeStudioPage() {
  const ws = await getWorkspace();
  const supabase = await createClient();
  const [{ data: rows }, { data: setters }] = await Promise.all([
    supabase.from("creatives").select("id, title, channel, headline, body, cta, image_idea, brief, status, compliance, review_note, reviewed_at, updated_at").eq("account_id", ws.account.id).order("updated_at", { ascending: false }).limit(200),
    supabase.from("setter_agents").select("id").eq("account_id", ws.account.id).order("created_at").limit(1),
  ]);
  return (
    <Page>
      <PageHeader eyebrow="Get found" title="Creative studio" subtitle="Ad and post copy written from the clinic's own details, checked against UK advertising rules for aesthetics, and signed off before anyone uses it." />
      <Studio items={(rows ?? []) as Creative[]} setterId={(setters?.[0]?.id as string) ?? ""} canApprove={can(ws, "settings.manage")} />
    </Page>
  );
}
