// Edits to a page's layout, used by Page Studio. Every function returns a new
// definition and never changes the one it was given.

import { block, section as makeSection, uid, type PBlock, type PBlockKind, type PageDefinition, type Row, type Section } from "@/lib/page-builder";

/** What's being dragged. */
export type Drag =
  | { t: "new-block"; kind: PBlockKind; patch?: Partial<PBlock> }
  | { t: "new-layout"; cols: number }
  | { t: "new-section"; make: () => Section }
  | { t: "block"; id: string }
  | { t: "row"; id: string }
  | { t: "section"; id: string };

/** Where it's dropped. */
export type Target =
  | { t: "sgap"; before: string | null } // between sections
  | { t: "gap"; section: string; before: string | null } // a new row inside a section
  | { t: "slot"; col: string; before: string | null } // inside a column
  | { t: "side"; col: string; side: "left" | "right" }; // a new column beside a column

export const targetKey = (x: Target) =>
  x.t === "sgap" ? `sgap:${x.before}` : x.t === "gap" ? `gap:${x.section}:${x.before}` : x.t === "slot" ? `slot:${x.col}:${x.before}` : `side:${x.col}:${x.side}`;

/** Sections only go between sections; rows and layouts between rows (or as a new section); blocks anywhere. */
export function accepts(drag: Drag, target: Target) {
  if (drag.t === "section" || drag.t === "new-section") return target.t === "sgap";
  if (drag.t === "row" || drag.t === "new-layout") return target.t === "gap" || target.t === "sgap";
  return true;
}

const copy = (d: PageDefinition): PageDefinition => structuredClone(d);

export function findSection(d: PageDefinition, id: string) {
  const i = d.sections.findIndex((s) => s.id === id);
  return i >= 0 ? { index: i, section: d.sections[i] } : null;
}
export function findRow(d: PageDefinition, id: string) {
  for (const s of d.sections) {
    const i = s.rows.findIndex((r) => r.id === id);
    if (i >= 0) return { section: s, index: i, row: s.rows[i] };
  }
  return null;
}
export function findColumn(d: PageDefinition, id: string) {
  for (const s of d.sections) for (const r of s.rows) {
    const i = r.columns.findIndex((c) => c.id === id);
    if (i >= 0) return { section: s, row: r, index: i, col: r.columns[i] };
  }
  return null;
}
export function findBlock(d: PageDefinition, id: string) {
  for (const s of d.sections) for (const r of s.rows) for (const c of r.columns) {
    const i = c.blocks.findIndex((b) => b.id === id);
    if (i >= 0) return { section: s, row: r, col: c, index: i, block: c.blocks[i] };
  }
  return null;
}
/** Which section something is in (a section, row, column or block id). */
export function sectionOf(d: PageDefinition, id: string | null) {
  if (!id) return null;
  return findSection(d, id)?.section ?? findRow(d, id)?.section ?? findColumn(d, id)?.section ?? findBlock(d, id)?.section ?? null;
}

function putSection(d: PageDefinition, before: string | null, s: Section) {
  const i = before ? d.sections.findIndex((x) => x.id === before) : -1;
  if (i < 0) d.sections.push(s);
  else d.sections.splice(i, 0, s);
}
function putRow(d: PageDefinition, sectionId: string, before: string | null, r: Row) {
  const s = d.sections.find((x) => x.id === sectionId) ?? d.sections[0];
  if (!s) return;
  const i = before ? s.rows.findIndex((x) => x.id === before) : -1;
  if (i < 0) s.rows.push(r);
  else s.rows.splice(i, 0, r);
}

