"use client";

// The "..." menu on each form in the list: open, share, duplicate, move to a folder, archive or restore.

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { notify } from "@/components/toast";
import { archiveForm, duplicateForm, moveFormToFolder } from "./actions";

export function FormRowMenu({ id, archived, folder = "", folders = [] }: { id: string; archived: boolean; folder?: string; folders?: string[] }) {
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [to, setTo] = useState(folder);
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && (setOpen(false), setMoving(false));
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium hover:bg-surface";
  const move = (name: string) =>
    start(async () => {
      const r = await moveFormToFolder(id, name).catch(() => ({ error: "We couldn't reach the server." }) as { error?: string; ok?: string });
      notify(r.error ?? r.ok ?? "Moved", r.error ? "bad" : "ok");
      if (!r.error) {
        setOpen(false);
        setMoving(false);
      }
    });
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Form actions" aria-expanded={open} disabled={pending} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-surface hover:text-navy disabled:opacity-50">
        <Icon name="more" size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-20 w-60 rounded-xl border border-line bg-white p-1 shadow-lg">
          {moving ? (
            <form
              className="flex flex-col gap-2 p-2"
              onSubmit={(e) => {
                e.preventDefault();
                move(to);
              }}
            >
              <div className="text-[12px] font-semibold text-muted">Move to a folder</div>
              {folders.filter((f) => f !== folder).map((f) => (
                <button key={f} type="button" onClick={() => move(f)} className={item}>
                  <Icon name="folder" size={14} /> {f}
                </button>
              ))}
              <input value={to} onChange={(e) => setTo(e.target.value)} maxLength={60} placeholder="Or type a new folder name" autoFocus className="field h-9 text-[13px]" />
              <div className="flex gap-1.5">
                <button type="submit" disabled={pending || !to.trim() || to.trim() === folder} className="btn-primary min-h-9 flex-1 rounded-lg text-[13px] font-semibold disabled:opacity-50">
                  Move
                </button>
                <button type="button" onClick={() => setMoving(false)} className="btn-ghost min-h-9 rounded-lg px-3 text-[13px] font-semibold">
                  Back
                </button>
              </div>
              {folder && (
                <button type="button" onClick={() => move("")} className="text-left text-[12.5px] font-semibold text-muted hover:text-navy">
                  Take it out of &quot;{folder}&quot;
                </button>
              )}
            </form>
          ) : (
            <>
              <Link href={`/forms/${id}`} className={item}>
                <Icon name="edit" size={14} /> Edit
              </Link>
              <Link href={`/forms/${id}?tab=share`} className={item}>
                <Icon name="share" size={14} /> Share and embed
              </Link>
              <button type="button" className={item} onClick={() => start(() => duplicateForm(id))}>
                <Icon name="copy" size={14} /> Duplicate
              </button>
              <button type="button" className={item} onClick={() => setMoving(true)}>
                <Icon name="folder" size={14} /> Move to a folder
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
