import type { Metadata } from "next";
import { Page, PageHeader } from "@/components/ui";
import { Audit } from "./audit";

export const metadata: Metadata = { title: "Free audit" };

/** The missed-revenue audit for sales calls: a clinic's own numbers in, the money they're losing out. */
export default function AuditPage() {
  return (
    <Page>
      <PageHeader eyebrow="Sales" title="Free missed-revenue audit" subtitle="Fill in a clinic's numbers on a call. It shows what slow replies, missed calls and no-shows cost them each month, and what the AI system wins back." />
      <Audit />
    </Page>
  );
}
