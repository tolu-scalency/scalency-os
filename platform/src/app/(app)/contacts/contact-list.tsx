"use client";

// The contacts list, with tick boxes to select several and delete them in one go.

import { shortId } from "@/lib/short-id-shared";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { ask } from "@/components/confirm";
import { notify } from "@/components/toast";
import { Avatar, Pill } from "@/components/ui";
import { deleteContacts } from "./actions";

export type ContactRow = { id: string; name: string; initials: string; email: string | null; phone: string | null; stage: string | null; value: string; added: string };

const GRID = "md:grid-cols-[minmax(240px,2fr)_minmax(140px,1fr)_minmax(150px,1.1fr)_110px_100px]";

export function ContactList({ rows, canDelete }: { rows: ContactRow[]; canDelete: boolean }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const all = rows.length > 0 && rows.every((r) => picked.has(r.id));
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const remove = async () => {
    const n = picked.size;
    const ok = await ask({
      title: `Delete ${n} contact${n === 1 ? "" : "s"}?`,
      text: "Their notes, tasks, deals and messages are deleted too. This can't be undone.",
      confirm: `Delete ${n}`,
    });
    if (!ok) return;
    start(async () => {
      const r = await deleteContacts([...picked]).catch(() => ({ error: "We couldn't reach the server. Try again." }) as { error?: string; ok?: string });
      notify(r.error ?? r.ok ?? "Deleted", r.error ? "bad" : "ok");
      if (!r.error) {
        setPicked(new Set());
        router.refresh();
      }
    });
  };

  return (
    <div className="card overflow-hidden">
      {canDelete && picked.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-chip px-5 py-2.5 text-[13px]">
          <span className="font-semibold text-brand">{picked.size} selected</span>
          <button type="button" disabled={pending} onClick={remove} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-white px-3 font-semibold text-bad ring-1 ring-bad/25 hover:bg-bad-bg disabled:opacity-60">
            <Icon name="trash" size={14} /> {pending ? "Deleting…" : "Delete"}
          </button>
          <button type="button" onClick={() => setPicked(new Set())} className="font-semibold text-muted hover:text-navy">
            Clear
          </button>
        </div>
      )}
      <div className={`hidden items-center gap-4 border-b border-line bg-surface px-5 py-3 text-[12px] font-medium text-muted md:flex`}>
        {canDelete && (
          <input
            type="checkbox"
            aria-label="Select all"
            checked={all}
            onChange={() => setPicked(all ? new Set() : new Set(rows.map((r) => r.id)))}
            className="h-4 w-4 flex-none accent-[var(--color-brand)]"
          />
        )}
        <div className={`grid flex-1 gap-4 ${GRID}`}>
          <span>Name</span>
          <span>Phone</span>
          <span>Stage</span>
          <span>Value</span>
          <span className="text-right">Added</span>
        </div>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((c) => (
          <li key={c.id} className={`flex items-center gap-4 pl-5 transition-colors hover:bg-surface ${picked.has(c.id) ? "bg-chip/60" : ""}`}>
            {canDelete && <input type="checkbox" aria-label={`Select ${c.name}`} checked={picked.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 flex-none accent-[var(--color-brand)]" />}
            <Link href={`/contacts/${shortId(c.id)}`} className={`grid min-w-0 flex-1 grid-cols-[1fr_auto] items-center gap-4 py-3.5 pr-5 ${GRID}`}>
              <span className="flex min-w-0 items-center gap-3">
                <Avatar initials={c.initials} size={36} />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold">{c.name}</span>
                  <span className="block truncate text-[12.5px] text-muted">{c.email ?? c.phone ?? "No email"}</span>
                </span>
              </span>
              <span className="hidden text-[13.5px] tabular-nums text-muted md:block">{c.phone ?? "—"}</span>
              <span>{c.stage ? <Pill>{c.stage}</Pill> : <span className="hidden text-[13px] text-faint md:inline">Not in pipeline</span>}</span>
              <span className="hidden text-[13.5px] font-medium tabular-nums md:block">{c.value}</span>
              <span className="hidden text-right text-[12.5px] text-faint md:block">{c.added}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
