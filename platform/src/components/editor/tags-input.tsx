"use client";

import { useId, useRef, useState } from "react";
import { Icon } from "@/components/icon";

/** Type a tag and press Enter (or comma) to add it. Existing tags are suggested as you type. */
/** `inline` shows suggestions in the flow (inside panels that scroll) instead of floating over the page. */
export function TagsInput({ value, onChange, suggestions, max = 10, placeholder = "Type a tag and press Enter", inline = false }: { value: string[]; onChange: (v: string[]) => void; suggestions: string[]; max?: number; placeholder?: string; inline?: boolean }) {
  const [draft, setDraft] = useState("");
  const [focus, setFocus] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const has = (t: string) => value.some((v) => v.toLowerCase() === t.toLowerCase());

  function add(raw: string) {
    const parts = raw.split(",").map((t) => t.trim().slice(0, 40)).filter(Boolean);
    const next = [...value];
    for (const p of parts) {
      const existing = suggestions.find((s) => s.toLowerCase() === p.toLowerCase()) ?? p;
      if (!next.some((v) => v.toLowerCase() === existing.toLowerCase()) && next.length < max) next.push(existing);
    }
    onChange(next);
    setDraft("");
  }

  const typed = draft.trim();
  const matches = suggestions.filter((s) => !has(s) && s.toLowerCase().includes(typed.toLowerCase())).slice(0, 8);
  const isNew = typed.length > 0 && !has(typed) && !suggestions.some((s) => s.toLowerCase() === typed.toLowerCase());

  return (
    <div className={`relative ${focus ? "z-40" : ""}`}>
      <div
        onClick={() => input.current?.focus()}
        className={`field flex min-h-11 cursor-text flex-wrap items-center gap-1.5 py-1.5 ${focus ? "border-sky ring-2 ring-sky/20" : ""}`}
      >
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-chip py-0.5 pl-2.5 pr-1 text-[12.5px] font-medium text-brand">
            {t}
            <button type="button" onClick={() => onChange(value.filter((v) => v !== t))} aria-label={`Remove ${t}`} className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-white">
              <Icon name="x" size={10} />
            </button>
          </span>
        ))}
        <input
          ref={input}
          value={draft}
          onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (draft.trim()) add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onFocus={() => setFocus(true)}
          onBlur={() => {
            setTimeout(() => setFocus(false), 120);
            if (draft.trim()) add(draft);
          }}
          placeholder={value.length ? "" : placeholder}
          aria-label="Tags"
          aria-controls={listId}
          style={{ boxShadow: "none", border: 0, outline: "none" }}
          className="min-w-[120px] flex-1 bg-transparent p-0 text-[14px]"
        />
      </div>
      {focus && (matches.length > 0 || isNew) && (
        <ul id={listId} role="listbox" className={`rise ${inline ? "relative" : "absolute left-0 right-0 top-full z-50"} mt-1 max-h-56 overflow-y-auto rounded-xl border border-line bg-white p-1 shadow-[var(--shadow-pop)]`}>
          {isNew && (
            <li>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(typed);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-medium text-brand hover:bg-chip"
              >
                <Icon name="plus" size={13} /> Add tag “{typed}”
              </button>
            </li>
          )}
          {matches.map((m) => (
            <li key={m}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(m);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13.5px] hover:bg-surface"
              >
                <Icon name="tag" size={13} className="text-muted" /> {m}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
