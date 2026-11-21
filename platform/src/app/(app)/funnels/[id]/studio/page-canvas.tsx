"use client";

// The Page Studio canvas: the page drawn exactly as visitors see it, with drop
// zones between sections, between rows, inside columns and beside columns.
// Drag sections and rows by their handles, drag blocks anywhere, click to select.

import { useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { Icon } from "@/components/icon";
import { BlockView, PAGE_CSS, RowShell, SectionShell, SiteLinksProvider } from "@/components/page-view";
import type { SiteLinks } from "@/lib/site-builder";
import { FONTS, blockInfo, textTone, type PBlock, type PageDefinition, type Row, type Section } from "@/lib/page-builder";
import { accepts, targetKey, type Drag, type Target } from "./page-tree";

export type RowAction = "up" | "down" | "duplicate" | "delete" | "cols1" | "cols2" | "cols3" | "cols4";
export type SectionAction = "up" | "down" | "duplicate" | "delete";

export type PageCanvasProps = {
  def: PageDefinition;
  device: "desktop" | "mobile";
  selected: string | null;
  drag: Drag | null;
  readOnly: boolean;
  onSelect: (id: string | null) => void;
  onDragStart: (d: Drag) => void;
  onDragEnd: () => void;
  onDrop: (t: Target) => void;
  onSectionAction: (id: string, a: SectionAction) => void;
  onRowAction: (id: string, a: RowAction) => void;
  onBlockAction: (id: string, a: "duplicate" | "delete" | "up" | "down") => void;
  /** Funnels and websites: where "next step", page and menu links go. */
  links?: SiteLinks | null;
  /** Websites: the shared header and footer, shown above and below the page. */
  before?: ReactNode;
  after?: ReactNode;
};

const BRAND = "#0a5fe3";

const lowerHalf = (e: DragEvent) => {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  return e.clientY > r.top + r.height / 2;
};

export function PageCanvas(props: PageCanvasProps) {
  const { def, device, drag, readOnly, onSelect } = props;
  const theme = def.theme;
  const [over, setOver] = useState<string | null>(null);

  const zone = (target: Target, kind: "sgap" | "gap" | "slot" | "side", label?: string) => {
    const key = targetKey(target);
    const active = Boolean(drag) && !readOnly && accepts(drag!, target);
    const hot = over === key && active;
    const base: CSSProperties =
      kind === "side"
        ? { position: "absolute", top: 0, bottom: 0, width: 22, [target.t === "side" && target.side === "left" ? "left" : "right"]: -16, zIndex: 3 }
        : kind === "sgap"
          ? { position: "relative", height: active ? 34 : 0, transition: "height .12s", zIndex: 6 }
          : { height: active ? (kind === "gap" ? 22 : 16) : kind === "gap" ? 6 : 2, margin: kind === "gap" ? "2px 0" : "1px 0", transition: "height .12s" };
    return (
      <div
        key={key}
        style={base}
        onDragOver={(e) => {
          if (!active) return;
          e.preventDefault();
          e.stopPropagation();
          if (over !== key) setOver(key);
        }}
        onDragLeave={() => setOver((o) => (o === key ? null : o))}
        onDrop={(e) => {
          if (!active) return;
          e.preventDefault();
          e.stopPropagation();
          setOver(null);
          props.onDrop(target);
        }}
      >
        <div
          style={{
            height: "100%",
            width: "100%",
            borderRadius: kind === "sgap" ? 0 : 6,
            background: hot ? `${BRAND}40` : active && kind !== "side" ? `${BRAND}12` : "transparent",
            boxShadow: hot ? `inset 0 0 0 2px ${BRAND}` : "none",
            display: "grid",
            placeItems: "center",
            color: BRAND,
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "var(--font-sans, system-ui)",
          }}
        >
          {active && kind === "sgap" ? label ?? "Drop here for a new section" : null}
        </div>
      </div>
    );
  };

  const aim = {
    hover: (e: DragEvent, target: Target) => {
      if (!drag || readOnly || !accepts(drag, target)) return;
      e.preventDefault();
      e.stopPropagation();
      const key = targetKey(target);
      if (over !== key) setOver(key);
    },
    land: (e: DragEvent, target: Target) => {
      if (!drag || readOnly || !accepts(drag, target)) return;
      e.preventDefault();
      e.stopPropagation();
      setOver(null);
      props.onDrop(target);
    },
  };

  return (
    <div onClick={() => onSelect(null)} className="min-h-full w-full" style={{ background: "#eef1f6", padding: device === "mobile" ? "24px 12px 80px" : "20px 20px 80px" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="pv-root"
        style={{
          width: "100%",
          maxWidth: device === "mobile" ? 390 : 1600,
          margin: "0 auto",
          fontFamily: FONTS[theme.font],
          color: theme.text,
          background: theme.background,
          borderRadius: device === "mobile" ? 28 : 12,
          boxShadow: "0 20px 60px -30px rgba(11,27,58,.35)",
          outline: "1px solid rgba(15,23,42,.06)",
          overflow: "clip",
          transition: "max-width .25s",
          minHeight: 400,
        }}
      >
        <style>{PAGE_CSS}</style>
        <SiteLinksProvider value={props.links ?? null}>
        {props.before}
        {def.sections.length === 0 ? (
          <div
            onDragOver={(e) => {
              if (drag && !readOnly) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (drag) props.onDrop({ t: "sgap", before: null });
            }}
            style={{ margin: 24, border: `2px dashed ${drag ? BRAND : "rgba(15,23,42,.15)"}`, borderRadius: 16, padding: "80px 20px", textAlign: "center", color: "#64748b", fontSize: 14, fontFamily: "var(--font-sans, system-ui)" }}
          >
            <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>This page is empty</div>
            Drag a ready-made section or a block here from the left, or click one to add it.
          </div>
        ) : (
          <>
            {def.sections.map((s, i) => (
              <div key={s.id}>
                {zone({ t: "sgap", before: s.id }, "sgap")}
                <SectionView {...props} s={s} index={i} total={def.sections.length} nextSection={def.sections[i + 1]?.id ?? null} zone={zone} aim={aim} />
              </div>
            ))}
            {zone({ t: "sgap", before: null }, "sgap", "Drop here to add it at the end")}
          </>
        )}
        {props.after}
        </SiteLinksProvider>
      </div>
    </div>
  );
}

type Zone = (t: Target, k: "sgap" | "gap" | "slot" | "side", label?: string) => ReactNode;
type Aim = { hover: (e: DragEvent, t: Target) => void; land: (e: DragEvent, t: Target) => void };

function SectionView(props: PageCanvasProps & { s: Section; index: number; total: number; nextSection: string | null; zone: Zone; aim: Aim }) {
  const { s, index, total, def, selected, drag, readOnly, onSelect, onDragStart, onDragEnd, onSectionAction, zone, aim, nextSection } = props;
  const [hover, setHover] = useState(false);
  const isSel = selected === s.id;
  const show = (hover || isSel) && !drag;
  const tone = textTone(s.style, def.theme);
  const moving = drag?.t === "section" || drag?.t === "new-section";
  const sTarget = (e: DragEvent): Target => ({ t: "sgap", before: lowerHalf(e) ? nextSection : s.id });
  return (
    <div
      data-sel={s.id}
      onDragOver={(e) => moving && aim.hover(e, sTarget(e))}
      onDrop={(e) => moving && aim.land(e, sTarget(e))}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(s.id);
      }}
      style={{ position: "relative", outline: isSel ? `2px solid ${BRAND}` : show ? `2px solid ${BRAND}55` : "2px solid transparent", outlineOffset: -2, transition: "outline-color .12s" }}
    >
      {show && !readOnly && (
        <div style={{ position: "absolute", left: 8, top: 8, zIndex: 7, display: "flex", alignItems: "center", gap: 2, padding: 3, borderRadius: 10, background: BRAND, color: "#fff", boxShadow: "0 8px 20px -8px rgba(10,95,227,.6)", fontFamily: "var(--font-sans, system-ui)" }} onClick={(e) => e.stopPropagation()}>
          <span
            draggable
            onDragStart={(e: DragEvent) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", s.id);
              onDragStart({ t: "section", id: s.id });
            }}
            onDragEnd={onDragEnd}
            onClick={() => onSelect(s.id)}
            title="Drag to move this section"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 7, cursor: "grab", fontSize: 11.5, fontWeight: 700 }}
          >
            <Icon name="grip" size={12} /> {s.name || "Section"}
          </span>
          <Tool icon="up" title="Move up" disabled={index === 0} onClick={() => onSectionAction(s.id, "up")} />
          <Tool icon="down" title="Move down" disabled={index === total - 1} onClick={() => onSectionAction(s.id, "down")} />
          <Tool icon="copy" title="Duplicate section" onClick={() => onSectionAction(s.id, "duplicate")} />
          <Tool icon="trash" title="Delete section" onClick={() => onSectionAction(s.id, "delete")} danger />
        </div>
      )}
      <SectionShell s={s} theme={def.theme} editing>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {s.rows.length === 0 && (
            <div
              onDragOver={(e) => drag && !moving && aim.hover(e, { t: "gap", section: s.id, before: null })}
              onDrop={(e) => drag && !moving && aim.land(e, { t: "gap", section: s.id, before: null })}
              style={{ border: `1.5px dashed ${tone === "light" ? "rgba(255,255,255,.4)" : "rgba(15,23,42,.18)"}`, borderRadius: 12, padding: "28px 12px", textAlign: "center", fontSize: 13, opacity: 0.8, fontFamily: "var(--font-sans, system-ui)" }}
            >
              Empty section. Drop blocks or columns here.
            </div>
          )}
          {s.rows.map((r, i) => (
            <div key={r.id} style={{ marginTop: i ? 34 : 0 }}>
              {zone({ t: "gap", section: s.id, before: r.id }, "gap")}
              <RowView {...props} r={r} section={s} index={i} total={s.rows.length} nextRow={s.rows[i + 1]?.id ?? null} tone={tone} />
            </div>
          ))}
          {s.rows.length > 0 && zone({ t: "gap", section: s.id, before: null }, "gap")}
        </div>
      </SectionShell>
    </div>
  );
}

