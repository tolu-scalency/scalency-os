"use client";

// The "..." menu on each form in the list: open, duplicate, archive or restore.

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { archiveForm, duplicateForm } from "./actions";

export function FormRowMenu({ id, archived }: { id: string; archived: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium hover:bg-surface";
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Form actions" aria-expanded={open} disabled={pending} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-surface hover:text-navy disabled:opacity-50">
        <Icon name="more" size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-20 w-48 rounded-xl border border-line bg-white p-1 shadow-lg">
          <Link href={`/forms/${id}`} className={item}>
            <Icon name="edit" size={14} /> Edit
          </Link>
          <Link href={`/forms/${id}?tab=share`} className={item}>
            <Icon name="share" size={14} /> Share and embed
          </Link>
          <button type="button" className={item} onClick={() => start(() => duplicateForm(id))}>
            <Icon name="copy" size={14} /> Duplicate
          </button>
          <button
            type="button"
            className={item}
            onClick={() =>
              start(async () => {
                await archiveForm(id, !archived);
                setOpen(false);
              })
            }
          >
            <Icon name={archived ? "refresh" : "download"} size={14} /> {archived ? "Restore" : "Archive"}
          </button>
        </div>
      )}
    </div>
  );
}
