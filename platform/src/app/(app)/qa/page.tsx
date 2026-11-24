import type { Metadata } from "next";
import { Page, PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { Qa, type GradedThread, type LabRun } from "./qa";

export const metadata: Metadata = { title: "QA and test lab" };

/** Quality: every AI conversation graded against the setter SOP, and the 50-conversation test. */
export default async function QaPage() {
  const ws = await getWorkspace();
  const supabase = await createClient();
  const [{ data: setters }, { data: graded }, { data: runs }, { count: waiting }] = await Promise.all([
    supabase.from("setter_agents").select("id, name").eq("account_id", ws.account.id).order("created_at"),
    supabase.from("setter_threads").select("id, contact_name, qa_score, qa_notes, qa_at, state, channel").eq("account_id", ws.account.id).not("qa_score", "is", null).order("qa_at", { ascending: false }).limit(60),
    supabase.from("setter_lab_runs").select("scenario, passed, score, result, created_at").eq("account_id", ws.account.id).order("created_at", { ascending: false }).limit(300),
    supabase.from("setter_threads").select("id", { count: "exact", head: true }).eq("account_id", ws.account.id).is("qa_at", null).not("last_outbound_at", "is", null),
  ]);
  // The latest run of each test.
  const latest = new Map<number, LabRun>();
  for (const r of (runs ?? []) as LabRun[]) if (!latest.has(r.scenario)) latest.set(r.scenario, r);
  return (
    <Page wide>
      <PageHeader eyebrow="Quality" title="QA and test lab" subtitle="Every AI conversation graded against the setter playbook, plus the 50-conversation test the AI must pass before a clinic goes live." />
      <Qa setterId={(setters?.[0]?.id as string) ?? ""} graded={(graded ?? []) as GradedThread[]} runs={[...latest.values()]} waiting={waiting ?? 0} />
    </Page>
  );
}
