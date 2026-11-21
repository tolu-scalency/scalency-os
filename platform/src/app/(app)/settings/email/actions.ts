"use server";

import { refresh } from "next/cache";
import { adminClient } from "@/lib/admin";
import { can, getWorkspace } from "@/lib/data";
import type { ActionResult } from "@/components/action-form";
import { seal } from "@/lib/secret-box";
import {
  checkSmtpHost,
  createDomain,
  defaultSender,
  removeDomain,
  sendViaDomain,
  sendViaSmtp,
  smtpReason,
  verifyDomain,
  verifySmtp,
  type DnsRecord,
  type Sender,
} from "@/lib/senders";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DOMAIN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

async function setup() {
  const ws = await getWorkspace();
  if (!can(ws, "settings.manage")) return { error: "You don't have access to change email settings." } as const;
  const admin = adminClient();
  if (!admin) return { error: "The server can't save this yet: SUPABASE_SECRET_KEY is missing in Netlify." } as const;
  return { ws, admin } as const;
}

const clean = (v: FormDataEntryValue | null, max = 200) => String(v ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);

async function makeDefault(admin: NonNullable<ReturnType<typeof adminClient>>, accountId: string, id: string | null) {
  await admin.from("email_senders").update({ is_default: false }).eq("account_id", accountId).eq("is_default", true);
  if (id) await admin.from("email_senders").update({ is_default: true }).eq("id", id).eq("account_id", accountId);
}

function testMail(to: string, workspace: string, from: string) {
  const text = `This is a test from Scalency OS. Emails from ${workspace} will now go out from ${from}.`;
  return {
    to,
    subject: "Test email from Scalency OS",
    text,
    html: `<p style="font:15px/24px -apple-system,Segoe UI,Arial,sans-serif;color:#1F2D45">${text}</p>`,
  };
}