function RowView(props: PageCanvasProps & { r: Row; section: Section; index: number; total: number; nextRow: string | null; tone: "light" | "dark"; zone: Zone; aim: Aim }) {
  const { r, section: s, index, total, nextRow, tone, def, selected, drag, readOnly, onSelect, onDragStart, onDragEnd, onRowAction, onBlockAction, zone, aim } = props;
  const [hover, setHover] = useState(false);
  const isSel = selected === r.id;
  const show = (hover || isSel) && !drag;
  const moving = drag?.t === "row" || drag?.t === "new-layout";
  const rowTarget = (e: DragEvent): Target => ({ t: "gap", section: s.id, before: lowerHalf(e) ? nextRow : r.id });
  const line = tone === "light" ? "rgba(255,255,255,.35)" : "rgba(15,23,42,.16)";
  return (
    <div
      data-sel={r.id}
      onDragOver={(e) => moving && aim.hover(e, rowTarget(e))}
      onDrop={(e) => moving && aim.land(e, rowTarget(e))}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(r.id);
      }}
      style={{ position: "relative", borderRadius: 10, outline: isSel ? `2px solid ${BRAND}` : show ? `1.5px dashed ${BRAND}88` : "1.5px dashed transparent", outlineOffset: 8, textAlign: "left" }}
    >
      {show && !readOnly && (
        <div style={{ position: "absolute", right: -4, top: -36, zIndex: 6, display: "flex", alignItems: "center", gap: 2, padding: 3, borderRadius: 10, background: "#0b1b3a", color: "#fff", boxShadow: "0 8px 20px -8px rgba(0,0,0,.4)", fontFamily: "var(--font-sans, system-ui)" }} onClick={(e) => e.stopPropagation()}>
          <span
            draggable
            onDragStart={(e: DragEvent) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", r.id);
              onDragStart({ t: "row", id: r.id });
            }}
            onDragEnd={onDragEnd}
            onClick={() => onSelect(r.id)}
            title="Drag to move these columns"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 7, cursor: "grab", fontSize: 11.5, fontWeight: 700 }}
          >
            <Icon name="grip" size={12} /> Columns
          </span>
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              title={`${n} column${n > 1 ? "s" : ""}`}
              onClick={() => onRowAction(r.id, `cols${n}` as RowAction)}
              style={{ width: 26, height: 24, borderRadius: 6, border: 0, cursor: "pointer", background: r.columns.length === n ? "rgba(255,255,255,.22)" : "transparent", color: "#fff", display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 2, padding: "6px 5px" }}
            >
              {Array.from({ length: n }).map((_, i) => (
                <span key={i} style={{ background: "currentColor", borderRadius: 1, opacity: 0.85 }} />
              ))}
            </button>
          ))}
          <span style={{ width: 1, height: 16, background: "rgba(255,255,255,.2)", margin: "0 2px" }} />
          <Tool icon="up" title="Move up" disabled={index === 0} onClick={() => onRowAction(r.id, "up")} />
          <Tool icon="down" title="Move down" disabled={index === total - 1} onClick={() => onRowAction(r.id, "down")} />
          <Tool icon="copy" title="Duplicate" onClick={() => onRowAction(r.id, "duplicate")} />
          <Tool icon="trash" title="Delete" onClick={() => onRowAction(r.id, "delete")} danger />
        </div>
      )}
      <RowShell r={r}>
        {r.columns.map((c) => (
          <div key={c.id} className="pv-col" style={{ position: "relative", gap: 0, borderRadius: 10, background: drag && !c.blocks.length ? `${BRAND}0d` : undefined }}>
            {r.columns.length < 4 && zone({ t: "side", col: c.id, side: "left" }, "side")}
            {r.columns.length < 4 && zone({ t: "side", col: c.id, side: "right" }, "side")}
            {c.blocks.length === 0 && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(c.id);
                }}
                onDragOver={(e) => drag && !moving && drag.t !== "section" && drag.t !== "new-section" && aim.hover(e, { t: "slot", col: c.id, before: null })}
                onDrop={(e) => drag && !moving && drag.t !== "section" && drag.t !== "new-section" && aim.land(e, { t: "slot", col: c.id, before: null })}
                style={{ border: `1.5px dashed ${selected === c.id ? BRAND : line}`, borderRadius: 10, padding: "22px 10px", textAlign: "center", fontSize: 12.5, opacity: 0.75, cursor: "pointer", fontFamily: "var(--font-sans, system-ui)" }}
              >
                Drop a block here
              </div>
            )}
            {c.blocks.map((b, bi) => (
              <div
                key={b.id}
                style={{ marginTop: bi ? 18 : 0 }}
                onDragOver={(e) => drag && (drag.t === "block" || drag.t === "new-block") && aim.hover(e, { t: "slot", col: c.id, before: lowerHalf(e) ? (c.blocks[bi + 1]?.id ?? null) : b.id })}
                onDrop={(e) => drag && (drag.t === "block" || drag.t === "new-block") && aim.land(e, { t: "slot", col: c.id, before: lowerHalf(e) ? (c.blocks[bi + 1]?.id ?? null) : b.id })}
              >
                {zone({ t: "slot", col: c.id, before: b.id }, "slot")}
                <BlockEdit b={b} def={def} tone={tone} first={bi === 0} last={bi === c.blocks.length - 1} selected={selected === b.id} dragging={Boolean(drag)} readOnly={readOnly} onSelect={onSelect} onDragStart={onDragStart} onDragEnd={onDragEnd} onAction={onBlockAction} />
              </div>
            ))}
            {c.blocks.length > 0 && zone({ t: "slot", col: c.id, before: null }, "slot")}
          </div>
        ))}
      </RowShell>
    </div>
  );
}

