"use client";

// Form Studio's right panel. Shows the settings for whatever is selected: a
// question, a piece of content, a section or a column. With nothing selected it
// shows the form's design (colours, fonts, buttons) and its steps.

import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icon";
import type { CustomField } from "@/lib/data";
import { FONTS, allBlocks, allFields, kindInfo, type Block, type ContentBlock, type FieldBlock, type FormDefinition, type Logic, type Theme } from "@/lib/form-builder";
import { findBlock, findColumn, findRow } from "./tree";

type Props = {
  def: FormDefinition;
  selected: string | null;
  stepId: string;
  customFields: CustomField[];
  readOnly: boolean;
  onBlock: (id: string, patch: Partial<Block>) => void;
  onDef: (patch: Partial<FormDefinition>) => void;
  onTheme: (patch: Partial<Theme>) => void;
  onAction: (a: { t: "block-dup" | "block-del" | "row-dup" | "row-del" | "col-del"; id: string } | { t: "cols"; id: string; n: number } | { t: "block-step"; id: string; step: string }) => void;
  onSteps: (a: { t: "add" } | { t: "rename"; id: string; title: string } | { t: "del"; id: string } | { t: "move"; id: string; dir: -1 | 1 } | { t: "open"; id: string }) => void;
  onDeselect: () => void;
};

const ACCENTS = ["#0a5fe3", "#0ea5e9", "#7c3aed", "#db2777", "#e11d48", "#ea580c", "#f59e0b", "#16a34a", "#0d9488", "#0b1b3a"];
const BACKGROUNDS = ["#f3f6fb", "#ffffff", "#f4f1ff", "#fdf2f8", "#fff7ed", "#f0fdfa", "#f1f5f9", "#0b1220", "#111827", "#0a2a66"];

export function Inspector(p: Props) {
  const { def, selected } = p;
  const block = selected ? findBlock(def, selected) : null;
  const row = !block && selected ? findRow(def, selected) : null;
  const col = !block && !row && selected ? findColumn(def, selected) : null;

  return (
    <fieldset disabled={p.readOnly} className="flex h-full min-w-0 flex-col">
      {block ? (
        <BlockPanel {...p} b={block.block} />
      ) : row ? (
        <Panel title="Section" icon="layout" onClose={p.onDeselect}>
          <Label text="Columns">
            <Segmented value={String(row.row.columns.length)} options={["1", "2", "3", "4"].map((v) => ({ value: v, label: v }))} onChange={(v) => p.onAction({ t: "cols", id: row.row.id, n: Number(v) })} />
          </Label>
          <p className="text-[12.5px] text-muted">Fewer columns move their fields into the last column kept. On phones, columns stack one above the other.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => p.onAction({ t: "row-dup", id: row.row.id })} className="btn-ghost inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold">
              <Icon name="copy" size={14} /> Duplicate
            </button>
            <button type="button" onClick={() => p.onAction({ t: "row-del", id: row.row.id })} className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold text-bad ring-1 ring-bad/25 hover:bg-bad-bg">
              <Icon name="trash" size={14} /> Delete
            </button>
          </div>
        </Panel>
      ) : col ? (
        <Panel title="Column" icon="columns" onClose={p.onDeselect}>
          <p className="text-[13px] text-muted">Drag a field into this column, or click one on the left to add it here.</p>
          {col.row.columns.length > 1 && (
            <button type="button" onClick={() => p.onAction({ t: "col-del", id: col.col.id })} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold text-bad ring-1 ring-bad/25 hover:bg-bad-bg">
              <Icon name="trash" size={14} /> Remove this column
            </button>
          )}
        </Panel>
      ) : (
        <FormPanel {...p} />
      )}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------

function Panel({ title, icon, onClose, actions, children }: { title: string; icon: IconName; onClose?: () => void; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-none items-center gap-2.5 border-b border-line px-4 py-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#55e3ec,#0a5fe3)] text-white">
          <Icon name={icon} size={15} />
        </span>
        <div className="min-w-0 flex-1 truncate text-[14px] font-semibold">{title}</div>
        {actions}
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" title="Back to form design" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface">
            <Icon name="x" size={15} />
          </button>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">{children}</div>
    </div>
  );
}

function Label({ text, hint, children }: { text: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-muted">{text}</span>
      {children}
      {hint && <span className="text-[11.5px] text-faint">{hint}</span>}
    </label>
  );
}

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex w-full items-start gap-3 text-left">
      <span className={`mt-0.5 inline-flex h-5 w-9 flex-none items-center rounded-full p-0.5 transition-colors ${on ? "bg-brand" : "bg-line-strong"}`}>
        <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : ""}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium">{label}</span>
        {hint && <span className="block text-[12px] text-muted">{hint}</span>}
      </span>
    </button>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: { value: string; label: ReactNode }[]; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-xl bg-surface p-0.5 ring-1 ring-line">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex min-h-8 flex-1 items-center justify-center rounded-[10px] px-2 text-[12.5px] font-semibold transition-colors ${value === o.value ? "bg-white text-navy shadow-sm" : "text-muted hover:text-navy"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Swatches({ value, colours, onChange }: { value: string; colours: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {colours.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} aria-label={c} className={`h-7 w-7 rounded-full ring-1 ring-line ring-offset-2 ${value.toLowerCase() === c ? "!ring-2 !ring-navy" : ""}`} style={{ background: c }} />
      ))}
      <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full ring-1 ring-line" title="Pick any colour" style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A question or piece of content
