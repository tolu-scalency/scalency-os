"use client";

import { useEffect } from "react";

/** Brings the original homepage design to life without changing its look: the hero dashboard's
 *  lines draw in, its numbers count up and its live activity keeps moving; cards lift on hover.
 *  The orbit and button motion is in CSS. Nothing moves for people who ask for reduced motion. */
export function HomeMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const hero = document.querySelector<HTMLElement>(".site section");
    const timers: ReturnType<typeof setInterval>[] = [];
    const frames: number[] = [];

    if (hero) {
      // Chart and sparkline lines draw themselves.
      hero.querySelectorAll<SVGPathElement>("svg path").forEach((p, i) => {
        const fill = p.getAttribute("style") ?? "";
        if (!/fill:\s*none/.test(fill)) {
          p.classList.add("hm-area");
          return;
        }
        p.setAttribute("pathLength", "1");
        p.classList.add("hm-draw");
        p.style.animationDelay = `${0.3 + (i % 6) * 0.12}s`;
      });
      // KPI numbers count up.
      hero.querySelectorAll<HTMLElement>("div").forEach((el) => {
        if (el.children.length || !/font-size:\s*20px/.test(el.getAttribute("style") ?? "")) return;
        const m = (el.textContent ?? "").trim().match(/^(£?)(\d+)(k?)$/);
        if (!m) return;
        const to = Number(m[2]);
        const start = performance.now();
        const step = (now: number) => {
          const p = Math.min(1, (now - start) / 1600);
          el.textContent = `${m[1]}${Math.round(to * (1 - Math.pow(1 - p, 3)))}${m[3]}`;
          if (p < 1) frames.push(requestAnimationFrame(step));
        };
        frames.push(requestAnimationFrame(step));
      });
      // Live activity: the newest item slides in at the top every few seconds.
      const label = [...hero.querySelectorAll<HTMLElement>("div")].find((d) => d.children.length === 0 && d.textContent?.trim() === "Live activity");
      const list = label?.parentElement;
      if (list && list.children.length > 2) {
        timers.push(
          setInterval(() => {
            const rows = [...list.children].slice(1) as HTMLElement[];
            const last = rows[rows.length - 1];
            last.classList.remove("hm-new");
            list.insertBefore(last, rows[0]);
            void last.offsetWidth;
            last.classList.add("hm-new");
          }, 2800),
        );
      }
    }

    // Cards lift on hover across the original sections.
    document.querySelectorAll<HTMLElement>('.site section [style*="border-radius: 1"], .site section [style*="border-radius: 2"]').forEach((el) => {
      const s = el.getAttribute("style") ?? "";
      if (/border:\s*1px solid/.test(s) && /padding/.test(s) && el.offsetWidth > 160) el.classList.add("hm-card");
    });

    return () => {
      timers.forEach(clearInterval);
      frames.forEach(cancelAnimationFrame);
    };
  }, []);
  return null;
}