function Tool({ icon, title, onClick, disabled, danger }: { icon: string; title: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      style={{ width: 26, height: 24, borderRadius: 6, border: 0, background: "transparent", color: danger ? "#fecaca" : "#fff", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1, display: "grid", placeItems: "center" }}
    >
      <Icon name={icon as "copy"} size={13} />
    </button>
  );
}

function BlockEdit({
  b,
  def,
  tone,
  first,
  last,
  selected,
  dragging,
  readOnly,
  onSelect,
  onDragStart,
  onDragEnd,
  onAction,
}: {
  b: PBlock;
  def: PageDefinition;
  tone: "light" | "dark";
  first: boolean;
  last: boolean;
  selected: boolean;
  dragging: boolean;
  readOnly: boolean;
  onSelect: (id: string) => void;
  onDragStart: (d: Drag) => void;
  onDragEnd: () => void;
  onAction: (id: string, a: "duplicate" | "delete" | "up" | "down") => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      data-sel={b.id}
      draggable={!readOnly}
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", b.id);
        onDragStart({ t: "block", id: b.id });
      }}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onSelect(b.id);
      }}
      className={b.hideOn ? `pv-edit-hide-${b.hideOn}` : undefined}
      style={{
        position: "relative",
        padding: 6,
        margin: -6,
        borderRadius: 10,
        cursor: readOnly ? "pointer" : "grab",
        outline: selected ? `2px solid ${BRAND}` : hover && !dragging ? `1.5px solid ${BRAND}99` : "1.5px solid transparent",
        background: selected ? `${BRAND}0a` : undefined,
        opacity: b.hideOn ? 0.55 : 1,
      }}
    >
      {(hover || selected) && !dragging && (
        <div style={{ position: "absolute", right: 4, top: -14, zIndex: 5, display: "flex", alignItems: "center", gap: 1, padding: "2px 3px", borderRadius: 8, background: BRAND, color: "#fff", fontSize: 11, fontWeight: 700, fontFamily: "var(--font-sans, system-ui)", boxShadow: "0 6px 16px -6px rgba(10,95,227,.6)", textAlign: "left" }}>
          <span style={{ padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon name="grip" size={11} /> {blockInfo(b.kind).label}
            {b.hideOn && <span title={`Hidden on ${b.hideOn}`}>· hidden on {b.hideOn}</span>}
          </span>
          {!readOnly && (
            <>
              <Tool icon="up" title="Move up" disabled={first} onClick={() => onAction(b.id, "up")} />
              <Tool icon="down" title="Move down" disabled={last} onClick={() => onAction(b.id, "down")} />
              <Tool icon="copy" title="Duplicate" onClick={() => onAction(b.id, "duplicate")} />
              <Tool icon="trash" title="Delete" onClick={() => onAction(b.id, "delete")} danger />
            </>
          )}
        </div>
      )}
      <div style={{ pointerEvents: "none" }}>
        <BlockView b={b} theme={def.theme} tone={tone} editing />
      </div>
    </div>
  );
}
