import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import nodemailer from "nodemailer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { open } from "./secret-box";

// Sending email from a workspace's own address: their mailbox (SMTP) or their own
// domain verified with Resend. Used by the delivery code and the settings page.

export type Sender = {
  id: string;
  account_id: string;
  kind: "smtp" | "domain";
  from_name: string;
  from_email: string;
  reply_to: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_security: "ssl" | "starttls" | null;
  smtp_user: string | null;
  smtp_secret?: string | null;
  domain: string | null;
  provider_domain_id: string | null;
  dns_records: DnsRecord[];
  status: "pending" | "verified" | "failed";
  is_default: boolean;
  last_error: string | null;
  verified_at: string | null;
  last_used_at: string | null;
  /** Reading replies from the mailbox's inbox (IMAP). */
  imap_enabled?: boolean;
  imap_host?: string | null;
  imap_checked_at?: string | null;
  imap_error?: string | null;
};
export type DnsRecord = { record: string; type: string; name: string; value: string; priority?: number; status?: string; ttl?: string };

export const SMTP_PORTS = [465, 587, 2525, 25];

/** Common mailbox settings, so people only need their email and an app password. */
export const SMTP_PRESETS = [
  { key: "google", label: "Google Workspace or Gmail", host: "smtp.gmail.com", port: 465, security: "ssl", help: "Use an app password: Google Account, Security, 2-Step Verification, App passwords." },
  { key: "outlook", label: "Microsoft 365 or Outlook", host: "smtp.office365.com", port: 587, security: "starttls", help: "Your Microsoft admin may need to turn on \"Authenticated SMTP\" for this mailbox." },
  { key: "zoho", label: "Zoho Mail", host: "smtp.zoho.eu", port: 465, security: "ssl", help: "Use smtp.zoho.com if your Zoho account is in the US. An app-specific password works best." },
  { key: "other", label: "Other (your host or provider)", host: "", port: 587, security: "starttls", help: "Find the SMTP settings in your email host's help pages." },
] as const;

const PRIVATE = [
  /^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^::1$/, /^fc/i, /^fd/i, /^fe80/i, /^::ffff:(127|10|192\.168|169\.254)\./i, /^::$/,
];

/** Only real public mail servers: no internal addresses, no odd ports. */
export async function checkSmtpHost(host: string, port: number) {
  if (!SMTP_PORTS.includes(port)) return `Use port ${SMTP_PORTS.slice(0, 3).join(", ")} or 25.`;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) || isIP(host)) return "Enter the mail server's name, like smtp.gmail.com.";
  try {
    const addrs = await lookup(host, { all: true });
    if (!addrs.length || addrs.some((a) => PRIVATE.some((r) => r.test(a.address)))) return "That mail server isn't reachable from the internet.";
  } catch {
    return `We couldn't find ${host}. Check the spelling.`;
  }
  return null;
}

