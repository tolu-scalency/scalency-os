"use client";

// "Every channel in, booked appointments out": leads flow from each channel into the Scalency AI
// core and come out booked, reminded and shown up. Light, on the site's own white and blues.
// All vector and CSS, so it's sharp on any screen. Rests for people who ask for less motion.

import { Icon, type IconName } from "@/components/icon";

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
  { title: "Showed up", text: "£450 · revenue tracked", y: 390, tone: "#0465C7" },
];
const TOOLS: { label: string; icon: IconName }[] = [
  { label: "Google Calendar", icon: "calendar" },
  { label: "Google Meet", icon: "video" },
  { label: "Microsoft Teams", icon: "video" },
  { label: "Calendly", icon: "calendar" },
  { label: "Meta Ads", icon: "megaphone" },
  { label: "Twilio SMS", icon: "phone" },
  { label: "Resend email", icon: "mail" },
  { label: "Claude AI", icon: "spark" },
  { label: "Webhooks", icon: "link" },
  { label: "Instagram", icon: "inbox" },
];

export function FlowEngine() {
  return (
    <section className="fe" id="flow">
      <div className="fe-wrap">
        <div className="fe-head rv">
          <span className="fe-tag">
            <span className="fe-dot" /> How it works, live
          </span>
          <h2 className="fe-h2">
            Every channel in. <span className="fe-grad">Booked appointments out.</span>
          </h2>
          <p className="fe-sub">Leads land from ads, Google, DMs, forms and missed calls. Scalency AI answers each one in seconds, books it into your calendar and makes sure they turn up.</p>
        </div>

        <div className="fe-stage rv" aria-hidden="true">
          <svg viewBox="0 0 900 500" className="fe-svg" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="fe-in" x1="0" x2="1">
                <stop offset="0" stopColor="#64E7EF" stopOpacity="0" />
                <stop offset="1" stopColor="#2FA8EB" />
              </linearGradient>
              <linearGradient id="fe-out" x1="0" x2="1">
                <stop offset="0" stopColor="#0465C7" />
                <stop offset="1" stopColor="#64E7EF" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="fe-core" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#64E7EF" />
                <stop offset=".45" stopColor="#2FA8EB" />
                <stop offset="1" stopColor="#0465C7" />
              </linearGradient>
            </defs>
            {SOURCES.map((s, i) => {
              const d = `M190 ${s.y} C 300 ${s.y}, 330 250, 410 250`;
              return (
                <g key={s.label}>
                  <path d={d} className="fe-wire" />
                  <path d={d} className="fe-flow" stroke="url(#fe-in)" style={{ animationDelay: `${i * 0.45}s` }} />
                  <circle r="4.5" className="fe-spark" style={{ offsetPath: `path("${d}")`, animationDelay: `${i * 0.45}s` }} />
                </g>
              );
            })}
            {OUTCOMES.map((o, i) => {
              const d = `M490 250 C 570 250, 600 ${o.y}, 700 ${o.y}`;
              return (
                <g key={o.title}>
                  <path d={d} className="fe-wire" />
                  <path d={d} className="fe-flow" stroke="url(#fe-out)" style={{ animationDelay: `${0.9 + i * 0.6}s` }} />
                  <circle r="4.5" className="fe-spark" style={{ offsetPath: `path("${d}")`, animationDelay: `${0.9 + i * 0.6}s` }} />
                </g>
              );
            })}
            <circle cx="450" cy="250" r="118" className="fe-ring fe-r1" />
            <circle cx="450" cy="250" r="92" className="fe-ring fe-r2" />
            <circle cx="450" cy="250" r="70" className="fe-ring fe-r3" />
            <rect x="400" y="200" width="100" height="100" rx="28" fill="url(#fe-core)" className="fe-core" />
            <path d="M432 268 L468 232 M448 232 H468 V252" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          {SOURCES.map((s, i) => (
            <div key={s.label} className="fe-chip" style={{ top: `${(s.y / 500) * 100}%`, animationDelay: `${i * 0.6}s` }}>
              <span className="fe-chip-i">
                <Icon name={s.icon} size={14} />
              </span>
              <span className="fe-chip-t">{s.label}</span>
            </div>
          ))}
          <div className="fe-core-label">
            <span className="fe-live" /> Scalency AI
          </div>
          {OUTCOMES.map((o, i) => (
            <div key={o.title} className="fe-out" style={{ top: `${(o.y / 500) * 100}%`, animationDelay: `${i * 0.8}s` }}>
              <span className="fe-out-dot" style={{ background: o.tone, boxShadow: `0 0 0 5px ${o.tone}22` }} />
              <div>
                <div className="fe-out-t">{o.title}</div>
                <div className="fe-out-s">{o.text}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="fe-marquee" aria-label="Connected tools">
          <div className="fe-track">
            {[...TOOLS, ...TOOLS].map((t, i) => (
              <span key={i} className="fe-tool" aria-hidden={i >= TOOLS.length}>
                <Icon name={t.icon} size={15} /> {t.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
