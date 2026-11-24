import type { Metadata } from "next";
import { fullId } from "@/lib/short-id";
import { notFound } from "next/navigation";
import { can, getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { cleanBusiness, cleanRules, type SetterStatus, type ThreadState } from "@/lib/setter";
import { SetterEditor, type Tab, type ThreadView } from "./setter-editor";
import type { CallItem, KnowledgeItem, VersionItem } from "./growth-tabs";

const TABS: Tab[] = ["clinic", "knowledge", "rules", "journey", "showup", "retention", "voice", "ghl", "test", "reactivate", "conversations"];

export const metadata: Metadata = { title: "AI setter" };

export default async function SetterRoute({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id: raw }, ws, sp] = await Promise.all([params, getWorkspace(), searchParams]);
  const id = await fullId("setter_agents", raw);
  const supabase = await createClient();
  const [{ data: a }, { data: threads }, { data: knowledge }, { data: versions }, { data: calls }] = await Promise.all([
    supabase
      .from("setter_agents")
      .select("id, name, status, business, rules, ghl_location_id, ghl_location_name, ghl_calendar_id, ghl_calendar_name, ghl_pipeline_id, ghl_stages, ghl_checked_at, ghl_error")
      .eq("id", id)
      .eq("account_id", ws.account.id)
      .maybeSingle(),
    supabase
      .from("setter_threads")
      .select("id, ghl_contact_id, contact_name, state, channel, origin, total_touches, next_action, next_action_at, last_outbound_at, appointment_at, note, updated_at, setter_turns(role, body, channel, created_at)")
      .eq("agent_id", id)
      .eq("account_id", ws.account.id)
      .order("updated_at", { ascending: false })
      .limit(40),
    supabase.from("setter_knowledge").select("id, question, answer, source, approved").eq("agent_id", id).eq("account_id", ws.account.id).order("created_at").limit(300),
    supabase.from("setter_versions").select("id, name, created_at, business, rules").eq("agent_id", id).eq("account_id", ws.account.id).order("created_at", { ascending: false }).limit(40),
    supabase.from("setter_calls").select("id, direction, purpose, duration_seconds, summary, created_at, recording_url").eq("agent_id", id).eq("account_id", ws.account.id).order("created_at", { ascending: false }).limit(20),
  ]);
  if (!a) notFound();
  // Lead reactivation numbers, across every old lead it has queued (not just the 40 shown).
  const count = async (q: (b: ReturnType<typeof base>) => ReturnType<typeof base>) => (await q(base())).count ?? 0;
  const base = () => supabase.from("setter_threads").select("id", { count: "exact", head: true }).eq("agent_id", id).eq("account_id", ws.account.id).eq("origin", "reactivation");
  const [rqueued, rmessaged, rreplied, rbooked] = await Promise.all([
    count((b) => b.eq("next_action", "reactivate")),
    count((b) => b.not("last_outbound_at", "is", null)),
    count((b) => b.not("last_inbound_at", "is", null)),
    count((b) => b.eq("state", "booked")),
  ]);
  const reactivation = { queued: rqueued, messaged: rmessaged, replied: rreplied, booked: rbooked };
  const views: ThreadView[] = (threads ?? []).map((t) => ({
    id: t.id as string,
    contactId: t.ghl_contact_id as string,
    name: (t.contact_name as string) || "Lead",
    state: t.state as ThreadState,
    channel: t.channel as string,
    touches: (t.total_touches as number) ?? 0,
    nextAt: (t.next_action_at as string) ?? null,
    nextIsOpener: t.next_action === "opener",
    origin: ((t.origin as string) ?? "lead") as ThreadView["origin"],
    contacted: Boolean(t.last_outbound_at),
    appointmentAt: (t.appointment_at as string) ?? null,
    note: (t.note as string) ?? null,
    updatedAt: t.updated_at as string,
    turns: ((t.setter_turns as { role: string; body: string; channel: string | null; created_at: string }[]) ?? [])
      .sort((x, y) => x.created_at.localeCompare(y.created_at))
      .slice(-60)
      .map((x) => ({ role: x.role as "lead" | "ai" | "event", body: x.body, at: x.created_at })),
  }));
  return (
    <SetterEditor
      reactivation={reactivation}
      setter={{
        id: a.id as string,
        name: a.name as string,
        status: a.status as SetterStatus,
        business: cleanBusiness(a.business),
        rules: cleanRules(a.rules),
        ghl: {
          locationId: (a.ghl_location_id as string) ?? "",
          locationName: (a.ghl_location_name as string) ?? "",
          calendarId: (a.ghl_calendar_id as string) ?? "",
          calendarName: (a.ghl_calendar_name as string) ?? "",
          pipelineId: (a.ghl_pipeline_id as string) ?? "",
          stages: (a.ghl_stages as Record<string, string>) ?? {},
          checkedAt: (a.ghl_checked_at as string) ?? null,
          error: (a.ghl_error as string) ?? null,
        },
      }}
      threads={views}
      accountId={ws.account.id}
      canEdit={can(ws, "ai.manage")}
      knowledge={(knowledge ?? []) as KnowledgeItem[]}
      versions={(versions ?? []) as VersionItem[]}
      calls={(calls ?? []) as CallItem[]}
      initialTab={TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : undefined}
    />
  );
}
