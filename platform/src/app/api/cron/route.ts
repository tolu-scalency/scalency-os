import { adminClient } from "@/lib/admin";
import { deliverPending, deliverWebhooks } from "@/lib/deliver";

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
  return Response.json({ ok: !error, workflowsProcessed: steps ?? 0, messagesSent: sent, webhooksSent: hooks, error: error?.message });
}
