"use client";

// A small notice at the top of the screen: "Saved", or what went wrong.
// Call notify() from anywhere in the app; <Toaster /> in the app shell shows it.

import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";

type Tone = "ok" | "bad" | "info";
type Note = { id: number; text: string; tone: Tone };

const EVENT = "scalency:toast";

/** Shows a notice at the top of the screen for a couple of seconds. */
export function notify(text: string, tone: Tone = "ok") {
  if (typeof window === "undefined" || !text) return;
  window.dispatchEvent(new CustomEvent<Omit<Note, "id">>(EVENT, { detail: { text, tone } }));
}

export function Toaster() {
  const [notes, setNotes] = useState<Note[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const all = timers.current;
    const drop = (id: number) => {
      setNotes((n) => n.filter((x) => x.id !== id));
      all.delete(id);
    };
    const onNote = (e: Event) => {
      const { text, tone } = (e as CustomEvent<Omit<Note, "id">>).detail;
      setNotes((list) => {
        // The same notice again (autosave) just stays up a little longer.
        const same = list.find((x) => x.text === text && x.tone === tone);
        const id = same ? same.id : ++seq.current;
        clearTimeout(all.get(id));
        all.set(id, setTimeout(() => drop(id), tone === "bad" ? 6000 : 2200));
        return same ? list : [...list.slice(-2), { id, text, tone }];
      });
    };
    window.addEventListener(EVENT, onNote);
    return () => {
      window.removeEventListener(EVENT, onNote);
      all.forEach(clearTimeout);
    };
  }, []);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4">
      {notes.map((n) => (
        <div
          key={n.id}
          role={n.tone === "bad" ? "alert" : "status"}
          className={`toast-in pointer-events-auto flex max-w-[min(520px,92vw)] items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold shadow-[0_10px_30px_-10px_rgba(10,30,80,.45)] ring-1 ${
            n.tone === "bad" ? "bg-white text-bad ring-bad/25" : n.tone === "info" ? "bg-navy text-white ring-white/10" : "bg-white text-navy ring-line"
          }`}
        >
          <span className={`inline-flex h-5 w-5 flex-none items-center justify-center rounded-full ${n.tone === "bad" ? "bg-bad-bg text-bad" : n.tone === "info" ? "bg-white/15" : "bg-ok-bg text-ok"}`}>
            <Icon name={n.tone === "bad" ? "x" : n.tone === "info" ? "bell" : "check"} size={12} />
          </span>
          <span className="truncate">{n.text}</span>
        </div>
      ))}
    </div>
  );
}
