import type { Metadata } from "next";
import { can, getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { providersReady } from "@/lib/deliver";
import type { Sender } from "@/lib/senders";
import { AddSender, SenderCard, ScalencyCard } from "./sender-forms";

export const metadata: Metadata = { title: "Email sending" };

const COLUMNS =
  "id, account_id, kind, from_name, from_email, reply_to, smtp_host, smtp_port, smtp_security, smtp_user, domain, provider_domain_id, dns_records, status, is_default, last_error, verified_at, last_used_at, imap_enabled, imap_host, imap_checked_at, imap_error";

export default async function EmailSendingPage() {
  const ws = await getWorkspace();
  const manager = can(ws, "settings.manage");
  const supabase = await createClient();
  const { data } = await supabase.from("email_senders").select(COLUMNS).eq("account_id", ws.account.id).order("created_at");
  const senders = (data ?? []) as Sender[];
  const usingOwn = senders.some((s) => s.is_default && s.status === "verified");
  const scalency = process.env.EMAIL_FROM ?? "";

  return (
    <div className="flex flex-col gap-4">
      <section className="card grid gap-5 p-5 sm:p-6 md:grid-cols-[260px_1fr] [&>*]:min-w-0">
        <div>
          <h2 className="text-[16px] font-semibold">Email sending</h2>
          <p className="mt-2 text-[13.5px] text-muted">
            Choose the address your workflow and inbox emails come from. Connect your own mailbox, or your own domain for the best delivery. Until then, emails go out from
            Scalency&apos;s address with your business name.
          </p>
          <p className="mt-3 text-[12.5px] text-faint">Replies go to the reply-to address if you set one, otherwise to the address emails are sent from.</p>
          <p className="mt-2 text-[12.5px] text-faint">With your own mailbox, replies from contacts also show in their conversation in Scalency, checked every 5 minutes.</p>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <ScalencyCard active={!usingOwn} address={scalency} ready={providersReady().email} workspace={ws.account.name} manager={manager} />
          {senders.map((s) => (
            <SenderCard key={s.id} s={s} manager={manager} />
          ))}
          {manager && <AddSender workspace={ws.account.name} userEmail={ws.userEmail} />}
        </div>
      </section>
    </div>
  );
}
