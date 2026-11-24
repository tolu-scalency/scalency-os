import type { Metadata } from "next";
import { Page, PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { Console, type QueueItem } from "./console";

export const metadata: Metadata = { title: "Setter console" };

/** One queue of every lead the AI has passed to a person, across all the clinics you work on. */
function weekAgo() {
  return new Date(Date.now() - 7 * 86_400_000).toISOString();
}

export default async function SetterConsolePage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const [{ show }, ws] = await Promise.all([searchParams, getWorkspace()]);
  const supabase = await createClient();
  const accounts = ws.workspaces.map((w) => w.id);
  const view = show === "done" ? "done" : "open";
  const since = weekAgo();
  let q = supabase
    .from("setter_handoffs")
    .select("id, account_id, agent_id, thread_id, category, priority, reason, summary, status, claimed_by, claimed_at, done_at, outcome, created_at, setter_threads(contact_name, ghl_contact_id, channel, lead_score, qualification, appointment_at, state)")
    .in("account_id", accounts)
    .order("created_at", { ascending: view === "open" })
    .limit(200);
  q = view === "open" ? q.neq("status", "done") : q.eq("status", "done").gte("done_at", since);
  const [{ data: rows }, { data: agents }, {
    data: { user },
  }] = await Promise.all([q, supabase.from("setter_agents").select("id, account_id, ghl_location_id, business").in("account_id", accounts), supabase.auth.getUser()]);

  const agentOf = new Map((agents ?? []).map((a) => [a.id as string, a]));
  const wsName = new Map(ws.workspaces.map((w) => [w.id, w.name]));
  const threadIds = [...new Set((rows ?? []).map((r) => r.thread_id as string))];
  const { data: turns } = threadIds.length
    ? await supabase.from("setter_turns").select("thread_id, role, body, created_at").in("thread_id", threadIds).neq("role", "event").order("created_at", { ascending: false }).limit(600)
    : { data: [] };
  const lastTurns = new Map<string, { role: string; body: string; at: string }[]>();
  for (const t of turns ?? []) {
    const list = lastTurns.get(t.thread_id as string) ?? [];
    if (list.length < 4) list.push({ role: t.role as string, body: t.body as string, at: t.created_at as string });
    lastTurns.set(t.thread_id as string, list);
  }

  const RANK = { urgent: 0, high: 1, medium: 2 } as Record<string, number>;
  const items: QueueItem[] = (rows ?? []).map((r) => {
    const th = (r.setter_threads ?? {}) as unknown as { contact_name?: string; ghl_contact_id?: string; channel?: string; lead_score?: number | null; qualification?: Record<string, unknown>; appointment_at?: string | null };
    const a = agentOf.get(r.agent_id as string);
    const clinic = String((a?.business as { clinicName?: string } | null)?.clinicName || wsName.get(r.account_id as string) || "Clinic");
    return {
      id: r.id as string,
      clinic,
      priority: r.priority as QueueItem["priority"],
      category: r.category as string,
      reason: r.reason as string,
      summary: (r.summary as string) ?? "",
      status: r.status as QueueItem["status"],
      mine: r.claimed_by === user?.id,
      claimed: Boolean(r.claimed_by),
      claimedAt: (r.claimed_at as string) ?? null,
      doneAt: (r.done_at as string) ?? null,
      outcome: (r.outcome as string) ?? null,
      createdAt: r.created_at as string,
      name: th.contact_name || "Lead",
      channel: th.channel || "SMS",
      score: th.lead_score ?? null,
      qualification: (th.qualification ?? {}) as Record<string, string | number | boolean>,
      ghlLink: a?.ghl_location_id && th.ghl_contact_id ? `https://app.gohighlevel.com/v2/location/${a.ghl_location_id}/contacts/detail/${th.ghl_contact_id}` : null,
      recent: (lastTurns.get(r.thread_id as string) ?? []).reverse(),
    };
  });
  if (view === "open") items.sort((x, y) => (RANK[x.priority] ?? 3) - (RANK[y.priority] ?? 3) || x.createdAt.localeCompare(y.createdAt));

  return (
    <Page wide>
      <PageHeader
        eyebrow="AI"
        title="Setter console"
        subtitle={`Every lead the AI has passed to a person, across ${accounts.length === 1 ? "this clinic" : `your ${accounts.length} clinics`}. Most urgent first, then longest waiting. Aim to pick up within 5 minutes.`}
      />
      <Console items={items} view={view} />
    </Page>
  );
}
