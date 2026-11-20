// Edits to a form's layout, used by Form Studio. Every function returns a new
// definition and never changes the one it was given.

import { field, content, uid, type Block, type FieldKind, type ContentKind, type FormDefinition, type Row, type Step } from "@/lib/form-builder";

/** What's being dragged. */
export type Drag =
  | { t: "new-field"; kind: FieldKind; key?: string; label?: string }
  | { t: "new-content"; kind: ContentKind }
  | { t: "new-layout"; cols: number }
  | { t: "block"; id: string }
  | { t: "row"; id: string };

/** Where it's dropped. Anchors are ids, so they stay right while things move. */
export type Target =
  | { t: "gap"; step: string; before: string | null } // a new row, before a row (or at the end)
  | { t: "slot"; col: string; before: string | null } // inside a column, before a block (or at the end)
  | { t: "side"; col: string; side: "left" | "right" }; // a new column beside a column

export const targetKey = (x: Target) => (x.t === "gap" ? `gap:${x.step}:${x.before}` : x.t === "slot" ? `slot:${x.col}:${x.before}` : `side:${x.col}:${x.side}`);

const copy = (d: FormDefinition): FormDefinition => structuredClone(d);

export function findBlock(d: FormDefinition, id: string) {
  for (const s of d.steps) for (const r of s.rows) for (const c of r.columns) {
    const i = c.blocks.findIndex((b) => b.id === id);
    if (i >= 0) return { step: s, row: r, col: c, index: i, block: c.blocks[i] };
  }
  return null;
}
export function findRow(d: FormDefinition, id: string) {
  for (const s of d.steps) {
    const i = s.rows.findIndex((r) => r.id === id);
    if (i >= 0) return { step: s, index: i, row: s.rows[i] };
  }
  return null;
}
export function findColumn(d: FormDefinition, id: string) {
  for (const s of d.steps) for (const r of s.rows) {
    const i = r.columns.findIndex((c) => c.id === id);
    if (i >= 0) return { step: s, row: r, index: i, col: r.columns[i] };
  }
  return null;
}

/** Takes a block out. Its column goes if it's now empty and has neighbours; the row goes if nothing is left. */
function take(d: FormDefinition, id: string): Block | null {
  const at = findBlock(d, id);
  if (!at) return null;
  at.col.blocks.splice(at.index, 1);
  if (!at.col.blocks.length && at.row.columns.length > 1) at.row.columns = at.row.columns.filter((c) => c.id !== at.col.id);
  if (at.row.columns.every((c) => !c.blocks.length)) at.step.rows = at.step.rows.filter((r) => r.id !== at.row.id);
  return at.block;
}

function newBlock(drag: Drag): Block | null {
  if (drag.t === "new-field") return field(drag.kind, drag.label, drag.key ? { key: drag.key } : {});
  if (drag.t === "new-content") return content(drag.kind);
  return null;
}

function putRow(d: FormDefinition, stepId: string, before: string | null, r: Row) {
  const s = d.steps.find((x) => x.id === stepId) ?? d.steps[0];
  const i = before ? s.rows.findIndex((x) => x.id === before) : -1;
  if (i < 0) s.rows.push(r);
  else s.rows.splice(i, 0, r);
}

/** Applies a drop. Returns the new definition and the id of what should be selected. */
export function drop(def: FormDefinition, drag: Drag, target: Target): { def: FormDefinition; select?: string } {
  const d = copy(def);

  if (drag.t === "row") {
    if (target.t !== "gap" || target.before === drag.id) return { def };
    const at = findRow(d, drag.id);
    if (!at) return { def };
    at.step.rows.splice(at.index, 1);
    putRow(d, target.step, target.before, at.row);
    return { def: d, select: at.row.id };
  }

  if (drag.t === "new-layout") {
    if (target.t !== "gap") return { def };
    const r: Row = { id: uid(), columns: Array.from({ length: drag.cols }, () => ({ id: uid(), blocks: [] })) };
    putRow(d, target.step, target.before, r);
    return { def: d, select: r.id };
  }

  // A block: new from the palette, or moved.
  if (drag.t === "block" && target.t === "slot" && target.before === drag.id) return { def };
  const block = drag.t === "block" ? findBlock(d, drag.id)?.block : newBlock(drag);
  if (!block) return { def };
  // Take the moved block out first (without tidying, so anchors still exist).
  let from: { row: string; col: string } | null = null;
  if (drag.t === "block") {
    const at = findBlock(d, drag.id)!;
    from = { row: at.row.id, col: at.col.id };
    at.col.blocks.splice(at.index, 1);
  }

  let landedRow: string | null = null;
  if (target.t === "gap") {
    const r: Row = { id: uid(), columns: [{ id: uid(), blocks: [block] }] };
    putRow(d, target.step, target.before, r);
    landedRow = r.id;
  } else if (target.t === "slot") {
    const at = findColumn(d, target.col);
    if (!at) return { def };
    const i = target.before ? at.col.blocks.findIndex((b) => b.id === target.before) : -1;
    if (i < 0) at.col.blocks.push(block);
    else at.col.blocks.splice(i, 0, block);
    landedRow = at.row.id;
  } else {
    const at = findColumn(d, target.col);
    if (!at || at.row.columns.length >= 4) return { def };
    at.row.columns.splice(target.side === "left" ? at.index : at.index + 1, 0, { id: uid(), blocks: [block] });
    landedRow = at.row.id;
  }

  // Tidy only where the block came from.
  if (from) {
    const src = findColumn(d, from.col);
    if (src && !src.col.blocks.length) {
      if (src.row.columns.length > 1) src.row.columns = src.row.columns.filter((c) => c.id !== from!.col);
      if (src.row.id !== landedRow && src.row.columns.every((c) => !c.blocks.length)) src.step.rows = src.step.rows.filter((r) => r.id !== src.row.id);
    }
  }
  return { def: d, select: block.id };
}

