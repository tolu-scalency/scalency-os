"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Icon } from "@/components/icon";
import type { WorkspaceCard } from "@/lib/data";
import { createWorkspace, switchWorkspace } from "@/app/(app)/workspace-actions";

const GRADIENTS = [
  "linear-gradient(135deg,#55e3ec,#0a5fe3)",
  "linear-gradient(135deg,#a78bfa,#4f46e5)",
  "linear-gradient(135deg,#34d399,#0e9f6e)",
  "linear-gradient(135deg,#fbbf24,#f97316)",
  "linear-gradient(135deg,#f472b6,#db2777)",
  "linear-gradient(135deg,#38bdf8,#0369a1)",
];
const roleName = (r: string) => (r === "owner" ? "Owner" : r === "admin" ? "Admin" : "Member");

/** Every workspace as a card. Search appears once there are a few. */
export function WorkspaceGrid({ cards, lastUsed, children }: { cards: WorkspaceCard[]; lastUsed: string; children?: React.ReactNode }) {
  const [q, setQ] = useState("");
  const shown = cards.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[18px] font-semibold">Your workspaces</h2>
        {cards.length > 4 && (
          <label className="flex h-10 w-full max-w-[300px] items-center gap-2 rounded-xl border border-line bg-white px-3 focus-within:border-sky">
            <Icon name="search" size={15} className="text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a workspace" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none" />
          </label>
        )}
      </div>
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((c, i) => (
          <form key={c.id} action={switchWorkspace}>
            <input type="hidden" name="id" value={c.id} />
            <button
              type="submit"
              className="card card-lift group flex h-full w-full flex-col gap-4 p-5 text-left focus-visible:outline-2 focus-visible:outline-sky"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex h-12 w-12 flex-none items-center justify-center rounded-2xl text-[18px] font-semibold text-white shadow-[0_8px_20px_-10px_rgba(10,95,227,0.7)]" style={{ background: GRADIENTS[i % GRADIENTS.length] }}>
                  {c.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold">{c.name}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                    {roleName(c.role)}
                    {c.id === lastUsed && <span className="rounded-full bg-chip px-2 py-px font-semibold text-brand">Last opened</span>}
                  </span>
                </span>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface text-muted transition-all group-hover:translate-x-0.5 group-hover:bg-brand group-hover:text-white">
                  <Icon name="next" size={15} />
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-surface p-3">
                {[
                  { label: "Contacts", value: c.contacts },
                  { label: "Open deals", value: c.openDeals },
                  { label: "New this week", value: c.newLeads },
                ].map((s) => (
                  <span key={s.label}>
                    <span className="block font-mono text-[17px] font-semibold tabular-nums text-navy">{s.value.toLocaleString("en-GB")}</span>
                    <span className="block text-[11.5px] text-muted">{s.label}</span>
                  </span>
                ))}
              </div>
            </button>
          </form>
        ))}
        {children}
      </div>
      {shown.length === 0 && <p className="text-[14px] text-muted">No workspace matches “{q}”.</p>}
    </section>
  );
}

/** A card for adding a workspace, shown to owners and admins. */
export function NewWorkspaceCard() {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-line-strong text-brand transition-colors hover:border-sky hover:bg-white"
      >
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-chip">
          <Icon name="plus" size={20} />
        </span>
        <span className="text-[15px] font-semibold">New workspace</span>
        <span className="text-[12.5px] text-muted">For a new client or brand</span>
      </button>
    );
  return (
    <ActionForm action={createWorkspace} className="card flex min-h-[180px] flex-col justify-center gap-3 p-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">Workspace name</span>
        <input name="name" required minLength={2} maxLength={80} autoFocus placeholder="e.g. Bright Dental" className="field" />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost min-h-10 rounded-xl px-4 text-[13.5px] font-semibold">
          Cancel
        </button>
        <SubmitButton icon="plus" pendingText="Creating…">
          Create
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
