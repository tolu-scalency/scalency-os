"use client";

import { useEffect } from "react";

/** Brings the homepage to life: sections and cards rise in as you scroll, and the hero's last word
 *  types, clears and rewrites itself. Nothing moves for people who ask for reduced motion. */
export function SiteMotion() {
  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;
    if (still) return;
    root.classList.add("motion-on");

    // Mark the static sections' blocks so they rise in.
    const targets = document.querySelectorAll<HTMLElement>(".site section .wrap > *, .home-extras section > div > *, .rv");
    targets.forEach((el, i) => {
      if (!el.classList.contains("rv")) {
        el.classList.add("rv");
        el.style.setProperty("--rv-delay", `${(i % 4) * 0.06}s`);
      }
    });
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("rv-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    document.querySelectorAll(".rv").forEach((el) => io.observe(el));

    // The hero's last word: types, clears and rewrites.
    const span = document.querySelector<HTMLElement>("[data-type-words]");
    let t: ReturnType<typeof setTimeout> | undefined;
    if (span) {
      const words = (span.dataset.typeWords ?? "").split("|").filter(Boolean);
      span.classList.add("typing");
      let w = 0;
      let n = words[0]?.length ?? 0;
      let deleting = true;
      const tick = () => {
        if (deleting) {
          n--;
          if (n <= 0) {
            deleting = false;
            w = (w + 1) % words.length;
          }
        } else n++;
        span.textContent = words[w].slice(0, Math.max(0, n));
        if (!deleting && n >= words[w].length) {
          deleting = true;
          t = setTimeout(tick, 2600);
          return;
        }
        t = setTimeout(tick, deleting ? 45 : 85);
      };
      if (words.length > 1) t = setTimeout(tick, 2600);
    }
    return () => {
      io.disconnect();
      if (t) clearTimeout(t);
      root.classList.remove("motion-on");
    };
  }, []);
  return null;
}
