"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import type { MergeField } from "@/lib/merge-fields";

/** "Insert field" menu: contact details, custom fields, owner, business and custom values. */
export function FieldPicker({ fields, onPick, compact }: { fields: MergeField[]; onPick: (token: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function away(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const shown = fields.filter((f) => !q || f.label.toLowerCase().includes(q.toLowerCase()) || f.token.includes(q.toLowerCase()));
  const groups = [...new Set(shown.map((f) => f.group))];

  return (
    <div ref={box} className="relative inline-block">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-line bg-white font-semibold text-brand hover:border-sky ${compact ? "h-8 px-2 text-[12px]" : "h-9 px-2.5 text-[12.5px]"}`}
        aria-expanded={open}
      >
        <span className="font-mono text-[11px]">{"{ }"}</span> Insert field
      </button>
      {open && (
        <div className="rise absolute right-0 top-full z-40 mt-1 w-72 rounded-xl border border-line bg-white p-2 shadow-[var(--shadow-pop)]">
          <label className="mb-1.5 flex items-center gap-2 rounded-lg bg-surface px-2.5">
            <Icon name="search" size={14} className="text-faint" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search fields" className="h-8 flex-1 bg-transparent text-[13px] outline-none" aria-label="Search fields" />
          </label>
          <div className="max-h-64 overflow-y-auto">
            {groups.map((g) => (
              <div key={g} className="mb-1">
                <div className="px-2 pb-0.5 pt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-faint">{g}</div>
                {shown
                  .filter((f) => f.group === g)
                  .map((f) => (
                    <button
                      key={f.token}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onPick(f.token);
                        setOpen(false);
                        setQ("");
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-surface"
                    >
                      <span className="truncate">{f.label}</span>
                      <code className="truncate text-[11px] text-faint">{f.token}</code>
                    </button>
                  ))}
              </div>
            ))}
            {shown.length === 0 && <p className="px-2 py-3 text-[13px] text-muted">No fields match.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

type TextProps = {
  value: string;
  onChange: (v: string) => void;
  fields: MergeField[];
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  label: string;
  className?: string;
};

/** A text box (or one-line input) with an "Insert field" button that drops a field in at the cursor. */
export function MergeText({ value, onChange, fields, multiline, rows = 3, maxLength, placeholder, label, className = "" }: TextProps) {
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  function insert(token: string) {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = (value.slice(0, start) + token + value.slice(end)).slice(0, maxLength ?? Infinity);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {multiline ? (
        <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} maxLength={maxLength} placeholder={placeholder} aria-label={label} className="field resize-y py-2.5" />
      ) : (
        <input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} maxLength={maxLength} placeholder={placeholder} aria-label={label} className="field" />
      )}
      <div className="flex items-center justify-between gap-2">
        <FieldPicker fields={fields} onPick={insert} compact />
        {maxLength && multiline ? <span className="text-[12px] text-faint">{value.length}/{maxLength}</span> : null}
      </div>
    </div>
  );
}
