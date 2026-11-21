"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { Popover, useListKeys } from "@/components/popover";
import type { MergeField } from "@/lib/merge-fields";

const GROUP_ICON: Record<string, IconName> = {
  Contact: "user",
  "Custom fields": "list",
  Deal: "pipeline",
  "Assigned user": "users",
  Business: "building",
  "Custom values": "database",
  Date: "calendar",
};

/** "Insert field" menu: contact details, custom fields, deal, owner, business, custom values and dates. */
export function FieldPicker({ fields, onPick, compact }: { fields: MergeField[]; onPick: (token: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string>("All");
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const groups = [...new Set(fields.map((f) => f.group))];
  const needle = q.trim().toLowerCase();
  const shown = fields.filter(
    (f) => (group === "All" || f.group === group) && (!needle || `${f.label} ${f.group} ${f.token}`.toLowerCase().includes(needle)),
  );
  // Same order as on screen, so arrow keys move down the list as you see it.
  const order = groups.flatMap((g) => shown.filter((f) => f.group === g));
  const close = () => {
    setOpen(false);
    setQ("");
    setGroup("All");
  };
  const pick = (f: MergeField) => {
    onPick(f.token);
    close();
  };
  const keys = useListKeys(order.length, (i) => pick(order[i]));

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${keys.active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [keys.active]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => (open ? close() : setOpen(true))}
        className={`inline-flex items-center gap-1.5 rounded-lg border bg-white font-semibold text-brand transition hover:border-sky ${open ? "border-sky ring-2 ring-sky/20" : "border-line"} ${compact ? "h-8 px-2 text-[12px]" : "h-9 px-2.5 text-[12.5px]"}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="font-mono text-[11px]">{"{ }"}</span> Insert field
      </button>
      <Popover anchor={btn} open={open} onClose={close} width={360} label="Insert field">
        <div className="flex-none border-b border-line p-2.5">
          <label className="flex h-10 items-center gap-2 rounded-xl bg-surface px-3 ring-1 ring-transparent focus-within:bg-white focus-within:ring-sky">
            <Icon name="search" size={14} className="text-faint" />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                keys.setActive(0);
              }}
              onKeyDown={keys.onKeyDown}
              placeholder="Search fields"
              className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none focus-visible:outline-none"
              aria-label="Search fields"
            />
          </label>
          <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none]">
            {["All", ...groups].map((g) => (
              <button
                key={g}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setGroup(g);
                  keys.setActive(0);
                }}
                className={`h-7 flex-none whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold ${group === g ? "bg-navy text-white" : "bg-surface text-muted hover:text-navy"}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        <div ref={list} className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {groups
            .filter((g) => shown.some((f) => f.group === g))
            .map((g) => (
              <div key={g} className="mb-1">
                <div className="flex items-center gap-1.5 px-2 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-faint">
                  <Icon name={GROUP_ICON[g] ?? "list"} size={12} /> {g}
                </div>
                {shown
                  .filter((f) => f.group === g)
                  .map((f) => {
                    const idx = order.indexOf(f);
                    const on = idx === keys.active;
                    return (
                      <button
                        key={f.token}
                        data-i={idx}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => keys.setActive(idx)}
                        onClick={() => pick(f)}
                        className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left ${on ? "bg-chip" : ""}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium text-navy">{f.label}</span>
                          {f.hint && <span className="block truncate text-[11.5px] text-muted">{f.hint}</span>}
                        </span>
                        <code className="max-w-[45%] flex-none truncate rounded-md bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted">{f.token}</code>
                      </button>
                    );
                  })}
              </div>
            ))}
          {shown.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-muted">No fields match &ldquo;{q}&rdquo;.</p>}
        </div>
        <div className="flex-none border-t border-line px-3 py-2 text-[11.5px] text-faint">Up and down to move, Enter to insert, Esc to close</div>
      </Popover>
    </>
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
