"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
import { askAI, quickSearch } from "@/app/(app)/ai-actions";

type Action = { label: string; hint?: string; icon: IconName; href: string };

const ACTIONS: Action[] = [
  { label: "New contact", icon: "plus", href: "/contacts?new=1" },
  { label: "New task", icon: "tasks", href: "/tasks" },
  { label: "New workflow", icon: "zap", href: "/workflows" },
  { label: "Go to Home", icon: "home", href: "/dashboard" },
  { label: "Go to Contacts", icon: "users", href: "/contacts" },
  { label: "Go to Pipeline", icon: "pipeline", href: "/pipeline" },
  { label: "Go to Inbox", icon: "inbox", href: "/inbox" },
  { label: "Go to Team chat", icon: "hash", href: "/chat" },
  { label: "Go to Notes", icon: "edit", href: "/notes" },
  { label: "Invite a teammate", icon: "team", href: "/settings/team" },
  { label: "Settings", icon: "settings", href: "/settings" },
];

/** Ctrl+K (or Cmd+K): jump anywhere, find a contact, or ask Scalency AI. */
export function CommandBar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<{ id: string; name: string; sub: string; stage: string | null }[]>([]);
  const [answer, setAnswer] = useState<{ answer?: string; notice?: string } | null>(null);
  const [active, setActive] = useState(0);
  const [thinking, startThinking] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 10);
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(async () => setPeople(await quickSearch(term).catch(() => [])), 180);
    return () => clearTimeout(t);
  }, [q]);

  const actions = ACTIONS.filter((a) => !q || a.label.toLowerCase().includes(q.toLowerCase()));
  const items: { key: string; run: () => void; node: React.ReactNode }[] = [
    ...(q.trim()
      ? [
          {
            key: "ai",
            run: () => startThinking(async () => setAnswer(await askAI(q).catch(() => ({ notice: "Scalency AI couldn't be reached. Please try again." })))),
            node: (
              <>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#a5b4fc,#4f46e5)] text-white"><Icon name="spark" size={15} /></span>
                <span className="min-w-0 flex-1 truncate">Ask Scalency AI: <strong>{q}</strong></span>
              </>
            ),
          },
        ]
      : []),
    ...(q.trim().length >= 2 ? people : []).map((p) => ({
      key: p.id,
      run: () => go(`/contacts/${p.id}`),
      node: (
        <>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#55e3ec,#0a5fe3)] text-[11px] font-semibold text-white">
            {p.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{p.name}</span>
            <span className="block truncate text-[12px] text-muted">{p.sub}{p.stage ? ` · ${p.stage}` : ""}</span>
          </span>
        </>
      ),
    })),
    ...actions.map((a) => ({
      key: a.href + a.label,
      run: () => go(a.href),
      node: (
        <>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-muted"><Icon name={a.icon} size={15} /></span>
          <span className="flex-1">{a.label}</span>
        </>
      ),
    })),
  ];

  function go(href: string) {
    onClose();
    setQ("");
    setAnswer(null);
    router.push(href);
  }

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/40 backdrop-blur-[3px]" />
      <div role="dialog" aria-modal="true" aria-label="Command bar" className="rise relative w-full max-w-[620px] overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-pop)]">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Icon name="search" size={18} className="text-faint" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
              setAnswer(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                items[active]?.run();
              }
            }}
            placeholder="Search, jump to a page, or ask Scalency AI…"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
          />
          <kbd className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-faint">Esc</kbd>
        </div>

        {(thinking || answer) && (
          <div className="border-b border-line bg-[linear-gradient(180deg,#f5f7ff,#ffffff)] px-5 py-4">
            <div className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-[#4f46e5]">
              <Icon name="spark" size={14} /> Scalency AI
            </div>
            {thinking ? (
              <div className="flex flex-col gap-2">
                <div className="skeleton h-3 w-11/12" />
                <div className="skeleton h-3 w-9/12" />
              </div>
            ) : answer?.answer ? (
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{answer.answer}</p>
            ) : (
              <p className="text-[13.5px] text-muted">{answer?.notice}</p>
            )}
          </div>
        )}

        <ul className="max-h-[52vh] overflow-y-auto p-2">
          {items.map((it, i) => (
            <li key={it.key}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={it.run}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[14px] ${i === active ? "bg-chip text-navy" : "text-navy"}`}
              >
                {it.node}
                {i === active && <Icon name="arrowRight" size={14} className="text-brand" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