/** Adds something by clicking: into the chosen column, or as a new row at the end of the step. */
export function addByClick(def: FormDefinition, drag: Drag, stepId: string, selected: string | null): { def: FormDefinition; select?: string } {
  if (drag.t === "new-layout") return drop(def, drag, { t: "gap", step: stepId, before: null });
  if (selected) {
    const b = findBlock(def, selected);
    if (b && b.step.id === stepId) {
      const next = b.col.blocks[b.index + 1]?.id ?? null;
      return drop(def, drag, { t: "slot", col: b.col.id, before: next });
    }
    const c = findColumn(def, selected);
    if (c && c.step.id === stepId) return drop(def, drag, { t: "slot", col: c.col.id, before: null });
    const r = findRow(def, selected);
    if (r && r.step.id === stepId) {
      const emptyCol = r.row.columns.find((x) => !x.blocks.length);
      if (emptyCol) return drop(def, drag, { t: "slot", col: emptyCol.id, before: null });
    }
  }
  return drop(def, drag, { t: "gap", step: stepId, before: null });
}

export function updateBlock(def: FormDefinition, id: string, patch: Partial<Block>): FormDefinition {
  const d = copy(def);
  const at = findBlock(d, id);
  if (at) at.col.blocks[at.index] = { ...at.block, ...patch } as Block;
  return d;
}

export function removeBlock(def: FormDefinition, id: string): FormDefinition {
  const d = copy(def);
  take(d, id);
  // Rules that pointed at it no longer apply.
  for (const s of d.steps) for (const r of s.rows) for (const c of r.columns) for (const b of c.blocks) if (b.logic?.field === id) delete b.logic;
  return d;
}

function reId(b: Block): Block {
  return { ...structuredClone(b), id: uid() };
}

export function duplicateBlock(def: FormDefinition, id: string): { def: FormDefinition; select?: string } {
  const d = copy(def);
  const at = findBlock(d, id);
  if (!at) return { def };
  const dup = reId(at.block);
  if (dup.type === "field" && ["first_name", "last_name", "full_name", "email", "phone", "company", "website"].includes(dup.kind)) {
    (dup as { kind: string }).kind = "text";
  }
  at.col.blocks.splice(at.index + 1, 0, dup);
  return { def: d, select: dup.id };
}

export function removeRow(def: FormDefinition, id: string): FormDefinition {
  const d = copy(def);
  const at = findRow(d, id);
  if (at) at.step.rows.splice(at.index, 1);
  return d;
}

export function duplicateRow(def: FormDefinition, id: string): { def: FormDefinition; select?: string } {
  const d = copy(def);
  const at = findRow(d, id);
  if (!at) return { def };
  const once = new Set(["first_name", "last_name", "full_name", "email", "phone", "company", "website"]);
  const r: Row = { id: uid(), columns: at.row.columns.map((c) => ({ id: uid(), blocks: c.blocks.filter((b) => !(b.type === "field" && once.has(b.kind))).map(reId) })) };
  at.step.rows.splice(at.index + 1, 0, r);
  return { def: d, select: r.id };
}

/** Changes how many columns a row has. Fewer columns: the blocks move into the last one kept. */
export function setColumns(def: FormDefinition, rowId: string, n: number): FormDefinition {
  const d = copy(def);
  const at = findRow(d, rowId);
  if (!at) return def;
  const cols = at.row.columns;
  if (n > cols.length) while (cols.length < n) cols.push({ id: uid(), blocks: [] });
  else if (n < cols.length) {
    const extra = cols.splice(n).flatMap((c) => c.blocks);
    cols[n - 1].blocks.push(...extra);
  }
  return d;
}

export function moveRowBy(def: FormDefinition, rowId: string, dir: -1 | 1): FormDefinition {
  const d = copy(def);
  const at = findRow(d, rowId);
  if (!at) return def;
  const j = at.index + dir;
  if (j < 0 || j >= at.step.rows.length) return def;
  [at.step.rows[at.index], at.step.rows[j]] = [at.step.rows[j], at.step.rows[at.index]];
  return d;
}

export function addStep(def: FormDefinition): { def: FormDefinition; step: string } {
  const d = copy(def);
  const s: Step = { id: uid(), title: `Step ${d.steps.length + 1}`, rows: [] };
  d.steps.push(s);
  return { def: d, step: s.id };
}

export function removeStep(def: FormDefinition, id: string): FormDefinition {
  if (def.steps.length < 2) return def;
  const d = copy(def);
  d.steps = d.steps.filter((s) => s.id !== id);
  return d;
}

export function moveStep(def: FormDefinition, id: string, dir: -1 | 1): FormDefinition {
  const d = copy(def);
  const i = d.steps.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= d.steps.length) return def;
  [d.steps[i], d.steps[j]] = [d.steps[j], d.steps[i]];
  return d;
}

/** Moves a block to another step (to the end). */
export function moveBlockToStep(def: FormDefinition, id: string, stepId: string): FormDefinition {
  return drop(def, { t: "block", id }, { t: "gap", step: stepId, before: null }).def;
}

/** Removes a column (its blocks go with it). */
export function removeColumn(def: FormDefinition, id: string): FormDefinition {
  const d = copy(def);
  const at = findColumn(d, id);
  if (!at) return def;
  if (at.row.columns.length > 1) at.row.columns.splice(at.index, 1);
  else at.step.rows = at.step.rows.filter((r) => r.id !== at.row.id);
  return d;
}
