"use client";

// The homepage hero: what Scalency sells in one look. Leads stream in from every channel to the
// AI core, and booked appointments stream out. Everything is drawn in SVG and CSS, so it stays
// razor-sharp on any screen (4K included) and weighs almost nothing. Rests for reduced motion.

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icon";

const PHRASES = ["finds your leads.", "answers in seconds.", "books the call.", "makes sure they show.", "fills your diary."];

function useTyping(words: string[]) {
  const [text, setText] = useState(words[0]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let w = 0;
    let n = words[0].length;
    let deleting = true;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (deleting) {
        n--;
        if (n <= 0) {
          deleting = false;
          w = (w + 1) % words.length;
        }
      } else n++;
      setText(words[w].slice(0, Math.max(0, n)));
      if (!deleting && n >= words[w].length) {
        deleting = true;
        t = setTimeout(tick, 2300);
        return;
      }
      t = setTimeout(tick, deleting ? 32 : 62);
    };
    t = setTimeout(tick, 2300);
    return () => clearTimeout(t);
  }, [words]);
  return text;
}

function Count({ to, suffix = "", ms = 1800 }: { to: number; suffix?: string; ms?: number }) {
  const [v, setV] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => setV(to), 0);
      return () => clearTimeout(t);
    }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / ms);
        setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, ms]);
  return (
    <span ref={ref}>
      {v}
      {suffix}
    </span>
  );
}

const SOURCES: { label: string; icon: IconName; y: number }[] = [
  { label: "Meta ads", icon: "megaphone", y: 70 },
  { label: "Google", icon: "search", y: 160 },
  { label: "Instagram DMs", icon: "inbox", y: 250 },
  { label: "Website form", icon: "form", y: 340 },
  { label: "Missed calls", icon: "phone", y: 430 },
];
const OUTCOMES = [
  { title: "Booked", text: "Thu 2:30pm · Google Meet", y: 110, tone: "#12b76a" },
  { title: "Reminded", text: "Replied YES to confirm", y: 250, tone: "#2FA8EB" },
  { title: "Showed up", text: "£450 · Revenue tracked", y: 390, tone: "#64E7EF" },
];

