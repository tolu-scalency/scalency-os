import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Delivers emails (Resend) and texts (Twilio) that workflows and the inbox have saved.
// In test mode the message is already addressed to the workspace's test inbox or phone.
// Each message is "claimed" first, so running this twice never sends anything twice.

type Pending = { id: string; account_id: string; channel: "email" | "sms"; to_address: string; subject: string | null; body: string; status: string };

export function providersReady() {
  return { email: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM), sms: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) };
}

async function sendEmail(m: Pending, workspace: string) {
  const from = process.env.EMAIL_FROM!; // e.g. hello@send.scalency.us
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: `${workspace.replace(/[<>"]/g, "")} <${from}>`,
      to: [m.to_address],
      subject: (m.status === "held_test_mode" ? "[TEST] " : "") + (m.subject ?? "(no subject)"),
      text: m.body,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) throw new Error(data.message ?? `Resend error ${res.status}`);
  return data.id ?? null;
}

async function sendSms(m: Pending) {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const from = process.env.TWILIO_FROM!; // a Twilio number like +447..., a Messaging Service SID (MG...), or a sender name like Scalency
  const form = new URLSearchParams({ To: m.to_address, Body: (m.status === "held_test_mode" ? "[TEST] " : "") + m.body });
  if (from.startsWith("MG")) form.set("MessagingServiceSid", from);
  else form.set("From", from);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { authorization: "Basic " + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"), "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
  if (!res.ok) throw new Error(data.message ?? `Twilio error ${res.status}`);
  return data.sid ?? null;
}

/** Sends waiting messages. Pass an account id to limit it to one workspace. Returns how many were sent. */
export async function deliverPending(supabase: SupabaseClient, accountId?: string, limit = 25) {
  const ready = providersReady();
  if (!ready.email && !ready.sms) return 0;
  const channels = [ready.email && "email", ready.sms && "sms"].filter(Boolean) as string[];

  let query = supabase
    .from("messages")
    .select("id, account_id, channel, to_address, subject, body, status")
    .in("status", ["queued", "held_test_mode"])
    .is("sent_at", null)
    .is("provider", null)
    .eq("direction", "outbound")
    .in("channel", channels)
    .order("created_at")
    .limit(limit);
  if (accountId) query = query.eq("account_id", accountId);
  const { data } = await query;
  if (!data?.length) return 0;

  const names = new Map<string, string>();
  let sent = 0;
  for (const m of data as Pending[]) {
    // Claim it so a second run can't send it too.
    const provider = m.channel === "email" ? "resend" : "twilio";
    const { data: claimed } = await supabase.from("messages").update({ provider }).eq("id", m.id).is("provider", null).select("id");
    if (!claimed?.length) continue;

    if (!names.has(m.account_id)) {
      const { data: acc } = await supabase.from("accounts").select("name").eq("id", m.account_id).maybeSingle();
      names.set(m.account_id, acc?.name ?? "Scalency");
    }
    try {
      const providerId = m.channel === "email" ? await sendEmail(m, names.get(m.account_id)!) : await sendSms(m);
      await supabase
        .from("messages")
        .update({ sent_at: new Date().toISOString(), provider_message_id: providerId, status: m.status === "queued" ? "sent" : "held_test_mode", from_address: m.channel === "email" ? process.env.EMAIL_FROM : process.env.TWILIO_FROM })
        .eq("id", m.id);
      sent += 1;
    } catch (e) {
      await supabase.from("messages").update({ status: "failed", error: String(e instanceof Error ? e.message : e).slice(0, 500) }).eq("id", m.id);
    }
  }
  return sent;
}
