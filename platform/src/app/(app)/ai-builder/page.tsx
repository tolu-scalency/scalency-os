import type { Metadata } from "next";
import { Button, Page, PageHeader } from "@/components/ui";
import { getPipeline, getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { SETUP_TEMPLATES } from "@/lib/setup";
import { SetupWizard, type LastSetup } from "./setup-wizard";

export const metadata: Metadata = { title: "AI setup" };

export default async function AiSetupPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  const ws = await getWorkspace();
  const manager = ws.account.role === "owner" || ws.account.role === "admin";
  const supabase = await createClient();

  const [pipeline, last] = await Promise.all([
    getPipeline(ws.account.id),
    supabase
      .from("workspace_setups")
      .select("id, applied_at, result")
      .eq("account_id", ws.account.id)
      .eq("status", "applied")
      .order("applied_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  let deals = 0;
  if (pipeline) {
    const { count } = await supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("pipeline_id", pipeline.id);
    deals = count ?? 0;
  }

  const lastSetup: LastSetup | null = last.data ? { id: last.data.id, appliedAt: last.data.applied_at } : null;

  return (
    <Page>
      <PageHeader
        eyebrow={welcome ? "Welcome to Scalency OS" : "AI setup"}
        title={welcome ? "Let's set up your workspace" : "Set up your workspace with AI"}
        subtitle="Tell us how your business works. We'll suggest your pipeline, fields, tags and starter workflows. You check everything before it's built."
        actions={welcome ? <Button href="/dashboard">Skip for now</Button> : undefined}
      />
      {manager ? (
        <SetupWizard
          accountId={ws.account.id}
          templates={SETUP_TEMPLATES}
          pipeline={pipeline ? { name: pipeline.name, stages: pipeline.stages.map((s) => s.name), deals } : null}
          lastSetup={lastSetup}
          welcome={Boolean(welcome)}
        />
      ) : (
        <p className="card p-6 text-[14px] text-muted">Only the workspace owner or an admin can run the AI setup. Ask them to open this page.</p>
      )}
    </Page>
  );
}