// ---------------------------------------------------------------------------

function BlockPanel(p: Props & { b: Block }) {
  const { b, def } = p;
  const set = (patch: Partial<FieldBlock> | Partial<ContentBlock>) => p.onBlock(b.id, patch as Partial<Block>);
  const title = b.type === "field" ? (b.kind === "custom" ? "Contact field" : kindInfo(b.kind)?.label ?? "Question") : b.kind[0].toUpperCase() + b.kind.slice(1);
  const icon = (b.type === "field" ? kindInfo(b.kind)?.icon : b.kind === "image" ? "image" : "edit") as IconName;
  const here = findBlock(def, b.id)!;

  return (
    <Panel
      title={title}
      icon={icon ?? "edit"}
      onClose={p.onDeselect}
      actions={
        <>
          <button type="button" title="Duplicate" aria-label="Duplicate" onClick={() => p.onAction({ t: "block-dup", id: b.id })} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface">
            <Icon name="copy" size={14} />
          </button>
          <button type="button" title="Delete" aria-label="Delete" onClick={() => p.onAction({ t: "block-del", id: b.id })} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-faint hover:bg-bad-bg hover:text-bad">
            <Icon name="trash" size={14} />
          </button>
        </>
      }
    >
      {b.type === "field" ? <FieldSettings {...p} f={b} set={set} /> : <ContentSettings b={b} set={set} />}

      {def.steps.length > 1 && (
        <Label text="Step">
          <select value={here.step.id} onChange={(e) => p.onAction({ t: "block-step", id: b.id, step: e.target.value })} className="field h-10 text-[13px]">
            {def.steps.map((s, i) => (
              <option key={s.id} value={s.id}>
                {i + 1}. {s.title}
              </option>
            ))}
          </select>
        </Label>
      )}

      <LogicEditor def={def} b={b} onChange={(logic) => set({ logic })} />
    </Panel>
  );
}

