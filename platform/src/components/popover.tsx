"use client";

// A floating panel attached to a button. It renders on top of everything (so side
// panels and scroll areas can't cut it off), opens below or above the button,
// whichever has room, and always stays inside the screen.

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Place = { top: number; left: number; maxHeight: number; above: boolean };

export function Popover({
  anchor,
  open,
  onClose,
  width = 320,
  align = "start",
  children,
  label,
}: {
  anchor: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  width?: number;
  align?: "start" | "end";
  children: React.ReactNode;
  label?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Place | null>(null);
  // The latest close handler, without re-running the placement effect on every render.
  const closeRef = useRef(onClose);
  useLayoutEffect(() => {
    closeRef.current = onClose;
  });

  // Place it next to the button, keep it on screen, and close on a click outside or Esc.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const a = anchor.current?.getBoundingClientRect();
      if (!a) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = Math.min(width, vw - 16);
      const below = vh - a.bottom - 12;
      const aboveRoom = a.top - 12;
      const above = below < 260 && aboveRoom > below;
      const maxHeight = Math.max(180, Math.min(440, above ? aboveRoom : below));
      let left = align === "end" ? a.right - w : a.left;
      left = Math.max(8, Math.min(left, vw - w - 8));
      setPlace((p) => (p && p.top === (above ? a.top - 6 : a.bottom + 6) && p.left === left && p.maxHeight === maxHeight && p.above === above ? p : { top: above ? a.top - 6 : a.bottom + 6, left, maxHeight, above }));
    };
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || anchor.current?.contains(t)) return;
      closeRef.current();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        anchor.current?.focus();
      }
    };
    measure();
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key, true);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, anchor, width, align]);

  if (!open || !place || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-label={label}
      className="rise fixed z-[90] flex flex-col overflow-hidden rounded-xl border border-line bg-white"
      style={{
        left: place.left,
        width: Math.min(width, window.innerWidth - 16),
        maxHeight: place.maxHeight,
        ...(place.above ? { bottom: window.innerHeight - place.top } : { top: place.top }),
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

/** Up/down/enter through a filtered list. Returns the active index and a key handler. */
export function useListKeys(count: number, onEnter: (i: number) => void) {
  const [active, setActive] = useState(0);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (count ? (a + 1) % count : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (count ? (a - 1 + count) % count : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (count) onEnter(Math.min(active, count - 1));
    }
  };
  return { active: Math.min(active, Math.max(0, count - 1)), setActive, onKeyDown };
}
