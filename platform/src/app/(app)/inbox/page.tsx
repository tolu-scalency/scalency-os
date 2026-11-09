import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Avatar, Button, Pill } from "@/components/ui";
import { findContact, threads } from "@/lib/sample-data";

export const metadata: Metadata = { title: "Conversations" };

export default function InboxPage() {
  const sam = findContact("sam-test")!;

  return (
    <main className="flex min-h-full flex-wrap">
      {/* Thread list */}
      <section aria-label="Threads" className="flex min-w-0 flex-[1_1_300px] flex-col gap-1 border-r border-line px-3 py-4">
        <div className="flex items-center justify-between px-1.5 pb-3">
          <h1 className="text-[17px] font-semibold tracking-[-0.02em]">Inbox</h1>
          <Button size="sm" icon="edit" label="New message">New</Button>
        </div>
        <div className="flex flex-wrap gap-1 px-1 pb-3 font-mono text-[11px]">
          <span className="rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-navy">ALL</span>
          <span className="px-2.5 py-1.5 text-muted">UNREAD · 4</span>
          <span className="px-2.5 py-1.5 text-muted">SMS</span>
          <span className="px-2.5 py-1.5 text-muted">EMAIL</span>
        </div>
        {threads.map((t, i) => {
          const c = findContact(t.contactId)!;
          return (
            <Link
              key={t.contactId}
              href="/inbox"
              className={`relative flex gap-3 rounded-[14px] border p-3.5 ${i === 0 ? "border-line-strong bg-surface shadow-[inset_3px_0_0_#0465c7]" : "border-transparent hover:bg-surface"}`}
            >
              <span className="relative">
                <Avatar initials={c.initials} tone={c.tone} size={40} />
                {t.unread && <span className="absolute -right-px -top-px h-2.5 w-2.5 rounded-full border-2 border-white bg-brand" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <strong className="text-[13.5px] font-semibold">{c.name}</strong>
                  <span className="font-mono text-[10.5px] text-muted">{t.when}</span>
                </div>
                <div className={`mt-0.5 truncate text-[12.5px] ${t.unread ? "font-semibold text-navy" : "text-muted"}`}>{t.last}</div>
                <div className="mt-2 flex gap-1.5">
                  <Pill tone="neutral" mono>{t.channel}</Pill>
                  <Pill tone={c.stageTone}>{c.stage}</Pill>
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      {/* Conversation */}
      <section aria-label="Conversation" className="dots flex min-w-0 flex-[2_1_460px] flex-col bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-white px-[22px] py-3.5">
          <Avatar initials={sam.initials} tone={sam.tone} size={38} />
          <div className="min-w-0 flex-1">
            <div className="text-[14.5px] font-semibold">{sam.name}</div>
            <div className="font-mono text-[11px] text-muted">{sam.phone} · {sam.email.toUpperCase()}</div>
          </div>
          <Button size="sm" icon="phone" label="Call">Call</Button>
          <Button size="sm" href={`/contacts/${sam.id}`} icon="user">Open record</Button>
        </div>

        <div className="flex flex-1 flex-col gap-3.5 p-[22px]">
          <div className="flex items-center gap-2.5"><span className="h-px flex-1 bg-line" /><span className="eyebrow">Today</span><span className="h-px flex-1 bg-line" /></div>
          <div className="self-center rounded-full border border-line bg-white px-3 py-1.5 text-xs text-muted">
            <Icon name="zap" size={13} className="mr-1.5 inline text-brand" />Automated by <strong className="font-semibold text-navy">L4 Booked Call</strong>
          </div>
          <div className="flex max-w-[68%] flex-col items-end gap-1 self-end">
            <div className="btn-primary rounded-[18px_18px_5px_18px] px-4 py-3 text-sm leading-relaxed">Hi Sam, your call with George is booked for Tuesday at 10:00. Reply YES to confirm.</div>
            <span className="font-mono text-[10.5px] text-muted">SMS · 14:41 · DELIVERED TO TEST PHONE</span>
          </div>
          <div className="flex max-w-[68%] flex-col gap-1 self-start">
            <div className="rounded-[18px_18px_18px_5px] border border-line-strong bg-white px-4 py-3 text-sm">YES, see you Tuesday</div>
            <span className="font-mono text-[10.5px] text-muted">SMS · 14:49</span>
          </div>
          <div className="self-center rounded-full bg-ok-bg px-3 py-1.5 text-xs text-ok">
            <Icon name="check" size={13} className="mr-1.5 inline" />Call confirmed · George notified in #booked-calls
          </div>
          <div className="flex w-[68%] flex-col items-end gap-1 self-end">
            <div className="w-full overflow-hidden rounded-[18px_18px_5px_18px] border border-line-strong bg-white">
              <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-[12.5px]">
                <Icon name="mail" size={14} className="text-brand" /><strong className="font-semibold">Your call on Tuesday</strong>
                <span className="ml-auto text-muted">from send.scalency.us</span>
              </div>
              <div className="px-4 py-3 text-[13.5px] leading-relaxed text-muted">Three quick steps before your call: add it to your calendar, move our emails out of spam, and reply YES…</div>
            </div>
            <span className="font-mono text-[10.5px] text-muted">EMAIL · 14:50 · OPENED 14:52</span>
          </div>
          <div className="self-center rounded-full border border-dashed border-line-strong px-3 py-1.5 text-xs text-muted">
            <Icon name="clock" size={13} className="mr-1.5 inline" />Next: 1-day reminder · Mon 10:00
          </div>
        </div>

        <form className="mx-[22px] mb-[22px] flex flex-col gap-2.5 rounded-[18px] border border-line-strong bg-white p-3 shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center gap-1 font-mono text-[11px]">
            <span className="rounded-lg border border-line-strong bg-surface px-2.5 py-1.5">SMS</span>
            <span className="px-2.5 py-1.5 text-muted">EMAIL</span>
            <span className="px-2.5 py-1.5 text-muted">WHATSAPP</span>
            <span className="px-2.5 py-1.5 text-muted">NOTE</span>
            <span className="ml-auto text-[10.5px] text-muted">FROM +44 UK · 0 / 160</span>
          </div>
          <label>
            <span className="sr-only">Reply</span>
            <textarea rows={2} placeholder="Write a reply, or press / for templates…" className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted" />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" icon="form">Templates</Button>
            <Button size="sm" icon="spark">Write with AI</Button>
            <Button size="sm" icon="clock">Schedule</Button>
            <Button size="sm" variant="primary" iconRight="send" className="ml-auto">Send</Button>
          </div>
        </form>
      </section>

      {/* Lead summary */}
      <aside aria-label="Lead summary" className="flex min-w-0 flex-[1_1_270px] flex-col gap-5 border-l border-line px-[18px] py-[22px]">
        <div className="flex flex-col items-center gap-2 text-center">
          <Avatar initials={sam.initials} tone={sam.tone} size={64} />
          <div className="text-base font-semibold tracking-[-0.02em]">{sam.name}</div>
          <div className="text-[12.5px] text-muted">Owner · {sam.business}</div>
          <Pill tone="green">Confirmed</Pill>
        </div>
        <div className="rounded-[14px] border border-brand/20 bg-gradient-to-br from-chip to-transparent p-3.5">
          <div className="flex items-center gap-2 text-[12.5px] font-semibold"><Icon name="spark" size={14} className="text-brand" />AI summary</div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">Multi-site clinic owner, £25–50k a month. Receptionist answers enquiries. Confirmed for Tuesday. Strong fit for Tier 2.</p>
        </div>
        <div>
          <div className="eyebrow mb-1">Answers</div>
          {[["Revenue", "£25–50K"], ["Sites", "3–6"], ["Answers enquiries", "Receptionist"]].map(([k, v]) => (
            <div key={k} className="flex justify-between py-1.5 text-[13px]"><span className="text-muted">{k}</span><span className="font-mono">{v}</span></div>
          ))}
        </div>
        <div>
          <div className="eyebrow mb-2">Running workflows</div>
          <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-[13px]">
            <span className="h-[7px] w-[7px] rounded-full bg-sky shadow-[0_0_8px_#2fa8eb]" /><span className="flex-1">L4 Booked Call</span><span className="font-mono text-[10.5px] text-muted">STEP 4/11</span>
          </div>
        </div>
        <div>
          <div className="eyebrow mb-2">Tags</div>
          <div className="flex flex-wrap gap-1.5"><Pill>booked call</Pill><Pill>multi-site</Pill><Pill>meta</Pill></div>
        </div>
      </aside>
    </main>
  );
}