function FieldSettings({ f, set, def, customFields }: Props & { f: FieldBlock; set: (p: Partial<FieldBlock>) => void }) {
  const info = kindInfo(f.kind);
  const [bulk, setBulk] = useState(false);
  const textLike = !["checkbox", "radio", "checkboxes", "yes_no", "rating", "hidden"].includes(f.kind);
  const opts = f.options ?? [];
  const showPoints = def.qualify.enabled || Boolean(f.scores?.some(Boolean));
  const setOpt = (i: number, v: string) => set({ options: opts.map((o, j) => (j === i ? v.slice(0, 120) : o)) });
  const setScore = (i: number, v: number) => set({ scores: opts.map((_, j) => (j === i ? v : (f.scores?.[j] ?? 0))) });
  const moveOpt = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= opts.length) return;
    const o = [...opts];
    const s = opts.map((_, k) => f.scores?.[k] ?? 0);
    [o[i], o[j]] = [o[j], o[i]];
    [s[i], s[j]] = [s[j], s[i]];
    set({ options: o, ...(f.scores ? { scores: s } : {}) });
  };

  return (
    <>
      <Label text={f.kind === "hidden" ? "Name (for your records)" : "Question"}>
        <textarea value={f.label} maxLength={200} rows={2} onChange={(e) => set({ label: e.target.value })} className="field py-2 text-[13.5px]" />
      </Label>

      {f.kind === "custom" && (
        <Label text="Saves to contact field" hint="Answers are stored on the contact, so you can filter and use them in workflows.">
          <select value={f.key ?? ""} onChange={(e) => set({ key: e.target.value })} className="field h-10 text-[13px]">
            <option value="">Choose a field</option>
            {customFields.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </Label>
      )}
      {f.kind === "hidden" && (
        <Label text="Read from the web address" hint="With ?campaign=spring on the link, the value “spring” is saved with the submission.">
          <div className="flex items-center gap-1 text-[13px]">
            <span className="text-muted">?</span>
            <input value={f.key ?? ""} onChange={(e) => set({ key: e.target.value.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 60) })} placeholder="campaign" className="field h-10 min-w-0 flex-1 text-[13px]" />
            <span className="text-muted">=…</span>
          </div>
        </Label>
      )}

      {textLike && (
        <Label text="Placeholder">
          <input value={f.placeholder ?? ""} maxLength={120} onChange={(e) => set({ placeholder: e.target.value || undefined })} className="field h-10 text-[13px]" placeholder="Shown inside the empty box" />
        </Label>
      )}
      {f.kind !== "hidden" && (
        <Label text="Help text">
          <input value={f.help ?? ""} maxLength={300} onChange={(e) => set({ help: e.target.value || undefined })} className="field h-10 text-[13px]" placeholder="Shown under the question" />
        </Label>
      )}
      {f.kind !== "hidden" && <Toggle on={f.required} onChange={(v) => set({ required: v })} label="Required" hint="They can't continue until it's answered." />}

      {info?.choices && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-muted">Options{showPoints ? " and points" : ""}</span>
            {f.kind !== "yes_no" && (
              <button type="button" onClick={() => setBulk((v) => !v)} className="text-[12px] font-semibold text-brand">
                {bulk ? "Done" : "Paste a list"}
              </button>
            )}
          </div>
          {bulk ? (
            <textarea
              rows={6}
              value={opts.join("\n")}
              onChange={(e) => set({ options: e.target.value.split("\n").map((o) => o.slice(0, 120)).slice(0, 40), scores: undefined })}
              className="field py-2 text-[13px]"
              placeholder="One option per line"
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              {opts.map((o, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input value={o} onChange={(e) => setOpt(i, e.target.value)} className="field h-9 min-w-0 flex-1 text-[13px]" aria-label={`Option ${i + 1}`} />
                  {showPoints && (
                    <input
                      type="number"
                      value={f.scores?.[i] ?? 0}
                      onChange={(e) => setScore(i, Math.max(-100, Math.min(100, Math.round(Number(e.target.value) || 0))))}
                      className="field h-9 w-14 px-2 text-center text-[13px]"
                      title="Points for this answer"
                      aria-label={`Points for option ${i + 1}`}
                    />
                  )}
                  <button type="button" onClick={() => moveOpt(i, -1)} disabled={i === 0} aria-label="Move up" className="inline-flex h-8 w-6 items-center justify-center text-muted disabled:opacity-30">
                    <Icon name="up" size={12} />
                  </button>
                  {f.kind !== "yes_no" && (
                    <button
                      type="button"
                      onClick={() => set({ options: opts.filter((_, j) => j !== i), ...(f.scores ? { scores: f.scores.filter((_, j) => j !== i) } : {}) })}
                      aria-label="Remove option"
                      className="inline-flex h-8 w-6 items-center justify-center text-faint hover:text-bad"
                    >
                      <Icon name="x" size={13} />
                    </button>
                  )}
                </div>
              ))}
              {f.kind !== "yes_no" && opts.length < 40 && (
                <button type="button" onClick={() => set({ options: [...opts, `Option ${opts.length + 1}`], ...(f.scores ? { scores: [...f.scores, 0] } : {}) })} className="inline-flex w-fit items-center gap-1 text-[12.5px] font-semibold text-brand">
                  <Icon name="plus" size={12} /> Add option
                </button>
              )}
            </div>
          )}
          {!def.qualify.enabled && (
            <p className="text-[11.5px] text-faint">Turn on “Qualify by score” under After submitting to give answers points.</p>
          )}
        </div>
      )}
    </>
  );
}

