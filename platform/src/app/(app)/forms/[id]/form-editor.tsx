"use client";

// Form Studio: Scalency's form builder. Elements on the left, the live form in
// the middle (drag, drop, rearrange), settings on the right. Undo and redo,
// phone and desktop views, a real preview, multi-step forms, rules and scoring.
// Everything saves automatically.

import { notify } from "@/components/toast";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";
import { TagsInput } from "@/components/editor/tags-input";
import { LeadForm } from "@/components/lead-form";
import type { CustomField, Stage } from "@/lib/data";
import { allFields, publishProblem, type Block, type FormDefinition, type Outcome, type Theme } from "@/lib/form-builder";
import { StagePicker } from "../../workflows/[id]/step-fields";
import { deleteForm, duplicateForm, saveForm, setFormStatus } from "../actions";
import { Canvas } from "./studio/canvas";
import { Inspector } from "./studio/inspector";
import { Palette } from "./studio/palette";
import {
  addByClick,
  addStep,
  drop,
  duplicateBlock,
  duplicateRow,
  findBlock,
  moveBlockToStep,
  moveRowBy,
  moveStep,
  removeBlock,
  removeColumn,
  removeRow,
  removeStep,
  setColumns,
  updateBlock,
  type Drag,
  type Target,
} from "./studio/tree";

export type Submission = {
  id: string;
  contactId: string;
  name: string;
  email: string;
  phone: string;
  answers: { label: string; value: string; file?: string }[];
  source: string;
  at: string;
  status: "started" | "submitted" | "qualified" | "unqualified";
  score: number | null;
};
type FormState = { id: string; name: string; slug: string; status: "live" | "draft" | "archived"; definition: FormDefinition; tags: string[]; stageId: string | null; redirectUrl: string };
type Tab = "design" | "settings" | "share" | "submissions";

