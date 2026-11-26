"use client";

import { shortId } from "@/lib/short-id-shared";
import { ask } from "@/components/confirm";
import { notify } from "@/components/toast";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { FieldInput } from "@/components/field-input";
import { Icon } from "@/components/icon";
import type { CustomField, Deal } from "@/lib/data";
import { deleteDeal, loadDeal, saveDeal } from "./actions";

export type StageOption = { id: string; name: string; pipelineId: string };
export type Person = { id: string; name: string };

/** A side panel to see and edit a deal: value, stage, status, owner, source and deal fields. */
export function DealPanel({ id, stages, people, onClose }: { id: string; stages: StageOption[]; people: Person[]; onClose: () => void }) {
  const [data, setData] = useState<{ deal: Deal; fields: CustomField[] } | null | undefined>(undefined);
  const [status, setStatus] = useState("open");
  const [, start] = useTransition();

  useEffect(() => {
    start(async () => {
      const res = await loadDeal(id).catch(() => null);
      setData(res);
      if (res) setStatus(res.deal.status);
    });
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const d = data?.deal;
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true" aria-label="Deal">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]" />
      <aside className="drawer-in relative flex h-full w-full max-w-[480px] flex-col bg-white shadow-2xl">
        <header className="flex items-start gap-3 border-b border-line p-5">
          <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-chip text-brand">
            <Icon name="pipeline" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] font-semibold">{d?.name ?? "Deal"}</h2>
            {d && (
              <Link href={`/contacts/${shortId(d.contactId)}`} className="text-[13px] font-medium text-brand hover:underline">
                {d.contactName} →
              </Link>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface">
            <Icon name="x" size={16} />
          </button>
        </header>

        {data === undefined && <div className="flex-1 p-5"><div className="skeleton h-40 rounded-xl" /></div>}
        {data === null && <p className="p-5 text-[14px] text-muted">This deal no longer exists.</p>}
        {d && data && (
          <ActionForm action={saveDeal} className="flex min-h-0 flex-1 flex-col">
            <input type="hidden" name="id" value={d.id} />
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium">Deal name</span>
                <input name="name" defaultValue={d.name} maxLength={120} className="field" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium">Value</span>
                  <span className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">£</span>
                    <input name="value" type="number" min="0" step="0.01" defaultValue={d.valuePence != null ? d.valuePence / 100 : ""} className="field w-full pl-7" />
                  </span>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium">Status</span>
                  <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} className="field">
                    <option value="open">Open</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                    <option value="abandoned">Abandoned</option>
                  </select>
                </label>
              </div>
              {status === "lost" && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium">Why was it lost?</span>
                  <input name="lost_reason" defaultValue={d.lostReason ?? ""} maxLength={200} placeholder="e.g. Went with a cheaper option" className="field" />
                </label>
              )}
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium">Pipeline and stage</span>
                <select name="stage_id" defaultValue={d.stageId} className="field">
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium">Owner</span>
                  <select name="owner" defaultValue={d.ownerId ?? ""} className="field">
                    <option value="">No owner</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium">Source</span>
                  <input name="source" defaultValue={d.source ?? ""} maxLength={80} placeholder="e.g. Referral" className="field" />
                </label>
              </div>
              {data.fields.length > 0 && (
                <div className="flex flex-col gap-3 border-t border-line pt-4">
                  <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Deal fields</h3>
                  {data.fields.map((f) => (
                    <div key={f.key} className="flex flex-col gap-1.5">
                      <span className="text-[13px] font-medium">{f.label}</span>
                      <FieldInput field={f} value={d.custom[f.key]} />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 text-[12.5px] text-muted">
                {d.email && <span className="inline-flex items-center gap-1"><Icon name="mail" size={12} /> {d.email}</span>}
                {d.phone && <span className="inline-flex items-center gap-1"><Icon name="phone" size={12} /> {d.phone}</span>}
                <span>Added {new Date(d.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
            </div>
            <footer className="flex items-center justify-between gap-2 border-t border-line p-4">
              <DeleteDeal id={d.id} onDone={onClose} />
              <SubmitButton pendingText="Saving…">Save deal</SubmitButton>
            </footer>
          </ActionForm>
        )}
      </aside>
    </div>,
    document.body,
  );
}

function DeleteDeal({ id, onDone }: { id: string; onDone: () => void }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (!(await ask({ title: "Delete this deal?", text: "The contact stays." }))) return;
          const fd = new FormData();
          fd.set("id", id);
          const res = await deleteDeal({}, fd);
          if (res.error) notify(res.error, "bad");
          else {
            notify("Deal deleted.");
            onDone();
          }
        })
      }
      className="text-[13px] font-semibold text-bad hover:underline"
    >
      {pending ? "Deleting…" : "Delete deal"}
    </button>
  );
}
