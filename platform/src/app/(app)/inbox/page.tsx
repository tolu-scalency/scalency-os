import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Icon } from "@/components/icon";
import { Avatar, Pill } from "@/components/ui";
import { getContactDetail, getWorkspace, listThreadMessages, listThreads, timeAgo, type Thread } from "@/lib/data";
import { sendMessage } from "./actions";
import { ChannelPicker } from "./channel-picker";

export const metadata: Metadata = { title: "Inbox" };

const statusLabel: Record<string, string> = { held_test_mode: "Test mode", queued: "Queued", sent: "Sent", delivered: "Delivered", failed: "Failed", received: "Received" };

export default async function InboxPage(props: PageProps<"/inbox">) {
  const params = await props.searchParams;
  const ws = await getWorkspace();
  const threads = await listThreads(ws.account.id);
  const selectedId = typeof params.c === "string" ? params.c : threads[0]?.contactId;
  let selected: Thread | undefined = threads.find((t) => t.contactId === selectedId);
  // Opened from a contact who has no messages yet: start a new conversation.
  if (!selected && typeof params.c === "string" && /^[0-9a-f-]{36}$/i.test(params.c)) {
    const c = await getContactDetail(params.c, ws.account.id);
    if (c) selected = { contactId: c.id, name: c.name, initials: c.initials, last: "", lastAt: c.createdAt, channel: "email", count: 0 };
  }
  const messages = selected ? await listThreadMessages(ws.account.id, selected.contactId) : [];

  return (
    <div className="flex h-[calc(100vh-64px)] min-h-[520px]">
      <aside className={`w-full flex-none flex-col border-r border-line bg-white md:flex md:w-[320px] ${selected ? "hidden" : "flex"}`}>
        <div className="px-5 pb-3 pt-5">
          <h1 className="text-[20px] font-semibold tracking-[-0.02em]">Inbox</h1>
          <p className="text-[12.5px] text-muted">Emails and texts with your contacts.</p>
        </div>
        {threads.length === 0 ? (
          <div className="m-4 rounded-2xl border border-dashed border-line-strong p-6 text-center text-[13.5px] text-muted">
            No conversations yet. Messages from workflows and from contact pages appear here.
          </div>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {threads.map((t) => (
              <li key={t.contactId}>
                <Link
                  href={`/inbox?c=${t.contactId}`}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${t.contactId === selected?.contactId ? "bg-chip" : "hover:bg-surface"}`}
                >
                  <Avatar initials={t.initials} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[14px] font-semibold">{t.name}</span>
                      <span className="whitespace-nowrap text-[11.5px] text-faint">{timeAgo(t.lastAt)}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
                      <Icon name={t.channel === "sms" ? "phone" : "mail"} size={12} />
                      <span className="truncate">{t.last}</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className={`min-w-0 flex-1 flex-col bg-canvas ${selected ? "flex" : "hidden md:flex"}`}>
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <span className="tile h-12 w-12 rounded-2xl"><Icon name="inbox" size={20} /></span>
            <div className="text-[15px] font-semibold">Pick a conversation</div>
            <p className="max-w-[340px] text-[13.5px] text-muted">Or open a contact and send them a message.</p>
          </div>
        ) : (
          <>
            <header className="flex flex-none items-center gap-3 border-b border-line bg-white px-5 py-3">
              <Link href="/inbox" className="text-muted md:hidden" aria-label="Back"><Icon name="arrowLeft" size={18} /></Link>
              <Avatar initials={selected.initials} size={34} />
              <Link href={`/contacts/${selected.contactId}`} className="text-[15px] font-semibold hover:text-brand">{selected.name}</Link>
              {ws.account.testMode && <span className="ml-auto"><Pill tone="amber">Test mode</Pill></span>}
            </header>
            <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-5">
              {messages.map((m) => (
                <li key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[560px] rounded-2xl px-4 py-3 shadow-sm ${m.direction === "outbound" ? "rounded-br-md bg-[linear-gradient(135deg,#1a86ee,#0a5fe3)] text-white" : "rounded-bl-md border border-line bg-white"}`}>
                    {m.subject && <div className="mb-1 text-[13px] font-semibold">{m.subject}</div>}
                    <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{m.body}</p>
                    <div className={`mt-2 flex items-center gap-1.5 text-[11px] ${m.direction === "outbound" ? "text-white/75" : "text-faint"}`}>
                      <Icon name={m.channel === "sms" ? "phone" : "mail"} size={11} />
                      {statusLabel[m.status] ?? m.status} · to {m.toAddress} · {timeAgo(m.createdAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex-none border-t border-line bg-white p-3 sm:p-4">
              <ActionForm action={sendMessage} resetOnOk className="flex flex-col gap-2">
                <input type="hidden" name="contact_id" value={selected.contactId} />
                <ChannelPicker />
                <div className="flex justify-end">
                  <SubmitButton icon="send" pendingText="Sending…">Send</SubmitButton>
                </div>
              </ActionForm>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
