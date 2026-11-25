import { adminClient } from "@/lib/admin";
import { deliverPending, deliverWebhooks } from "@/lib/deliver";
import { recheckPendingDomains } from "@/lib/domains";
import { syncCalendly } from "@/lib/calendar/booking";

// The clock. Netlify calls this every minute (netlify/functions/clock.mts).
// It runs due workflow steps for every workspace, then sends waiting emails, texts and webhooks.
// Protected by CRON_SECRET; uses the Supabase secret key, which stays on the server.

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Not allowed", { status: 401 });
  }
  const admin = adminClient();
  if (!admin) return new Response("Missing Supabase settings", { status: 500 });

  const { data: steps, error } = await admin.rpc("run_due_workflows");
  const sent = await deliverPending(admin, undefined, 100);
  const hooks = await deliverWebhooks(admin);
  // Clear out old sign-in codes once an hour.
  if (new Date().getMinutes() === 0) await admin.rpc("prune_login_codes");
  // New own domains for pages switch on by themselves once their DNS records show up.
  if (new Date().getMinutes() % 10 === 5) await recheckPendingDomains(admin).catch((e) => console.error("Domain checks failed", e));
  // Calendly bookings come into Scalency every 5 minutes.
  if (new Date().getMinutes() % 5 === 2) await syncCalendly(admin).catch((e) => console.error("Calendly sync failed", e));
  return Response.json({ ok: !error, workflowsProcessed: steps ?? 0, messagesSent: sent, webhooksSent: hooks, error: error?.message });
}
