"use client";

// Folder filters above the forms list, with rename for the open folder.

import { useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { notify } from "@/components/toast";
import { renameFolder } from "./actions";

export function FolderBar({ folders, active, total, loose, canEdit }: { folders: { name: string; count: number }[]; active: string | null; total: number; loose: number; canEdit: boolean }) {
  const [pending, start] = useTransition();
  if (!folders.length) return null;
  const chip = (on: boolean) => `inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 ring-1 ${on ? "bg-navy text-white ring-navy" : "bg-white text-muted ring-line hover:text-navy"}`;
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
      <Link href="/forms" className={chip(active === null)}>
        All forms <span className="opacity-70">{total}</span>
      </Link>
      {folders.map((f) => (
        <Link key={f.name} href={`/forms?folder=${encodeURIComponent(f.name)}`} className={chip(active === f.name)}>
          <Icon name="folder" size={13} /> {f.name} <span className="opacity-70">{f.count}</span>
        </Link>
      ))}
      {loose > 0 && (
        <Link href="/forms?folder=" className={chip(active === "")}>
          Not in a folder <span className="opacity-70">{loose}</span>
        </Link>
      )}
      {canEdit && active && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const to = window.prompt(`Rename the folder "${active}" (leave empty to remove the folder; its forms stay):`, active);
            if (to === null || to.trim() === active) return;
            start(async () => {
              const r = await renameFolder(active, to);
              notify(r.error ?? r.ok ?? "Done", r.error ? "bad" : "ok");
              if (!r.error) window.location.href = to.trim() ? `/forms?folder=${encodeURIComponent(to.trim())}` : "/forms";
            });
          }}
          className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-muted hover:text-navy"
        >
          <Icon name="edit" size={13} /> Rename folder
        </button>
      )}
    </div>
  );
}
