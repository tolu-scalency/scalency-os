import type { Metadata } from "next";
import { headers } from "next/headers";
import { Page, PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { QrMaker, type QrTarget } from "./qr-maker";

export const metadata: Metadata = { title: "QR codes" };

/** QR codes for print: point one at any live page, funnel, website or form, or any web address. */
export default async function QrCodesPage() {
  const ws = await getWorkspace();
  const supabase = await createClient();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "os.scalency.us";
  const base = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  const [{ data: acc }, { data: sites }, { data: forms }, { data: domains }] = await Promise.all([
    supabase.from("accounts").select("slug").eq("id", ws.account.id).single(),
    supabase.from("sites").select("id, name, slug, kind").eq("account_id", ws.account.id).eq("status", "live").order("name"),
    supabase.from("forms").select("id, name, slug").eq("account_id", ws.account.id).eq("status", "live").order("name"),
    supabase.from("site_domains").select("site_id, domain").eq("account_id", ws.account.id).eq("status", "verified"),
  ]);
  const wsSlug = (acc?.slug as string) ?? "";
  const domainOf = new Map((domains ?? []).map((d) => [d.site_id as string, d.domain as string]));
  const targets: QrTarget[] = [
    ...(sites ?? []).map((s) => ({
      group: s.kind === "website" ? "Websites" : s.kind === "funnel" ? "Funnels" : "Pages",
      label: s.name as string,
      url: domainOf.has(s.id as string) ? `https://${domainOf.get(s.id as string)}` : `${base}/p/${wsSlug}/${s.slug}`,
    })),
    ...(forms ?? []).map((f) => ({ group: "Forms", label: f.name as string, url: wsSlug && f.slug ? `${base}/f/${wsSlug}/${f.slug}` : `${base}/f/${f.id}` })),
  ];
  return (
    <Page>
      <PageHeader eyebrow="Sites" title="QR codes" subtitle="For flyers, posters, business cards and shop windows. Scans are tagged so you can see them in your stats." />
      <QrMaker targets={targets} />
    </Page>
  );
}
