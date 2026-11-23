"use client";

import { shortId } from "@/lib/short-id-shared";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import type { BoardCard, BoardColumn } from "@/lib/data";
import { moveCard } from "./actions";

const accents = ["#55e3ec", "#29b0f8", "#0a5fe3", "#6d8bff", "#a78bfa", "#f59e0b", "#f97316", "#94a3b8", "#10b981", "#ef4444"];

function money(pence: number | null) {
  if (pence == null) return null;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(pence / 100);
}

/** The pipeline board. Drag a card to another column to move the deal. */
export function Board({ columns: initial, children, onOpen, fields }: { columns: BoardColumn[]; children?: React.ReactNode; onOpen?: (id: string) => void; fields?: CardField[] }) {
  const show = new Set(fields ?? DEFAULT_CARD_FIELDS);
  const [columns, setColumns] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState("");
  // On bigger screens the board fills the window, so its sideways scroll bar sits at the bottom of the screen.
  const scroller = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    function fit() {
      const el = scroller.current;
      if (!el || window.innerWidth < 640) return setHeight(null);
      const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 0;
      setHeight(Math.max(320, window.innerHeight - el.getBoundingClientRect().top - nav - 12));
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  const [, startTransition] = useTransition();

  function move(cardId: string, toStage: string) {
    const from = columns.find((c) => c.cards.some((k) => k.opportunityId === cardId));
    if (!from || from.id === toStage) return;
    const card = from.cards.find((k) => k.opportunityId === cardId)!;
    const previous = columns;
    setColumns(columns.map((c) => (c.id === from.id ? { ...c, cards: c.cards.filter((k) => k.opportunityId !== cardId) } : c.id === toStage ? { ...c, cards: [card, ...c.cards] } : c)));
    setError("");
    startTransition(async () => {
      const result = await moveCard(cardId, toStage).catch(() => ({ error: "We couldn't move the card. Please try again." }));
      if (result.error) {
        setColumns(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p role="alert" className="rounded-xl bg-bad-bg px-3 py-2 text-[13px] text-bad">{error}</p>}
      <p className="flex items-center gap-1.5 text-[12.5px] text-muted sm:hidden">
        <Icon name="arrowRight" size={13} /> Swipe to see every stage. Tap someone to move them.
      </p>
      <div
        ref={scroller}
        style={height ? { height } : undefined}
        className="board-scroll -mx-4 snap-x snap-mandatory overflow-x-auto scroll-px-4 px-4 pb-3 sm:-mx-7 sm:snap-none sm:px-7"
      >
        <div className="flex h-full min-w-min items-start gap-3 sm:items-stretch">
          {columns.map((col, i) => {
            const total = col.cards.reduce((s, k) => s + (k.valuePence ?? 0), 0);
            return (
              <section
                key={col.id}
                aria-label={col.name}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(col.id);
                }}
                onDragLeave={() => setOver((o) => (o === col.id ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  setOver(null);
                  setDragging(null);
                  if (id) move(id, col.id);
                }}
                className={`flex min-h-[300px] w-[calc(100vw-64px)] max-w-[320px] flex-none snap-start flex-col gap-2 rounded-2xl p-2.5 transition-colors sm:max-h-full sm:min-h-[420px] sm:w-[280px] sm:overflow-y-auto sm:[scrollbar-width:thin] ${
                  over === col.id ? "bg-chip ring-2 ring-sky/50" : "bg-[#eaeff6]"
                }`}
              >
                <div className="flex items-center gap-2 px-1.5 pb-1 pt-1">
                  <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: accents[i % accents.length] }} />
                  <h2 className="min-w-0 flex-1 truncate text-[14px] font-semibold">{col.name}</h2>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[12px] font-semibold tabular-nums text-muted">{col.cards.length}</span>
                </div>
                {total > 0 && <div className="px-1.5 text-[12px] text-muted">{money(total)}</div>}
                {col.cards.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line-strong px-3 py-8 text-center text-[12.5px] text-faint">
                    Drop deals here
                  </div>
                )}
                {col.cards.map((card) => (
                  <Link
                    key={card.opportunityId}
                    href={`/contacts/${shortId(card.contactId)}`}
                    onClick={(e) => {
                      if (onOpen && !e.metaKey && !e.ctrlKey) {
                        e.preventDefault();
                        onOpen(card.opportunityId);
                      }
                    }}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", card.opportunityId);
                      e.dataTransfer.effectAllowed = "move";
                      setDragging(card.opportunityId);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    className={`block cursor-grab rounded-xl border border-line bg-white p-3 shadow-[0_1px_2px_rgba(11,36,71,0.05)] transition-all hover:-translate-y-px hover:border-sky/60 hover:shadow-[0_10px_24px_-14px_rgba(11,36,71,0.35)] active:cursor-grabbing ${
                      dragging === card.opportunityId ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[linear-gradient(135deg,#55e3ec,#0a5fe3)] text-[11.5px] font-semibold text-white">
                        {card.initials}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold">{card.name}</span>
                        {show.has("contact") && card.name !== card.contactName && <span className="block truncate text-[12px] text-muted">{card.contactName}</span>}
                      </span>
                      {card.status !== "open" && (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${card.status === "won" ? "bg-ok-bg text-ok" : "bg-bad-bg text-bad"}`}>{card.status}</span>
                      )}
                    </div>
                    <CardDetails card={card} show={show} />
                  </Link>
                ))}
              </section>
            );
          })}
          {children}
        </div>
      </div>
    </div>
  );
}