function ContentSettings({ b, set }: { b: ContentBlock; set: (p: Partial<ContentBlock>) => void }) {
  const align = (
    <Label text="Alignment">
      <Segmented value={b.align ?? "left"} options={[{ value: "left", label: "Left" }, { value: "center", label: "Centre" }]} onChange={(v) => set({ align: v === "center" ? "center" : undefined })} />
    </Label>
  );
  switch (b.kind) {
    case "heading":
      return (
        <>
          <Label text="Text">
            <textarea value={b.text ?? ""} maxLength={200} rows={2} onChange={(e) => set({ text: e.target.value })} className="field py-2 text-[13.5px]" />
          </Label>
          <Label text="Size">
            <Segmented value={String(b.level ?? 1)} options={[{ value: "1", label: "Large" }, { value: "2", label: "Medium" }, { value: "3", label: "Small" }]} onChange={(v) => set({ level: Number(v) as 1 })} />
          </Label>
          {align}
        </>
      );
    case "paragraph":
      return (
        <>
          <Label text="Text">
            <textarea value={b.text ?? ""} maxLength={2000} rows={5} onChange={(e) => set({ text: e.target.value })} className="field py-2 text-[13.5px]" />
          </Label>
          {align}
        </>
      );
    case "image":
      return (
        <>
          <Label text="Image address" hint="Paste an https:// link to an image, e.g. your logo.">
            <input value={b.src ?? ""} onChange={(e) => set({ src: e.target.value.trim() })} placeholder="https://…/logo.png" className="field h-10 text-[13px]" />
          </Label>
          <Label text="Description (for screen readers)">
            <input value={b.alt ?? ""} maxLength={200} onChange={(e) => set({ alt: e.target.value })} className="field h-10 text-[13px]" />
          </Label>
          {align}
        </>
      );
    case "spacer":
      return (
        <Label text={`Height: ${b.height ?? 24}px`}>
          <input type="range" min={8} max={160} step={4} value={b.height ?? 24} onChange={(e) => set({ height: Number(e.target.value) })} className="accent-[#0a5fe3]" />
        </Label>
      );
    default:
      return <p className="text-[13px] text-muted">A thin line to split the form into parts.</p>;
  }
}

