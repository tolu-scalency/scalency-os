"use client";

// Page Studio: build a landing page by dragging sections, columns and blocks.
// Saves automatically; publish when it's ready.

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { notify } from "@/components/toast";
import { PageView } from "@/components/page-view";
import type { PageDefinition } from "@/lib/page-builder";
import { savePage, setSiteStatus } from "../../actions";
import { PageCanvas } from "./page-canvas";
import { PageInspector } from "./page-inspector";
import { PagePalette } from "./page-palette";
import {
  addByClick,
  drop,
  duplicateBlock,
  duplicateRow,
  duplicateSection,
  findBlock,
  findColumn,
  findRow,
  findSection,
  moveBlockBy,
  moveRowBy,
  moveSectionBy,
  removeBlock,
  removeColumn,
  removeRow,
  removeSection,
  setColumns,
  updateBlock,
  updateRow,
  updateSection,
  type Drag,
  type Target,
} from "./page-tree";

export type StudioSite = { id: string; name: string; slug: string; status: "draft" | "live" | "archived"; pageId: string; definition: PageDefinition };

export function PageStudio({ site, base, workspaceSlug, forms, canEdit }: { site: StudioSite; base: string; workspaceSlug: string; forms: { id: string; name: string }[]; canEdit: boolean }) {
  const readOnly = !canEdit;
  const [def, setDefState] = useState<PageDefinition>(site.definition);
  const [name, setName] = useState(site.name);
  const [slug, setSlug] = useState(site.slug);
  const [status, setStatus] = useState(site.status);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [panel, setPanel] = useState<"none" | "add" | "settings">("none");
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const link = `${base}/p/${workspaceSlug}/${slug}`;

  // ---------------------------------------------------------------- history
  const current = useRef<PageDefinition>(site.definition);
  const past = useRef<PageDefinition[]>([]);
  const future = useRef<PageDefinition[]>([]);
  const lastKey = useRef<{ key: string; at: number }>({ key: "", at: 0 });
  const [hist, setHist] = useState({ past: 0, future: 0 });
  const show = useCallback((next: PageDefinition) => {
    current.current = next;
    setDefState(next);
    setHist({ past: past.current.length, future: future.current.length });
  }, []);
  const commit = useCallback(
    (next: PageDefinition, key = "") => {
      if (readOnly) return;
      const cur = current.current;
      if (next === cur) return;
      const now = Date.now();
      if (!(key && lastKey.current.key === key && now - lastKey.current.at < 900)) {
        past.current.push(cur);
        if (past.current.length > 80) past.current.shift();
      }
      lastKey.current = { key, at: now };
      future.current = [];
      show(next);
      setDirty(true);
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

  // ---------------------------------------------------------------- saving
  const first = useRef(true);
  const save = useCallback(
    (extra?: { slug?: string }) =>
      new Promise<{ error?: string; ok?: string }>((resolve) =>
        start(async () => {
          const r = await savePage(site.id, { name, pageId: site.pageId, definition: current.current, ...(extra ?? {}) }).catch(() => ({ error: "We couldn't reach the server. Check your connection; your changes are kept here." }) as { error?: string; ok?: string });
          setMsg(r.error ? r : { ok: "All changes saved" });
          if (!extra) notify(r.error ? `Not saved: ${r.error}` : "Saved", r.error ? "bad" : "ok");
          if (!r.error) setDirty(false);
          resolve(r);
        }),
      ),
    [name, site.id, site.pageId],
  );
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!dirty || readOnly) return;
    const t = setTimeout(() => save(), 1200);
    return () => clearTimeout(t);
  }, [dirty, def, name, readOnly, save]);

  function publish(next: "live" | "draft") {
    start(async () => {
      if (dirty) {
        const s = await savePage(site.id, { name, pageId: site.pageId, definition: current.current }).catch(() => ({ error: "We couldn't reach the server." }) as { error?: string });
        if (s.error) return void notify(`Not saved: ${s.error}`, "bad");
        setDirty(false);
      }
      const r = await setSiteStatus(site.id, next).catch(() => ({ error: "We couldn't reach the server. Try again." }) as { error?: string; ok?: string });
      notify(r.error ?? r.ok ?? "Done", r.error ? "bad" : "ok");
      if (!r.error) setStatus(next);
    });
  }

  // ---------------------------------------------------------------- actions
  const remove = useCallback(
    (id: string) => {
      const d = current.current;
      if (findBlock(d, id)) commit(removeBlock(d, id));
      else if (findRow(d, id)) commit(removeRow(d, id));
      else if (findColumn(d, id)) commit(removeColumn(d, id));
      else if (findSection(d, id)) commit(removeSection(d, id));
      setSelected(null);
    },
    [commit],
  );
  const duplicate = useCallback(
    (id: string) => {
      const d = current.current;
      const r = findBlock(d, id) ? duplicateBlock(d, id) : findRow(d, id) ? duplicateRow(d, id) : findSection(d, id) ? duplicateSection(d, id) : null;
      if (!r) return;
      commit(r.def);
      if (r.select) setSelected(r.select);
    },
    [commit],
  );

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
      } else if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      } else if (!typing && selected && (e.key === "Delete" || e.key === "Backspace") && !readOnly) {
        e.preventDefault();
        remove(selected);
      } else if (mod && e.key.toLowerCase() === "d" && selected && !typing && !readOnly) {
        e.preventDefault();
        duplicate(selected);
      } else if (e.key === "Escape") {
        setSelected(null);
        setPreview(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, undo, redo, save, remove, duplicate, readOnly]);

  // Warn before closing with unsaved changes.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const onDrop = (target: Target) => {
    if (!drag) return;
    const r = drop(def, drag, target);
    commit(r.def);
    if (r.select) setSelected(r.select);
    setDrag(null);
  };
  const onAdd = (d: Drag) => {
    const r = addByClick(def, d, selected);
    commit(r.def);
    if (r.select) {
      setSelected(r.select);
      requestAnimationFrame(() => document.querySelector(`[data-sel="${r.select}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
    }
    setPanel("none");
  };

  const blocks = def.sections.reduce((n, s) => n + s.rows.reduce((m, r) => m + r.columns.reduce((k, c) => k + c.blocks.length, 0), 0), 0);

  return (
    <div className="-mx-4 -mt-6 flex flex-col sm:-mx-7 sm:-mt-8">
      <div className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 sm:px-5">
          <Link href="/funnels" className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-surface" aria-label="Back to pages">
            <Icon name="arrowLeft" size={17} />
          </Link>
          <span className="hidden items-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,#0a3fa6,#0a5fe3_60%,#29b0f8)] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white sm:inline-flex">
            <Icon name="globe" size={12} /> Page Studio
          </span>
          <input
            value={name}
            disabled={readOnly}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
            maxLength={120}
            className="min-w-0 flex-[1_1_180px] rounded-lg bg-transparent px-2 py-1 text-[18px] font-semibold tracking-[-0.02em] outline-none hover:bg-surface focus:bg-surface focus:ring-2 focus:ring-sky/40"
            aria-label="Page name"
          />
          <span className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold ${status === "live" ? "bg-ok-bg text-ok" : "bg-surface text-muted"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status === "live" ? "bg-ok" : "bg-faint"}`} /> {status === "live" ? "Live" : "Draft"}
          </span>
          <span className={`hidden text-[12px] lg:inline ${msg.error ? "text-bad" : "text-muted"}`}>{pending ? "Saving…" : msg.error ?? (dirty ? "Saving automatically…" : msg.ok ?? "")}</span>
          <div className="ml-auto flex items-center gap-1.5">
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
                <button key={d} type="button" onClick={() => setDevice(d)} title={d === "desktop" ? "Desktop view" : "Phone view"} aria-label={d === "desktop" ? "Desktop view" : "Phone view"} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${device === d ? "bg-white text-brand shadow-sm" : "text-muted"}`}>
                  <Icon name={d === "desktop" ? "monitor" : "smartphone"} size={15} />
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setPreview(true)} className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold">
              <Icon name="eye" size={15} /> <span className="hidden sm:inline">Preview</span>
            </button>
            {status === "live" && (
              <a href={link} target="_blank" rel="noopener noreferrer" className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold">
                <Icon name="globe" size={15} /> <span className="hidden sm:inline">Open</span>
              </a>
            )}
            {canEdit &&
              (status === "live" ? (
                <button type="button" onClick={() => publish("draft")} disabled={pending} className="btn-ghost inline-flex min-h-9 items-center rounded-xl px-3 text-[13px] font-semibold">
                  Unpublish
                </button>
              ) : (
                <button type="button" onClick={() => publish("live")} disabled={pending || !blocks} className="btn-primary inline-flex min-h-9 items-center gap-2 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-60">
                  <Icon name="globe" size={15} /> Publish
                </button>
              ))}
          </div>
        </div>
      </div>

      <div className="relative flex h-[calc(100vh-58px-var(--chrome-h,64px))] min-h-[560px] overflow-hidden">
        <aside className={`${panel === "add" ? "absolute inset-y-0 left-0 z-20 flex shadow-2xl" : "hidden"} w-[272px] flex-none flex-col border-r border-line bg-[#f8fafd] lg:static lg:flex lg:shadow-none`}>
          <div className="flex items-center justify-between px-4 pt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
            Add to page
            <button type="button" onClick={() => setPanel("none")} className="lg:hidden" aria-label="Close">
              <Icon name="x" size={15} />
            </button>
          </div>
          <PagePalette readOnly={readOnly} onDragStart={setDrag} onDragEnd={() => setDrag(null)} onAdd={onAdd} />
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-none items-center gap-2 border-b border-line bg-white px-3 py-1.5 lg:hidden">
            <button type="button" onClick={() => setPanel(panel === "add" ? "none" : "add")} className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold">
              <Icon name="plus" size={14} /> Add
            </button>
            <button type="button" onClick={() => setPanel(panel === "settings" ? "none" : "settings")} className="btn-ghost ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold">
              <Icon name="settings" size={14} /> {selected ? "Edit" : "Page settings"}
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <PageCanvas
              def={def}
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
              onSectionAction={(id, a) => {
                if (a === "delete") remove(id);
                else if (a === "duplicate") duplicate(id);
                else commit(moveSectionBy(def, id, a === "up" ? -1 : 1));
              }}
              onRowAction={(id, a) => {
                if (a === "delete") remove(id);
                else if (a === "duplicate") duplicate(id);
                else if (a === "up" || a === "down") commit(moveRowBy(def, id, a === "up" ? -1 : 1));
                else commit(setColumns(def, id, Number(a.slice(4))));
              }}
              onBlockAction={(id, a) => {
                if (a === "delete") remove(id);
                else if (a === "duplicate") duplicate(id);
                else commit(moveBlockBy(def, id, a === "up" ? -1 : 1));
              }}
            />
          </div>
          <div className="flex flex-none items-center justify-between gap-3 border-t border-line bg-white px-4 py-1.5 text-[11.5px] text-faint">
            <span>
              {def.sections.length} section{def.sections.length === 1 ? "" : "s"} · {blocks} block{blocks === 1 ? "" : "s"}
            </span>
            <span className="hidden sm:inline">Drag to rearrange · Del removes · Ctrl+D duplicates · Ctrl+Z undoes · Ctrl+S saves</span>
          </div>
        </section>

        <aside className={`${panel === "settings" ? "absolute inset-y-0 right-0 z-20 flex shadow-2xl" : "hidden"} w-[320px] flex-none flex-col border-l border-line bg-white xl:static xl:flex xl:shadow-none`}>
          <div className="flex justify-end px-2 pt-2 xl:hidden">
            <button type="button" onClick={() => setPanel("none")} aria-label="Close" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface">
              <Icon name="x" size={15} />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <PageInspector
              def={def}
              selected={selected}
              readOnly={readOnly}
              forms={forms}
              link={link}
              slug={slug}
              onSelect={setSelected}
              onSlug={async (next) => {
                const r = await save({ slug: next });
                if (!r.error) setSlug(next);
                notify(r.error ?? "Link saved", r.error ? "bad" : "ok");
                return r;
              }}
              onBlock={(id, patch, key) => commit(updateBlock(def, id, patch), key)}
              onRow={(id, patch) => commit(updateRow(def, id, patch))}
              onCols={(id, n) => commit(setColumns(def, id, n))}
              onSection={(id, patch, key) => commit(updateSection(def, id, patch), key)}
              onPage={(patch, key) => commit({ ...def, ...patch }, key)}
              onDuplicate={duplicate}
              onDelete={remove}
            />
          </div>
        </aside>
      </div>

      {preview &&
        createPortal(
          <div className="fixed inset-0 z-[85] flex flex-col bg-[#0b1b3a]/80 backdrop-blur-sm">
            <div className="flex flex-none items-center gap-2 px-4 py-2.5 text-white">
              <span className="text-[14px] font-semibold">Preview</span>
              <span className="text-[12.5px] opacity-70">Buttons and forms work here like on the live page.</span>
              <div className="ml-auto flex items-center gap-0.5 rounded-xl bg-white/10 p-0.5">
                {(["desktop", "mobile"] as const).map((d) => (
                  <button key={d} type="button" onClick={() => setDevice(d)} aria-label={d} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${device === d ? "bg-white text-brand" : "text-white"}`}>
                    <Icon name={d === "desktop" ? "monitor" : "smartphone"} size={15} />
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setPreview(false)} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-[13px] font-semibold hover:bg-white/20">
                <Icon name="x" size={14} /> Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
              <div className="mx-auto overflow-hidden rounded-xl bg-white" style={{ maxWidth: device === "mobile" ? 390 : "100%" }}>
                <PageView def={def} sample />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
