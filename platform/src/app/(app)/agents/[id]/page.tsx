import type { Metadata } from "next";
import { fullId } from "@/lib/short-id";
import { notFound } from "next/navigation";
import { can, getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { cleanBusiness, cleanRules, type SetterStatus, type ThreadState } from "@/lib/setter";
import { SetterEditor, type ThreadView } from "./setter-editor";

export const metadata: Metadata = { title: "AI setter" };

export default async function SetterRoute({ params }: { params: Promise<{ id: string }> }) {
  const [{ id: raw }, ws] = await Promise.all([params, getWorkspace()]);
  const id = await fullId("setter_agents", raw);
  const supabase = await createClient();
  const [{ data: a }, { data: threads }] = await Promise.all([
    supabase
      .from("setter_agents")
      .select("id, name, status, business, rules, ghl_location_id, ghl_location_name, ghl_calendar_id, ghl_calendar_name, ghl_pipeline_id, ghl_stages, ghl_checked_at, ghl_error")
      .eq("id", id)
      .eq("account_id", ws.account.id)
      .maybeSingle(),
    supabase
      .from("setter_threads")
      .select("id, ghl_contact_id, contact_name, state, channel, total_touches, next_action, next_action_at, last_outbound_at, appointment_at, note, updated_at, setter_turns(role, body, channel, created_at)")
      .eq("agent_id", id)
      .eq("account_id", ws.account.id)
      .order("updated_at", { ascending: false })
      .limit(40),
  ]);
  if (!a) notFound();
  const views: ThreadView[] = (threads ?? []).map((t) => ({
    id: t.id as string,
    contactId: t.ghl_contact_id as string,
    name: (t.contact_name as string) || "Lead",
    state: t.state as ThreadState,
    channel: t.channel as string,
    touches: (t.total_touches as number) ?? 0,
    nextAt: (t.next_action_at as string) ?? null,
    nextIsOpener: t.next_action === "opener",
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
    />
  );
}