function LogicEditor({ def, b, onChange }: { def: FormDefinition; b: Block; onChange: (l: Logic | undefined) => void }) {
  const order = allBlocks(def).map((x) => x.id);
  const mine = order.indexOf(b.id);
  const candidates = allFields(def).filter((f) => f.id !== b.id && f.kind !== "hidden" && order.indexOf(f.id) < mine);
  const l = b.logic;
  const target = candidates.find((f) => f.id === l?.field);
  const needsValue = l && l.op !== "answered" && l.op !== "empty";

  return (
    <div className="rounded-xl border border-line bg-surface/60 p-3">
      <Toggle
        on={Boolean(l)}
        onChange={(v) => onChange(v && candidates[0] ? { field: candidates[0].id, op: "is", value: candidates[0].options?.[0] ?? "" } : undefined)}
        label="Only show when…"
        hint={candidates.length ? "Show this based on an earlier answer." : "Add a question above this one to use a rule."}
      />
      {l && (
        <div className="mt-3 flex flex-col gap-2">
          <select
            value={l.field}
            onChange={(e) => {
              const f = candidates.find((x) => x.id === e.target.value);
              onChange({ field: e.target.value, op: l.op, value: f?.options?.[0] ?? "" });
            }}
            className="field h-9 text-[13px]"
            aria-label="Question"
          >
            {candidates.map((f) => (
              <option key={f.id} value={f.id}>{f.label.slice(0, 60)}</option>
            ))}
          </select>
          <select value={l.op} onChange={(e) => onChange({ ...l, op: e.target.value as Logic["op"] })} className="field h-9 text-[13px]" aria-label="Rule">
            <option value="is">is</option>
            <option value="is_not">is not</option>
            <option value="contains">contains</option>
            <option value="answered">is answered</option>
            <option value="empty">is not answered</option>
          </select>
          {needsValue &&
            (target?.options?.length ? (
              <select value={l.value ?? ""} onChange={(e) => onChange({ ...l, value: e.target.value })} className="field h-9 text-[13px]" aria-label="Answer">
                {target.options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input value={l.value ?? ""} onChange={(e) => onChange({ ...l, value: e.target.value.slice(0, 120) })} className="field h-9 text-[13px]" placeholder="Answer" aria-label="Answer" />
            ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nothing selected: the form's design and steps
// ---------------------------------------------------------------------------

function FormPanel(p: Props) {
  const [tab, setTab] = useState<"style" | "form">("style");
  const { def } = p;
  const t = def.theme;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-none border-b border-line p-3">
        <Segmented value={tab} options={[{ value: "style", label: "Style" }, { value: "form", label: "Steps and buttons" }]} onChange={(v) => setTab(v as "style")} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        {tab === "style" ? (
          <>
            <Label text="Brand colour">
              <Swatches value={t.accent} colours={ACCENTS} onChange={(v) => p.onTheme({ accent: v })} />
            </Label>
            <Label text="Page background">
              <Swatches value={t.background} colours={BACKGROUNDS} onChange={(v) => p.onTheme({ background: v })} />
            </Label>
            <Toggle on={t.dark} onChange={(v) => p.onTheme({ dark: v, ...(v && !["#0b1220", "#111827", "#0a2a66"].includes(t.background) ? { background: "#0b1220" } : !v && ["#0b1220", "#111827", "#0a2a66"].includes(t.background) ? { background: "#f3f6fb" } : {}) })} label="Dark form" />
            <Toggle on={t.card} onChange={(v) => p.onTheme({ card: v })} label="Show the form on a card" hint="Off: the form sits straight on the background." />
            <Label text="Font">
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(FONTS) as Theme["font"][]).map((k) => (
                  <button key={k} type="button" onClick={() => p.onTheme({ font: k })} className={`rounded-xl px-3 py-2 text-left text-[14px] ring-1 ${t.font === k ? "bg-chip ring-brand" : "bg-white ring-line"}`} style={{ fontFamily: FONTS[k].stack }}>
                    {FONTS[k].label}
                  </button>
                ))}
              </div>
            </Label>
            <Label text={`Corners: ${t.radius}px`}>
              <input type="range" min={0} max={28} value={t.radius} onChange={(e) => p.onTheme({ radius: Number(e.target.value) })} className="accent-[#0a5fe3]" />
            </Label>
            <Label text="Answer boxes">
              <Segmented value={t.fieldStyle} options={[{ value: "outlined", label: "Outlined" }, { value: "filled", label: "Filled" }, { value: "underline", label: "Line" }]} onChange={(v) => p.onTheme({ fieldStyle: v as Theme["fieldStyle"] })} />
            </Label>
            <Label text="Button">
              <Segmented value={t.buttonStyle} options={[{ value: "solid", label: "Solid" }, { value: "outline", label: "Outline" }, { value: "pill", label: "Pill" }]} onChange={(v) => p.onTheme({ buttonStyle: v as Theme["buttonStyle"] })} />
            </Label>
            <Label text="Button width">
              <Segmented value={t.buttonAlign} options={[{ value: "full", label: "Full" }, { value: "left", label: "Left" }, { value: "center", label: "Centre" }]} onChange={(v) => p.onTheme({ buttonAlign: v as Theme["buttonAlign"] })} />
            </Label>
            <Label text={`Form width: ${t.width}px`}>
              <input type="range" min={360} max={960} step={20} value={t.width} onChange={(e) => p.onTheme({ width: Number(e.target.value) })} className="accent-[#0a5fe3]" />
            </Label>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-semibold text-muted">Steps</span>
              {def.steps.map((s, i) => (
                <div key={s.id} className={`flex items-center gap-1 rounded-xl p-1 ring-1 ${s.id === p.stepId ? "bg-chip ring-brand/40" : "bg-white ring-line"}`}>
                  <button type="button" onClick={() => p.onSteps({ t: "open", id: s.id })} className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[12px] font-bold text-brand">
                    {i + 1}
                  </button>
                  <input value={s.title} maxLength={80} onChange={(e) => p.onSteps({ t: "rename", id: s.id, title: e.target.value })} className="h-8 min-w-0 flex-1 rounded-lg bg-transparent px-1 text-[13px] font-medium outline-none focus:bg-white" aria-label={`Step ${i + 1} name`} />
                  <button type="button" onClick={() => p.onSteps({ t: "move", id: s.id, dir: -1 })} disabled={i === 0} aria-label="Move up" className="inline-flex h-8 w-6 items-center justify-center text-muted disabled:opacity-30">
                    <Icon name="up" size={12} />
                  </button>
                  <button type="button" onClick={() => p.onSteps({ t: "move", id: s.id, dir: 1 })} disabled={i === def.steps.length - 1} aria-label="Move down" className="inline-flex h-8 w-6 items-center justify-center text-muted disabled:opacity-30">
                    <Icon name="down" size={12} />
                  </button>
                  {def.steps.length > 1 && (
                    <button type="button" onClick={() => p.onSteps({ t: "del", id: s.id })} aria-label="Delete step" className="inline-flex h-8 w-6 items-center justify-center text-faint hover:text-bad">
                      <Icon name="trash" size={12} />
                    </button>
                  )}
                </div>
              ))}
              {def.steps.length < 10 && (
                <button type="button" onClick={() => p.onSteps({ t: "add" })} className="btn-ghost inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold">
                  <Icon name="plus" size={13} /> Add a step
                </button>
              )}
            </div>
            {def.steps.length > 1 && (
              <Label text="Progress">
                <Segmented value={def.progress} options={[{ value: "bar", label: "Bar" }, { value: "steps", label: "Steps" }, { value: "none", label: "Hidden" }]} onChange={(v) => p.onDef({ progress: v as "bar" })} />
              </Label>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Label text="Submit button">
                <input value={def.button} maxLength={40} onChange={(e) => p.onDef({ button: e.target.value })} className="field h-10 text-[13px]" />
              </Label>
              {def.steps.length > 1 && (
                <Label text="Next button">
                  <input value={def.next} maxLength={40} onChange={(e) => p.onDef({ next: e.target.value })} className="field h-10 text-[13px]" />
                </Label>
              )}
              {def.steps.length > 1 && (
                <Label text="Back button">
                  <input value={def.back} maxLength={40} onChange={(e) => p.onDef({ back: e.target.value })} className="field h-10 text-[13px]" />
                </Label>
              )}
            </div>
            {def.steps.length > 1 && (
              <Toggle on={def.saveProgress} onChange={(v) => p.onDef({ saveProgress: v })} label="Save people who stop part way" hint="Once they've given an email or phone, they're saved as a contact even if they don't finish. You'll see them as “Started” in Submissions." />
            )}
            <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
              <Toggle on={def.consent.enabled} onChange={(v) => p.onDef({ consent: { ...def.consent, enabled: v } })} label="Ask for permission to contact" hint="Recommended in the UK. Shown above the submit button." />
              {def.consent.enabled && (
                <>
                  <textarea value={def.consent.text} maxLength={300} rows={2} onChange={(e) => p.onDef({ consent: { ...def.consent, text: e.target.value } })} className="field py-2 text-[13px]" />
                  <Toggle on={def.consent.required} onChange={(v) => p.onDef({ consent: { ...def.consent, required: v } })} label="They must tick it to send" />
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
