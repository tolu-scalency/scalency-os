import type { Metadata } from "next";
import { Results, type FeedRow, type Handoff, type Th } from "./view";
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

  const [{ data: threadRows }, { data: handoffRows }, { data: feedRows }] = await Promise.all([
    supabase
      .from("setter_threads")
      .select("id, account_id, origin, channel, state, created_at, first_reply_at, last_inbound_at, last_outbound_at, booked_at, appointment_status, guardrail_flags, lead_score")
      .in("account_id", accounts)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(5000),
    supabase.from("setter_handoffs").select("id, priority, status, created_at, claimed_at, category").in("account_id", accounts).gte("created_at", since).limit(2000),
    supabase
      .from("setter_turns")
      .select("id, role, body, channel, created_at, setter_threads(contact_name)")
      .in("account_id", accounts)
      .neq("role", "lead")
      .order("created_at", { ascending: false })
      .limit(14),
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
    />
  );
}