/** Applies a drop. Returns the new definition and what to select. */
export function drop(def: PageDefinition, drag: Drag, target: Target): { def: PageDefinition; select?: string } {
  const d = copy(def);

  if (drag.t === "section") {
    if (target.t !== "sgap" || target.before === drag.id) return { def };
    const at = findSection(d, drag.id);
    if (!at) return { def };
    d.sections.splice(at.index, 1);
    putSection(d, target.before, at.section);
    return { def: d, select: at.section.id };
  }
  if (drag.t === "new-section") {
    if (target.t !== "sgap") return { def };
    const s = reIdSection(drag.make());
    putSection(d, target.before, s);
    return { def: d, select: s.id };
  }

  if (drag.t === "row" || drag.t === "new-layout") {
    let r: Row;
    if (drag.t === "row") {
      const at = findRow(d, drag.id);
      if (!at || (target.t === "gap" && target.before === drag.id)) return { def };
      at.section.rows.splice(at.index, 1);
      r = at.row;
    } else {
      r = { id: uid(), columns: Array.from({ length: drag.cols }, () => ({ id: uid(), blocks: [] })) };
    }
    if (target.t === "gap") putRow(d, target.section, target.before, r);
    else if (target.t === "sgap") putSection(d, target.before, makeSection("Section", [r]));
    else return { def };
    return { def: d, select: r.id };
  }

  // A block: new from the palette, or moved.
  if (drag.t === "block" && target.t === "slot" && target.before === drag.id) return { def };
  const b = drag.t === "block" ? findBlock(d, drag.id)?.block : block(drag.kind, drag.patch);
  if (!b) return { def };
  let from: { col: string } | null = null;
  if (drag.t === "block") {
    const at = findBlock(d, drag.id)!;
    from = { col: at.col.id };
    at.col.blocks.splice(at.index, 1);
  }

  let landedRow: string | null = null;
  if (target.t === "sgap") {
    const r: Row = { id: uid(), columns: [{ id: uid(), blocks: [b] }] };
    putSection(d, target.before, makeSection(b.kind === "menu" ? "Header" : b.kind === "footer" ? "Footer" : "Section", [r], b.kind === "menu" ? { padding: "s" } : b.kind === "footer" ? { padding: "m", background: "#0b1b3a" } : {}));
    landedRow = r.id;
  } else if (target.t === "gap") {
    const r: Row = { id: uid(), columns: [{ id: uid(), blocks: [b] }] };
    putRow(d, target.section, target.before, r);
    landedRow = r.id;
  } else if (target.t === "slot") {
    const at = findColumn(d, target.col);
    if (!at) return { def };
    const i = target.before ? at.col.blocks.findIndex((x) => x.id === target.before) : -1;
    if (i < 0) at.col.blocks.push(b);
    else at.col.blocks.splice(i, 0, b);
    landedRow = at.row.id;
  } else {
    const at = findColumn(d, target.col);
    if (!at || at.row.columns.length >= 4) return { def };
    at.row.columns.splice(target.side === "left" ? at.index : at.index + 1, 0, { id: uid(), blocks: [b] });
    landedRow = at.row.id;
  }

  if (from) {
    const src = findColumn(d, from.col);
    if (src && !src.col.blocks.length) {
      if (src.row.columns.length > 1) src.row.columns = src.row.columns.filter((c) => c.id !== from!.col);
      else if (src.row.id !== landedRow) src.section.rows = src.section.rows.filter((r) => r.id !== src.row.id);
    }
  }
  return { def: d, select: b.id };
}

/** Adds by clicking: after the selected block, into the selected column or section, or as a new section at the end. */
export function addByClick(def: PageDefinition, drag: Drag, selected: string | null): { def: PageDefinition; select?: string } {
  if (drag.t === "new-section") {
    const at = sectionOf(def, selected);
    const i = at ? def.sections.findIndex((s) => s.id === at.id) : -1;
    return drop(def, drag, { t: "sgap", before: i >= 0 ? (def.sections[i + 1]?.id ?? null) : null });
  }
  if (drag.t === "new-layout") {
    const s = sectionOf(def, selected);
    return s ? drop(def, drag, { t: "gap", section: s.id, before: null }) : drop(def, drag, { t: "sgap", before: null });
  }
  if (selected) {
    const b = findBlock(def, selected);
    if (b) return drop(def, drag, { t: "slot", col: b.col.id, before: b.col.blocks[b.index + 1]?.id ?? null });
    const c = findColumn(def, selected);
    if (c) return drop(def, drag, { t: "slot", col: c.col.id, before: null });
    const r = findRow(def, selected);
    if (r) {
      const empty = r.row.columns.find((x) => !x.blocks.length) ?? r.row.columns.at(-1)!;
      return drop(def, drag, { t: "slot", col: empty.id, before: null });
    }
    const s = findSection(def, selected);
    if (s) return drop(def, drag, { t: "gap", section: s.section.id, before: null });
  }
  return drop(def, drag, { t: "sgap", before: null });
}

