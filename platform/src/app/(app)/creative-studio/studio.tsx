"use client";

import { useMemo, useState, useTransition } from "react";
import { ask } from "@/components/confirm";
import { Icon } from "@/components/icon";
import { notify } from "@/components/toast";
import { callSetter } from "@/lib/call-setter";
import { checkCreative, type CreativeIssue } from "@/lib/creative-rules";
import { deleteCreative, saveCreative, setCreativeStatus, type CreativeInput } from "./actions";

export type Creative = {
  id: string;
  title: string;
  channel: string;
  headline: string;
  body: string;
  cta: string;
  image_idea: string;
  brief: string | null;
  status: "draft" | "in_review" | "approved" | "rejected";
  compliance: { status?: string; issues?: CreativeIssue[] };
  review_note: string | null;
  reviewed_at: string | null;
  updated_at: string;
};

const CHANNELS = ["Meta ad", "Instagram post", "Instagram story", "Google ad", "TikTok ad", "Email", "Text message", "Landing page"];
const COLUMNS: { key: Creative["status"]; label: string; tone: string }[] = [
  { key: "draft", label: "Drafts", tone: "bg-surface text-muted" },
  { key: "in_review", label: "Waiting for sign-off", tone: "bg-warn-bg text-warn" },
  { key: "approved", label: "Approved", tone: "bg-ok-bg text-ok" },
  { key: "rejected", label: "Rejected", tone: "bg-bad-bg text-bad" },
];
const field = "field h-10 w-full text-[13.5px]";
const label = "flex flex-col gap-1.5 text-[12.5px] font-semibold text-navy";

function Flags({ text }: { text: string }) {
  const c = checkCreative(text);
  if (c.status === "ok")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ok-bg px-2 py-0.5 text-[11px] font-semibold text-ok">
        <Icon name="shield" size={11} /> Passes UK ad rules
      </span>
    );
  return (
    <div className="flex flex-col gap-1">
      {c.issues.map((i, n) => (
        <div key={n} className={`rounded-lg px-2.5 py-1.5 text-[11.5px] ${i.level === "block" ? "bg-bad-bg text-bad" : "bg-warn-bg text-warn"}`}>
          <strong>&quot;{i.match}&quot;</strong>: {i.rule}
        </div>
      ))}
    </div>
  );
}

