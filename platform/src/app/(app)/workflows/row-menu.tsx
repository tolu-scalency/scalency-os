"use client";

// The "..." menu on each workflow in the list: open, duplicate, copy or move to another workspace, delete.

import { shortId } from "@/lib/short-id-shared";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { notify } from "@/components/toast";
import { ask } from "@/components/confirm";
import { copyWorkflowTo, deleteWorkflow, duplicateWorkflow } from "./actions";

type Other = { id: string; name: string };

export function WorkflowRowMenu({ id, name, running, others }: { id: string; name: string; running: number; others: Other[] }) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState<null | "copy" | "move">(null);
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) {
        setOpen(false);
        setPicking(null);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const done = (r: { ok?: string; error?: string }) => {
    notify(r.error ?? r.ok ?? "Done", r.error ? "bad" : "ok");
    setOpen(false);
    setPicking(null);
  };

  const send = (target: Other, move: boolean) => {
    void ask({
      title: move ? `Move "${name}" to ${target.name}?` : `Copy "${name}" to ${target.name}?`,
      text: move
        ? `It arrives there switched off, and it's removed from this workspace${running ? `, which stops the ${running} ${running === 1 ? "person" : "people"} going through it now` : ""}.`
        : "The copy arrives switched off, so you can check it before turning it on.",
      confirm: move ? "Move" : "Copy",
      danger: move,
    }).then((ok) => ok && start(async () => done(await copyWorkflowTo(id, target.id, move))));
  };

  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium hover:bg-surface";
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Actions for ${name}`}
        aria-expanded={open}
        disabled={pending}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-surface hover:text-navy disabled:opacity-50"
      >
        <Icon name="more" size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-20 w-60 rounded-xl border border-line bg-white p-1 shadow-lg">
          {picking ? (
            <>
              <p className="px-3 pb-1 pt-2 text-[12px] font-semibold text-muted">{picking === "move" ? "Move to" : "Copy to"}</p>
              <div className="max-h-60 overflow-y-auto">
                {others.map((o) => (
                  <button key={o.id} type="button" className={item} onClick={() => send(o, picking === "move")}>
                    <Icon name="arrowRight" size={14} /> <span className="truncate">{o.name}</span>
                  </button>
                ))}
              </div>
              <button type="button" className={`${item} text-muted`} onClick={() => setPicking(null)}>
                Back
              </button>
            </>
          ) : (
            <>
              <Link href={`/workflows/${shortId(id)}`} className={item}>
                <Icon name="edit" size={14} /> Open
              </Link>
              <button type="button" className={item} onClick={() => start(async () => done(await duplicateWorkflow(id)))}>
                <Icon name="copy" size={14} /> Duplicate
              </button>
              {others.length > 0 && (
                <>
                  <button type="button" className={item} onClick={() => setPicking("copy")}>
                    <Icon name="copy" size={14} /> Copy to another workspace
                  </button>
                  <button type="button" className={item} onClick={() => setPicking("move")}>
                    <Icon name="arrowRight" size={14} /> Move to another workspace
                  </button>
                </>
              )}
              <button
                type="button"
                className={`${item} text-bad`}
                onClick={() => {
                  void ask({
                    title: `Delete "${name}"?`,
                    text: `${running ? `${running} ${running === 1 ? "person is" : "people are"} going through it now and will stop. ` : ""}Its history goes too. This can't be undone.`,
                  }).then((ok) => ok && start(async () => done(await deleteWorkflow(id))));
                }}
              >
                <Icon name="trash" size={14} /> Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
