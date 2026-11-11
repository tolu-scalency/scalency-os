import { createHmac, timingSafeEqual } from "node:crypto";
import { adminClient } from "@/lib/admin";
import { deliverPending } from "@/lib/deliver";

// Twilio calls this when someone texts the Scalency number ("A message comes in" webhook).
// The reply is matched to the contact who was last texted from that number, saved in the
// Inbox, and any "lead replied" workflows run. STOP and START are respected.

export const dynamic = "force-dynamic";

const STOP = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);
const START = new Set(["START", "UNSTOP", "YES"]);
const empty = () => new Response("<Response></Response>", { headers: { "content-type": "text/xml" } });

/** Twilio signs each request; check it so nobody else can post fake replies. */
function signed(urls: string[], params: URLSearchParams, signature: string, token: string) {
  const sorted = [...params.keys()].sort().map((k) => k + params.get(k)).join("");
  return urls.some((u) => {
    const expected = createHmac("sha1", token).update(u + sorted).digest("base64");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export async function POST(request: Request) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  const admin = adminClient();
  if (!token || !admin) return new Response("Not set up", { status: 503 });

  const raw = await request.text();
  const params = new URLSearchParams(raw);
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const candidates = [request.url, `https://${host}${url.pathname}${url.search}`];
  if (!signed(candidates, params, request.headers.get("x-twilio-signature") ?? "", token)) {
    return new Response("Bad signature", { status: 403 });
  }

  const from = params.get("From") ?? "";
  const body = (params.get("Body") ?? "").slice(0, 1600);
  const sid = params.get("MessageSid") ?? null;
  if (!from) return empty();

  // Whoever we last texted at this number (in test mode that's the workspace's test phone).
  const { data: last } = await admin
    .from("messages")
    .select("account_id, contact_id")
    .eq("direction", "outbound")
    .eq("channel", "sms")
    .eq("to_address", from)
    .not("contact_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let account = last?.account_id as string | undefined;
  let contact = last?.contact_id as string | undefined;
  if (!contact) {
    const { data: c } = await admin.from("contacts").select("id, account_id").eq("phone", from).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    account = c?.account_id;
    contact = c?.id;
  }
  if (!account || !contact) return empty();

  const { error } = await admin.from("messages").insert({
    account_id: account,
    contact_id: contact,
    direction: "inbound",
    channel: "sms",
    to_address: params.get("To") ?? "",
    from_address: from,
    body: body || "(empty message)",
    status: "received",
    provider: "twilio",
    provider_message_id: sid,
  });
  // 23505 means Twilio retried a message we already saved.
  if (error && error.code !== "23505") return new Response("Couldn't save", { status: 500 });
  if (error) return empty();

  await admin.from("activity").insert({ account_id: account, contact_id: contact, type: "message.received", summary: `Text reply: ${body.slice(0, 80)}` });

  const word = body.trim().toUpperCase();
  if (STOP.has(word)) await admin.from("contacts").update({ sms_unsubscribed_at: new Date().toISOString() }).eq("id", contact);
  else if (START.has(word)) await admin.from("contacts").update({ sms_unsubscribed_at: null }).eq("id", contact);

  await admin.rpc("run_due_workflows", { target_account: account });
  await deliverPending(admin, account);
  return empty();
}
