"use client";

// The Form Studio canvas: the form drawn exactly as visitors see it, with drop
// zones between rows, inside columns and beside columns. Drag rows by their
// handle, drag blocks anywhere, click to select.

import { useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { Icon } from "@/components/icon";
import { ContentView, FieldView, palette } from "@/components/lead-form";
import { FONTS, bookingStepIx, kindInfo, type Block, type FormDefinition, type Row, type Step } from "@/lib/form-builder";
import { targetKey, type Drag, type Target } from "./tree";

export type CanvasProps = {
  def: FormDefinition;
  step: Step;
  device: "desktop" | "mobile";
  selected: string | null;
  drag: Drag | null;
  readOnly: boolean;
  onSelect: (id: string | null) => void;
  onDragStart: (d: Drag) => void;
  onDragEnd: () => void;
  onDrop: (t: Target) => void;
  onRowAction: (rowId: string, action: "up" | "down" | "duplicate" | "delete" | "cols1" | "cols2" | "cols3" | "cols4") => void;
  onBlockAction: (id: string, action: "duplicate" | "delete") => void;
};

const BRAND = "#0a5fe3";

export function Canvas(props: CanvasProps) {
  const { def, step, device, drag, readOnly, onSelect } = props;
  const t = def.theme;
  const p = palette(t);
  const [over, setOver] = useState<string | null>(null);
  const width = device === "mobile" ? 375 : t.width;

  const zone = (target: Target, kind: "gap" | "slot" | "side", extra?: ReactNode) => {
    const key = targetKey(target);
    const active = Boolean(drag) && !readOnly && accepts(drag!, target);
    const hot = over === key && active;
    const base: CSSProperties =
      kind === "side"
        ? { position: "absolute", top: 0, bottom: 0, width: 22, [target.t === "side" && target.side === "left" ? "left" : "right"]: -14, zIndex: 3 }
        : { height: active ? (kind === "gap" ? 22 : 16) : kind === "gap" ? 8 : 4, margin: kind === "gap" ? "2px 0" : "1px 0", transition: "height .12s" };
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
            borderRadius: 6,
            background: hot ? `${BRAND}33` : active && kind !== "side" ? `${BRAND}0d` : "transparent",
            boxShadow: hot ? `inset 0 0 0 2px ${BRAND}` : "none",
            transition: "background .12s",
          }}
        />
        {extra}
      </div>
    );
  };

  // Dropping straight onto a question or section works too: the top half puts
  // it before, the bottom half after, and the matching drop line lights up.
  const aim: Aim = {
    hover: (e, target) => {
      if (!drag || readOnly || !accepts(drag, target)) return;
      e.preventDefault();
      e.stopPropagation();
      const key = targetKey(target);
      if (over !== key) setOver(key);
    },
    land: (e, target) => {
      if (!drag || readOnly || !accepts(drag, target)) return;
      e.preventDefault();
      e.stopPropagation();
      setOver(null);
      props.onDrop(target);
    },
  };

  return (
    <div
      onClick={() => onSelect(null)}
      className="min-h-full w-full overflow-auto"
      style={{ background: t.background, padding: device === "mobile" ? "28px 12px 80px" : "40px 24px 100px", transition: "background .2s" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: width,
          margin: "0 auto",
          fontFamily: FONTS[t.font]?.stack,
          color: p.fg,
          transition: "max-width .25s",
          ...(t.card ? { background: p.card, borderRadius: Math.max(t.radius + 6, 14), padding: device === "mobile" ? "24px 18px" : "32px 28px", boxShadow: "0 24px 60px -24px rgba(11,27,58,0.28)" } : {}),
          ...(device === "mobile" ? { outline: "1px solid rgba(15,23,42,0.08)" } : {}),
        }}
      >
        {def.steps.length > 1 && def.progress !== "none" && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: p.muted, marginBottom: 6 }}>
              <span>{step.title}</span>
              <span>
                Step {def.steps.findIndex((s) => s.id === step.id) + 1} of {def.steps.length}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: p.line }}>
              <div style={{ height: "100%", width: `${((def.steps.findIndex((s) => s.id === step.id) + 1) / def.steps.length) * 100}%`, background: t.accent, borderRadius: 999 }} />
            </div>
          </div>
        )}

        {step.rows.length === 0 ? (
          <div
            onDragOver={(e) => {
              if (drag && !readOnly) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (drag) props.onDrop({ t: "gap", step: step.id, before: null });
            }}
            style={{ border: `2px dashed ${drag ? BRAND : p.line}`, borderRadius: 16, padding: "48px 20px", textAlign: "center", color: p.muted, fontSize: 14, background: drag ? `${BRAND}0d` : "transparent" }}
          >
            <div style={{ fontWeight: 700, color: p.fg, marginBottom: 4 }}>This step is empty</div>
            Drag fields, sections or content here from the left, or click one to add it.
          </div>
        ) : (
          <>
            {step.rows.map((r, i) => (
              <div key={r.id}>
                {zone({ t: "gap", step: step.id, before: r.id }, "gap")}
                <RowView {...props} row={r} index={i} total={step.rows.length} nextRow={step.rows[i + 1]?.id ?? null} zone={zone} aim={aim} />
              </div>
            ))}
            {zone({ t: "gap", step: step.id, before: null }, "gap")}
          </>
        )}

        {(() => {
          const ix = def.steps.findIndex((s) => s.id === step.id);
          const bix = bookingStepIx(def);
          if (bix > 0 && ix === bix) return null;
          const finish = bix > 0 ? ix === bix - 1 : ix === def.steps.length - 1;
          return (
            <div style={{ marginTop: 18, display: "flex", gap: 10, justifyContent: t.buttonAlign === "center" ? "center" : "flex-start", pointerEvents: "none" }}>
              {ix > 0 && <span style={btn(def, true)}>{def.back}</span>}
              <span style={{ ...btn(def), flex: t.buttonAlign === "full" ? 1 : undefined }}>{finish ? def.button : def.next}</span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function btn(def: FormDefinition, ghost = false): CSSProperties {
  const t = def.theme;
  const outline = ghost || t.buttonStyle === "outline";
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    padding: "0 26px",
    borderRadius: t.buttonStyle === "pill" ? 999 : t.radius,
    border: `2px solid ${ghost ? palette(t).line : t.accent}`,
    background: outline ? "transparent" : t.accent,
    color: outline ? (ghost ? palette(t).fg : t.accent) : "#fff",
    fontWeight: 700,
    fontSize: 16,
  };
}

/** What can go where: rows and layouts only between rows; blocks anywhere. */
type Aim = { hover: (e: DragEvent, t: Target) => void; land: (e: DragEvent, t: Target) => void };

/** True when the pointer is in the lower half of the element. */
const lowerHalf = (e: DragEvent) => {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  return e.clientY > r.top + r.height / 2;
};

function accepts(drag: Drag, target: Target) {
  if (drag.t === "row" || drag.t === "new-layout") return target.t === "gap";
  return true;
}

function RowView({
  row,
  index,
  total,
  zone,
  def,
  step,
  selected,
  drag,
  readOnly,
  onSelect,
  onDragStart,
  onDragEnd,
  onRowAction,
  onBlockAction,
  nextRow,
  aim,
}: CanvasProps & { row: Row; index: number; total: number; nextRow: string | null; zone: (t: Target, k: "gap" | "slot" | "side") => ReactNode; aim: Aim }) {
  const t = def.theme;
  const isSel = selected === row.id;
  const [hover, setHover] = useState(false);
  const show = (hover || isSel) && !drag;
  const rowTarget = (e: DragEvent): Target => ({ t: "gap", step: step.id, before: lowerHalf(e) ? nextRow : row.id });
  const moving = drag?.t === "row" || drag?.t === "new-layout";
  return (
    <div
      onDragOver={(e) => moving && aim.hover(e, rowTarget(e))}
      onDrop={(e) => moving && aim.land(e, rowTarget(e))}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: "relative", borderRadius: 12, outline: isSel ? `2px solid ${BRAND}` : show ? `1.5px dashed ${BRAND}66` : "1.5px dashed transparent", outlineOffset: 6, transition: "outline-color .12s" }}
    >
      {show && !readOnly && (
        <div
          style={{ position: "absolute", left: -6, top: -34, zIndex: 5, display: "flex", alignItems: "center", gap: 2, padding: 3, borderRadius: 10, background: "#0b1b3a", color: "#fff", boxShadow: "0 8px 20px -8px rgba(0,0,0,.4)", fontFamily: "var(--font-sans, system-ui)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <span
            draggable
            onDragStart={(e: DragEvent) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", row.id);
              onDragStart({ t: "row", id: row.id });
            }}
            onDragEnd={onDragEnd}
            onClick={() => onSelect(row.id)}
            title="Drag to move this section"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 7, cursor: "grab", fontSize: 11.5, fontWeight: 700 }}
          >
            <Icon name="grip" size={12} /> Section
          </span>
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              title={`${n} column${n > 1 ? "s" : ""}`}
              onClick={() => onRowAction(row.id, `cols${n}` as "cols1")}
              style={{ width: 26, height: 24, borderRadius: 6, border: 0, cursor: "pointer", background: row.columns.length === n ? "rgba(255,255,255,.22)" : "transparent", color: "#fff", display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 2, padding: "6px 5px" }}
            >
              {Array.from({ length: n }).map((_, i) => (
                <span key={i} style={{ background: "currentColor", borderRadius: 1, opacity: 0.85 }} />
              ))}
            </button>
          ))}
          <span style={{ width: 1, height: 16, background: "rgba(255,255,255,.2)", margin: "0 2px" }} />
          <ToolBtn icon="up" title="Move up" disabled={index === 0} onClick={() => onRowAction(row.id, "up")} />
          <ToolBtn icon="down" title="Move down" disabled={index === total - 1} onClick={() => onRowAction(row.id, "down")} />
          <ToolBtn icon="copy" title="Duplicate section" onClick={() => onRowAction(row.id, "duplicate")} />
          <ToolBtn icon="trash" title="Delete section" onClick={() => onRowAction(row.id, "delete")} danger />
        </div>
      )}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelect(row.id);
        }}
        style={{ display: "grid", gap: 14, gridTemplateColumns: `repeat(${row.columns.length}, minmax(0, 1fr))` }}
      >
        {row.columns.map((c) => (
          <div key={c.id} style={{ position: "relative", minWidth: 0, display: "flex", flexDirection: "column", borderRadius: 10, background: drag && !c.blocks.length ? `${BRAND}08` : undefined }}>
            {row.columns.length < 4 && zone({ t: "side", col: c.id, side: "left" }, "side")}
            {row.columns.length < 4 && zone({ t: "side", col: c.id, side: "right" }, "side")}
            {c.blocks.length === 0 && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(c.id);
                }}
                style={{ border: `1.5px dashed ${selected === c.id ? BRAND : palette(t).line}`, borderRadius: 10, padding: "18px 10px", textAlign: "center", fontSize: 12.5, color: palette(t).muted, cursor: "pointer" }}
              >
                Drop a field here
              </div>
            )}
            {c.blocks.map((b, bi) => (
              <div
                key={b.id}
                onDragOver={(e) => drag && drag.t !== "row" && drag.t !== "new-layout" && aim.hover(e, { t: "slot", col: c.id, before: lowerHalf(e) ? (c.blocks[bi + 1]?.id ?? null) : b.id })}
                onDrop={(e) => drag && drag.t !== "row" && drag.t !== "new-layout" && aim.land(e, { t: "slot", col: c.id, before: lowerHalf(e) ? (c.blocks[bi + 1]?.id ?? null) : b.id })}
              >
                {zone({ t: "slot", col: c.id, before: b.id }, "slot")}
                <BlockView b={b} def={def} selected={selected === b.id} dragging={Boolean(drag)} readOnly={readOnly} onSelect={onSelect} onDragStart={onDragStart} onDragEnd={onDragEnd} onAction={onBlockAction} />
              </div>
            ))}
            {zone({ t: "slot", col: c.id, before: null }, "slot")}
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolBtn({ icon, title, onClick, disabled, danger }: { icon: string; title: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      style={{ width: 26, height: 24, borderRadius: 6, border: 0, background: "transparent", color: danger ? "#fca5a5" : "#fff", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1, display: "grid", placeItems: "center" }}
    >
      <Icon name={icon as "copy"} size={13} />
    </button>
  );
}