export function FormEditor({
  form,
  base,
  workspaceSlug,
  views,
  healthProblem,
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
  workspaceSlug: string;
  views: number;
  healthProblem?: string;
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
  const [def, setDefState] = useState<FormDefinition>(form.definition);
  const [tags, setTags] = useState(form.tags);
  const [stageId, setStageId] = useState<string | null>(form.stageId);
  const [redirectUrl, setRedirectUrl] = useState(form.redirectUrl);
  const [status, setStatus] = useState(form.status);
  const [stepId, setStepId] = useState(form.definition.steps[0].id);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [preview, setPreview] = useState(false);
  const [panel, setPanel] = useState<"none" | "add" | "settings">("none");
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [pending, start] = useTransition();
  const readOnly = !canEdit;

  // ---------------------------------------------------------------- history
  // The history lives in refs (no re-render on every push); hist mirrors the
  // sizes so the undo and redo buttons know when to switch on.
  const current = useRef<FormDefinition>(form.definition);
  const past = useRef<FormDefinition[]>([]);
  const future = useRef<FormDefinition[]>([]);
  const lastKey = useRef<{ key: string; at: number }>({ key: "", at: 0 });
  const [hist, setHist] = useState({ past: 0, future: 0 });
  const show = useCallback((next: FormDefinition) => {
    current.current = next;
    setDefState(next);
    setHist({ past: past.current.length, future: future.current.length });
  }, []);

  const commit = useCallback(
    (next: FormDefinition, key = "") => {
      if (readOnly) return;
      const cur = current.current;
      if (next === cur) return;
      const now = Date.now();
      // Typing in one box counts as one change for undo.
      if (!(key && lastKey.current.key === key && now - lastKey.current.at < 900)) {
        past.current.push(cur);
        if (past.current.length > 80) past.current.shift();
      }
      lastKey.current = { key, at: now };
      future.current = [];
      show(next);
      setDirty(true);
      setMsg({});
    },
    [readOnly, show],
  );
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(current.current);
    lastKey.current = { key: "", at: 0 };
    show(prev);
    setDirty(true);
  }, [show]);
  const redo = useCallback(() => {
    const nxt = future.current.pop();
    if (!nxt) return;
    past.current.push(current.current);
    show(nxt);
    setDirty(true);
  }, [show]);

  // Keep the open step valid (after undo, deleting a step and so on).
  const step = def.steps.find((s) => s.id === stepId) ?? def.steps[0];

  // ---------------------------------------------------------------- saving
  const first = useRef(true);
  function save() {
    start(async () => {
      const r = await saveForm(form.id, { name, definition: def, tags, stageId, redirectUrl });
      setMsg(r.error ? r : { ok: "All changes saved" });
      notify(r.error ? `Not saved: ${r.error}` : "Saved", r.error ? "bad" : "ok");
      if (!r.error) setDirty(false);
    });
  }
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!dirty || readOnly) return;
    const t = setTimeout(save, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, name, def, tags, stageId, redirectUrl]);

  function publish(next: "live" | "draft") {
    start(async () => {
      if (dirty) {
        const s = await saveForm(form.id, { name, definition: def, tags, stageId, redirectUrl });
        if (s.error) return setMsg(s);
        setDirty(false);
      }
      const r = await setFormStatus(form.id, next);
      setMsg(r);
      notify(r.error ?? (next === "live" ? "Published. The link and embed code are ready." : "Unpublished"), r.error ? "bad" : "ok");
      if (!r.error) {
        setStatus(next);
        if (next === "live") setTab("share");
      }
    });
  }

  // ---------------------------------------------------------------- keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.closest("input, textarea, select, [contenteditable=true]");
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y" && !typing) {
        e.preventDefault();
        redo();
      } else if (tab === "design" && !typing && selected && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        if (findBlock(def, selected)) commit(removeBlock(def, selected));
        else commit(removeRow(def, selected));
        setSelected(null);
      } else if (tab === "design" && mod && e.key.toLowerCase() === "d" && selected && !typing) {
        e.preventDefault();
        const r = findBlock(def, selected) ? duplicateBlock(def, selected) : duplicateRow(def, selected);
        commit(r.def);
        if (r.select) setSelected(r.select);
      } else if (e.key === "Escape") {
        setSelected(null);
        setPreview(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, selected, def, undo, redo, commit]);

  // ---------------------------------------------------------------- canvas handlers
  const onDrop = (target: Target) => {
    if (!drag) return;
    const r = drop(def, drag, target);
    commit(r.def);
    if (r.select) setSelected(r.select);
    setDrag(null);
  };
  const onAdd = (d: Drag) => {
    const r = addByClick(def, d, step.id, selected);
    commit(r.def);
    if (r.select) setSelected(r.select);
    setPanel("none");
  };

  const problem = publishProblem(def);
  const [slug, setSlug] = useState(form.slug);
  const link = workspaceSlug && slug ? `${base}/f/${workspaceSlug}/${slug}` : `${base}/f/${form.id}`;
  const saveSlug = (next: string) =>
    new Promise<{ error?: string; ok?: string }>((resolve) =>
      start(async () => {
        const r = await saveForm(form.id, { name, definition: def, tags, stageId, redirectUrl, slug: next });
        if (!r.error) {
          setSlug(next);
          setDirty(false);
        }
        notify(r.error ?? "Link updated", r.error ? "bad" : "ok");
        resolve(r.error ? r : { ok: "Link updated" });
      }),
    );
  const fieldsCount = allFields(def).length;

  // ---------------------------------------------------------------- render
  const tabBtn = (t: Tab, label: string, count?: number) => (
    <button
      key={t}
      type="button"
      onClick={() => setTab(t)}
      className={`relative inline-flex min-h-10 items-center gap-1.5 px-3 text-[13.5px] font-semibold transition-colors ${tab === t ? "text-navy" : "text-muted hover:text-navy"}`}
    >
      {label}
      {count !== undefined && <span className="rounded-full bg-chip px-1.5 text-[11px] text-brand">{count}</span>}
      {tab === t && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
    </button>
  );

  return (
    <div className="flex w-full min-w-0 flex-col overflow-x-clip">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3 sm:px-6">
          <Link href="/forms" className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-surface" aria-label="Back to forms">
            <Icon name="arrowLeft" size={17} />
          </Link>
          <span className="hidden items-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,#0a3fa6,#0a5fe3_60%,#29b0f8)] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white sm:inline-flex">
            <Icon name="file" size={12} /> Form Studio
          </span>
          <input
            value={name}
            disabled={readOnly}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
            maxLength={80}
            className="min-w-0 flex-[1_1_200px] rounded-lg bg-transparent px-2 py-1 text-[19px] font-semibold tracking-[-0.02em] outline-none hover:bg-surface focus:bg-surface focus:ring-2 focus:ring-sky/40"
            aria-label="Form name"
          />
          <span className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold ${status === "live" ? "bg-ok-bg text-ok" : "bg-surface text-muted"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status === "live" ? "bg-ok" : "bg-faint"}`} /> {status === "live" ? "Live" : "Draft"}
          </span>
          <span className={`hidden text-[12px] md:inline ${msg.error ? "text-bad" : "text-muted"}`}>{pending ? "Saving…" : msg.error ?? msg.ok ?? (dirty ? "Saving automatically…" : "")}</span>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setPreview(true)} className="btn-ghost inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-[13.5px] font-semibold">
              <Icon name="eye" size={15} /> Preview
            </button>
            {canEdit &&
              (status === "live" ? (
                <button type="button" onClick={() => publish("draft")} disabled={pending} className="btn-ghost inline-flex min-h-10 items-center rounded-xl px-3.5 text-[13.5px] font-semibold">
                  Unpublish
                </button>
              ) : (
                <button type="button" onClick={() => publish("live")} disabled={pending || Boolean(problem)} title={problem ?? undefined} className="btn-primary inline-flex min-h-10 items-center gap-2 rounded-xl px-5 text-[13.5px] font-semibold disabled:opacity-60">
                  <Icon name="globe" size={15} /> Publish
                </button>
              ))}
          </div>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto px-3 sm:px-5">
          {tabBtn("design", "Design")}
          {tabBtn("settings", "After submitting")}
          {tabBtn("share", "Share and embed")}
          {tabBtn("submissions", "Submissions", submissions.length)}
        </div>
      </div>
      {msg.error && <p className="mx-4 mt-3 rounded-xl bg-bad-bg px-4 py-2.5 text-[13px] text-bad sm:mx-6 md:hidden">{msg.error}</p>}
      {problem && status !== "live" && tab === "design" && (
        <p className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-warn-bg px-4 py-2.5 text-[13px] text-warn sm:mx-6">
          <Icon name="warning" size={14} /> {problem}
        </p>
      )}

      {tab === "design" && (
        <div className="relative flex h-[calc(100vh-86px-var(--chrome-h,64px))] min-h-[560px] overflow-hidden">
          {/* Left: elements */}
          <aside className={`${panel === "add" ? "absolute inset-y-0 left-0 z-20 flex shadow-2xl" : "hidden"} w-[264px] flex-none flex-col border-r border-line bg-[#f8fafd] lg:static lg:flex lg:shadow-none`}>
            <div className="flex items-center justify-between px-4 pt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
              Add to form
              <button type="button" onClick={() => setPanel("none")} className="lg:hidden" aria-label="Close">
                <Icon name="x" size={15} />
              </button>
            </div>
            <Palette def={def} customFields={customFields} readOnly={readOnly} onDragStart={(d) => setDrag(d)} onDragEnd={() => setDrag(null)} onAdd={onAdd} />
          </aside>

          {/* Middle: canvas */}
          <section className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-none flex-wrap items-center gap-2 border-b border-line bg-white px-3 py-2">
              <button type="button" onClick={() => setPanel(panel === "add" ? "none" : "add")} className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold lg:hidden">
                <Icon name="plus" size={14} /> Add
              </button>
              <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                {def.steps.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setStepId(s.id);
                      setSelected(null);
                    }}
                    onDragOver={(e) => {
                      if (drag?.t === "block") {
                        e.preventDefault();
                      }
                    }}
                    onDrop={(e) => {
                      if (drag?.t !== "block") return;
                      e.preventDefault();
                      commit(moveBlockToStep(def, drag.id, s.id));
                      setDrag(null);
                    }}
                    title={drag?.t === "block" ? `Drop to move to ${s.title}` : s.title}
                    className={`inline-flex min-h-9 flex-none items-center gap-2 rounded-xl px-3 text-[13px] font-semibold transition-colors ${s.id === step.id ? "bg-navy text-white" : drag?.t === "block" ? "bg-chip text-brand ring-1 ring-brand/40" : "text-muted hover:bg-surface"}`}
                  >
                    <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-md text-[11px] ${s.id === step.id ? "bg-white/20" : "bg-surface"}`}>{i + 1}</span>
                    <span className="max-w-[140px] truncate">{s.title}</span>
                  </button>
                ))}
                {canEdit && def.steps.length < 10 && (
                  <button
                    type="button"
                    onClick={() => {
                      const r = addStep(def);
                      commit(r.def);
                      setStepId(r.step);
                      setSelected(null);
                    }}
                    title="Add a step (makes this a multi-step form)"
                    className="inline-flex min-h-9 flex-none items-center gap-1 rounded-xl px-2.5 text-[12.5px] font-semibold text-brand hover:bg-chip"
                  >
                    <Icon name="plus" size={13} /> Step
                  </button>
                )}
              </div>
              <div className="flex items-center gap-0.5 rounded-xl bg-surface p-0.5">
                <button type="button" onClick={undo} disabled={!hist.past} title="Undo (Ctrl+Z)" aria-label="Undo" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-navy hover:bg-white disabled:opacity-30">
                  <Icon name="undo" size={15} />
                </button>
                <button type="button" onClick={redo} disabled={!hist.future} title="Redo (Ctrl+Shift+Z)" aria-label="Redo" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-navy hover:bg-white disabled:opacity-30">
                  <Icon name="redo" size={15} />
                </button>
              </div>
              <div className="flex items-center gap-0.5 rounded-xl bg-surface p-0.5">
                {(["desktop", "mobile"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDevice(d)}
                    title={d === "desktop" ? "Desktop view" : "Phone view"}
                    aria-label={d === "desktop" ? "Desktop view" : "Phone view"}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${device === d ? "bg-white text-brand shadow-sm" : "text-muted"}`}
                  >
                    <Icon name={d === "desktop" ? "monitor" : "smartphone"} size={15} />
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setPanel(panel === "settings" ? "none" : "settings")} className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold xl:hidden">
                <Icon name="settings" size={14} /> {selected ? "Edit" : "Style"}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <Canvas
                def={def}
                step={step}
                device={device}
                selected={selected}
                drag={drag}
                readOnly={readOnly}
                onSelect={(id) => {
                  setSelected(id);
                  if (id && window.innerWidth < 1280) setPanel("settings");
                }}
                onDragStart={setDrag}
                onDragEnd={() => setDrag(null)}
                onDrop={onDrop}
                onRowAction={(id, a) => {
                  if (a === "delete") {
                    commit(removeRow(def, id));
                    setSelected(null);
                  } else if (a === "duplicate") {
                    const r = duplicateRow(def, id);
                    commit(r.def);
                    if (r.select) setSelected(r.select);
                  } else if (a === "up" || a === "down") commit(moveRowBy(def, id, a === "up" ? -1 : 1));
                  else commit(setColumns(def, id, Number(a.slice(4))));
                }}
                onBlockAction={(id, a) => {
                  if (a === "delete") {
                    commit(removeBlock(def, id));
                    setSelected(null);
                  } else {
                    const r = duplicateBlock(def, id);
                    commit(r.def);
                    if (r.select) setSelected(r.select);
                  }
                }}
              />
            </div>
            <div className="flex flex-none items-center justify-between gap-3 border-t border-line bg-white px-4 py-1.5 text-[11.5px] text-faint">
              <span>
                {fieldsCount} question{fieldsCount === 1 ? "" : "s"} · {def.steps.length} step{def.steps.length === 1 ? "" : "s"}
              </span>
              <span className="hidden sm:inline">Drag to rearrange · Del removes · Ctrl+D duplicates · Ctrl+Z undoes</span>
            </div>
          </section>

          {/* Right: settings */}
          <aside className={`${panel === "settings" ? "absolute inset-y-0 right-0 z-20 flex shadow-2xl" : "hidden"} w-[320px] flex-none flex-col border-l border-line bg-white xl:static xl:flex xl:shadow-none`}>
            <div className="flex justify-end px-2 pt-2 xl:hidden">
              <button type="button" onClick={() => setPanel("none")} aria-label="Close" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface">
                <Icon name="x" size={15} />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <Inspector
                def={def}
                selected={selected}
                stepId={step.id}
                customFields={customFields}
                readOnly={readOnly}
                onDeselect={() => setSelected(null)}
                onBlock={(id, patch) => commit(updateBlock(def, id, patch as Partial<Block>), `b:${id}:${Object.keys(patch).join(",")}`)}
                onDef={(patch) => commit({ ...def, ...patch }, `d:${Object.keys(patch).join(",")}`)}
                onTheme={(patch: Partial<Theme>) => commit({ ...def, theme: { ...def.theme, ...patch } }, `t:${Object.keys(patch).join(",")}`)}
                onAction={(a) => {
                  if (a.t === "block-dup") {
                    const r = duplicateBlock(def, a.id);
                    commit(r.def);
                    if (r.select) setSelected(r.select);
                  } else if (a.t === "block-del") {
                    commit(removeBlock(def, a.id));
                    setSelected(null);
                  } else if (a.t === "row-dup") {
                    const r = duplicateRow(def, a.id);
                    commit(r.def);
                    if (r.select) setSelected(r.select);
                  } else if (a.t === "row-del") {
                    commit(removeRow(def, a.id));
                    setSelected(null);
                  } else if (a.t === "col-del") {
                    commit(removeColumn(def, a.id));
                    setSelected(null);
                  } else if (a.t === "cols") commit(setColumns(def, a.id, a.n));
                  else if (a.t === "block-step") {
                    commit(moveBlockToStep(def, a.id, a.step));
                    setStepId(a.step);
                  }
                }}
                onSteps={(a) => {
                  if (a.t === "add") {
                    const r = addStep(def);
                    commit(r.def);
                    setStepId(r.step);
                  } else if (a.t === "rename") commit({ ...def, steps: def.steps.map((s) => (s.id === a.id ? { ...s, title: a.title } : s)) }, `s:${a.id}`);
                  else if (a.t === "del") {
                    const s = def.steps.find((x) => x.id === a.id);
                    const n = s ? s.rows.reduce((m, r) => m + r.columns.reduce((k, c) => k + c.blocks.length, 0), 0) : 0;
                    if (n && !confirm(`Delete "${s?.title}" and the ${n} item${n === 1 ? "" : "s"} on it?`)) return;
                    commit(removeStep(def, a.id));
                    if (step.id === a.id) setStepId(def.steps.find((x) => x.id !== a.id)!.id);
                  } else if (a.t === "move") commit(moveStep(def, a.id, a.dir));
                  else setStepId(a.id);
                }}
              />
            </div>
          </aside>
        </div>
      )}

      {tab === "settings" && (
        <AfterSubmit
          def={def}
          commit={commit}
          readOnly={readOnly}
          tags={tags}
          setTags={(t) => {
            setTags(t);
            setDirty(true);
          }}
          allTags={allTags}
          stageId={stageId}
          setStageId={(v) => {
            setStageId(v);
            setDirty(true);
          }}
          stages={stages}
          pipelines={pipelines}
          redirectUrl={redirectUrl}
          setRedirectUrl={(v) => {
            setRedirectUrl(v);
            setDirty(true);
          }}
          onDuplicate={() => start(() => duplicateForm(form.id))}
          onDelete={() => {
            if (confirm(`Delete "${name}" and its ${submissions.length} submission${submissions.length === 1 ? "" : "s"}? This can't be undone.`)) start(() => deleteForm(form.id));
          }}
          canDelete={canEdit}
        />
      )}
      {tab === "share" && (
        <Share
          link={link}
          base={base}
          linkPrefix={workspaceSlug ? `${base}/f/${workspaceSlug}/` : ""}
          slug={slug}
          onSaveSlug={saveSlug}
          formId={form.id}
          live={status === "live"}
          healthProblem={healthProblem}
          accent={def.theme.accent}
          def={def}
          commit={commit}
          readOnly={readOnly}
        />
      )}
      {tab === "submissions" && <Submissions submissions={submissions} name={name} qualify={def.qualify.enabled} views={views} />}

      {preview &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex flex-col bg-ink/60 backdrop-blur-sm">
            <div className="flex flex-none items-center gap-3 bg-white px-4 py-2.5">
              <span className="text-[14px] font-semibold">Preview</span>
              <span className="text-[12.5px] text-muted">Try it like a visitor would. Nothing is sent.</span>
              <div className="ml-auto flex items-center gap-0.5 rounded-xl bg-surface p-0.5">
                {(["desktop", "mobile"] as const).map((d) => (
                  <button key={d} type="button" onClick={() => setDevice(d)} aria-label={d} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${device === d ? "bg-white text-brand shadow-sm" : "text-muted"}`}>
                    <Icon name={d === "desktop" ? "monitor" : "smartphone"} size={15} />
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setPreview(false)} className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold">
                <Icon name="x" size={14} /> Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-8" style={{ background: def.theme.background }}>
              <div
                className="mx-auto"
                style={{
                  maxWidth: device === "mobile" ? 375 : def.theme.width,
                  ...(def.theme.card ? { background: def.theme.dark ? "#111c33" : "#fff", borderRadius: Math.max(def.theme.radius + 6, 14), padding: device === "mobile" ? "24px 18px" : "32px 28px", boxShadow: "0 24px 60px -24px rgba(11,27,58,0.28)" } : {}),
                }}
              >
                <LeadForm key={JSON.stringify(def).length} formId={form.id} def={def} preview />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// After submitting
// ---------------------------------------------------------------------------

function AfterSubmit({
  def,
  commit,
  readOnly,
  tags,
  setTags,
  allTags,
  stageId,
  setStageId,
  stages,
  pipelines,
  redirectUrl,
  setRedirectUrl,
  onDelete,
  onDuplicate,
  canDelete,
}: {
  def: FormDefinition;
  commit: (d: FormDefinition, key?: string) => void;
  readOnly: boolean;
  tags: string[];
  setTags: (t: string[]) => void;
  allTags: string[];
  stageId: string | null;
  setStageId: (v: string | null) => void;
  stages: Stage[];
  pipelines: { id: string; name: string }[];
  redirectUrl: string;
  setRedirectUrl: (v: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  canDelete: boolean;
}) {
  const [mode, setMode] = useState<"message" | "redirect">(redirectUrl ? "redirect" : "message");
  const q = def.qualify;
  const setQ = (patch: Partial<typeof q>) => commit({ ...def, qualify: { ...q, ...patch } }, `q:${Object.keys(patch).join(",")}`);
  const maxScore = useMemo(
    () => allFields(def).reduce((n, f) => n + (f.scores?.length ? (f.kind === "checkboxes" ? f.scores.filter((s) => s > 0).reduce((a, b) => a + b, 0) : Math.max(0, ...f.scores)) : 0), 0),
    [def],
  );
  const outcomeEditor = (label: string, o: Outcome, set: (o: Outcome) => void, tone: string) => (
    <div className={`flex flex-col gap-2 rounded-xl border p-3 ${tone}`}>
      <div className="text-[13px] font-semibold">{label}</div>
      <textarea value={o.message} maxLength={400} rows={2} onChange={(e) => set({ ...o, message: e.target.value })} className="field bg-white py-2 text-[13px]" placeholder="Message they see" />
      <input value={o.redirect} onChange={(e) => set({ ...o, redirect: e.target.value.trim() })} className="field h-10 bg-white text-[13px]" placeholder="Or send them to a page: https://…" />
      <input value={o.tag} maxLength={40} onChange={(e) => set({ ...o, tag: e.target.value })} className="field h-10 bg-white text-[13px]" placeholder="Tag to add, e.g. Qualified" />
    </div>
  );

  return (
    <fieldset disabled={readOnly} className="mx-auto grid w-full max-w-[820px] gap-4 px-4 py-6 sm:px-6">
      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-[15px] font-semibold">What they see next</h2>
        <div className="flex flex-wrap gap-2">
          {(["message", "redirect"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                if (m === "message") setRedirectUrl("");
              }}
              className={`rounded-xl px-3.5 py-2 text-[13.5px] font-semibold ring-1 ${mode === m ? "bg-navy text-white ring-navy" : "bg-white text-muted ring-line"}`}
            >
              {m === "message" ? "A thank-you message" : "Send them to a page"}
            </button>
          ))}
        </div>
        {mode === "message" ? (
          <textarea value={def.success} maxLength={400} rows={3} onChange={(e) => commit({ ...def, success: e.target.value }, "success")} className="field py-2.5" aria-label="Thank-you message" />
        ) : (
          <input value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value.trim())} placeholder="https://yoursite.co.uk/thank-you" className="field h-11" aria-label="Thank-you page address" />
        )}
      </section>

      <section className="card flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold">Qualify by score</h2>
            <p className="text-[12.5px] text-muted">Give answers points in Design. People at or above the pass mark are qualified; everyone else gets a different message, page and tag.</p>
          </div>
          <button type="button" onClick={() => setQ({ enabled: !q.enabled })} className={`inline-flex h-6 w-11 flex-none items-center rounded-full p-0.5 transition-colors ${q.enabled ? "bg-brand" : "bg-line-strong"}`} aria-label="Qualify by score">
            <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${q.enabled ? "translate-x-5" : ""}`} />
          </button>
        </div>
        {q.enabled && (
          <>
            <label className="flex flex-wrap items-center gap-2 text-[13.5px]">
              Pass mark
              <input type="number" value={q.min} onChange={(e) => setQ({ min: Math.round(Number(e.target.value) || 0) })} className="field h-10 w-24 text-center" />
              <span className="text-muted">points{maxScore ? ` (top score possible: ${maxScore})` : " (no answers have points yet)"}</span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {outcomeEditor("Qualified", q.qualified, (o) => setQ({ qualified: o }), "border-ok/30 bg-ok-bg/40")}
              {outcomeEditor("Not a fit", q.unqualified, (o) => setQ({ unqualified: o }), "border-line bg-surface/60")}
            </div>
          </>
        )}
      </section>

      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-[15px] font-semibold">Tag everyone who fills it in</h2>
        <TagsInput value={tags} onChange={setTags} suggestions={allTags} inline placeholder="Type a tag and press Enter, e.g. AI audit" />
      </section>

      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-[15px] font-semibold">Add them to a pipeline</h2>
        <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px]">
          <input type="checkbox" checked={Boolean(stageId)} onChange={(e) => setStageId(e.target.checked ? (stages[0]?.id ?? null) : null)} disabled={!stages.length} className="h-4 w-4 accent-[#0a5fe3]" />
          Create a deal for each submission
        </label>
        {stageId && <StagePicker stages={stages} pipelines={pipelines} value={stageId} onChange={(v) => setStageId(v.stageId || null)} />}
        <p className="text-[12.5px] text-muted">If they already have an open deal in that pipeline, we keep it rather than adding another.</p>
      </section>

      <section className="card flex flex-col gap-3 p-5">
        <div>
          <h2 className="text-[15px] font-semibold">Tell your team</h2>
          <p className="text-[12.5px] text-muted">Every submission, with the answers, straight away.</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px]">
          <input type="checkbox" checked={def.notify.chat} onChange={(e) => commit({ ...def, notify: { ...def.notify, chat: e.target.checked } })} className="h-4 w-4 accent-[#0a5fe3]" />
          Post it in the #leads team chat
        </label>
        <EmailList value={def.notify.emails} onChange={(emails) => commit({ ...def, notify: { ...def.notify, emails } }, "notify-emails")} />
      </section>

      <section className="card flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold">Email them a confirmation</h2>
            <p className="text-[12.5px] text-muted">Sent to the person who filled it in. In test mode it goes to your test inbox instead.</p>
          </div>
          <button type="button" onClick={() => commit({ ...def, confirm: { ...def.confirm, enabled: !def.confirm.enabled } })} className={`inline-flex h-6 w-11 flex-none items-center rounded-full p-0.5 transition-colors ${def.confirm.enabled ? "bg-brand" : "bg-line-strong"}`} aria-label="Email them a confirmation">
            <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${def.confirm.enabled ? "translate-x-5" : ""}`} />
          </button>
        </div>
        {def.confirm.enabled && (
          <>
            <input value={def.confirm.subject} maxLength={150} onChange={(e) => commit({ ...def, confirm: { ...def.confirm, subject: e.target.value } }, "confirm-subject")} className="field h-10 text-[13.5px]" aria-label="Subject" placeholder="Subject" />
            <textarea value={def.confirm.body} maxLength={5000} rows={6} onChange={(e) => commit({ ...def, confirm: { ...def.confirm, body: e.target.value } }, "confirm-body")} className="field py-2.5 text-[13.5px]" aria-label="Email" />
            <p className="text-[12px] text-muted">
              You can use {"{{first_name}}"}, {"{{last_name}}"}, {"{{name}}"}, {"{{email}}"}, {"{{phone}}"} and {"{{form_name}}"}. Only sent if the form asks for an email.
            </p>
          </>
        )}
      </section>

      <section className="card flex flex-col gap-2 p-5">
        <h2 className="text-[15px] font-semibold">Start a workflow</h2>
        <p className="text-[13.5px] text-muted">
          Create a workflow with the trigger <strong className="text-navy">Form submitted</strong> and choose this form. Use If / else on the Qualified or Not a fit tag to follow each group up differently.
        </p>
        <Link href="/workflows" className="inline-flex w-fit items-center gap-1.5 text-[13.5px] font-semibold text-brand hover:underline">
          Go to workflows <Icon name="arrowRight" size={14} />
        </Link>
      </section>

      {canDelete && (
        <section className="card flex flex-wrap items-center gap-3 p-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold">Duplicate this form</h2>
            <p className="text-[13px] text-muted">A draft copy with the same questions, style and settings, to change for another offer or client.</p>
          </div>
          <button type="button" onClick={onDuplicate} className="btn-ghost inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-[13.5px] font-semibold">
            <Icon name="copy" size={14} /> Duplicate
          </button>
        </section>
      )}
      {canDelete && (
        <section className="card flex flex-wrap items-center gap-3 p-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold">Delete this form</h2>
            <p className="text-[13px] text-muted">Its link stops working and its submissions are removed. The contacts it created stay.</p>
          </div>
          <button type="button" onClick={onDelete} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-[13.5px] font-semibold text-bad ring-1 ring-bad/30 hover:bg-bad-bg">
            <Icon name="trash" size={14} /> Delete form
          </button>
        </section>
      )}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Share and embed
// ---------------------------------------------------------------------------

function EmailList({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const [bad, setBad] = useState(false);
  const add = () => {
    const e = draft.trim().toLowerCase();
    if (!e) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return setBad(true);
    if (!value.includes(e) && value.length < 5) onChange([...value, e]);
    setDraft("");
    setBad(false);
  };
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13.5px]">Email these people (up to 5)</span>
      <div className="flex flex-wrap gap-1.5">
        {value.map((e) => (
          <span key={e} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-chip pl-3 pr-1.5 text-[12.5px] font-semibold text-brand">
            {e}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== e))} aria-label={`Remove ${e}`} className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-white">
              <Icon name="x" size={11} />
            </button>
          </span>
        ))}
      </div>
      {value.length < 5 && (
        <div className="flex flex-wrap gap-2">
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setBad(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="name@company.co.uk"
            className={`field h-10 min-w-0 flex-[1_1_220px] text-[13.5px] ${bad ? "ring-2 ring-bad/40" : ""}`}
            aria-label="Email address to notify"
          />
          <button type="button" onClick={add} className="btn-ghost inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold">
            <Icon name="plus" size={14} /> Add
          </button>
        </div>
      )}
      {bad && <span className="text-[12.5px] text-bad">That doesn&apos;t look like an email address.</span>}
    </div>
  );
}

type EmbedMode = "inline" | "popup" | "slide" | "iframe";
type EmbedTrigger = "button" | "load" | "delay" | "scroll" | "exit";

function Share({
  link,
  base,
  linkPrefix,
  slug,
  onSaveSlug,
  formId,
  live,
  healthProblem,
  accent,
  def,
  commit,
  readOnly,
}: {
  link: string;
  base: string;
  linkPrefix: string;
  slug: string;
  onSaveSlug: (s: string) => Promise<{ error?: string; ok?: string }>;
  formId: string;
  live: boolean;
  healthProblem?: string;
  accent: string;
  def: FormDefinition;
  commit: (d: FormDefinition, key?: string) => void;
  readOnly: boolean;
}) {
  const [copied, setCopied] = useState("");
  const [utm, setUtm] = useState("");
  const [slugDraft, setSlugDraft] = useState(slug);
  const [slugMsg, setSlugMsg] = useState<{ error?: string; ok?: string }>({});
  const [mode, setMode] = useState<EmbedMode>("inline");
  const [trigger, setTrigger] = useState<EmbedTrigger>("button");
  const [delay, setDelay] = useState(5);
  const [scroll, setScroll] = useState(50);
  const [button, setButton] = useState("Get in touch");
  const [once, setOnce] = useState(true);
  const tracked = utm.trim() ? `${link}?utm_source=${encodeURIComponent(utm.trim().toLowerCase())}` : link;

  const attrs = [`src="${base}/api/forms/embed"`, `data-form="${formId}"`];
  if (mode === "popup" || mode === "slide") {
    attrs.push(`data-mode="${mode}"`, `data-trigger="${trigger}"`);
    if (trigger === "button") attrs.push(`data-button="${button.replace(/"/g, "&quot;")}"`, `data-color="${accent}"`);
    if (trigger === "delay") attrs.push(`data-delay="${delay}"`);
    if (trigger === "scroll") attrs.push(`data-scroll="${scroll}"`);
    if (trigger !== "button" && once) attrs.push(`data-once="true"`);
  }
  const embed =
    mode === "iframe"
      ? `<iframe src="${base}/f/${formId}?embed=1" title="Form" style="width:100%;min-height:640px;border:0" loading="lazy"></iframe>`
      : `<script ${attrs.join(" ")} async></script>`;

  const copy = async (t: string, what: string) => {
    try {
      await navigator.clipboard.writeText(t);
      setCopied(what);
      setTimeout(() => setCopied(""), 1800);
    } catch {}
  };
  const tr = def.tracking;
  const choice = (on: boolean) => `rounded-xl px-3 py-2 text-[13px] font-semibold ring-1 ${on ? "bg-navy text-white ring-navy" : "bg-white text-muted ring-line hover:text-navy"}`;

  return (
    <div className="mx-auto grid w-full max-w-[860px] gap-4 px-4 py-6 sm:px-6">
      {healthProblem && <p className="rounded-xl border border-bad/30 bg-bad-bg px-4 py-3 text-[13.5px] text-bad">{healthProblem}</p>}
      {!live && (
        <p className="rounded-xl bg-warn-bg px-4 py-3 text-[13.5px] text-warn">
          This form is a draft, so the link and embed show &ldquo;not available&rdquo; until you press <strong>Publish</strong>.
        </p>
      )}
      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-[15px] font-semibold">Link</h2>
        <p className="text-[13px] text-muted">Use it in bio links, emails, ads and QR codes. Add where you&apos;re sharing it, and every lead shows its source.</p>
        <div className="flex flex-wrap items-center gap-2">
          <input value={utm} onChange={(e) => setUtm(e.target.value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 30))} placeholder="Where? e.g. instagram" className="field h-10 w-[200px] text-[13px]" aria-label="Source" />
          <code className="min-w-0 flex-1 truncate rounded-xl bg-surface px-3 py-2.5 text-[13px] ring-1 ring-line">{tracked}</code>
          <button type="button" onClick={() => copy(tracked, "link")} className="btn-ghost inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold">
            <Icon name={copied === "link" ? "check" : "copy"} size={14} /> {copied === "link" ? "Copied" : "Copy"}
          </button>
          <a href={tracked} target="_blank" rel="noreferrer" className="btn-ghost inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold">
            <Icon name="globe" size={14} /> Open
          </a>
        </div>
        {linkPrefix && !readOnly && (
          <div className="flex flex-col gap-1.5 border-t border-line pt-3">
            <span className="text-[13px] font-semibold">Link name</span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-[13px] text-muted">{linkPrefix}</span>
              <input
                value={slugDraft}
                onChange={(e) => {
                  setSlugDraft(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-").slice(0, 60));
                  setSlugMsg({});
                }}
                className="field h-10 w-[220px] text-[13px]"
                aria-label="Link name"
              />
              <button
                type="button"
                disabled={!slugDraft || slugDraft === slug}
                onClick={async () => setSlugMsg(await onSaveSlug(slugDraft.replace(/^-+|-+$/g, "")))}
                className="btn-ghost inline-flex min-h-10 items-center rounded-xl px-3.5 text-[13px] font-semibold disabled:opacity-50"
              >
                Save link
              </button>
            </div>
            {slugMsg.error && <span className="text-[12.5px] text-bad">{slugMsg.error}</span>}
            {slugMsg.ok && <span className="text-[12.5px] text-ok">{slugMsg.ok}. The old link stops working.</span>}
          </div>
        )}
      </section>

      <section className="card flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-[15px] font-semibold">Put it on a website</h2>
          <p className="text-[13px] text-muted">Choose how it shows, copy the code and paste it into WordPress (Custom HTML block), Webflow (Embed), Wix (Embed code), Framer, Shopify, Squarespace (Code block) or any site.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["inline", "On the page"],
              ["popup", "Popup"],
              ["slide", "Slide-in (corner)"],
              ["iframe", "Plain iframe"],
            ] as const
          ).map(([m, t]) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={choice(mode === m)}>
              {t}
            </button>
          ))}
        </div>
        {(mode === "popup" || mode === "slide") && (
          <div className="grid gap-3 rounded-xl bg-surface/70 p-3.5">
            <span className="text-[13px] font-semibold">Opens when</span>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["button", "They click a button"],
                  ["load", "The page loads"],
                  ["delay", "After a few seconds"],
                  ["scroll", "They scroll down"],
                  ["exit", "They're about to leave"],
                ] as const
              ).map(([k, t]) => (
                <button key={k} type="button" onClick={() => setTrigger(k)} className={choice(trigger === k)}>
                  {t}
                </button>
              ))}
            </div>
            {trigger === "button" && (
              <label className="flex flex-wrap items-center gap-2 text-[13px]">
                Button text
                <input value={button} maxLength={40} onChange={(e) => setButton(e.target.value)} className="field h-10 w-[220px] text-[13px]" />
              </label>
            )}
            {trigger === "delay" && (
              <label className="flex flex-wrap items-center gap-2 text-[13px]">
                After
                <input type="number" min={0} max={120} value={delay} onChange={(e) => setDelay(Math.max(0, Math.min(120, Math.round(Number(e.target.value) || 0))))} className="field h-10 w-20 text-center text-[13px]" />
                seconds
              </label>
            )}
            {trigger === "scroll" && (
              <label className="flex flex-wrap items-center gap-2 text-[13px]">
                When they&apos;ve scrolled
                <input type="number" min={1} max={100} value={scroll} onChange={(e) => setScroll(Math.max(1, Math.min(100, Math.round(Number(e.target.value) || 50))))} className="field h-10 w-20 text-center text-[13px]" />
                % of the page
              </label>
            )}
            {trigger !== "button" && (
              <label className="flex cursor-pointer items-center gap-2.5 text-[13px]">
                <input type="checkbox" checked={once} onChange={(e) => setOnce(e.target.checked)} className="h-4 w-4 accent-[#0a5fe3]" />
                Show it at most once to each visitor
              </label>
            )}
            <p className="text-[12px] text-muted">
              Want your own button or link to open it? Add <code className="rounded bg-white px-1">data-scalency-open=&quot;{formId}&quot;</code> to it.
            </p>
          </div>
        )}
        <textarea readOnly value={embed} rows={mode === "iframe" ? 3 : 4} className="field py-2.5 font-mono text-[11.5px]" onFocus={(e) => e.currentTarget.select()} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => copy(embed, "embed")} className="btn-primary inline-flex min-h-10 w-fit items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold">
            <Icon name={copied === "embed" ? "check" : "copy"} size={14} /> {copied === "embed" ? "Copied" : "Copy code"}
          </button>
          <span className="text-[12px] text-muted">{mode === "iframe" ? "For site builders that don't allow scripts. It won't resize itself." : "Resizes itself and passes the page's UTM tags through."}</span>
        </div>
      </section>

      <fieldset disabled={readOnly} className="card flex flex-col gap-3 p-5">
        <div>
          <h2 className="text-[15px] font-semibold">Tracking</h2>
          <p className="text-[13px] text-muted">Fires a page view when the form opens and a Lead event when it&apos;s sent, on the link and in embeds.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Meta (Facebook) Pixel ID
            <input value={tr.fbPixel} onChange={(e) => commit({ ...def, tracking: { ...tr, fbPixel: e.target.value.replace(/\D/g, "").slice(0, 20) } }, "fb")} placeholder="e.g. 1234567890123456" className="field h-10 font-normal" />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Google tag ID
            <input value={tr.googleTag} onChange={(e) => commit({ ...def, tracking: { ...tr, googleTag: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20) } }, "gtag")} placeholder="e.g. G-XXXXXXX or AW-XXXXXXX" className="field h-10 font-normal" />
          </label>
        </div>
      </fieldset>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