/** The engine: channels on the left, the AI core in the middle, booked outcomes on the right. */
function Engine() {
  return (
    <div className="hx-engine" aria-hidden="true">
      <svg viewBox="0 0 900 500" className="hx-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="hx-in" x1="0" x2="1">
            <stop offset="0" stopColor="#64E7EF" stopOpacity="0" />
            <stop offset="1" stopColor="#64E7EF" stopOpacity=".9" />
          </linearGradient>
          <linearGradient id="hx-out" x1="0" x2="1">
            <stop offset="0" stopColor="#2FA8EB" stopOpacity=".9" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="hx-core" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#7ff0f6" />
            <stop offset=".45" stopColor="#2FA8EB" />
            <stop offset="1" stopColor="#0465C7" />
          </radialGradient>
          <filter id="hx-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {SOURCES.map((s, i) => {
          const d = `M190 ${s.y} C 300 ${s.y}, 330 250, 410 250`;
          return (
            <g key={s.label}>
              <path d={d} className="hx-wire" />
              <path d={d} className="hx-flow" stroke="url(#hx-in)" style={{ animationDelay: `${i * 0.45}s` }} />
              <circle r="4" className="hx-spark" style={{ offsetPath: `path("${d}")`, animationDelay: `${i * 0.45}s` }} />
            </g>
          );
        })}
        {OUTCOMES.map((o, i) => {
          const d = `M490 250 C 570 250, 600 ${o.y}, 700 ${o.y}`;
          return (
            <g key={o.title}>
              <path d={d} className="hx-wire" />
              <path d={d} className="hx-flow hx-flow-out" stroke="url(#hx-out)" style={{ animationDelay: `${0.9 + i * 0.6}s` }} />
              <circle r="4" className="hx-spark hx-spark-out" style={{ offsetPath: `path("${d}")`, animationDelay: `${0.9 + i * 0.6}s` }} />
            </g>
          );
        })}
        <g className="hx-rings">
          <circle cx="450" cy="250" r="118" className="hx-ring hx-ring-1" />
          <circle cx="450" cy="250" r="92" className="hx-ring hx-ring-2" />
          <circle cx="450" cy="250" r="70" className="hx-ring hx-ring-3" />
        </g>
        <circle cx="450" cy="250" r="52" fill="url(#hx-core)" filter="url(#hx-glow)" className="hx-core" />
        <path d="M432 266 L468 230 M450 230 H468 V248" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>

      {SOURCES.map((s, i) => (
        <div key={s.label} className="hx-chip" style={{ top: `${(s.y / 500) * 100}%`, animationDelay: `${i * 0.12}s` }}>
          <span className="hx-chip-i">
            <Icon name={s.icon} size={14} />
          </span>
          {s.label}
        </div>
      ))}
      <div className="hx-core-label">
        <span className="hx-live" /> Scalency AI
      </div>
      {OUTCOMES.map((o, i) => (
        <div key={o.title} className="hx-out" style={{ top: `${(o.y / 500) * 100}%`, animationDelay: `${0.6 + i * 0.15}s` }}>
          <span className="hx-out-dot" style={{ background: o.tone, boxShadow: `0 0 0 5px ${o.tone}22` }} />
          <div>
            <div className="hx-out-t">{o.title}</div>
            <div className="hx-out-s">{o.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function HeroAI() {
  const phrase = useTyping(PHRASES);
  return (
    <section className="hx" id="top">
      <div className="hx-aurora" aria-hidden="true">
        <span className="hx-blob hx-b1" />
        <span className="hx-blob hx-b2" />
        <span className="hx-blob hx-b3" />
      </div>
      <div className="hx-grid" aria-hidden="true" />
      <div className="hx-stars" aria-hidden="true" />

      <div className="hx-wrap">
        <div className="hx-copy">
          <a href="#engine" className="hx-pill">
            <span className="hx-pill-tag">New</span> The AI growth system: lead generation and lead conversion
            <Icon name="arrowRight" size={13} />
          </a>
          <h1 className="hx-h1">
            Growth that runs itself.
            <span className="hx-typed">
              <span className="hx-grad">Scalency AI {phrase}</span>
              <span className="hx-caret" />
            </span>
          </h1>
          <p className="hx-sub">
            Scalency brings you the leads, answers every enquiry with AI in under 60 seconds, books them straight into your calendar and follows up until they turn up. Ads, AI front desk, CRM and calendar in one place, so growing feels easy.
          </p>
          <div className="hx-ctas">
            <a href="/signup" className="hx-btn hx-btn-main">
              Get started <Icon name="arrowRight" size={16} />
            </a>
            <a href="#ai" className="hx-btn hx-btn-ghost">
              <span className="hx-play">
                <Icon name="play" size={12} />
              </span>
              Watch the AI work
            </a>
          </div>
          <div className="hx-trust">
            <span>
              <Icon name="check" size={14} /> Built in the UK
            </span>
            <span>
              <Icon name="check" size={14} /> Test mode before go-live
            </span>
            <span>
              <Icon name="check" size={14} /> You own your data
            </span>
          </div>
        </div>

        <Engine />

        <div className="hx-stats">
          <div className="hx-stat">
            <div className="hx-stat-n">
              &lt;<Count to={60} suffix="s" />
            </div>
            <div className="hx-stat-l">first reply, day or night</div>
          </div>
          <div className="hx-stat">
            <div className="hx-stat-n">
              <Count to={5} />
            </div>
            <div className="hx-stat-l">follow-ups until they book</div>
          </div>
          <div className="hx-stat">
            <div className="hx-stat-n">
              <Count to={4} />
            </div>
            <div className="hx-stat-l">reminders before every visit</div>
          </div>
          <div className="hx-stat">
            <div className="hx-stat-n">
              <Count to={24} suffix="/7" />
            </div>
            <div className="hx-stat-l">AI on shift, never off sick</div>
          </div>
        </div>
      </div>
      <div className="hx-fade" aria-hidden="true" />
    </section>
  );
}
