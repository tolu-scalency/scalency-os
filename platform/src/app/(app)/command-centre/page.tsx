import type { Metadata } from "next";
import { getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { Page, PageHeader } from "@/components/ui";
import { CommandCentre, type LiveThread } from "./centre";

export const metadata: Metadata = { title: "Command centre" };

function since(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/** Every live AI conversation across your clinics: what's being said, who needs a person, and
 *  one click to take over or hand back. */
export default async function CommandCentrePage() {
  const ws = await getWorkspace();
  const accounts = [ws.account.id];
  const supabase = await createClient();
  const { data: threads } = await supabase
    .from("setter_threads")
    .select("id, account_id, agent_id, ghl_contact_id, contact_name, state, channel, origin, lead_score, qualification, appointment_at, last_inbound_at, last_outbound_at, updated_at")
    .in("account_id", accounts)
    .in("state", ["active", "paused", "handed_over", "booked"])
    .gte("updated_at", since(14))
    .order("updated_at", { ascending: false })
    .limit(80);
  const ids = (threads ?? []).map((t) => t.id as string);
  const agentIds = [...new Set((threads ?? []).map((t) => t.agent_id as string))];
  const [{ data: turns }, { data: agents }] = await Promise.all([
    ids.length ? supabase.from("setter_turns").select("thread_id, role, body, channel, created_at").in("thread_id", ids).order("created_at", { ascending: false }).limit(2000) : Promise.resolve({ data: [] }),
    agentIds.length ? supabase.from("setter_agents").select("id, business, ghl_location_id").in("id", agentIds) : Promise.resolve({ data: [] }),
  ]);
  const byThread = new Map<string, { role: string; body: string; at: string }[]>();
  for (const t of (turns ?? []) as { thread_id: string; role: string; body: string; created_at: string }[]) {
    const list = byThread.get(t.thread_id) ?? [];
    if (list.length < 40) list.push({ role: t.role, body: t.body, at: t.created_at });
    byThread.set(t.thread_id, list);
  }
  const agentMap = new Map(((agents ?? []) as { id: string; business: { clinicName?: string; assistantName?: string } | null; ghl_location_id: string | null }[]).map((a) => [a.id, a]));
  const items: LiveThread[] = ((threads ?? []) as Record<string, unknown>[]).map((t) => {
    const a = agentMap.get(t.agent_id as string);
    return {
      id: t.id as string,
      agentId: t.agent_id as string,
      name: (t.contact_name as string) || "Lead",
      clinic: a?.business?.clinicName || ws.workspaces.find((w) => w.id === t.account_id)?.name || "",
      assistant: a?.business?.assistantName || "AI",
      state: t.state as LiveThread["state"],
      channel: (t.channel as string) || "SMS",
      origin: (t.origin as string) || "lead",
      score: (t.lead_score as number) ?? null,
      qualification: (t.qualification as Record<string, unknown>) ?? {},
      appointmentAt: (t.appointment_at as string) ?? null,
      lastAt: (t.updated_at as string) ?? "",
      waiting: Boolean(t.last_inbound_at && (!t.last_outbound_at || (t.last_inbound_at as string) > (t.last_outbound_at as string))),
      ghlLink: a?.ghl_location_id ? `https://app.gohighlevel.com/v2/location/${a.ghl_location_id}/contacts/detail/${t.ghl_contact_id}` : "",
      turns: (byThread.get(t.id as string) ?? []).reverse(),
    };
  });
  return (
    <Page wide>
      <PageHeader eyebrow="AI" title="Command centre" subtitle={`Every live AI conversation in ${ws.account.name}. Read along, get a summary, take over and reply yourself, or hand back to the AI.`} />
      <CommandCentre items={items} />
    </Page>
  );
}