/** Connects a mailbox (SMTP). It logs in and sends a test email to you before saving. */
export async function addMailbox(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const s = await setup();
  if ("error" in s) return { error: s.error };
  const { ws, admin } = s;

  const host = clean(fd.get("host"), 120).toLowerCase();
  const port = Number(fd.get("port"));
  const security = fd.get("security") === "ssl" ? "ssl" : "starttls";
  const user = clean(fd.get("user"), 200);
  const password = String(fd.get("password") ?? "").slice(0, 300);
  const fromEmail = clean(fd.get("from_email"), 200).toLowerCase() || user.toLowerCase();
  const fromName = clean(fd.get("from_name"), 80) || ws.account.name;
  const replyTo = clean(fd.get("reply_to"), 200).toLowerCase() || null;

  if (!host || !user || !password) return { error: "Fill in the mail server, login and password." };
  if (!EMAIL.test(fromEmail)) return { error: "Enter the address to send from." };
  if (replyTo && !EMAIL.test(replyTo)) return { error: "The reply-to address doesn't look right." };
  const bad = await checkSmtpHost(host, port);
  if (bad) return { error: bad };

  const cfg = { smtp_host: host, smtp_port: port, smtp_security: security, smtp_user: user };
  try {
    await verifySmtp(cfg, password);
  } catch (e) {
    return { error: smtpReason(e) };
  }

  const draft = { ...cfg, id: "", account_id: ws.account.id, kind: "smtp", from_name: fromName, from_email: fromEmail, reply_to: replyTo, smtp_secret: seal(password) } as unknown as Sender;
  try {
    await sendViaSmtp(draft, testMail(ws.userEmail, ws.account.name, fromEmail));
  } catch (e) {
    return { error: `Logged in, but the test email failed: ${e instanceof Error ? e.message : e}` };
  }

  const { data: existing } = await admin.from("email_senders").select("id").eq("account_id", ws.account.id).eq("is_default", true).maybeSingle();
  const { data, error } = await admin
    .from("email_senders")
    .insert({
      account_id: ws.account.id,
      kind: "smtp",
      from_name: fromName,
      from_email: fromEmail,
      reply_to: replyTo,
      smtp_host: host,
      smtp_port: port,
      smtp_security: security,
      smtp_user: user,
      smtp_secret: draft.smtp_secret,
      status: "verified",
      verified_at: new Date().toISOString(),
      created_by: ws.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Couldn't save the mailbox. Please try again." };
  if (!existing || fd.get("make_default") === "on") await makeDefault(admin, ws.account.id, data.id);
  refresh();
  return { ok: `Connected. A test email went to ${ws.userEmail}.` };
}

/** Adds the workspace's own domain to our sending service and shows the DNS records to add. */
export async function addDomain(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const s = await setup();
  if ("error" in s) return { error: s.error };
  const { ws, admin } = s;

  const domain = clean(fd.get("domain"), 253).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  const local = clean(fd.get("local"), 64).toLowerCase() || "hello";
  const fromName = clean(fd.get("from_name"), 80) || ws.account.name;
  const replyTo = clean(fd.get("reply_to"), 200).toLowerCase() || null;
  if (!DOMAIN.test(domain)) return { error: "Enter the domain only, like theirbusiness.co.uk." };
  if (/scalency\.us$/.test(domain)) return { error: "Use the workspace's own domain, not Scalency's." };
  if (!/^[a-z0-9._+-]+$/.test(local)) return { error: "The part before the @ can only use letters, numbers, dots and dashes." };
  if (replyTo && !EMAIL.test(replyTo)) return { error: "The reply-to address doesn't look right." };

  const { data: taken } = await admin.from("email_senders").select("id, account_id").eq("kind", "domain").ilike("domain", domain).maybeSingle();
  if (taken) return { error: taken.account_id === ws.account.id ? "That domain is already added below." : "That domain is already connected to another workspace." };

  let created;
  try {
    created = await createDomain(domain);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't add the domain." };
  }
  const { error } = await admin.from("email_senders").insert({
    account_id: ws.account.id,
    kind: "domain",
    domain,
    from_name: fromName,
    from_email: `${local}@${domain}`,
    reply_to: replyTo,
    provider_domain_id: created.id,
    dns_records: (created.records ?? []) as DnsRecord[],
    status: created.status === "verified" ? "verified" : "pending",
    created_by: ws.userId,
  });
  if (error) {
    await removeDomain(created.id).catch(() => null);
    return { error: "Couldn't save the domain. Please try again." };
  }
  refresh();
  return { ok: "Domain added. Add the DNS records below, then click Check." };
}

async function ownSender(admin: NonNullable<ReturnType<typeof adminClient>>, accountId: string, id: string) {
  const { data } = await admin.from("email_senders").select("*").eq("id", id).eq("account_id", accountId).maybeSingle();
  return (data as Sender | null) ?? null;
}

/** Asks our sending service to check the DNS records again. */
export async function checkDomain(id: string): Promise<ActionResult> {
  const s = await setup();
  if ("error" in s) return { error: s.error };
  const { ws, admin } = s;
  const sender = await ownSender(admin, ws.account.id, id);
  if (!sender?.provider_domain_id) return { error: "That domain is no longer here." };
  try {
    const d = await verifyDomain(sender.provider_domain_id);
    const verified = d.status === "verified";
    await admin
      .from("email_senders")
      .update({
        dns_records: (d.records ?? sender.dns_records) as DnsRecord[],
        status: verified ? "verified" : d.status === "failed" ? "failed" : "pending",
        verified_at: verified ? new Date().toISOString() : null,
        last_error: verified ? null : d.status === "failed" ? "Some records weren't found or don't match. Check them and try again." : null,
      })
      .eq("id", id);
    if (verified && !(await defaultSender(admin, ws.account.id))) await makeDefault(admin, ws.account.id, id);
    refresh();
    return verified ? { ok: `${sender.domain} is verified. Emails now go out from ${sender.from_email}.` } : { ok: "Not verified yet. DNS changes can take a few minutes, sometimes a few hours. Check again soon." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't check the domain." };
  }
}

/** Chooses which address this workspace's emails come from. Pass null for Scalency's own address. */
export async function setDefaultSender(id: string | null): Promise<ActionResult> {
  const s = await setup();
  if ("error" in s) return { error: s.error };
  const { ws, admin } = s;
  if (id) {
    const sender = await ownSender(admin, ws.account.id, id);
    if (!sender) return { error: "That sender is no longer here." };
    if (sender.status !== "verified") return { error: "Verify it first." };
  }
  await makeDefault(admin, ws.account.id, id);
  refresh();
  return { ok: id ? "Emails now go out from this address." : "Emails now go out from Scalency's address." };
}

/** Sends a test email to you from a connected address. */
export async function sendTestEmail(id: string): Promise<ActionResult> {
  const s = await setup();
  if ("error" in s) return { error: s.error };
  const { ws, admin } = s;
  const sender = await ownSender(admin, ws.account.id, id);
  if (!sender || sender.status !== "verified") return { error: "Verify it first." };
  try {
    const mail = testMail(ws.userEmail, ws.account.name, sender.from_email);
    if (sender.kind === "smtp") await sendViaSmtp(sender, mail);
    else await sendViaDomain(sender, mail);
    await admin.from("email_senders").update({ last_error: null, last_used_at: new Date().toISOString() }).eq("id", id);
    return { ok: `Test email sent to ${ws.userEmail}.` };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    await admin.from("email_senders").update({ last_error: reason.slice(0, 300) }).eq("id", id);
    refresh();
    return { error: reason };
  }
}

/** Changes the name and reply-to an address uses. */
export async function updateSender(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const s = await setup();
  if ("error" in s) return { error: s.error };
  const { ws, admin } = s;
  const id = String(fd.get("id") ?? "");
  const sender = await ownSender(admin, ws.account.id, id);
  if (!sender) return { error: "That sender is no longer here." };
  const fromName = clean(fd.get("from_name"), 80) || ws.account.name;
  const replyTo = clean(fd.get("reply_to"), 200).toLowerCase() || null;
  if (replyTo && !EMAIL.test(replyTo)) return { error: "The reply-to address doesn't look right." };
  const patch: Record<string, unknown> = { from_name: fromName, reply_to: replyTo };
  if (sender.kind === "domain") {
    const local = clean(fd.get("local"), 64).toLowerCase();
    if (local) {
      if (!/^[a-z0-9._+-]+$/.test(local)) return { error: "The part before the @ can only use letters, numbers, dots and dashes." };
      patch.from_email = `${local}@${sender.domain}`;
    }
  }
  await admin.from("email_senders").update(patch).eq("id", id);
  refresh();
  return { ok: "Saved." };
}

/** Disconnects an address. Emails fall back to Scalency's address if it was the default. */
export async function removeSender(id: string): Promise<ActionResult> {
  const s = await setup();
  if ("error" in s) return { error: s.error };
  const { ws, admin } = s;
  const sender = await ownSender(admin, ws.account.id, id);
  if (!sender) return { ok: "Removed." };
  if (sender.kind === "domain" && sender.provider_domain_id) await removeDomain(sender.provider_domain_id).catch(() => null);
  await admin.from("email_senders").delete().eq("id", id).eq("account_id", ws.account.id);
  refresh();
  return { ok: "Removed. Emails go out from Scalency's address unless another one is set as default." };
}
