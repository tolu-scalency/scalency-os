"use client";

// A floating settings panel. Drag it by its header to anywhere on the page; it
// remembers where you left it. "Dock" puts it back on the right.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";

type Pos = { x: number; y: number; w: number };
const KEY = "scalency.wf-panel";
const DEFAULT_W = 420;

function docked(): Pos {
  const w = typeof window === "undefined" ? 1280 : window.innerWidth;
  return { x: Math.max(8, w - DEFAULT_W - 16), y: 84, w: DEFAULT_W };
}

export function FloatingPanel({ title, subtitle, icon, tone, onClose, children, footer }: { title: string; subtitle?: string; icon: ReactNode; tone?: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const [pos, setPos] = useState<Pos | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const resize = useRef<{ startX: number; startW: number } | null>(null);

  useEffect(() => {
    let p = docked();
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Pos | null;
      if (saved && typeof saved.x === "number") p = clamp(saved);
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPos(p);
    const onResize = () => setPos((q) => (q ? clamp(q) : q));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function clamp(p: Pos): Pos {
    const w = Math.min(Math.max(p.w || DEFAULT_W, 320), Math.min(720, window.innerWidth - 16));
    return { w, x: Math.min(Math.max(8, p.x), window.innerWidth - Math.min(w, 120)), y: Math.min(Math.max(8, p.y), window.innerHeight - 80) };
  }
  function keep(p: Pos) {
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {}
  }

  function onDown(e: React.PointerEvent) {
    if (!pos || (e.target as HTMLElement).closest("button")) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current || !pos) return;
    setPos(clamp({ ...pos, x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy }));
  }
  function onUp() {
    if (drag.current && pos) keep(pos);
    drag.current = null;
  }

  function onResizeDown(e: React.PointerEvent) {
    if (!pos) return;
    resize.current = { startX: e.clientX, startW: pos.w };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onResizeMove(e: React.PointerEvent) {
    if (!resize.current || !pos) return;
    const w = resize.current.startW - (e.clientX - resize.current.startX);
    const next = clamp({ ...pos, w, x: pos.x + (pos.w - w) });
    setPos(next);
  }
  function onResizeUp() {
    if (resize.current && pos) keep(pos);
    resize.current = null;
  }

  if (!pos) return null;
  // On phones the panel is a sheet at the bottom instead. Drawn at the top of the
  // page so nothing on the page can clip or cover it.
  return createPortal(
    <div
      role="dialog"
      aria-label={title}
      style={{ left: pos.x, top: pos.y, width: pos.w }}
      className="flyout fixed z-[60] flex max-h-[calc(100vh-100px)] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_60px_-12px_rgba(15,23,42,0.35)] max-sm:!inset-x-2 max-sm:!bottom-2 max-sm:!top-auto max-sm:!w-auto max-sm:max-h-[75vh]"
    >
      <div
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
        className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-ew-resize hover:bg-sky/40 max-sm:hidden"
        aria-hidden
      />
      <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} className="flex cursor-grab touch-none select-none items-center gap-3 border-b border-line bg-surface/70 px-3.5 py-3 active:cursor-grabbing">
        <Icon name="grip" size={14} className="text-faint" />
        <span className={`inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-gradient-to-br text-white ${tone ?? "from-[#55e3ec] to-[#0a5fe3]"}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold">{title}</div>
          {subtitle && <div className="truncate text-[12px] text-muted">{subtitle}</div>}
        </div>
        <button
          type="button"
          title="Dock to the right"
          aria-label="Dock to the right"
          onClick={() => {
            const p = docked();
            setPos(p);
            keep(p);
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-white hover:text-navy max-sm:hidden"
        >
          <Icon name="panel" size={15} />
        </button>
        <button type="button" title="Close" aria-label="Close panel" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-white hover:text-navy">
          <Icon name="x" size={16} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      {footer && <div className="flex items-center gap-2 border-t border-line bg-white px-4 py-3">{footer}</div>}
    </div>,
    document.body,
  );
}
