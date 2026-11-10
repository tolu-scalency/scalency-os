"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// A thin gradient bar at the top of the window while the next page loads, like most modern web apps.
export function NavProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download") || !a.href) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setState("loading");
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // The address changed, so the new page is on screen: finish the bar and fade it out.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => (s === "loading" ? "done" : s));
    const t = setTimeout(() => setState("idle"), 450);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2.5px]">
      <div
        className="h-full bg-[linear-gradient(90deg,#55e3ec,#29b0f8,#0a5fe3)] shadow-[0_0_10px_rgba(41,176,248,0.7)]"
        style={{
          width: state === "idle" ? "0%" : state === "loading" ? "82%" : "100%",
          opacity: state === "idle" ? 0 : 1,
          transition:
            state === "loading" ? "width 2.4s cubic-bezier(.1,.7,.2,1), opacity .1s" : state === "done" ? "width .2s ease-out, opacity .3s ease .2s" : "none",
        }}
      />
    </div>
  );
}
