"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { notify } from "@/components/toast";
import { deleteSpend, saveSpend } from "./actions";

export function SpendForm({ sources, rows, symbol }: { sources: string[]; rows: { id: string; month: string; source: string; amount: number }[]; symbol: string }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [source, setSource] = useState(sources[0] ?? "");
  const [amount, setAmount] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-[140px_1fr_140px_auto] sm:items-end">
        <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-navy">
          Month
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="field h-10 w-full text-[13.5px]" />
        </label>
        <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-navy">
          Lead source
          <input list="spend-sources" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Facebook" className="field h-10 w-full text-[13.5px]" />
          <datalist id="spend-sources">
            {sources.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-navy">
          Spent ({symbol})
          <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1200" className="field h-10 w-full font-mono text-[13.5px]" />
        </label>
        <button
          type="button"
          disabled={pending || !amount}
          onClick={() =>
            start(async () => {
              const r = await saveSpend(month, source, Number(amount));
              notify(r.error ?? "Saved", r.error ? "bad" : "ok");
              if (!r.error) setAmount("");
            })
          }
          className="btn-primary inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-50"
        >
          <Icon name="plus" size={14} /> Add
        </button>
      </div>
      {rows.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {rows.map((r) => (
            <li key={r.id} className="inline-flex items-center gap-2 rounded-full bg-surface py-1 pl-3 pr-1 text-[12px]">
              <span className="text-muted">{r.month.slice(0, 7)}</span>
              <span className="font-semibold text-navy">{r.source}</span>
              <span className="font-mono">
                {symbol}
                {Number(r.amount).toLocaleString("en-GB")}
              </span>
              <button type="button" onClick={() => start(async () => void (await deleteSpend(r.id)))} className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-white hover:text-bad" aria-label="Delete">
                <Icon name="x" size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
