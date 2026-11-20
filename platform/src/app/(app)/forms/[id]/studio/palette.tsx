"use client";

// Form Studio's left panel: everything you can put on a form. Drag onto the
// canvas, or click to add (into the selected section, or at the end).

import { useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import type { CustomField } from "@/lib/data";
import { CONTENT_KINDS, FIELD_KINDS, allFields, type FormDefinition } from "@/lib/form-builder";
import type { Drag } from "./tree";

export function Palette({ def, customFields, onDragStart, onDragEnd, onAdd, readOnly }: { def: FormDefinition; customFields: CustomField[]; onDragStart: (d: Drag) => void; onDragEnd: () => void; onAdd: (d: Drag) => void; readOnly: boolean }) {
  const [q, setQ] = useState("");
  const used = new Set(allFields(def).map((f) => f.kind));
  const usedKeys = new Set(allFields(def).filter((f) => f.kind === "custom").map((f) => f.key));
  const term = q.trim().toLowerCase();
  const match = (label: string) => !term || label.toLowerCase().includes(term);

  const item = (key: string, label: string, icon: string, drag: Drag, disabled = false, hint?: string) =>
    match(label) && (
      <button
        key={key}
        type="button"
        draggable={!disabled && !readOnly}
        disabled={disabled || readOnly}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "copy";
          e.dataTransfer.setData("text/plain", label);
          onDragStart(drag);
        }}
        onDragEnd={onDragEnd}
        onClick={() => onAdd(drag)}
        title={disabled ? "Already on the form" : hint ?? `Drag onto the form, or click to add`}
        className="group flex min-h-10 w-full items-center gap-2.5 rounded-xl border border-line bg-white px-2.5 text-left text-[13px] font-medium transition-all enabled:cursor-grab enabled:hover:-translate-y-px enabled:hover:border-sky enabled:hover:shadow-sm disabled:opacity-40"
      >
        <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-chip text-brand">
          <Icon name={icon as IconName} size={14} />
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <Icon name="grip" size={12} className="flex-none text-faint opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    );

  const section = (title: string, items: (React.ReactNode | false)[], cols = 1) => {
    const shown = items.filter(Boolean);
    if (!shown.length) return null;
    return (
      <div className="mb-4">
        <div className="mb-1.5 px-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-faint">{title}</div>
        <div className={`grid gap-1.5 ${cols === 2 ? "grid-cols-2" : ""}`}>{shown}</div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="relative p-3 pb-2">
        <Icon name="search" size={14} className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search elements" className="field h-9 w-full pl-8 text-[13px]" aria-label="Search elements" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        {!term &&
          section("Sections", [
            ...[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                draggable={!readOnly}
                disabled={readOnly}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "copy";
                  e.dataTransfer.setData("text/plain", `${n} columns`);
                  onDragStart({ t: "new-layout", cols: n });
                }}
                onDragEnd={onDragEnd}
                onClick={() => onAdd({ t: "new-layout", cols: n })}
                title="Drag a section onto the form, then drop fields into its columns"
                className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-white p-2 text-[11.5px] font-medium text-muted transition-all hover:-translate-y-px hover:border-sky hover:text-navy disabled:opacity-40"
              >
                <span className="grid h-7 w-full gap-1" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
                  {Array.from({ length: n }).map((_, i) => (
                    <span key={i} className="rounded-[4px] bg-chip ring-1 ring-sky/30" />
                  ))}
                </span>
                {n === 1 ? "1 column" : `${n} columns`}
              </button>
            )),
          ], 2)}
        {section(
          "Contact details",
          FIELD_KINDS.filter((k) => k.group === "Contact").map((k) => item(k.kind, k.label, k.icon, { t: "new-field", kind: k.kind }, k.once && used.has(k.kind))),
        )}
        {section(
          "Questions",
          FIELD_KINDS.filter((k) => k.group === "Questions").map((k) => item(k.kind, k.label, k.icon, { t: "new-field", kind: k.kind })),
        )}
        {customFields.length > 0 &&
          section(
            "Your contact fields",
            customFields.map((c) => item(`cf-${c.key}`, c.label, "user", { t: "new-field", kind: "custom", key: c.key, label: c.label }, usedKeys.has(c.key), "Answers save straight onto the contact")),
          )}
        {section(
          "Content",
          CONTENT_KINDS.map((k) => item(`c-${k.kind}`, k.label, k.kind === "image" ? "image" : k.kind === "divider" ? "minus" : k.icon, { t: "new-content", kind: k.kind })),
        )}
        {section(
          "Advanced",
          FIELD_KINDS.filter((k) => k.group === "Advanced").map((k) => item(k.kind, k.label, k.icon, { t: "new-field", kind: k.kind }, false, "Fills itself from the web address, e.g. ?campaign=spring")),
        )}
      </div>
    </div>
  );
}