export type CardField = "value" | "contact" | "owner" | "source" | "tags" | "email" | "phone" | "created";
export const CARD_FIELDS: { key: CardField; label: string }[] = [
  { key: "value", label: "Deal value" },
  { key: "contact", label: "Contact name" },
  { key: "owner", label: "Owner" },
  { key: "source", label: "Source" },
  { key: "tags", label: "Tags" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "created", label: "Date added" },
];
export const DEFAULT_CARD_FIELDS: CardField[] = ["value", "owner", "source", "tags"];

/** The extra lines on a card, as chosen in "Card fields". */
function CardDetails({ card, show }: { card: BoardCard; show: Set<CardField> }) {
  const rows: React.ReactNode[] = [];
  if (show.has("value") && card.valuePence != null) rows.push(<div key="v" className="text-[13px] font-semibold tabular-nums text-navy">{money(card.valuePence)}</div>);
  const meta: { icon: "user" | "link" | "mail" | "phone" | "calendar"; text: string }[] = [];
  if (show.has("owner")) meta.push({ icon: "user", text: card.ownerName ?? "No owner" });
  if (show.has("source") && card.source) meta.push({ icon: "link", text: card.source });
  if (show.has("email") && card.email) meta.push({ icon: "mail", text: card.email });
  if (show.has("phone") && card.phone) meta.push({ icon: "phone", text: card.phone });
  if (show.has("created")) meta.push({ icon: "calendar", text: new Date(card.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) });
  if (meta.length)
    rows.push(
      <div key="m" className="flex flex-col gap-1">
        {meta.map((m, i) => (
          <span key={i} className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted">
            <Icon name={m.icon} size={12} className="flex-none" />
            <span className="truncate">{m.text}</span>
          </span>
        ))}
      </div>,
    );
  if (show.has("tags") && card.tags.length)
    rows.push(
      <div key="t" className="flex flex-wrap gap-1">
        {card.tags.slice(0, 4).map((t) => (
          <span key={t} className="rounded-full bg-chip px-2 py-0.5 text-[11px] font-medium text-brand">{t}</span>
        ))}
        {card.tags.length > 4 && <span className="text-[11px] text-muted">+{card.tags.length - 4}</span>}
      </div>,
    );
  return rows.length ? <div className="mt-2.5 flex flex-col gap-2 border-t border-line pt-2.5">{rows}</div> : null;
}
