"use client";

// The "..." menu on each page in the list: edit, open, duplicate, archive or restore, delete.

import { ask } from "@/components/confirm";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { notify } from "@/components/toast";
import { archivePage, deletePage, duplicatePage } from "./actions";

export function PageRowMenu({ id, archived, live, href, edit, kind = "page" }: { id: string; archived: boolean; live: boolean; href: string; edit?: string; kind?: string }) {
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
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Page actions" aria-expanded={open} disabled={pending} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-surface hover:text-navy disabled:opacity-50">
        <Icon name="more" size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-20 w-52 rounded-xl border border-line bg-white p-1 shadow-lg">
          <Link href={edit ?? `/funnels/${id}`} className={item}>
            <Icon name="edit" size={14} /> {kind === "page" ? "Edit" : "Open"}
          </Link>
          <Link href={`/funnels/${id}/overview`} className={item}>
            <Icon name="globe" size={14} /> {kind === "page" ? "Stats and domain" : "Steps, stats and domain"}
          </Link>
          {live && (
            <a href={href} target="_blank" rel="noopener noreferrer" className={item}>
              <Icon name="arrowRight" size={14} /> Open the live {kind === "page" ? "page" : kind}
            </a>
          )}
          <button type="button" className={item} onClick={() => start(() => duplicatePage(id))}>
            <Icon name="copy" size={14} /> Duplicate
          </button>
          <button
            type="button"
            className={item}
            onClick={() =>
              start(async () => {
                const r = await archivePage(id, !archived);
                notify(r.error ?? r.ok ?? "Done", r.error ? "bad" : "ok");
                setOpen(false);
              })
            }
          >
            <Icon name={archived ? "refresh" : "download"} size={14} /> {archived ? "Restore" : "Archive"}
          </button>
          {archived && (
            <button
              type="button"
              className={`${item} text-bad`}
              onClick={() => {
                void ask({ title: "Delete this for good?", text: "Its pages and stats go too. This can't be undone." }).then((ok) => ok && start(() => deletePage(id)));
              }}
            >
              <Icon name="trash" size={14} /> Delete for good
            </button>
          )}
        </div>
      )}
    </div>
  );
}