export function Studio({ items, setterId, canApprove }: { items: Creative[]; setterId: string; canApprove: boolean }) {
  const [channel, setChannel] = useState(CHANNELS[0]);
  const [brief, setBrief] = useState("");
  const [treatment, setTreatment] = useState("");
  const [offer, setOffer] = useState("");
  const [audience, setAudience] = useState("");
  const [busy, setBusy] = useState(false);
  const [variants, setVariants] = useState<CreativeInput[]>([]);
  const [editing, setEditing] = useState<Creative | null>(null);
  const [pending, start] = useTransition();
  const byStatus = useMemo(() => Object.fromEntries(COLUMNS.map((c) => [c.key, items.filter((i) => i.status === c.key)])) as Record<Creative["status"], Creative[]>, [items]);

  const generate = async () => {
    if (!setterId) return void notify("Set up an AI setter first: the studio writes from its business details.", "bad");
    setBusy(true);
    const res = await callSetter({ agent_id: setterId, action: "creative_generate", channel, brief, treatment, offer, audience });
    setBusy(false);
    if ("error" in res && res.error) return void notify(String(res.error), "bad");
    setVariants(((res.variants as { headline: string; body: string; cta: string; image: string }[]) ?? []).map((v) => ({ title: v.headline, channel, headline: v.headline, body: v.body, cta: v.cta, image_idea: v.image, brief })));
  };
  const keep = (v: CreativeInput) =>
    start(async () => {
      const r = await saveCreative(v);
      notify(r.error ?? "Saved to drafts", r.error ? "bad" : "ok");
      if (!r.error) setVariants((list) => list.filter((x) => x !== v));
    });
  const move = (c: Creative, status: Creative["status"]) =>
    start(async () => {
      let note: string | undefined;
      if (status === "rejected") note = window.prompt("Why? (shown to whoever wrote it)") ?? undefined;
      const r = await setCreativeStatus(c.id, status, note);
      notify(r.error ?? r.ok ?? "Done", r.error ? "bad" : "ok");
    });

  return (
    <div className="flex flex-col gap-5">
      <section className="card overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="flex flex-col gap-4 border-b border-line p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <div>
              <div className="eyebrow mb-1">New brief</div>
              <h2 className="text-[17px] font-semibold">What do you want to promote?</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>
                Where it goes
                <select value={channel} onChange={(e) => setChannel(e.target.value)} className={field}>
                  {CHANNELS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className={label}>
                Treatment or concern
                <input value={treatment} onChange={(e) => setTreatment(e.target.value)} placeholder="Forehead lines, lip filler, acne scars…" className={field} />
              </label>
              <label className={label}>
                Offer (optional)
                <input value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="Free consultation this month" className={field} />
              </label>
              <label className={label}>
                Who it&apos;s for (optional)
                <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Women 30 to 55 within 10 miles" className={field} />
              </label>
            </div>
            <label className={label}>
              Brief
              <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={4} placeholder="Fill quiet Tuesday and Wednesday afternoons. Natural results, nurse prescriber, free 30-minute consultation." className="field w-full py-2.5 text-[13.5px] leading-relaxed" />
            </label>
            <button type="button" disabled={busy || !brief.trim()} onClick={generate} className="btn-primary inline-flex min-h-11 w-fit items-center gap-2 rounded-xl px-5 text-[14px] font-semibold disabled:opacity-50">
              <Icon name="spark" size={15} /> {busy ? "Writing 3 versions…" : "Write 3 versions"}
            </button>
            <p className="text-[11.5px] text-muted">The AI never names prescription-only medicines, never targets under-18s, and avoids guarantees and countdown pressure. Every version is checked again before you save it.</p>
          </div>
          <div className="flex min-h-[320px] flex-col gap-3 bg-surface/60 p-5 sm:p-6">
            {variants.length === 0 ? (
              <div className="m-auto max-w-[340px] text-center text-[13px] text-muted">
                <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand ring-1 ring-line">
                  <Icon name="image" size={20} />
                </span>
                Your 3 versions appear here, each with its UK ad-rules check. Keep the ones you like.
              </div>
            ) : (
              variants.map((v, i) => (
                <article key={i} className="flex flex-col gap-2.5 rounded-2xl bg-white p-4 ring-1 ring-line">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">Version {i + 1}</span>
                    <button type="button" disabled={pending} onClick={() => keep(v)} className="btn-primary inline-flex min-h-8 items-center gap-1 rounded-lg px-3 text-[12px] font-semibold">
                      <Icon name="check" size={12} /> Keep
                    </button>
                  </div>
                  <div className="text-[15px] font-semibold leading-snug text-navy">{v.headline}</div>
                  <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-navy/85">{v.body}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-brand px-2.5 py-1 text-[12px] font-semibold text-white">{v.cta}</span>
                    {v.image_idea && <span className="text-[12px] text-muted">Image: {v.image_idea}</span>}
                  </div>
                  <Flags text={`${v.headline} ${v.body} ${v.cta}`} />
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        {COLUMNS.map((col) => (
          <section key={col.key} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1">
              <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${col.tone}`}>{col.label}</span>
              <span className="font-mono text-[12px] text-faint">{byStatus[col.key].length}</span>
            </div>
            {byStatus[col.key].length === 0 && <div className="rounded-2xl border border-dashed border-line-strong p-5 text-center text-[12.5px] text-muted">Nothing here.</div>}
            {byStatus[col.key].map((c) => (
              <article key={c.id} className="card flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-md bg-chip px-1.5 py-0.5 text-[10.5px] font-semibold text-brand">{c.channel}</span>
                  <div className="flex gap-0.5">
                    <button type="button" onClick={() => setEditing(c)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-navy" aria-label="Edit">
                      <Icon name="edit" size={13} />
                    </button>
                    <button type="button" onClick={async () => (await ask({ title: "Delete this creative?", text: "This can't be undone." })) && start(async () => void (await deleteCreative(c.id)))} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-bad-bg hover:text-bad" aria-label="Delete">
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                </div>
                <div className="text-[14px] font-semibold leading-snug">{c.headline || c.title}</div>
                <p className="line-clamp-4 text-[12.5px] leading-relaxed text-muted">{c.body}</p>
                <Flags text={`${c.headline} ${c.body} ${c.cta}`} />
                {c.review_note && <p className="rounded-lg bg-surface px-2.5 py-1.5 text-[11.5px] text-navy">Note: {c.review_note}</p>}
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {c.status === "draft" && (
                    <button type="button" disabled={pending} onClick={() => move(c, "in_review")} className="btn-primary min-h-8 rounded-lg px-3 text-[12px] font-semibold">
                      Send for sign-off
                    </button>
                  )}
                  {c.status === "in_review" && canApprove && (
                    <>
                      <button type="button" disabled={pending} onClick={() => move(c, "approved")} className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-ok px-3 text-[12px] font-semibold text-white">
                        <Icon name="check" size={12} /> Approve
                      </button>
                      <button type="button" disabled={pending} onClick={() => move(c, "rejected")} className="btn-ghost min-h-8 rounded-lg px-3 text-[12px] font-semibold">
                        Reject
                      </button>
                    </>
                  )}
                  {c.status === "approved" && (
                    <button type="button" onClick={() => navigator.clipboard.writeText(`${c.headline}\n\n${c.body}\n\n${c.cta}`).then(() => notify("Copied", "ok"))} className="btn-ghost inline-flex min-h-8 items-center gap-1 rounded-lg px-3 text-[12px] font-semibold">
                      <Icon name="copy" size={12} /> Copy
                    </button>
                  )}
                  {(c.status === "rejected" || (c.status === "in_review" && !canApprove)) && (
                    <button type="button" disabled={pending} onClick={() => move(c, "draft")} className="btn-ghost min-h-8 rounded-lg px-3 text-[12px] font-semibold">
                      Back to drafts
                    </button>
                  )}
                </div>
              </article>
            ))}
          </section>
        ))}
      </div>

      {editing && <Editor c={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Editor({ c, onClose }: { c: Creative; onClose: () => void }) {
  const [v, setV] = useState<CreativeInput>({ title: c.title, channel: c.channel, headline: c.headline, body: c.body, cta: c.cta, image_idea: c.image_idea, brief: c.brief ?? "" });
  const [pending, start] = useTransition();
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy/40 p-4" onClick={onClose}>
      <div className="card flex max-h-[90vh] w-full max-w-[640px] flex-col gap-3 overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[17px] font-semibold">Edit creative</h2>
        <label className={label}>
          Headline
          <input value={v.headline} onChange={(e) => setV({ ...v, headline: e.target.value })} className={field} />
        </label>
        <label className={label}>
          Text
          <textarea value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} rows={6} className="field w-full py-2.5 text-[13.5px] leading-relaxed" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>
            Button
            <input value={v.cta} onChange={(e) => setV({ ...v, cta: e.target.value })} className={field} />
          </label>
          <label className={label}>
            Where it goes
            <select value={v.channel} onChange={(e) => setV({ ...v, channel: e.target.value })} className={field}>
              {CHANNELS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>
        <Flags text={`${v.headline} ${v.body} ${v.cta}`} />
        <p className="text-[11.5px] text-muted">Saving moves it back to drafts, so it gets signed off again.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost min-h-10 rounded-xl px-4 text-[13px] font-semibold">
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveCreative(v, c.id);
                notify(r.error ?? "Saved", r.error ? "bad" : "ok");
                if (!r.error) onClose();
              })
            }
            className="btn-primary min-h-10 rounded-xl px-4 text-[13px] font-semibold"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
