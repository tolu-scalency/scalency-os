import { createClient } from "@supabase/supabase-js";
import { deliverPending } from "@/lib/deliver";

// The clock. Netlify calls this every minute (netlify/functions/clock.mts).
// It runs due workflow steps for every workspace, then sends waiting emails and texts.
// Protected by CRON_SECRET; uses the Supabase secret key, which stays on the server.

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Not allowed", { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return new Response("Missing Supabase settings", { status: 500 });

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: steps, error } = await admin.rpc("run_due_workflows");
  const sent = await deliverPending(admin, undefined, 100);
  return Response.json({ ok: !error, workflowsProcessed: steps ?? 0, messagesSent: sent, error: error?.message });
}