function BlockView({
  b,
  def,
  selected,
  dragging,
  readOnly,
  onSelect,
  onDragStart,
  onDragEnd,
  onAction,
}: {
  b: Block;
  def: FormDefinition;
  selected: boolean;
  dragging: boolean;
  readOnly: boolean;
  onSelect: (id: string) => void;
  onDragStart: (d: Drag) => void;
  onDragEnd: () => void;
  onAction: (id: string, a: "duplicate" | "delete") => void;
}) {
  const [hover, setHover] = useState(false);
  const label = b.type === "field" ? (b.kind === "custom" ? "Contact field" : kindInfo(b.kind)?.label) : b.kind === "booking" ? "Booking calendar" : b.kind[0].toUpperCase() + b.kind.slice(1);
  return (
    <div
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
        onSelect(b.id);
      }}
      style={{
        position: "relative",
        padding: 8,
        margin: -8,
        borderRadius: 10,
        cursor: readOnly ? "pointer" : "grab",
        outline: selected ? `2px solid ${BRAND}` : hover && !dragging ? `1.5px solid ${BRAND}80` : "1.5px solid transparent",
        background: selected ? `${BRAND}08` : undefined,
      }}
    >
      {(hover || selected) && !dragging && (
        <div style={{ position: "absolute", right: 6, top: -12, zIndex: 4, display: "flex", alignItems: "center", gap: 2, padding: "2px 3px", borderRadius: 8, background: BRAND, color: "#fff", fontSize: 11, fontWeight: 700, fontFamily: "var(--font-sans, system-ui)", boxShadow: "0 6px 16px -6px rgba(10,95,227,.6)" }}>
          <span style={{ padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon name="grip" size={11} /> {label}
            {b.logic?.field && <span title="Shown only when a rule matches" style={{ marginLeft: 2 }}>· rule</span>}
          </span>
          {!readOnly && (
            <>
              <ToolBtn icon="copy" title="Duplicate" onClick={() => onAction(b.id, "duplicate")} />
              <ToolBtn icon="trash" title="Delete" onClick={() => onAction(b.id, "delete")} danger />
            </>
          )}
        </div>
      )}
      <div style={{ opacity: b.logic?.field ? 0.85 : 1 }}>
        {b.type === "content" ? <ContentView b={b} theme={def.theme} design /> : <FieldView f={b} value={undefined} onChange={() => {}} theme={def.theme} design />}
      </div>
    </div>
  );
}
