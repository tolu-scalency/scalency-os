import { adminClient } from "@/lib/admin";
import { readReplies } from "@/lib/mail-replies";

// Reads replies from connected mailboxes (IMAP). Netlify's clock calls this every
// 5 minutes (netlify/functions/clock.mts). Protected by CRON_SECRET.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 26;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Not allowed", { status: 401 });
  }
  const admin = adminClient();
  if (!admin) return new Response("Missing Supabase settings", { status: 500 });
  const r = await readReplies(admin, 20_000);
  return Response.json({ ok: true, ...r });
}
