"use client";

// Page Studio's left panel: ready-made sections, blocks and column layouts.
// Drag anything onto the page, or click to add it after what's selected.

import { useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { BLOCK_KINDS } from "@/lib/page-builder";
import { SECTION_PRESETS } from "@/lib/page-sections";
import type { Drag } from "./page-tree";

export function PagePalette({ readOnly, onDragStart, onDragEnd, onAdd }: { readOnly: boolean; onDragStart: (d: Drag) => void; onDragEnd: () => void; onAdd: (d: Drag) => void }) {
  const [tab, setTab] = useState<"sections" | "blocks">("sections");
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();

  const item = (key: string, icon: string, label: string, hint: string, drag: Drag) => (
    <button
      key={key}
      type="button"
      draggable={!readOnly}
      disabled={readOnly}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("text/plain", key);
        onDragStart(drag);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onAdd(drag)}
      title={`${hint}. Drag onto the page, or click to add.`}
      className="group flex w-full items-center gap-2.5 rounded-xl border border-transparent bg-white px-2.5 py-2 text-left ring-1 ring-line transition hover:-translate-y-px hover:ring-brand/40 active:cursor-grabbing disabled:opacity-50"
      style={{ cursor: readOnly ? "default" : "grab" }}
    >
      <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-chip text-brand">
        <Icon name={icon as IconName} size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-navy">{label}</span>
        <span className="block truncate text-[11.5px] text-muted">{hint}</span>
      </span>
      <Icon name="grip" size={13} className="flex-none text-faint opacity-0 transition group-hover:opacity-100" />
    </button>
  );

  const sections = SECTION_PRESETS.filter((p) => !needle || `${p.label} ${p.hint}`.toLowerCase().includes(needle));
  const blocks = BLOCK_KINDS.filter((b) => !needle || `${b.label} ${b.hint} ${b.group}`.toLowerCase().includes(needle));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none px-3 pb-2 pt-2">
        <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-line">
          {(["sections", "blocks"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`flex-1 rounded-lg py-1.5 text-[12.5px] font-semibold ${tab === t ? "bg-navy text-white" : "text-muted hover:text-navy"}`}>
              {t === "sections" ? "Sections" : "Blocks"}
            </button>
          ))}
        </div>
        <label className="mt-2 flex h-9 items-center gap-2 rounded-xl bg-white px-3 ring-1 ring-line focus-within:ring-sky">
          <Icon name="search" size={13} className="text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "sections" ? "Search sections" : "Search blocks"} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none focus-visible:outline-none" aria-label="Search" />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {tab === "sections" ? (
          <div className="flex flex-col gap-1.5">
            <p className="px-1 pb-1 text-[11.5px] leading-relaxed text-muted">Ready-made sections with words you can change. Drop them between sections on the page.</p>
            {sections.map((p) => item(`s-${p.key}`, p.icon, p.label, p.hint, { t: "new-section", make: () => p.make() }))}
            {!sections.length && <p className="px-1 py-4 text-center text-[12.5px] text-muted">Nothing matches.</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {!needle && (
              <div>
                <div className="px-1 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-faint">Columns</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      draggable={!readOnly}
                      disabled={readOnly}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "copy";
                        e.dataTransfer.setData("text/plain", `cols-${n}`);
                        onDragStart({ t: "new-layout", cols: n });
                      }}
                      onDragEnd={onDragEnd}
                      onClick={() => onAdd({ t: "new-layout", cols: n })}
                      title={`${n} column${n > 1 ? "s" : ""}`}
                      className="flex h-12 flex-col items-center justify-center gap-1 rounded-xl bg-white ring-1 ring-line hover:ring-brand/40"
                      style={{ cursor: readOnly ? "default" : "grab" }}
                    >
                      <span className="grid h-4 w-9 gap-0.5" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
                        {Array.from({ length: n }).map((_, i) => (
                          <span key={i} className="rounded-[2px] bg-brand/70" />
                        ))}
                      </span>
                      <span className="text-[10.5px] font-semibold text-muted">{n}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {(["Basics", "Media", "Sections", "Layout"] as const).map((g) => {
              const list = blocks.filter((b) => b.group === g);
              if (!list.length) return null;
              return (
                <div key={g}>
                  <div className="px-1 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-faint">{g === "Sections" ? "Content" : g}</div>
                  <div className="flex flex-col gap-1.5">{list.map((b) => item(`b-${b.kind}`, b.icon, b.label, b.hint, { t: "new-block", kind: b.kind }))}</div>
                </div>
              );
            })}
            {!blocks.length && <p className="px-1 py-4 text-center text-[12.5px] text-muted">Nothing matches.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