const STATUS_LOOK: Record<Submission["status"], { label: string; cls: string }> = {
  started: { label: "Started", cls: "bg-warn-bg text-warn" },
  submitted: { label: "Submitted", cls: "bg-chip text-brand" },
  qualified: { label: "Qualified", cls: "bg-ok-bg text-ok" },
  unqualified: { label: "Not a fit", cls: "bg-surface text-muted" },
};

function monthAgoIso() {
  return new Date(Date.now() - 30 * 86400000).toISOString();
}

function Submissions({ submissions, name, qualify, views }: { submissions: Submission[]; name: string; qualify: boolean; views: number }) {
  const [filter, setFilter] = useState<"all" | Submission["status"]>("all");
  const shown = submissions.filter((s) => filter === "all" || s.status === filter);
  const counts = submissions.reduce<Record<string, number>>((m, s) => ((m[s.status] = (m[s.status] ?? 0) + 1), m), {});

  function exportCsv() {
    const labels = [...new Set(shown.flatMap((s) => s.answers.map((a) => a.label)))];
    const head = ["Submitted", "Status", "Score", "Name", "Email", "Phone", "Source", ...labels];
    const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const lines = shown.map((s) =>
      [new Date(s.at).toISOString(), STATUS_LOOK[s.status].label, s.score ?? "", s.name, s.email, s.phone, s.source, ...labels.map((l) => s.answers.find((a) => a.label === l)?.value ?? "")].map((v) => esc(String(v))).join(","),
    );
    const blob = new Blob([[head.map(esc).join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "form"}-submissions.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const [monthAgo] = useState(monthAgoIso);
  const recent = submissions.filter((s) => s.at >= monthAgo);
  const finished = recent.filter((s) => s.status !== "started").length;
  const stat = (label: string, value: string, hint?: string) => (
    <div className="card flex flex-col gap-0.5 px-4 py-3">
      <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</span>
      <span className="text-[22px] font-semibold tracking-[-0.02em]">{value}</span>
      {hint && <span className="text-[12px] text-muted">{hint}</span>}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6">
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {stat("Views", String(views), "Last 30 days")}
        {stat("Sent", String(finished), "Last 30 days")}
        {stat("Conversion", views ? `${Math.min(100, Math.round((finished / views) * 1000) / 10)}%` : "–", "Sent ÷ views")}
        {stat("Stopped part way", String(recent.filter((s) => s.status === "started").length), "Saved as contacts")}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(["all", "submitted", ...(qualify ? (["qualified", "unqualified"] as const) : []), "started"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-xl px-3 py-1.5 text-[13px] font-semibold ring-1 ${filter === k ? "bg-navy text-white ring-navy" : "bg-white text-muted ring-line"}`}>
            {k === "all" ? "All" : STATUS_LOOK[k].label} <span className="opacity-70">{k === "all" ? submissions.length : (counts[k] ?? 0)}</span>
          </button>
        ))}
        <button type="button" onClick={exportCsv} disabled={!shown.length} className="btn-ghost ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold disabled:opacity-50">
          <Icon name="download" size={14} /> Export CSV
        </button>
      </div>
      <section className="card overflow-hidden">
        {shown.length === 0 ? (
          <p className="p-8 text-center text-[14px] text-muted">{submissions.length ? "Nothing here with this filter." : "No submissions yet. Once someone fills in the form, they show up here and in Contacts."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13.5px]">
              <thead className="bg-surface text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
                <tr>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Answers</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((s) => (
                  <tr key={s.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link href={`/contacts/${s.contactId}`} className="font-semibold text-brand hover:underline">{s.name}</Link>
                      <div className="text-[12.5px] text-muted">{[s.email, s.phone].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[11.5px] font-semibold ${STATUS_LOOK[s.status].cls}`}>{STATUS_LOOK[s.status].label}</span>
                      {s.score !== null && <div className="mt-1 text-[12px] text-muted">Score {s.score}</div>}
                    </td>
                    <td className="max-w-[380px] px-4 py-3">
                      <dl className="grid gap-0.5">
                        {s.answers
                          .filter((a) => !["First name", "Last name", "Email", "Phone", "Full name"].includes(a.label))
                          .slice(0, 6)
                          .map((a, i) => (
                            <div key={i} className="truncate">
                              <dt className="inline text-muted">{a.label}: </dt>
                              <dd className="inline">
                                {a.file ? (
                                  <a href={`/api/forms/file/${a.file}`} target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">
                                    {a.value}
                                  </a>
                                ) : (
                                  a.value
                                )}
                              </dd>
                            </div>
                          ))}
                      </dl>
                    </td>
                    <td className="px-4 py-3 text-muted">{s.source || "Direct"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(s.at))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
