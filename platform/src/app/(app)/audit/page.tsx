import type { Metadata } from "next";
import { Page, PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { Audit } from "./audit";
import { AiAudit, type SavedAudit } from "./report";
import { AuditTabs } from "./tabs";

export const metadata: Metadata = { title: "AI opportunity audit" };

/** The AI opportunity audit (Platform Features) and the quick missed-revenue calculator, for sales calls. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [ws, sp] = await Promise.all([getWorkspace(), searchParams]);
  const supabase = await createClient();
  const { data } = await supabase.from("audits").select("id, business_name, website, report, monthly_total, created_at").eq("account_id", ws.account.id).order("created_at", { ascending: false }).limit(50);
  const tab = sp.tab === "calculator" ? "calculator" : "report";
  return (
    <Page>
      <PageHeader eyebrow="Sales" title="AI opportunity audit" subtitle="A report for any business: where AI will make them money, save time and save money, with £ estimates and a 90-day roadmap. Or run the quick calculator live on a call." />
      <AuditTabs tab={tab} />
      {tab === "report" ? <AiAudit accountId={ws.account.id} saved={(data ?? []) as SavedAudit[]} /> : <Audit />}
    </Page>
  );
}