// ---------------------------------------------------------------- blocks
export function updateBlock(def: PageDefinition, id: string, patch: Partial<PBlock>): PageDefinition {
  const d = copy(def);
  const at = findBlock(d, id);
  if (at) at.col.blocks[at.index] = { ...at.block, ...patch };
  return d;
}
export function removeBlock(def: PageDefinition, id: string): PageDefinition {
  const d = copy(def);
  const at = findBlock(d, id);
  if (!at) return def;
  at.col.blocks.splice(at.index, 1);
  if (!at.col.blocks.length && at.row.columns.length > 1) at.row.columns = at.row.columns.filter((c) => c.id !== at.col.id);
  if (at.row.columns.every((c) => !c.blocks.length)) at.section.rows = at.section.rows.filter((r) => r.id !== at.row.id);
  return d;
}
export function duplicateBlock(def: PageDefinition, id: string): { def: PageDefinition; select?: string } {
  const d = copy(def);
  const at = findBlock(d, id);
  if (!at) return { def };
  const dup = { ...structuredClone(at.block), id: uid() };
  at.col.blocks.splice(at.index + 1, 0, dup);
  return { def: d, select: dup.id };
}
export function moveBlockBy(def: PageDefinition, id: string, dir: -1 | 1): PageDefinition {
  const d = copy(def);
  const at = findBlock(d, id);
  if (!at) return def;
  const j = at.index + dir;
  if (j < 0 || j >= at.col.blocks.length) return def;
  [at.col.blocks[at.index], at.col.blocks[j]] = [at.col.blocks[j], at.col.blocks[at.index]];
  return d;
}

// ---------------------------------------------------------------- rows
export function removeRow(def: PageDefinition, id: string): PageDefinition {
  const d = copy(def);
  const at = findRow(d, id);
  if (at) at.section.rows.splice(at.index, 1);
  return d;
}
function reIdRow(r: Row): Row {
  return { ...structuredClone(r), id: uid(), columns: r.columns.map((c) => ({ id: uid(), blocks: c.blocks.map((b) => ({ ...structuredClone(b), id: uid() })) })) };
}
function reIdSection(s: Section): Section {
  return { ...structuredClone(s), id: uid(), rows: s.rows.map(reIdRow) };
}
export function duplicateRow(def: PageDefinition, id: string): { def: PageDefinition; select?: string } {
  const d = copy(def);
  const at = findRow(d, id);
  if (!at) return { def };
  const r = reIdRow(at.row);
  at.section.rows.splice(at.index + 1, 0, r);
  return { def: d, select: r.id };
}
export function setColumns(def: PageDefinition, rowId: string, n: number): PageDefinition {
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
export function moveRowBy(def: PageDefinition, rowId: string, dir: -1 | 1): PageDefinition {
  const d = copy(def);
  const at = findRow(d, rowId);
  if (!at) return def;
  const j = at.index + dir;
  if (j < 0 || j >= at.section.rows.length) return def;
  [at.section.rows[at.index], at.section.rows[j]] = [at.section.rows[j], at.section.rows[at.index]];
  return d;
}
export function updateRow(def: PageDefinition, rowId: string, patch: Partial<Row>): PageDefinition {
  const d = copy(def);
  const at = findRow(d, rowId);
  if (at) at.section.rows[at.index] = { ...at.row, ...patch };
  return d;
}
export function removeColumn(def: PageDefinition, id: string): PageDefinition {
  const d = copy(def);
  const at = findColumn(d, id);
  if (!at) return def;
  if (at.row.columns.length > 1) at.row.columns.splice(at.index, 1);
  else at.section.rows = at.section.rows.filter((r) => r.id !== at.row.id);
  return d;
}

// ---------------------------------------------------------------- sections
export function updateSection(def: PageDefinition, id: string, patch: Partial<Section>): PageDefinition {
  const d = copy(def);
  const at = findSection(d, id);
  if (at) d.sections[at.index] = { ...at.section, ...patch, style: { ...at.section.style, ...(patch.style ?? {}) } };
  return d;
}
export function removeSection(def: PageDefinition, id: string): PageDefinition {
  const d = copy(def);
  d.sections = d.sections.filter((s) => s.id !== id);
  return d;
}
export function duplicateSection(def: PageDefinition, id: string): { def: PageDefinition; select?: string } {
  const d = copy(def);
  const at = findSection(d, id);
  if (!at) return { def };
  const s = { ...reIdSection(at.section), anchor: "" };
  d.sections.splice(at.index + 1, 0, s);
  return { def: d, select: s.id };
}
export function moveSectionBy(def: PageDefinition, id: string, dir: -1 | 1): PageDefinition {
  const d = copy(def);
  const i = d.sections.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= d.sections.length) return def;
  [d.sections[i], d.sections[j]] = [d.sections[j], d.sections[i]];
  return d;
}
