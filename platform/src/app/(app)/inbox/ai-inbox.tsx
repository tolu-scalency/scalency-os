// The "AI setter" side of the Inbox: every conversation the AI setter is having with
// leads in GHL, with the lead's messages, the AI's replies and what it did, in order.

import Link from "next/link";
import { Icon } from "@/components/icon";
import { Avatar, Pill } from "@/components/ui";
import { initialsOf, timeAgo } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { THREAD_LOOK, type ThreadState } from "@/lib/setter";
import { InboxTabs } from "./tabs";
import { SetterThreadButtons } from "./setter-buttons";

type Row = {
  id: string;
  agent_id: string;
  ghl_contact_id: string;
  contact_name: string | null;
  state: ThreadState;
  channel: string;
  appointment_at: string | null;
  note: string | null;
  last_outbound_at: string | null;
  updated_at: string;
};
type Turn = { id: string; role: "lead" | "ai" | "event"; body: string; channel: string | null; created_at: string };

const whenIn = (tz: string) => (iso: string) => {
  try {
    return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz });
  } catch {
    return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }
};

export async function AiInbox({ accountId, selectedId, canManage }: { accountId: string; selectedId?: string; canManage: boolean }) {
  const supabase = await createClient();
  const [{ data: rows }, { data: agents }] = await Promise.all([
    supabase
      .from("setter_threads")
      .select("id, agent_id, ghl_contact_id, contact_name, state, channel, appointment_at, note, last_outbound_at, updated_at")
      .eq("account_id", accountId)
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase.from("setter_agents").select("id, name, ghl_location_id, business").eq("account_id", accountId),
  ]);
  const threads = (rows ?? []) as Row[];
  const agentOf = new Map((agents ?? []).map((a) => [a.id as string, { name: a.name as string, location: (a.ghl_location_id as string) ?? "" }]));
  const ids = threads.map((t) => t.id);

  // The last message of each conversation, for the list.
  const { data: lastTurns } = ids.length
    ? await supabase.from("setter_turns").select("thread_id, role, body, created_at").in("thread_id", ids).neq("role", "event").order("created_at", { ascending: false }).limit(400)
    : { data: [] };
  const lastOf = new Map<string, { role: string; body: string }>();
  for (const t of lastTurns ?? []) if (!lastOf.has(t.thread_id as string)) lastOf.set(t.thread_id as string, { role: t.role as string, body: t.body as string });

  const selected = threads.find((t) => t.id === selectedId);
  const { data: turnRows } = selected
    ? await supabase.from("setter_turns").select("id, role, body, channel, created_at").eq("thread_id", selected.id).order("created_at", { ascending: true }).limit(300)
    : { data: [] };
  const turns = (turnRows ?? []) as Turn[];
  const agent = selected ? agentOf.get(selected.agent_id) : undefined;
  // Times in the business's own time zone (set on the AI setter's Clinic tab).
  const tz = String(((agents ?? []).find((a) => a.id === selected?.agent_id)?.business as { timezone?: string } | null)?.timezone || "Europe/London");
  const when = whenIn(tz);
  const ghlLink = selected && agent?.location ? `https://app.gohighlevel.com/v2/location/${agent.location}/contacts/detail/${selected.ghl_contact_id}` : null;

  return (
    <div className="flex h-[var(--app-h)] min-h-[420px]">
      <aside className={`w-full flex-none flex-col border-r border-line bg-white md:flex md:w-[320px] ${selected ? "hidden" : "flex"}`}>
        <div className="px-5 pb-3 pt-5">
          <h1 className="text-[20px] font-semibold tracking-[-0.02em]">Inbox</h1>
          <InboxTabs view="ai" />
        </div>
        {threads.length === 0 ? (
          <div className="m-4 rounded-xl border border-dashed border-line-strong p-6 text-center text-[13.5px] text-muted">
            No AI setter conversations yet. When a new lead comes in through GHL, the conversation shows here.
          </div>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {threads.map((t) => {
              const name = t.contact_name || "Lead";
              const last = lastOf.get(t.id);
              return (
                <li key={t.id}>
                  <Link href={`/inbox?view=ai&t=${t.id}`} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${t.id === selected?.id ? "bg-chip" : "hover:bg-surface"}`}>
                    <Avatar initials={initialsOf(name)} size={38} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[14px] font-semibold">{name}</span>
                        <span className="whitespace-nowrap text-[11.5px] text-faint">{timeAgo(t.updated_at)}</span>
                      </span>
                      <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
                        <Icon name={last?.role === "ai" ? "spark" : t.channel === "Email" ? "mail" : "phone"} size={12} />
                        <span className="truncate">{last ? `${last.role === "ai" ? "AI: " : ""}${last.body}` : THREAD_LOOK[t.state]?.label}</span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <section className={`min-w-0 flex-1 flex-col bg-canvas ${selected ? "flex" : "hidden md:flex"}`}>
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <span className="tile h-12 w-12 rounded-xl"><Icon name="spark" size={20} /></span>
            <div className="text-[15px] font-semibold">Pick a conversation</div>
            <p className="max-w-[340px] text-[13.5px] text-muted">See what each lead said and how the AI answered.</p>
          </div>
        ) : (
          <>
            <header className="flex flex-none flex-wrap items-center gap-3 border-b border-line bg-white px-5 py-3">
              <Link href="/inbox?view=ai" className="text-muted md:hidden" aria-label="Back"><Icon name="arrowLeft" size={18} /></Link>
              <Avatar initials={initialsOf(selected.contact_name || "Lead")} size={34} />
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold">{selected.contact_name || "Lead"}</div>
                <div className="text-[12px] text-muted">
                  {agent?.name ?? "AI setter"} · {selected.channel}
                  {selected.appointment_at ? ` · Booked for ${when(selected.appointment_at)}` : ""}
                </div>
              </div>
              <span className="ml-auto flex flex-wrap items-center gap-2">
                <Pill tone={THREAD_LOOK[selected.state]?.tone ?? "neutral"}>{THREAD_LOOK[selected.state]?.label ?? selected.state}</Pill>
                {ghlLink && (
                  <a href={ghlLink} target="_blank" rel="noopener noreferrer" className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold">
                    Open in GHL <Icon name="arrowRight" size={13} />
                  </a>
                )}
              </span>
            </header>
            <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
              {turns.length === 0 && <li className="text-center text-[13px] text-muted">No messages yet.</li>}
              {turns.map((m) =>
                m.role === "event" ? (
                  <li key={m.id} className="flex justify-center">
                    <span className="rounded-full bg-white px-3 py-1 text-[12px] text-muted ring-1 ring-line">
                      {m.body} · {when(m.created_at)}
                    </span>
                  </li>
                ) : (
                  <li key={m.id} className={`flex ${m.role === "ai" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[88%] rounded-xl px-4 py-3 shadow-sm sm:max-w-[560px] ${m.role === "ai" ? "rounded-br-md bg-[linear-gradient(135deg,#1a86ee,#0a5fe3)] text-white" : "rounded-bl-md border border-line bg-white"}`}>
                      <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{m.body}</p>
                      <div className={`mt-2 flex items-center gap-1.5 text-[11px] ${m.role === "ai" ? "text-white/75" : "text-faint"}`}>
                        <Icon name={m.role === "ai" ? "spark" : m.channel === "Email" || m.channel === "TYPE_EMAIL" ? "mail" : "phone"} size={11} />
                        {m.role === "ai" ? "AI setter" : selected.contact_name || "Lead"} · {when(m.created_at)}
                      </div>
                    </div>
                  </li>
                ),
              )}
            </ul>
            <div className="flex-none border-t border-line bg-white p-3 sm:p-4">
              {selected.note && <p className="mb-2 text-center text-[12.5px] font-medium text-navy">{selected.note}</p>}
              <p className="mb-2 text-center text-[12.5px] text-muted">
                Replies to this lead are sent from GHL. If you reply there yourself, the AI steps back.
              </p>
              {canManage && <SetterThreadButtons id={selected.id} state={selected.state} contacted={Boolean(selected.last_outbound_at)} />}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