function transport(s: { smtp_host: string; smtp_port: number; smtp_security: string | null; smtp_user: string }, password: string) {
  return nodemailer.createTransport({
    host: s.smtp_host,
    port: s.smtp_port,
    secure: s.smtp_security === "ssl",
    requireTLS: s.smtp_security !== "ssl",
    auth: { user: s.smtp_user, pass: password },
    tls: { minVersion: "TLSv1.2", servername: s.smtp_host },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

/** Plain-English reasons for the usual SMTP errors. */
export function smtpReason(e: unknown) {
  const m = String(e instanceof Error ? e.message : e);
  if (/535|auth|credentials|username and password/i.test(m)) return "The mailbox refused the email or password. For Google and Zoho, use an app password, not your normal one.";
  if (/ETIMEDOUT|timeout|ECONNREFUSED|ECONNRESET/i.test(m)) return "We couldn't connect to the mail server. Check the server name, port and security setting.";
  if (/certificate|self.signed|TLS|SSL/i.test(m)) return "The secure connection failed. Try the other security option (SSL on 465, or STARTTLS on 587).";
  if (/550|553|sender|not owned|not allowed to send/i.test(m)) return "The mailbox won't send as that address. Use the address you log in with, or an alias it owns.";
  return m.slice(0, 200);
}

/** Connects and logs in, without sending anything. */
export async function verifySmtp(s: { smtp_host: string; smtp_port: number; smtp_security: string | null; smtp_user: string }, password: string) {
  const t = transport(s, password);
  try {
    await t.verify();
  } finally {
    t.close();
  }
}

type Mail = { to: string; subject: string; text: string; html: string };

/** Sends through a connected mailbox. Returns the message id. */
export async function sendViaSmtp(s: Sender, mail: Mail) {
  if (!s.smtp_host || !s.smtp_port || !s.smtp_user || !s.smtp_secret) throw new Error("This mailbox isn't fully set up.");
  const t = transport({ smtp_host: s.smtp_host, smtp_port: s.smtp_port, smtp_security: s.smtp_security, smtp_user: s.smtp_user }, open(s.smtp_secret));
  try {
    const info = await t.sendMail({
      from: { name: s.from_name.replace(/[<>"\r\n]/g, ""), address: s.from_email },
      to: mail.to,
      replyTo: s.reply_to ?? undefined,
      subject: mail.subject.replace(/[\r\n]+/g, " "),
      text: mail.text,
      html: mail.html,
    });
    return info.messageId ?? null;
  } catch (e) {
    throw new Error(smtpReason(e));
  } finally {
    t.close();
  }
}

/** Sends from the workspace's own verified domain, through Resend. */
export async function sendViaDomain(s: Sender, mail: Mail) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: `${s.from_name.replace(/[<>"\r\n]/g, "")} <${s.from_email}>`,
      to: [mail.to],
      reply_to: s.reply_to ?? undefined,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) throw new Error(data.message ?? `Resend error ${res.status}`);
  return data.id ?? null;
}

/** The workspace's default sender that's ready to use, with the encrypted password (server only). */
export async function defaultSender(admin: SupabaseClient, accountId: string): Promise<Sender | null> {
  const { data } = await admin.from("email_senders").select("*").eq("account_id", accountId).eq("is_default", true).eq("status", "verified").maybeSingle();
  return (data as Sender | null) ?? null;
}

// ---- Resend domains -------------------------------------------------------------

async function resend<T>(path: string, init?: RequestInit): Promise<T> {
  if (!process.env.RESEND_API_KEY) throw new Error("Email sending isn't connected yet (RESEND_API_KEY in Netlify).");
  const res = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; name?: string };
  if (!res.ok) {
    const msg = data.message ?? `Resend error ${res.status}`;
    if (res.status === 401 || /restricted|permission|not allowed/i.test(msg)) throw new Error("The Resend key in Netlify can only send emails. Create a key with Full access in Resend and put it in RESEND_API_KEY.");
    if (/limit|plan|upgrade/i.test(msg)) throw new Error(`Resend's plan limit was reached (${msg}). Remove an unused domain in Resend or upgrade the plan.`);
    throw new Error(msg);
  }
  return data;
}

type ResendDomain = { id: string; name: string; status: string; records?: DnsRecord[] };

export async function createDomain(name: string) {
  return resend<ResendDomain>("/domains", { method: "POST", body: JSON.stringify({ name, region: "eu-west-1" }) });
}
export async function getDomain(id: string) {
  return resend<ResendDomain>(`/domains/${encodeURIComponent(id)}`);
}
export async function verifyDomain(id: string) {
  await resend<{ id: string }>(`/domains/${encodeURIComponent(id)}/verify`, { method: "POST" });
  return getDomain(id);
}
export async function removeDomain(id: string) {
  await resend<{ id: string }>(`/domains/${encodeURIComponent(id)}`, { method: "DELETE" });
}
