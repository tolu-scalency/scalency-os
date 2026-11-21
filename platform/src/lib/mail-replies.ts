import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { open } from "./secret-box";
import { runWorkflowsSoon } from "./run-soon";

// Email replies: reads the inbox of each connected mailbox (IMAP) every 5 minutes and
// puts replies from contacts into their conversation, like text replies.
//
// - Uses the same login and app password as sending, so there's nothing new to set up.
// - The first time, it only notes where the inbox is up to: older emails aren't imported.
// - Only emails from people who are already contacts are added. Out-of-office and other
//   automatic replies are skipped, so they don't start "lead replied" workflows.
// - Nothing is changed in the mailbox: emails aren't marked as read or moved.

type MailSender = {
  id: string;
  account_id: string;
  from_email: string;
  smtp_host: string;
  smtp_user: string;
  smtp_secret: string;
  imap_host: string | null;
  imap_port: number | null;
  imap_last_uid: number | null;
  imap_uid_validity: number | null;
};

/** Where to read the inbox, from the sending settings: smtp.gmail.com reads imap.gmail.com, and so on. */
export function imapFor(smtpHost: string, saved?: { host?: string | null; port?: number | null }) {
  if (saved?.host) return { host: saved.host, port: saved.port ?? 993 };
  const h = smtpHost.toLowerCase();
  const known: Record<string, string> = {
    "smtp.gmail.com": "imap.gmail.com",
    "smtp.googlemail.com": "imap.gmail.com",
    "smtp.office365.com": "outlook.office365.com",
    "smtp-mail.outlook.com": "outlook.office365.com",
    "smtp.mail.yahoo.com": "imap.mail.yahoo.com",
    "smtp.zoho.com": "imap.zoho.com",
    "smtp.zoho.eu": "imap.zoho.eu",
    "smtppro.zoho.com": "imappro.zoho.com",
    "smtppro.zoho.eu": "imappro.zoho.eu",
    "smtp.mail.me.com": "imap.mail.me.com",
  };
  if (known[h]) return { host: known[h], port: 993 };
  if (h.startsWith("smtp.")) return { host: `imap.${h.slice(5)}`, port: 993 };
  if (h.startsWith("smtpout.")) return { host: `imap.${h.slice(8)}`, port: 993 };
  return { host: h, port: 993 };
}

const PRIVATE = [/^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^::1$/, /^fc/i, /^fd/i, /^fe80/i, /^::$/];

/** Only real public mail servers, never anything inside our own network. */
async function publicHost(host: string) {
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) || isIP(host)) return false;
  try {
    const addrs = await lookup(host, { all: true });
    return addrs.length > 0 && !addrs.some((a) => PRIVATE.some((r) => r.test(a.address)));
  } catch {
    return false;
  }
}

/** The new part of a reply, without the quoted email underneath. */
export function replyText(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const cut = lines.findIndex(
    (l, i) =>
      /^On .{6,200}wrote:\s*$/i.test(l) ||
      (/^On .{6,200}$/i.test(l) && /wrote:\s*$/i.test(lines[i + 1] ?? "")) ||
      /^-{2,}\s*Original Message\s*-{2,}/i.test(l) ||
      /^_{10,}$/.test(l) ||
      /^From:\s.+/i.test(l) && /^(Sent|Date):\s/i.test(lines[i + 1] ?? "") ||
      /^>/.test(l),
  );
  const kept = (cut > 0 ? lines.slice(0, cut) : lines).join("\n").trim();
  return (kept || text.trim()).slice(0, 5000);
}

const AUTO_SUBJECT = /^(auto(matic)?[ -]?reply|out of (the )?office|away from|undeliverable|delivery status notification|mail delivery (failed|subsystem))/i;

const ids = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : v ? v.split(/\s+/) : [])
    .map((x) => x.trim())
    .filter(Boolean)
    .flatMap((x) => [x, x.replace(/^<|>$/g, ""), `<${x.replace(/^<|>$/g, "")}>`]);

