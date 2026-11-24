import type { Metadata } from "next";
import { cleanBusiness } from "@/lib/setter";
import { Results, type FeedRow, type Guarantee, type Handoff, type Th } from "./view";

/** Each clinic's guarantee (for example 8 consultations in 60 days) and bookings since it started. */
async function guaranteesFor(agents: { id: string; account_id: string; business: unknown }[], workspaces: { id: string; name: string }[]): Promise<Guarantee[]> {
  const supabase = await createClient();
  const out: Guarantee[] = [];
  for (const a of agents) {
    const b = cleanBusiness(a.business);
    if (!b.guaranteeTarget || !b.guaranteeStart) continue;
    const { count } = await supabase.from("setter_threads").select("id", { count: "exact", head: true }).eq("agent_id", a.id).gte("booked_at", `${b.guaranteeStart}T00:00:00Z`);
    out.push({ clinic: b.clinicName || workspaces.find((w) => w.id === a.account_id)?.name || "Clinic", target: b.guaranteeTarget, days: b.guaranteeDays, start: b.guaranteeStart, booked: count ?? 0 });
  }
  return out;
}
import { getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "AI results" };

/** The time now (kept out of the component so render stays pure). */
function nowMs() {
  return Date.now();
}

const PERIODS = { "7": 7, "30": 30, "90": 90 } as const;

/** How the AI setter is doing: speed to lead, replies, bookings, shows, handoffs and the live feed,
 *  for this clinic or every clinic you work on (Platform Spec N, dashboard v1). */
export default async function AiResultsPage({ searchParams }: { searchParams: Promise<{ days?: string; scope?: string }> }) {
  const [sp, ws] = await Promise.all([searchParams, getWorkspace()]);
  const days = PERIODS[(sp.days ?? "30") as keyof typeof PERIODS] ?? 30;
  const all = sp.scope === "all" && ws.workspaces.length > 1;
  const accounts = all ? ws.workspaces.map((w) => w.id) : [ws.account.id];
  const supabase = await createClient();
  const now = nowMs();
  const since = new Date(now - days * 86_400_000).toISOString();

  const [{ data: threadRows }, { data: handoffRows }, { data: feedRows }, { data: agentRows }] = await Promise.all([
    supabase
      .from("setter_threads")
      .select("id, account_id, origin, channel, state, created_at, first_reply_at, last_inbound_at, last_outbound_at, booked_at, appointment_status, guardrail_flags, lead_score, qa_score")
      .in("account_id", accounts)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(5000),
    supabase.from("setter_handoffs").select("id, thread_id, priority, status, created_at, claimed_at, category").in("account_id", accounts).gte("created_at", since).limit(2000),
    supabase
      .from("setter_turns")
      .select("id, role, body, channel, created_at, setter_threads(contact_name)")
      .in("account_id", accounts)
      .neq("role", "lead")
      .order("created_at", { ascending: false })
      .limit(14),
    supabase.from("setter_agents").select("id, account_id, business").in("account_id", accounts),
  ]);
  return (
    <Results
      days={days}
      all={all}
      clinics={accounts.length}
      many={ws.workspaces.length > 1}
      name={ws.account.name}
      now={now}
      threads={(threadRows ?? []) as Th[]}
      handoffs={(handoffRows ?? []) as Handoff[]}
      feedRows={(feedRows ?? []) as unknown as FeedRow[]}
      setterId={((agentRows ?? []) as { id: string; account_id: string }[]).find((a) => a.account_id === ws.account.id)?.id ?? ""}
      guarantees={await guaranteesFor((agentRows ?? []) as { id: string; account_id: string; business: unknown }[], ws.workspaces)}
    />
  );
}

