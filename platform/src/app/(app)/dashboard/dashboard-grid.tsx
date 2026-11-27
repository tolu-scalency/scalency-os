"use client";

// The home page grid. Owners and admins can press "Customise" to drag widgets
// around, resize them, add new ones and remove others. The layout is shared by
// everyone in the workspace.

import { notify } from "@/components/toast";
import { useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";
import { SIZE_LABEL, SPAN, WIDGETS, widgetDef, type Widget, type WidgetSize } from "@/lib/dashboard";
import { saveDashboard } from "./actions";

const newId = () => Math.random().toString(36).slice(2, 10);

export function DashboardGrid({
  layout,
  isDefault,
  nodes,
  canEdit,
  pipelines,
  header,
}: {
  layout: Widget[];
  isDefault: boolean;
  nodes: Record<string, ReactNode>;
  canEdit: boolean;
  pipelines: { id: string; name: string }[];
  header: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Widget[]>(layout);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [pending, start] = useTransition();

  const items = editing ? draft : layout;

  function update(id: string, fn: (w: Widget) => Widget, markChanged = false) {
    setDraft((d) => d.map((w) => (w.id === id ? fn(w) : w)));
    if (markChanged) setChanged((c) => new Set(c).add(id));
  }
  function add(type: Widget["type"]) {
    const def = widgetDef(type)!;
    const w: Widget = { id: newId(), type, size: def.size, ...(type === "pipeline" && pipelines[0] ? { settings: { pipelineId: pipelines[0].id } } : {}) };
    setDraft((d) => [w, ...d]);
    setChanged((c) => new Set(c).add(w.id));
    setAdding(false);
  }
  function save(layoutToSave: Widget[] | null) {
    start(async () => {
      const r = await saveDashboard(layoutToSave);
      setMsg(r);
      notify(r.error ?? r.ok ?? "Saved", r.error ? "bad" : "ok");
      if (!r.error) {
        setEditing(false);
        setChanged(new Set());
      }
    });
  }
  function onDragOver(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setDraft((d) => {
      const from = d.findIndex((w) => w.id === dragId);
      const to = d.findIndex((w) => w.id === targetId);
      if (from < 0 || to < 0) return d;
      const copy = [...d];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy;
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        {header}
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(layout);
              setChanged(new Set());
              setMsg({});
              setEditing(true);
            }}
            className="btn-ghost inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-[13.5px] font-semibold"
          >
            <Icon name="columns" size={15} /> Customise
          </button>
        )}
      </div>

      {editing && (
        <div className="sticky top-2 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-sky/40 bg-white/95 p-2.5 pl-4 shadow-[var(--shadow-pop)] backdrop-blur">
          <span className="min-w-0 flex-1 text-[13px]">
            <span className="font-semibold">Customising the home page</span>
            <span className="text-muted"> for everyone in this workspace. Drag widgets to move them.</span>
          </span>
          {msg.error && <span className="text-[12.5px] text-bad">{msg.error}</span>}
          <button type="button" onClick={() => setAdding(true)} className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold">
            <Icon name="plus" size={14} /> Add widget
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("Put the home page back to the default layout?")) save(null);
            }}
            disabled={pending || isDefault}
            className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold disabled:opacity-50"
          >
            <Icon name="undo" size={14} /> Reset
          </button>
          <button type="button" onClick={() => setEditing(false)} disabled={pending} className="btn-ghost inline-flex min-h-9 items-center rounded-xl px-3 text-[13px] font-semibold">
            Cancel
          </button>
          <button type="button" onClick={() => save(draft)} disabled={pending} className="btn-primary inline-flex min-h-9 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-70">
            <Icon name="check" size={14} /> {pending ? "Saving…" : "Save layout"}
          </button>
        </div>
      )}
      {!editing && msg.ok && <p className="text-[13px] text-ok">{msg.ok}</p>}

      <div className="stagger grid grid-cols-12 gap-3 sm:gap-4">
        {items.map((w) => {
          const def = widgetDef(w.type);
          if (!def) return null;
          const content =
            w.type === "note" ? (
              <NoteWidget w={w} editing={editing} onChange={(settings) => update(w.id, (x) => ({ ...x, settings: { ...x.settings, ...settings } }))} />
            ) : changed.has(w.id) || !(w.id in nodes) ? (
              <div className="card flex h-full min-h-[120px] flex-col items-center justify-center gap-2 p-5 text-center">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-chip text-brand"><Icon name={def.icon} size={18} /></span>
                <div className="text-[14px] font-semibold">{def.label}</div>
                <div className="text-[12.5px] text-muted">Shows your numbers once you save.</div>
              </div>
            ) : (
              nodes[w.id]
            );
          if (!editing) {
            if (w.id in nodes && nodes[w.id] === null) return null; // e.g. setup is finished
            return (
              <div key={w.id} className={`${SPAN[w.size]} min-w-0 [&>*]:h-full`}>
                {content}
              </div>
            );
          }
          return (
            <div
              key={w.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                setDragId(w.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                onDragOver(w.id);
              }}
              onDragEnd={() => setDragId(null)}
              className={`${SPAN[w.size]} group relative min-w-0 cursor-grab rounded-xl outline-2 outline-offset-4 outline-sky/50 transition-opacity [&>.wbody>*]:h-full ${dragId === w.id ? "opacity-40" : ""} outline-dashed`}
            >
              <div className="absolute -top-3 right-2 z-10 flex items-center gap-1 rounded-xl border border-line bg-white p-1 shadow-[var(--shadow-pop)]">
                <span className="inline-flex h-7 items-center gap-1 px-1.5 text-[11.5px] font-semibold text-muted">
                  <Icon name="grip" size={13} /> {def.label}
                </span>
                <select
                  value={w.size}
                  onChange={(e) => update(w.id, (x) => ({ ...x, size: e.target.value as WidgetSize }))}
                  aria-label="Size"
                  className="h-7 rounded-lg border border-line bg-surface px-1.5 text-[12px] font-medium"
                >
                  {def.sizes.map((s) => (
                    <option key={s} value={s}>{SIZE_LABEL[s]}</option>
                  ))}
                </select>
                {w.type === "pipeline" && pipelines.length > 1 && (
                  <select
                    value={w.settings?.pipelineId ?? pipelines[0]?.id}
                    onChange={(e) => update(w.id, (x) => ({ ...x, settings: { ...x.settings, pipelineId: e.target.value } }), true)}
                    aria-label="Pipeline"
                    className="h-7 max-w-[140px] rounded-lg border border-line bg-surface px-1.5 text-[12px] font-medium"
                  >
                    {pipelines.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => setDraft((d) => d.filter((x) => x.id !== w.id))}
                  aria-label={`Remove ${def.label}`}
                  title="Remove"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-faint hover:bg-bad-bg hover:text-bad"
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
              <div className="wbody pointer-events-none h-full select-none [&_input]:pointer-events-auto [&_textarea]:pointer-events-auto">{content}</div>
            </div>
          );
        })}
        {editing && !draft.length && (
          <div className="col-span-12 rounded-xl border-2 border-dashed border-line-strong p-6 text-center text-[14px] text-muted">
            The home page is empty. Use <span className="font-semibold text-navy">Add widget</span> to put something here.
          </div>
        )}
      </div>

      {adding &&
        createPortal(
        <div className="fixed inset-0 z-[70] flex justify-end">
          <button type="button" aria-label="Close" onClick={() => setAdding(false)} className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" />
          <div className="drawer-in relative flex h-full w-full max-w-[420px] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 className="text-[16px] font-semibold">Add a widget</h2>
                <p className="text-[12.5px] text-muted">It goes at the top. Drag it wherever you like.</p>
              </div>
              <button type="button" onClick={() => setAdding(false)} aria-label="Close" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface">
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {["Numbers", "Charts and lists", "Other"].map((g) => (
                <div key={g} className="mb-4">
                  <div className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">{g}</div>
                  <div className="flex flex-col gap-1.5">
                    {WIDGETS.filter((d) => d.group === g).map((d) => {
                      const taken = d.once && draft.some((w) => w.type === d.type);
                      return (
                        <button
                          key={d.type}
                          type="button"
                          disabled={taken}
                          onClick={() => add(d.type)}
                          className="flex items-center gap-3 rounded-xl border border-line p-2.5 text-left transition-colors enabled:hover:border-sky enabled:hover:bg-surface disabled:opacity-50"
                        >
                          <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-chip text-brand"><Icon name={d.icon} size={16} /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13.5px] font-semibold">{d.label}</span>
                            <span className="block text-[12px] text-muted">{taken ? "Already on the page" : d.hint}</span>
                          </span>
                          <Icon name="plus" size={15} className="text-faint" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}

function NoteWidget({ w, editing, onChange }: { w: Widget; editing: boolean; onChange: (s: { title?: string; text?: string }) => void }) {
  const title = w.settings?.title ?? "";
  const text = w.settings?.text ?? "";
  if (editing)
    return (
      <div className="card flex h-full flex-col gap-2 p-5">
        <input value={title} maxLength={60} onChange={(e) => onChange({ title: e.target.value })} placeholder="Title, e.g. This week's focus" className="field h-10 font-semibold" draggable={false} onDragStart={(e) => e.preventDefault()} />
        <textarea value={text} maxLength={1000} rows={4} onChange={(e) => onChange({ text: e.target.value })} placeholder="Write a note for the team" className="field min-h-[96px] flex-1" draggable={false} onDragStart={(e) => e.preventDefault()} />
      </div>
    );
  return (
    <section className="card h-full p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#fff4e5] text-[#c2410c]"><Icon name="edit" size={14} /></span>
        <h2 className="text-[16px] font-semibold">{title || "Note"}</h2>
      </div>
      <p className="whitespace-pre-wrap text-[14px] text-muted">{text || "Nothing here yet."}</p>
    </section>
  );
}