async function readOne(admin: SupabaseClient, s: MailSender, deadline: number) {
  const where = imapFor(s.smtp_host, { host: s.imap_host, port: s.imap_port });
  if (!(await publicHost(where.host))) throw new Error(`We couldn't reach ${where.host} to read replies.`);
  const client = new ImapFlow({
    host: where.host,
    port: where.port,
    secure: where.port === 993,
    auth: { user: s.smtp_user, pass: open(s.smtp_secret) },
    logger: false,
    tls: { minVersion: "TLSv1.2", servername: where.host },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    disableAutoIdle: true,
  });
  let added = 0;
  await client.connect();
  try {
    const box = await client.mailboxOpen("INBOX", { readOnly: true });
    const validity = Number(box.uidValidity);
    const top = Number(box.uidNext) - 1;
    // First time, or the mailbox was rebuilt: start from now and import nothing old.
    if (s.imap_last_uid == null || s.imap_uid_validity !== validity) {
      await admin.from("email_senders").update({ imap_last_uid: top, imap_uid_validity: validity, imap_checked_at: new Date().toISOString(), imap_error: null, imap_host: where.host, imap_port: where.port }).eq("id", s.id);
      return 0;
    }
    let last = Number(s.imap_last_uid);
    if (top <= last) {
      await admin.from("email_senders").update({ imap_checked_at: new Date().toISOString(), imap_error: null }).eq("id", s.id);
      return 0;
    }
    const range = `${last + 1}:${Math.min(top, last + 30)}`;
    for await (const msg of client.fetch(range, { uid: true, source: { start: 0, maxLength: 400_000 } }, { uid: true })) {
      if (Date.now() > deadline) break;
      const uid = Number(msg.uid);
      if (uid <= last) continue;
      last = uid;
      if (!msg.source) continue;
      const mail = await simpleParser(msg.source, { skipImageLinks: true, skipTextToHtml: true, skipTextLinks: true });
      const from = mail.from?.value?.[0]?.address?.toLowerCase() ?? "";
      if (!from || from === s.from_email.toLowerCase()) continue;
      const auto = String(mail.headers.get("auto-submitted") ?? "no").toLowerCase();
      if ((auto && auto !== "no") || mail.headers.has("x-autoreply") || AUTO_SUBJECT.test(mail.subject ?? "")) continue;

      // Which contact: the email it answers (one of ours), or the sender's address.
      let contact: string | null = null;
      const refs = [...ids(mail.inReplyTo), ...ids(mail.references as string | string[] | undefined)].slice(0, 60);
      if (refs.length) {
        const { data } = await admin.from("messages").select("contact_id").eq("account_id", s.account_id).eq("provider", "smtp").in("provider_message_id", refs).not("contact_id", "is", null).limit(1).maybeSingle();
        contact = (data?.contact_id as string | undefined) ?? null;
      }
      if (!contact) {
        const { data } = await admin.from("contacts").select("id").eq("account_id", s.account_id).ilike("email", from.replace(/[%_\\]/g, "\\$&")).order("updated_at", { ascending: false }).limit(1).maybeSingle();
        contact = (data?.id as string | undefined) ?? null;
      }
      if (!contact) continue;

      const body = replyText(mail.text ?? "") || "(empty email)";
      const { error } = await admin.from("messages").insert({
        account_id: s.account_id,
        contact_id: contact,
        direction: "inbound",
        channel: "email",
        to_address: s.from_email,
        from_address: from,
        subject: (mail.subject ?? "").slice(0, 300) || null,
        body,
        status: "received",
        provider: "imap",
        provider_message_id: (mail.messageId ?? `${s.id}:${validity}:${uid}`).slice(0, 300),
        sender_id: s.id,
        created_at: (mail.date ?? new Date()).toISOString(),
      });
      // 23505: already saved (the same email seen twice).
      if (error && error.code !== "23505") throw new Error(`Saving a reply failed: ${error.message}`);
      if (!error) {
        added++;
        await admin.from("activity").insert({ account_id: s.account_id, contact_id: contact, type: "message.received", summary: `Email reply: ${(mail.subject || body).slice(0, 80)}` });
      }
    }
    await admin.from("email_senders").update({ imap_last_uid: last, imap_checked_at: new Date().toISOString(), imap_error: null }).eq("id", s.id);
    if (added) runWorkflowsSoon(admin, s.account_id);
    return added;
  } finally {
    await client.logout().catch(() => client.close());
  }
}

/** Reads every connected mailbox, the ones checked longest ago first, for up to about 20 seconds. */
export async function readReplies(admin: SupabaseClient, budgetMs = 20_000) {
  const deadline = Date.now() + budgetMs;
  const { data } = await admin
    .from("email_senders")
    .select("id, account_id, from_email, smtp_host, smtp_user, smtp_secret, imap_host, imap_port, imap_last_uid, imap_uid_validity")
    .eq("kind", "smtp")
    .eq("status", "verified")
    .eq("imap_enabled", true)
    .order("imap_checked_at", { ascending: true, nullsFirst: true })
    .limit(25);
  let replies = 0;
  let mailboxes = 0;
  for (const s of (data ?? []) as MailSender[]) {
    if (Date.now() > deadline - 4000) break;
    mailboxes++;
    try {
      replies += await readOne(admin, s, deadline);
    } catch (e) {
      const err = e as { message?: string; authenticationFailed?: boolean; responseText?: string };
      const m = `${err?.message ?? String(e)} ${err?.responseText ?? ""}`.trim();
      const reason = err?.authenticationFailed || /auth|login|credential|password/i.test(m)
        ? "The mailbox turned down the login for reading replies. Some providers need IMAP switched on (Gmail: Settings, Forwarding and POP/IMAP)."
        : m.slice(0, 300);
      await admin.from("email_senders").update({ imap_checked_at: new Date().toISOString(), imap_error: reason }).eq("id", s.id);
    }
  }
  return { mailboxes, replies };
}
