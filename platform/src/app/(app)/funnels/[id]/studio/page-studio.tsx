"use client";

// Page Studio: build a landing page by dragging sections, columns and blocks.
// Saves automatically; publish when it's ready.

import { shortId } from "@/lib/short-id-shared";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { notify } from "@/components/toast";
import { BlockView, PageView, RowShell, SectionShell } from "@/components/page-view";
import { textTone, type PageDefinition, type PageTheme, type Section } from "@/lib/page-builder";
import { siteLinks, type SiteKind, type SitePageInfo, type SiteSettings } from "@/lib/site-builder";
import { savePage, saveSitePart, setSiteStatus } from "../../actions";
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

export type StudioSite = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "live" | "archived";
  kind: SiteKind;
  pageId: string;
  pageName: string;
  pageSlug: string;
  /** Editing a website's shared header or footer instead of a page. */
  part: "header" | "footer" | null;
  pages: SitePageInfo[];
  parts: SiteSettings;
  definition: PageDefinition;
};

const PART_NAME = { header: "Shared header", footer: "Shared footer" } as const;

export function PageStudio({ site, base, workspaceSlug, forms, canEdit }: { site: StudioSite; base: string; workspaceSlug: string; forms: { id: string; name: string }[]; canEdit: boolean }) {
  const readOnly = !canEdit;
  const router = useRouter();
  const single = site.kind === "page";
  const [def, setDefState] = useState<PageDefinition>(site.definition);
  // A single page's name is the site's name; a funnel step or website page has its own.
  const [name, setName] = useState(single ? site.name : site.part ? PART_NAME[site.part] : site.pageName);
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
  const siteBase = `/p/${workspaceSlug}/${slug}`;
  const link = `${base}${siteBase}${site.pageSlug && !site.part ? `/${site.pageSlug}` : ""}`;
  const overview = `/funnels/${shortId(site.id)}/overview`;
  // Where "next step", page and menu links go, drawn in the builder as on the live page.
  const links = useMemo(() => (single ? null : siteLinks(site.pages, site.pageId, siteBase)), [single, site.pages, site.pageId, siteBase]);

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
  /** Saves to the server: the page, or a website's shared header or footer. */
  const persist = useCallback(
    (extra?: { slug?: string }): Promise<{ error?: string; ok?: string }> => {
      const fail = () => ({ error: "We couldn't reach the server. Check your connection; your changes are kept here." });
      if (site.part) return saveSitePart(site.id, site.part, current.current).catch(fail);
      return savePage(site.id, {
        name: single ? name : site.name,
        ...(single ? {} : { pageName: name }),
        pageId: site.pageId,
        definition: current.current,
        ...(extra ?? {}),
      }).catch(fail);
    },
    [name, single, site.id, site.name, site.pageId, site.part],
  );
  const save = useCallback(
    (extra?: { slug?: string }) =>
      new Promise<{ error?: string; ok?: string }>((resolve) =>
        start(async () => {
          const r = await persist(extra);
          setMsg(r.error ? r : { ok: "All changes saved" });
          if (!extra) notify(r.error ? `Not saved: ${r.error}` : "Saved", r.error ? "bad" : "ok");
          if (!r.error) setDirty(false);
          resolve(r);
        }),
      ),
    [persist],
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

  /** Opens another step, page or shared part, saving this one first. */
  function goTo(value: string) {
    const url = value === "overview" ? overview : value.startsWith("part:") ? `/funnels/${shortId(site.id)}?part=${value.slice(5)}` : `/funnels/${shortId(site.id)}?page=${value}`;
    start(async () => {
      if (dirty && !readOnly) {
        const r = await persist();
        if (r.error) return void notify(`Not saved: ${r.error}`, "bad");
        setDirty(false);
      }
      router.push(url);
    });
  }

  function publish(next: "live" | "draft") {
    start(async () => {
      if (dirty) {
        const s = await persist();
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
    <div className="flex w-full min-w-0 flex-col overflow-x-clip">
      <div className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 sm:px-5">
          <Link href={single ? "/funnels" : overview} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-surface" aria-label={single ? "Back to pages" : "Back to the overview"}>
            <Icon name="arrowLeft" size={17} />
          </Link>
          <span className="hidden items-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,#0a3fa6,#0a5fe3_60%,#29b0f8)] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white sm:inline-flex">
            <Icon name="globe" size={12} /> Page Studio
          </span>
          {!single && (
            <select
              value={site.part ? `part:${site.part}` : site.pageId}
              onChange={(e) => goTo(e.target.value)}
              className="field h-9 max-w-[220px] text-[13px] font-semibold"
              aria-label={site.kind === "funnel" ? "Step" : "Page"}
              title={site.name}
            >
              <option value="overview">{site.kind === "funnel" ? "All steps and stats" : "All pages and settings"}</option>
              {site.pages.map((p, i) => (
                <option key={p.id} value={p.id}>
                  {site.kind === "funnel" ? `Step ${i + 1}: ` : ""}
                  {p.name}
                </option>
              ))}
              {site.kind === "website" && <option value="part:header">Shared header</option>}
              {site.kind === "website" && <option value="part:footer">Shared footer</option>}
            </select>
          )}
          <input
            value={name}
            disabled={readOnly || Boolean(site.part)}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
            maxLength={120}
            className="min-w-0 flex-[1_1_180px] rounded-lg bg-transparent px-2 py-1 text-[18px] font-semibold tracking-[-0.02em] outline-none hover:bg-surface focus:bg-surface focus:ring-2 focus:ring-sky/40"
            aria-label={single ? "Page name" : site.kind === "funnel" ? "Step name" : "Page name"}
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
              links={links}
              before={site.kind === "website" && !site.part ? <SharedPart sections={site.parts.header} theme={def.theme} label="Shared header" onEdit={() => goTo("part:header")} /> : null}
              after={site.kind === "website" && !site.part ? <SharedPart sections={site.parts.footer} theme={def.theme} label="Shared footer" onEdit={() => goTo("part:footer")} /> : null}
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
              site={{ kind: site.kind, pageId: site.pageId, pages: site.pages.map((p) => ({ id: p.id, name: p.name })) }}
              overview={overview}
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
                <PageView
                  def={def}
                  sample
                  links={links}
                  header={site.kind === "website" && !site.part ? site.parts.header : []}
                  footer={site.kind === "website" && !site.part ? site.parts.footer : []}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/** A website's shared header or footer, shown on every page. Edited in its own view. */
function SharedPart({ sections, theme, label, onEdit }: { sections: Section[]; theme: PageTheme; label: string; onEdit: () => void }) {
  if (!sections.length)
    return (
      <button type="button" onClick={onEdit} className="block w-full border-y border-dashed border-line bg-surface/60 py-3 text-center text-[12.5px] font-semibold text-muted hover:text-brand" style={{ fontFamily: "var(--font-sans, system-ui)" }}>
        + Add a {label.toLowerCase()} to every page
      </button>
    );
  return (
    <div className="group relative">
      <div style={{ pointerEvents: "none", opacity: 0.92 }}>
        {sections.map((s) => {
          const tone = textTone(s.style, theme);
          return (
            <SectionShell key={s.id} s={s} theme={theme}>
              <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
                {s.rows.map((r) => (
                  <RowShell key={r.id} r={r}>
                    {r.columns.map((c) => (
                      <div key={c.id} className="pv-col">
                        {c.blocks.map((b) => (
                          <BlockView key={b.id} b={b} theme={theme} tone={tone} editing />
                        ))}
                      </div>
                    ))}
                  </RowShell>
                ))}
              </div>
            </SectionShell>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit the ${label.toLowerCase()}`}
        className="absolute inset-0 flex items-center justify-center text-[13px] outline-dashed outline-1 -outline-offset-1 outline-transparent transition group-hover:bg-[#0a5fe3]/10 group-hover:outline-[#0a5fe3]"
        style={{ fontFamily: "var(--font-sans, system-ui)" }}
      >
        <span className="rounded-lg bg-[#0a5fe3] px-3 py-1.5 font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100">Edit the {label.toLowerCase()} (on every page)</span>
      </button>
    </div>
  );
}
