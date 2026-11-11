import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Delivers emails (Resend) and texts (Twilio) that workflows and the inbox have saved.
// In test mode the message is already addressed to the workspace's test inbox or phone.
// Each message is "claimed" first, so running this twice never sends anything twice.

type Pending = { id: string; account_id: string; channel: "email" | "sms"; to_address: string; subject: string | null; body: string; html: string | null; status: string };

/** Scalency's own team (PLATFORM_ADMIN_EMAILS in Netlify, comma separated). Customers never see platform settings. */
export function isPlatformAdmin(email: string | null | undefined) {
  const list = (process.env.PLATFORM_ADMIN_EMAILS ?? "").toLowerCase().split(",").map((e) => e.trim()).filter(Boolean);
  return Boolean(email && list.includes(email.toLowerCase()));
}

export function providersReady() {
  return { email: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM), sms: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) };
}

function escapeHtml(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** A clean HTML version of a plain-text message, with links made clickable. */
export function emailHtml(body: string, workspace: string, test: boolean) {
  const paragraphs = escapeHtml(body)
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0A5FE3;">$1</a>'))
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#1F2D45;">${p}</p>`)
    .join("");
  return emailShell(paragraphs, workspace, test);
}

/** Designed emails: a full HTML document is sent as written; a design from the editor goes inside the clean frame. */
export function designedHtml(html: string, workspace: string, test: boolean) {
  if (/<html[\s>]/i.test(html)) {
    if (!test) return html;
    const banner = '<div style="padding:10px 16px;background:#FFF7E6;color:#8A5300;font:12px Arial,sans-serif;text-align:center;">Test mode: this was sent to the workspace test inbox, not to the lead.</div>';
    return /<body[^>]*>/i.test(html) ? html.replace(/<body[^>]*>/i, (m) => m + banner) : banner + html;
  }
  return emailShell(`<div style="font-size:15px;line-height:24px;color:#1F2D45;">${html}</div>`, workspace, test);
}

function emailShell(paragraphs: string, workspace: string, test: boolean) {
  const banner = test
    ? '<tr><td style="padding:10px 16px;background-color:#FFF7E6;color:#8A5300;font-size:12px;text-align:center;">Test mode: this was sent to the workspace test inbox, not to the lead.</td></tr>'
    : "";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background-color:#F4F7FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F7FB;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#FFFFFF;border-radius:16px;overflow:hidden;">
${banner}
<tr><td style="padding:32px 32px 16px;">${paragraphs}</td></tr>
<tr><td style="padding:0 32px 28px;font-size:12px;color:#8592A6;">${escapeHtml(workspace)}</td></tr>
</table></td></tr></table></body></html>`;
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
      html: m.html ? designedHtml(m.html, workspace, m.status === "held_test_mode") : emailHtml(m.body, workspace, m.status === "held_test_mode"),
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
    .select("id, account_id, channel, to_address, subject, body, html, status")
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

type Hook = { id: string; url: string; payload: unknown };

/** Posts queued outgoing webhooks. Needs the server (secret key) client, so it only runs from the clock. */
export async function deliverWebhooks(admin: SupabaseClient, limit = 50) {
  const { data } = await admin.from("outbound_webhooks").select("id, url, payload").eq("status", "queued").order("created_at").limit(limit);
  let sent = 0;
  for (const h of (data ?? []) as Hook[]) {
    const { data: claimed } = await admin.from("outbound_webhooks").update({ status: "sending" }).eq("id", h.id).eq("status", "queued").select("id");
    if (!claimed?.length) continue;
    try {
      const res = await fetch(h.url, {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": "Scalency-OS-Webhook/1.0" },
        body: JSON.stringify(h.payload),
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
      });
      await admin
        .from("outbound_webhooks")
        .update({ status: res.ok ? "sent" : "failed", response_status: res.status, sent_at: new Date().toISOString(), error: res.ok ? null : `The other app answered ${res.status}` })
        .eq("id", h.id);
      if (res.ok) sent += 1;
    } catch (e) {
      await admin.from("outbound_webhooks").update({ status: "failed", error: String(e instanceof Error ? e.message : e).slice(0, 300) }).eq("id", h.id);
    }
  }
  return sent;
}
