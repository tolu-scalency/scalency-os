import type { Metadata } from "next";
import Link from "next/link";
import { shortId } from "@/lib/short-id-shared";
import { getWorkspace } from "@/lib/data";
import { providersReady } from "@/lib/deliver";
import { createClient } from "@/lib/supabase/server";
import { Health, type Check } from "./health";

export const metadata: Metadata = { title: "Integrations and health" };

/** True when the last time something happened is older than this many days (or never). */
function stale(iso: string | null, days: number) {
  return iso ? Date.now() - new Date(iso).getTime() > days * 86_400_000 : true;
}

function ago(iso: string | null | undefined) {
  if (!iso) return null;
  return iso;
}

/** Integrations hub and health monitor (Platform Features): every connection this workspace relies
 *  on, whether it's working, when it last did something, and how to fix it. */
export default async function IntegrationsPage() {
  const ws = await getWorkspace();
  const supabase = await createClient();
  const acc = ws.account.id;
  const latest = async (table: string, col: string, build?: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
    const q = build ? build(base(table, col)) : base(table, col);
    const { data } = await q;
    return ((data?.[0] as Record<string, string> | undefined)?.[col] as string) ?? null;
  };
  const base = (table: string, col: string) => supabase.from(table).select(col).eq("account_id", acc).order(col, { ascending: false }).limit(1);
  const [{ data: setters }, lastLead, lastReply, lastAi, lastStatus, lastCall, lastForm] = await Promise.all([
    supabase.from("setter_agents").select("id, name, status, ghl_location_name, ghl_checked_at, ghl_error, ghl_calendar_id, ghl_calendar_name, ghl_pipeline_id").eq("account_id", acc).order("created_at"),
    latest("setter_threads", "created_at", (q) => q.eq("origin", "lead")),
    latest("setter_turns", "created_at", (q) => q.eq("role", "lead")),
    latest("setter_turns", "created_at", (q) => q.eq("role", "ai").eq("is_test", false)),
    latest("setter_threads", "appointment_status_at"),
    latest("setter_calls", "created_at"),
    latest("form_submissions", "started_at"),
  ]);
  const p = providersReady();
  const checks: Check[] = [];
  for (const s of (setters ?? []) as Record<string, unknown>[]) {
    const href = `/agents/${shortId(s.id as string)}?tab=ghl`;
    checks.push({
      group: "GoHighLevel",
      name: `${s.name as string}: GHL connection`,
      status: s.ghl_error ? "bad" : s.ghl_checked_at ? "ok" : "warn",
      detail: (s.ghl_error as string) || (s.ghl_checked_at ? `Connected to ${(s.ghl_location_name as string) || "your sub-account"}` : "Not connected yet"),
      at: (s.ghl_checked_at as string) ?? null,
      fix: s.ghl_checked_at && !s.ghl_error ? undefined : { label: "Connect GHL", href },
    });
    checks.push({ group: "GoHighLevel", name: `${s.name as string}: calendar`, status: s.ghl_calendar_id ? "ok" : "warn", detail: s.ghl_calendar_id ? `Booking into ${(s.ghl_calendar_name as string) || "your calendar"}` : "No calendar chosen, so the AI can't book", at: null, fix: s.ghl_calendar_id ? undefined : { label: "Choose a calendar", href } });
    checks.push({ group: "GoHighLevel", name: `${s.name as string}: status`, status: s.status === "live" ? "ok" : s.status === "test" ? "warn" : "off", detail: s.status === "live" ? "Live: working every lead" : s.status === "test" ? "Test mode: only contacts tagged ai-test" : "Switched off", at: null, fix: s.status === "live" ? undefined : { label: "Open the AI setter", href: `/agents/${shortId(s.id as string)}` } });
  }
  if (!setters?.length) checks.push({ group: "GoHighLevel", name: "AI setter", status: "warn", detail: "No AI setter in this workspace yet", at: null, fix: { label: "Set one up", href: "/agents" } });
  checks.push(
    { group: "Webhooks from GHL", name: "New leads", status: lastLead ? (stale(lastLead, 7) ? "warn" : "ok") : "warn", detail: lastLead ? "Last new lead received" : "No new lead has come in yet: check the 'new lead' workflow in GHL", at: ago(lastLead) },
    { group: "Webhooks from GHL", name: "Replies", status: lastReply ? "ok" : "warn", detail: lastReply ? "Last reply received" : "No replies yet: check the 'lead replied' workflow", at: ago(lastReply) },
    { group: "Webhooks from GHL", name: "Appointment status", status: lastStatus ? "ok" : "off", detail: lastStatus ? "Last show, no-show or cancellation" : "Optional: needed for show rates, reviews and rebooking", at: ago(lastStatus) },
    { group: "AI", name: "AI messages", status: lastAi ? (stale(lastAi, 7) ? "warn" : "ok") : "warn", detail: lastAi ? "Last message the AI sent" : "The AI hasn't sent a live message yet", at: ago(lastAi) },
    { group: "AI", name: "Voice calls", status: lastCall ? "ok" : "off", detail: lastCall ? "Last AI call" : "Voice AI isn't connected yet", at: ago(lastCall) },
    { group: "Sending", name: "Email (Resend)", status: p.email ? "ok" : "bad", detail: p.email ? "Ready to send workflow and alert emails" : "RESEND_API_KEY or EMAIL_FROM is missing in Netlify", at: null },
    { group: "Sending", name: "Texts (Twilio)", status: p.sms ? "ok" : "warn", detail: p.sms ? "Ready to send workflow texts" : "Twilio isn't set up in Netlify (GHL still sends the AI's texts)", at: null },
    { group: "Lead sources", name: "Scalency forms", status: lastForm ? "ok" : "off", detail: lastForm ? "Last form submission" : "No submissions yet", at: ago(lastForm) },
    { group: "Payments", name: "Stripe", status: "off", detail: "Waiting for approval to connect", at: null },
  );
  return (
    <div className="flex flex-col gap-4">
      <Health checks={checks} accountId={acc} />
      <p className="text-[12.5px] text-muted">
        Facebook lead forms and mailboxes come in through GHL, so their health shows as &quot;New leads&quot;. Anything red needs fixing now; amber is worth a look. See also the <Link href="/guardrails" className="font-semibold text-brand hover:underline">guardrails log</Link>.
      </p>
    </div>
  );
}
