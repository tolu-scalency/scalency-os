"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { BoardColumn } from "@/lib/data";
import { moveCard } from "./actions";

const accents = ["#55e3ec", "#29b0f8", "#0a5fe3", "#6d8bff", "#a78bfa", "#f59e0b", "#f97316", "#94a3b8", "#10b981", "#ef4444"];

function money(pence: number | null) {
  if (pence == null) return null;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(pence / 100);
}

/** The pipeline board. Drag a card to another column to move the deal. */
export function Board({ columns: initial, children }: { columns: BoardColumn[]; children?: React.ReactNode }) {
  const [columns, setColumns] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState("");
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
      <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-7 sm:px-7">
        <div className="flex min-w-min items-start gap-3">
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
                className={`flex min-h-[420px] w-[280px] flex-none flex-col gap-2 rounded-2xl p-2.5 transition-colors ${
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
                    href={`/contacts/${card.contactId}`}
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
                      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{card.name}</span>
                    </div>
                    {card.valuePence != null && <div className="mt-2 text-[13px] font-semibold tabular-nums text-navy">{money(card.valuePence)}</div>}
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
