"use client";

// The form builder: fields on the left, a live preview on the right. Settings decide
// what happens after someone submits; Share gives the link and embed code;
// Submissions lists everyone who filled it in. Changes save automatically.

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { TagsInput } from "@/components/editor/tags-input";
import { LeadForm } from "@/components/lead-form";
import type { CustomField, Stage } from "@/lib/data";
import { FIELD_KINDS, newFieldId, publishProblem, type FormDefinition, type FormField, type FormFieldKind } from "@/lib/form-builder";
import { StagePicker } from "../../workflows/[id]/step-fields";
import { deleteForm, saveForm, setFormStatus } from "../actions";

export type Submission = { id: string; contactId: string; name: string; email: string; phone: string; answers: { label: string; value: string }[]; source: string; at: string };
type FormState = { id: string; name: string; status: "live" | "draft" | "archived"; definition: FormDefinition; tags: string[]; stageId: string | null; redirectUrl: string };
type Tab = "build" | "settings" | "share" | "submissions";

const ACCENTS = ["#0a5fe3", "#0ea5e9", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0b1b3a"];

export function FormEditor({
  form,
  base,
  canEdit,
  customFields,
  allTags,
  stages,
  pipelines,
  submissions,
  initialTab,
}: {
  form: FormState;
  base: string;
  canEdit: boolean;
  customFields: CustomField[];
  allTags: string[];
  stages: Stage[];
  pipelines: { id: string; name: string }[];
  submissions: Submission[];
  initialTab: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [name, setName] = useState(form.name);
  const [def, setDef] = useState<FormDefinition>(form.definition);
  const [tags, setTags] = useState(form.tags);
  const [stageId, setStageId] = useState<string | null>(form.stageId);
  const [redirectUrl, setRedirectUrl] = useState(form.redirectUrl);
  const [afterMode, setAfterMode] = useState<"message" | "redirect">(form.redirectUrl ? "redirect" : "message");
  const [status, setStatus] = useState(form.status);
  const [open, setOpen] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState("");
  const first = useRef(true);

  const touch = () => {
    setDirty(true);
    setMsg({});
  };
  const setD = (patch: Partial<FormDefinition>) => {
    setDef((d) => ({ ...d, ...patch }));
    touch();
  };
  const setField = (id: string, patch: Partial<FormField>) => setD({ fields: def.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) });

  function save() {
    start(async () => {
      const r = await saveForm(form.id, { name, definition: def, tags, stageId, redirectUrl: afterMode === "redirect" ? redirectUrl : "" });
      setMsg(r.error ? r : { ok: "All changes saved" });
      if (!r.error) setDirty(false);
    });
  }
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!dirty || !canEdit) return;
    const t = setTimeout(save, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, name, def, tags, stageId, redirectUrl, afterMode]);

  function publish(next: "live" | "draft") {
    start(async () => {
      if (dirty) {
        const s = await saveForm(form.id, { name, definition: def, tags, stageId, redirectUrl: afterMode === "redirect" ? redirectUrl : "" });
        if (s.error) return setMsg(s);
        setDirty(false);
      }
      const r = await setFormStatus(form.id, next);
      setMsg(r);
      if (!r.error) {
        setStatus(next);
        if (next === "live") setTab("share");
      }
    });
  }

  function addField(kind: FormFieldKind, key?: string) {
    const cf = key ? customFields.find((f) => f.key === key) : undefined;
    const label = cf?.label ?? FIELD_KINDS.find((k) => k.kind === kind)!.label;
    const f: FormField = { id: newFieldId(), kind, label, required: kind === "email", ...(key ? { key } : {}), ...(kind === "select" ? { options: ["Option 1", "Option 2"] } : {}) };
    setD({ fields: [...def.fields, f] });
    setOpen(f.id);
  }
  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= def.fields.length) return;
    const copy = [...def.fields];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    setD({ fields: copy });
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(""), 1800);
    } catch {}
  }

  const link = `${base}/f/${form.id}`;
  const embed = `<iframe src="${link}?embed=1" id="scalency-form-${form.id}" title="${def.title || name}" style="width:100%;border:0;min-height:520px" loading="lazy"></iframe>
<script>window.addEventListener("message",function(e){if(e.data&&e.data.scalencyForm==="${form.id}"){document.getElementById("scalency-form-${form.id}").style.height=e.data.height+"px"}});</script>`;
  const problem = publishProblem(def);
  const used = new Set(def.fields.map((f) => f.kind));
  const usedKeys = new Set(def.fields.filter((f) => f.kind === "custom").map((f) => f.key));
  const tabBtn = (t: Tab, label: string, count?: number) => (
    <button
      key={t}
      type="button"
      onClick={() => setTab(t)}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13.5px] font-semibold transition-colors ${tab === t ? "bg-white text-navy shadow-sm" : "text-muted hover:text-navy"}`}
    >
      {label}
      {count !== undefined && <span className="rounded-full bg-chip px-1.5 text-[11px] text-brand">{count}</span>}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/forms" className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-white" aria-label="Back to forms">
          <Icon name="arrowLeft" size={17} />
        </Link>
        <input
          value={name}
          disabled={!canEdit}
          onChange={(e) => {
            setName(e.target.value);
            touch();
          }}
          maxLength={80}
          className="min-w-0 flex-[1_1_220px] rounded-lg bg-transparent px-2 py-1 text-[22px] font-semibold tracking-[-0.03em] outline-none hover:bg-white focus:bg-white focus:ring-2 focus:ring-sky/40"
          aria-label="Form name"
        />
        <span className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold ${status === "live" ? "bg-ok-bg text-ok" : "bg-surface text-muted"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${status === "live" ? "bg-ok" : "bg-faint"}`} /> {status === "live" ? "Live" : status === "archived" ? "Archived" : "Draft"}
        </span>
        <span className={`text-[12.5px] ${msg.error ? "text-bad" : "text-muted"}`}>{pending ? "Saving…" : msg.error ?? msg.ok ?? (dirty ? "Saving automatically…" : "")}</span>
        {canEdit && (
          <div className="ml-auto flex gap-2">
            {status === "live" ? (
              <button type="button" onClick={() => publish("draft")} disabled={pending} className="btn-ghost inline-flex min-h-10 items-center rounded-xl px-4 text-[13.5px] font-semibold">
                Unpublish
              </button>
            ) : (
              <button
                type="button"
                onClick={() => publish("live")}
                disabled={pending || Boolean(problem)}
                title={problem ?? undefined}
                className="btn-primary inline-flex min-h-10 items-center gap-2 rounded-xl px-5 text-[13.5px] font-semibold disabled:opacity-60"
              >
                <Icon name="globe" size={15} /> Publish
              </button>
            )}
          </div>
        )}
      </div>
      {problem && status !== "live" && <p className="rounded-xl bg-warn-bg px-4 py-2.5 text-[13px] text-warn">{problem}</p>}

      <div className="inline-flex w-fit flex-wrap gap-1 rounded-xl bg-surface p-1">
        {tabBtn("build", "Build")}
        {tabBtn("settings", "After submitting")}
        {tabBtn("share", "Share and embed")}
        {tabBtn("submissions", "Submissions", submissions.length)}
      </div>

      {tab === "build" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-4">
            <section className="card flex flex-col gap-3 p-5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-medium text-muted">Heading</span>
                <input value={def.title} maxLength={120} onChange={(e) => setD({ title: e.target.value })} className="field h-11 font-semibold" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-medium text-muted">Intro text (optional)</span>
                <textarea value={def.intro} maxLength={400} rows={2} onChange={(e) => setD({ intro: e.target.value })} className="field py-2.5" />
              </label>
            </section>

            <section className="card p-2">
              <div className="px-3 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-faint">Fields</div>
              {def.fields.length === 0 && <p className="px-3 py-4 text-[13.5px] text-muted">No fields yet. Add Email or Phone so each submission becomes a contact.</p>}
              {def.fields.map((f, i) => {
                const isOpen = open === f.id;
                const kindLabel = f.kind === "custom" ? `Contact field: ${customFields.find((c) => c.key === f.key)?.label ?? f.key}` : FIELD_KINDS.find((k) => k.kind === f.kind)?.label;
                return (
                  <div key={f.id} className={`rounded-xl ${isOpen ? "bg-surface" : ""}`}>
                    <div className="flex items-center gap-2 px-3 py-2">
                      <button type="button" onClick={() => setOpen(isOpen ? null : f.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                        <Icon name={isOpen ? "down" : "next"} size={13} className="flex-none text-faint" />
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-semibold">
                            {f.label}
                            {f.required && <span className="text-bad"> *</span>}
                          </span>
                          <span className="block truncate text-[12px] text-muted">{kindLabel}{f.half ? " · half width" : ""}</span>
                        </span>
                      </button>
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-white disabled:opacity-30">
                        <Icon name="up" size={14} />
                      </button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === def.fields.length - 1} aria-label="Move down" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-white disabled:opacity-30">
                        <Icon name="down" size={14} />
                      </button>
                      <button type="button" onClick={() => setD({ fields: def.fields.filter((x) => x.id !== f.id) })} aria-label={`Remove ${f.label}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-faint hover:bg-bad-bg hover:text-bad">
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                    {isOpen && (
                      <div className="grid gap-3 px-3 pb-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[12px] font-medium text-muted">Label</span>
                          <input value={f.label} maxLength={80} onChange={(e) => setField(f.id, { label: e.target.value })} className="field h-10" />
                        </label>
                        {f.kind !== "checkbox" && (
                          <label className="flex flex-col gap-1.5">
                            <span className="text-[12px] font-medium text-muted">Placeholder (optional)</span>
                            <input value={f.placeholder ?? ""} maxLength={80} onChange={(e) => setField(f.id, { placeholder: e.target.value || undefined })} className="field h-10" />
                          </label>
                        )}
                        {f.kind === "select" && (
                          <label className="flex flex-col gap-1.5 sm:col-span-2">
                            <span className="text-[12px] font-medium text-muted">Options, one per line</span>
                            <textarea
                              rows={4}
                              value={(f.options ?? []).join("\n")}
                              onChange={(e) => setField(f.id, { options: e.target.value.split("\n").map((o) => o.slice(0, 60)).slice(0, 30) })}
                              className="field py-2"
                            />
                          </label>
                        )}
                        <div className="flex flex-wrap gap-4 sm:col-span-2">
                          <label className="flex cursor-pointer items-center gap-2 text-[13.5px]">
                            <input type="checkbox" checked={f.required} onChange={(e) => setField(f.id, { required: e.target.checked })} className="h-4 w-4 accent-[#0a5fe3]" /> Required
                          </label>
                          <label className="flex cursor-pointer items-center gap-2 text-[13.5px]">
                            <input type="checkbox" checked={Boolean(f.half)} onChange={(e) => setField(f.id, { half: e.target.checked || undefined })} className="h-4 w-4 accent-[#0a5fe3]" /> Half width
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="mt-1 border-t border-line px-3 py-3">
                <div className="mb-2 text-[12px] font-medium text-muted">Add a field</div>
                <div className="flex flex-wrap gap-1.5">
                  {FIELD_KINDS.filter((k) => k.kind !== "custom").map((k) => (
                    <button
                      key={k.kind}
                      type="button"
                      disabled={k.once && used.has(k.kind)}
                      onClick={() => addField(k.kind)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-[12.5px] font-medium hover:border-sky disabled:opacity-40"
                    >
                      <Icon name="plus" size={12} /> {k.label}
                    </button>
                  ))}
                  {customFields.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => e.target.value && addField("custom", e.target.value)}
                      className="h-8 rounded-lg border border-line bg-white px-2 text-[12.5px] font-medium"
                      aria-label="Add one of your contact fields"
                    >
                      <option value="">+ Your contact fields…</option>
                      {customFields.map((c) => (
                        <option key={c.key} value={c.key} disabled={usedKeys.has(c.key)}>{c.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </section>

            <section className="card flex flex-col gap-3 p-5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-medium text-muted">Button text</span>
                <input value={def.button} maxLength={40} onChange={(e) => setD({ button: e.target.value })} className="field h-11" />
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px]">
                <input type="checkbox" checked={def.consent.enabled} onChange={(e) => setD({ consent: { ...def.consent, enabled: e.target.checked } })} className="h-4 w-4 accent-[#0a5fe3]" />
                Ask for permission to contact them (recommended in the UK)
              </label>
              {def.consent.enabled && (
                <>
                  <textarea value={def.consent.text} maxLength={300} rows={2} onChange={(e) => setD({ consent: { ...def.consent, text: e.target.value } })} className="field py-2.5" />
                  <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-muted">
                    <input type="checkbox" checked={def.consent.required} onChange={(e) => setD({ consent: { ...def.consent, required: e.target.checked } })} className="h-4 w-4 accent-[#0a5fe3]" />
                    They must tick it to send the form
                  </label>
                </>
              )}
              <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
                <span className="text-[12.5px] font-medium text-muted">Style</span>
                <div className="flex gap-1.5">
                  {ACCENTS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setD({ theme: { ...def.theme, accent: c } })}
                      aria-label={`Colour ${c}`}
                      className={`h-7 w-7 rounded-full ring-offset-2 ${def.theme.accent === c ? "ring-2 ring-navy" : ""}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={def.theme.rounded} onChange={(e) => setD({ theme: { ...def.theme, rounded: e.target.checked } })} className="h-4 w-4 accent-[#0a5fe3]" /> Rounded
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={def.theme.dark} onChange={(e) => setD({ theme: { ...def.theme, dark: e.target.checked } })} className="h-4 w-4 accent-[#0a5fe3]" /> Dark
                </label>
              </div>
            </section>
          </fieldset>

          <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
            <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-faint">
              <Icon name="eye" size={13} /> Preview
            </div>
            <div className="rounded-2xl p-5 sm:p-7" style={{ background: def.theme.dark ? "#111c33" : "#ffffff", boxShadow: "var(--shadow-card)" }}>
              <LeadForm formId={form.id} def={def} preview />
            </div>
          </div>
        </div>
      )}

      {tab === "settings" && (
        <fieldset disabled={!canEdit} className="grid max-w-[760px] gap-4">
          <section className="card flex flex-col gap-3 p-5">
            <h2 className="text-[15px] font-semibold">What they see next</h2>
            <div className="flex flex-wrap gap-2">
              {(["message", "redirect"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setAfterMode(m);
                    touch();
                  }}
                  className={`rounded-xl px-3.5 py-2 text-[13.5px] font-semibold ring-1 ${afterMode === m ? "bg-navy text-white ring-navy" : "bg-white text-muted ring-line"}`}
                >
                  {m === "message" ? "A thank-you message" : "Send them to a page"}
                </button>
              ))}
            </div>
            {afterMode === "message" ? (
              <textarea value={def.success} maxLength={400} rows={3} onChange={(e) => setD({ success: e.target.value })} className="field py-2.5" aria-label="Thank-you message" />
            ) : (
              <input
                value={redirectUrl}
                onChange={(e) => {
                  setRedirectUrl(e.target.value.trim());
                  touch();
                }}
                placeholder="https://yoursite.co.uk/thank-you"
                className="field h-11"
                aria-label="Thank-you page address"
              />
            )}
          </section>

          <section className="card flex flex-col gap-3 p-5">
            <h2 className="text-[15px] font-semibold">Tag everyone who fills it in</h2>
            <TagsInput
              value={tags}
              onChange={(t) => {
                setTags(t);
                touch();
              }}
              suggestions={allTags}
              inline
              placeholder="Type a tag and press Enter, e.g. AI audit"
            />
            <p className="text-[12.5px] text-muted">Tags help you filter contacts and can start workflows (“Tag added”).</p>
          </section>

          <section className="card flex flex-col gap-3 p-5">
            <h2 className="text-[15px] font-semibold">Add them to a pipeline</h2>
            <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px]">
              <input
                type="checkbox"
                checked={Boolean(stageId)}
                onChange={(e) => {
                  setStageId(e.target.checked ? (stages[0]?.id ?? null) : null);
                  touch();
                }}
                disabled={!stages.length}
                className="h-4 w-4 accent-[#0a5fe3]"
              />
              Create a deal for each new submission
            </label>
            {stageId && (
              <StagePicker
                stages={stages}
                pipelines={pipelines}
                value={stageId}
                onChange={(v) => {
                  setStageId(v.stageId || null);
                  touch();
                }}
              />
            )}
            <p className="text-[12.5px] text-muted">If they already have an open deal in that pipeline, we keep it rather than adding another.</p>
          </section>

          <section className="card flex flex-col gap-2 p-5">
            <h2 className="text-[15px] font-semibold">Start a workflow</h2>
            <p className="text-[13.5px] text-muted">
              Create a workflow with the trigger <strong className="text-navy">Form submitted</strong> and choose this form. It then runs for everyone who fills it in: a welcome text, a team alert, a follow-up task and so on.
            </p>
            <Link href="/workflows" className="inline-flex w-fit items-center gap-1.5 text-[13.5px] font-semibold text-brand hover:underline">
              Go to workflows <Icon name="arrowRight" size={14} />
            </Link>
          </section>

          {canEdit && (
            <section className="card flex flex-wrap items-center gap-3 p-5">
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-semibold">Delete this form</h2>
                <p className="text-[13px] text-muted">Its link stops working and its submissions are removed. The contacts it created stay.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete "${name}" and its ${submissions.length} submission${submissions.length === 1 ? "" : "s"}? This can't be undone.`)) start(() => deleteForm(form.id));
                }}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-[13.5px] font-semibold text-bad ring-1 ring-bad/30 hover:bg-bad-bg"
              >
                <Icon name="trash" size={14} /> Delete form
              </button>
            </section>
          )}
        </fieldset>
      )}

      {tab === "share" && (
        <div className="grid max-w-[860px] gap-4">
          {status !== "live" && (
            <p className="rounded-xl bg-warn-bg px-4 py-3 text-[13.5px] text-warn">
              This form is a draft, so the link and embed show “not found” until you press <strong>Publish</strong>.
            </p>
          )}
          <section className="card flex flex-col gap-3 p-5">
            <h2 className="text-[15px] font-semibold">Link</h2>
            <p className="text-[13px] text-muted">Share it anywhere: bio links, emails, ads, QR codes. Add ?utm_source=instagram to see where leads came from.</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-xl bg-surface px-3 py-2.5 text-[13px] ring-1 ring-line">{link}</code>
              <button type="button" onClick={() => copy(link, "link")} className="btn-ghost inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold">
                <Icon name={copied === "link" ? "check" : "copy"} size={14} /> {copied === "link" ? "Copied" : "Copy"}
              </button>
              <a href={link} target="_blank" rel="noreferrer" className="btn-ghost inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold">
                <Icon name="globe" size={14} /> Open
              </a>
            </div>
          </section>
          <section className="card flex flex-col gap-3 p-5">
            <h2 className="text-[15px] font-semibold">Embed on a website</h2>
            <p className="text-[13px] text-muted">Paste this where the form should appear: WordPress (Custom HTML block), Webflow (Embed), Wix (Embed code), Framer or any site. It resizes itself.</p>
            <textarea readOnly value={embed} rows={5} className="field py-2.5 font-mono text-[12px]" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" onClick={() => copy(embed, "embed")} className="btn-primary inline-flex min-h-10 w-fit items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold">
              <Icon name={copied === "embed" ? "check" : "copy"} size={14} /> {copied === "embed" ? "Copied" : "Copy embed code"}
            </button>
          </section>
        </div>
      )}

      {tab === "submissions" && (
        <section className="card overflow-hidden">
          {submissions.length === 0 ? (
            <p className="p-8 text-center text-[14px] text-muted">No submissions yet. Once someone fills in the form, they show up here and in Contacts.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[13.5px]">
                <thead className="bg-surface text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
                  <tr>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Answers</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {submissions.map((s) => (
                    <tr key={s.id} className="align-top">
                      <td className="px-4 py-3">
                        <Link href={`/contacts/${s.contactId}`} className="font-semibold text-brand hover:underline">{s.name}</Link>
                        <div className="text-[12.5px] text-muted">{[s.email, s.phone].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td className="px-4 py-3">
                        <dl className="grid gap-0.5">
                          {s.answers
                            .filter((a) => !["First name", "Last name", "Email", "Phone", "Full name"].includes(a.label))
                            .slice(0, 6)
                            .map((a, i) => (
                              <div key={i} className="truncate">
                                <dt className="inline text-muted">{a.label}: </dt>
                                <dd className="inline">{a.value}</dd>
                              </div>
                            ))}
                        </dl>
                      </td>
                      <td className="px-4 py-3 text-muted">{s.source || "Direct"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">
                        {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(s.at))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
