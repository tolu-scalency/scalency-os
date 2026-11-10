"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Icon } from "@/components/icon";
import { createClient } from "@/lib/supabase/browser";
import type { Channel, ChatMessage } from "@/lib/data";
import { createChannel, postMessage } from "./actions";

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
function time(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function day(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

/** Team chat: channels on the left, messages on the right, with live updates. */
export function ChatRoom({
  accountId,
  channels,
  current,
  initial,
  names,
  me,
}: {
  accountId: string;
  channels: Channel[];
  current?: Channel;
  initial: ChatMessage[];
  names: Record<string, string>;
  me: { id: string; name: string };
}) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // Live: new messages from teammates and from workflows appear without refreshing.
  useEffect(() => {
    if (!current) return;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return; // Live updates unavailable; messages still load on refresh.
    }
    const sub = supabase
      .channel(`chat-${current.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${current.id}` }, (payload) => {
        const m = payload.new as { id: number; body: string; author_id: string | null; created_at: string; contact_id: string | null; account_id: string };
        if (m.account_id !== accountId) return;
        setMessages((list) =>
          list.some((x) => x.id === m.id)
            ? list
            : [...list, { id: m.id, body: m.body, authorId: m.author_id, authorName: m.author_id ? (names[m.author_id] ?? "Teammate") : "Scalency", createdAt: m.created_at, contactId: m.contact_id }],
        );
      })
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [current, accountId, names]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!current || !draft.trim()) return;
    const body = draft;
    setDraft("");
    setError("");
    const temp = -Date.now();
    setMessages((m) => [...m, { id: temp, body, authorId: me.id, authorName: me.name, createdAt: new Date().toISOString(), contactId: null }]);
    start(async () => {
      let r: Awaited<ReturnType<typeof postMessage>>;
      try {
        r = await postMessage(current.id, body);
      } catch {
        r = { error: "We couldn't send that. Check your connection and try again." };
      }
      if ("error" in r) {
        setError(r.error ?? "We couldn't send that.");
        setMessages((m) => m.filter((x) => x.id !== temp));
        setDraft(body);
      } else {
        setMessages((m) => (m.some((x) => x.id === r.id) ? m.filter((x) => x.id !== temp) : m.map((x) => (x.id === temp ? { ...x, id: r.id, createdAt: r.createdAt } : x))));
      }
    });
  }

  return (
    <div className="flex h-[calc(100vh-64px)] min-h-[520px]">
      <aside className="hidden w-[250px] flex-none flex-col border-r border-line bg-white md:flex">
        <div className="flex items-center justify-between px-4 pb-2 pt-5">
          <h1 className="text-[18px] font-semibold tracking-[-0.02em]">Team chat</h1>
          <button type="button" onClick={() => setShowNew((v) => !v)} aria-label="New channel" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-brand">
            <Icon name={showNew ? "x" : "plus"} size={16} />
          </button>
        </div>
        {showNew && (
          <ActionForm action={createChannel} resetOnOk className="flex flex-wrap gap-2 px-3 pb-3">
            <input name="name" required placeholder="channel-name" className="field h-9 min-h-0 flex-1" />
            <SubmitButton pendingText="…" className="min-h-9 px-3">Add</SubmitButton>
          </ActionForm>
        )}
        <div className="px-4 pb-1 pt-2 text-[11px] font-medium text-faint">Channels</div>
        <ul className="flex flex-col gap-0.5 px-2">
          {channels.map((c) => (
            <li key={c.id}>
              <Link
                href={`/chat?c=${c.name}`}
                className={`flex h-9 items-center gap-2 rounded-[10px] px-2.5 text-[14px] ${c.id === current?.id ? "bg-chip font-semibold text-brand" : "text-navy hover:bg-surface"}`}
              >
                <Icon name="hash" size={15} className="text-faint" />
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-canvas">
        <header className="flex flex-none items-center gap-3 border-b border-line bg-white px-5 py-3.5">
          <Icon name="hash" size={18} className="text-brand" />
          <div className="min-w-0">
            <div className="text-[15px] font-semibold">{current?.name ?? "No channel"}</div>
            {current?.topic && <div className="truncate text-[12.5px] text-muted">{current.topic}</div>}
          </div>
          <div className="ml-auto flex gap-1 md:hidden">
            {channels.map((c) => (
              <Link key={c.id} href={`/chat?c=${c.name}`} className={`rounded-lg px-2 py-1 text-[12.5px] ${c.id === current?.id ? "bg-chip font-semibold text-brand" : "text-muted"}`}>
                #{c.name}
              </Link>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <span className="tile h-12 w-12 rounded-2xl"><Icon name="hash" size={20} /></span>
              <div className="text-[15px] font-semibold">Start the conversation in #{current?.name}</div>
              <p className="max-w-[360px] text-[13.5px] text-muted">
                {current?.name === "leads" ? "Turn on a workflow with an “Alert the team” step and new leads will post here by themselves." : "Messages here are seen by everyone in the workspace."}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {messages.map((m, i) => {
                const d = day(m.createdAt);
                const prev = messages[i - 1];
                const showDay = !prev || day(prev.createdAt) !== d;
                const grouped = !showDay && prev && prev.authorId === m.authorId && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60000;
                const bot = !m.authorId;
                return (
                  <li key={m.id}>
                    {showDay && (
                      <div className="my-3 flex items-center gap-3 text-[12px] font-medium text-faint">
                        <span className="h-px flex-1 bg-line" />
                        {d}
                        <span className="h-px flex-1 bg-line" />
                      </div>
                    )}
                    <div className={`group flex gap-3 rounded-xl px-2 py-1 hover:bg-white ${grouped ? "" : "mt-2"}`}>
                      <div className="w-9 flex-none">
                        {!grouped && (
                          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-[12px] font-semibold text-white ${bot ? "bg-[linear-gradient(135deg,#fdba74,#ea580c)]" : "bg-[linear-gradient(135deg,#55e3ec,#0a5fe3)]"}`}>
                            {bot ? <Icon name="zap" size={15} /> : initials(m.authorName)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {!grouped && (
                          <div className="flex items-baseline gap-2">
                            <span className="text-[14px] font-semibold">{m.authorName}</span>
                            {bot && <span className="rounded bg-warn-bg px-1.5 text-[10.5px] font-semibold text-warn">Automation</span>}
                            <span className="text-[11.5px] text-faint">{time(m.createdAt)}</span>
                          </div>
                        )}
                        <p className={`whitespace-pre-wrap break-words text-[14px] leading-relaxed ${m.id < 0 ? "opacity-60" : ""}`}>{m.body}</p>
                        {m.contactId && (
                          <Link href={`/contacts/${m.contactId}`} className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline">
                            Open contact <Icon name="arrowRight" size={12} />
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div ref={bottom} />
        </div>

        <form onSubmit={send} className="flex-none border-t border-line bg-white p-3 sm:p-4">
          {error && <p className="mb-2 text-[13px] text-bad">{error}</p>}
          <div className="flex items-end gap-2 rounded-2xl border border-line-strong bg-white p-2 focus-within:border-sky focus-within:shadow-[0_0_0_4px_rgba(41,176,248,0.12)]">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              rows={1}
              placeholder={`Message #${current?.name ?? ""}`}
              aria-label="Message"
              className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[14px] outline-none"
            />
            <button type="submit" disabled={!draft.trim()} aria-label="Send" className="btn-primary inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl disabled:opacity-40">
              <Icon name="send" size={16} />
            </button>
          </div>
          <p className="mt-1.5 px-1 text-[11.5px] text-faint">Enter to send, Shift + Enter for a new line</p>
        </form>
      </section>
    </div>
  );
}
