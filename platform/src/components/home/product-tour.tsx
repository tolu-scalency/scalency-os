"use client";

// "See Scalency run across every channel": a tabbed tour of live product mockups. Each tab
// plays a short scene (a text thread, an AI call, the calendar filling, the numbers, the
// command centre), then moves to the next. Click a tab to jump; hover to pause.

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icon";

const TABS: { key: string; label: string; icon: IconName; title: string; text: string }[] = [
  { key: "chat", label: "AI chat", icon: "inbox", title: "Replies like your best receptionist", text: "Texts, DMs and web chat answered in seconds. It listens first, asks one question at a time and books the call." },
  { key: "voice", label: "Voice AI", icon: "phone", title: "Calls every new lead within a minute", text: "Picks up missed calls, answers questions in a natural voice and books straight into your calendar." },
  { key: "calendar", label: "Calendar", icon: "calendar", title: "Your diary fills itself", text: "Your own booking pages, round robin across the team, Google Meet, Teams and Calendly connected." },
  { key: "results", label: "Results", icon: "chart", title: "Revenue you can prove", text: "Bookings, show rate and revenue by channel, with cost per booked call, updating as it happens." },
  { key: "command", label: "Command centre", icon: "zap", title: "Every conversation, one screen", text: "Watch the AI work live, take over any chat in one click and switch campaigns on or off." },
];
const STEP_MS = 7000;

function useCount(to: number, ms = 1400) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return v;
}

function Chat() {
  const lines = [
    { me: false, t: "Hi, how much is teeth whitening?" },
    { me: true, t: "Hi Amy! Happy to help. Is it for an event, or more of an everyday brighter smile?" },
    { me: false, t: "Wedding in 6 weeks!" },
    { me: true, t: "Congratulations! That's plenty of time. Our free consult is 20 minutes. Tuesday 5pm or Thursday 12pm?" },
    { me: false, t: "Tuesday 5pm" },
  ];
  return (
    <div className="pt-phone">
      <div className="pt-phone-top">
        <span className="pt-av">A</span>
        <div>
          <b>Amy Jones</b>
          <span>Instagram DM · AI replying</span>
        </div>
        <span className="pt-score">Lead score 82</span>
      </div>
      <div className="pt-thread">
        {lines.map((l, i) => (
          <div key={i} className={`pt-bub ${l.me ? "pt-me" : ""}`} style={{ animationDelay: `${0.3 + i * 1.05}s` }}>
            {l.t}
          </div>
        ))}
        <div className="pt-booked" style={{ animationDelay: "5.6s" }}>
          <Icon name="checkCircle" size={14} /> Booked Tue 5:00pm · reminders set
        </div>
      </div>
    </div>
  );
}

function Voice() {
  return (
    <div className="pt-call">
      <div className="pt-call-top">
        <span className="pt-ring">
          <Icon name="phone" size={18} />
        </span>
        <div>
          <b>Outbound call · Mark Davies</b>
          <span>Scalency Voice AI · 0:48</span>
        </div>
        <span className="pt-rec">● Live</span>
      </div>
      <div className="pt-wave">
        {Array.from({ length: 36 }, (_, i) => (
          <span key={i} style={{ animationDelay: `${(i % 9) * 0.09}s`, height: `${30 + ((i * 37) % 60)}%` }} />
        ))}
      </div>
      <div className="pt-script">
        <p style={{ animationDelay: ".4s" }}>
          <b>AI</b> Hi Mark, it&apos;s Scalency calling about your enquiry. Have you got a minute?
        </p>
        <p style={{ animationDelay: "1.8s" }}>
          <b>Mark</b> Yes, I wanted a quote for the boiler.
        </p>
        <p style={{ animationDelay: "3.2s" }}>
          <b>AI</b> I can book the survey for you. Wednesday 9am or Friday 2pm?
        </p>
      </div>
      <div className="pt-booked pt-booked-light" style={{ animationDelay: "4.6s" }}>
        <Icon name="calendar" size={14} /> Survey booked · Wed 9:00am · summary saved to contact
      </div>
    </div>
  );
}

function Calendar() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const filled = [
    [0, 0], [1, 1], [2, 0], [0, 2], [3, 1], [4, 0], [1, 3], [2, 2], [3, 3], [4, 2],
  ];
  return (
    <div className="pt-cal">
      <div className="pt-cal-top">
        <b>Strategy call · this week</b>
        <span className="pt-chips">
          <span>Google Meet</span>
          <span>Teams</span>
          <span>Calendly</span>
        </span>
      </div>
      <div className="pt-cal-grid">
        {days.map((d, di) => (
          <div key={d} className="pt-cal-col">
            <span className="pt-cal-d">{d}</span>
            {[0, 1, 2, 3].map((s) => {
              const k = filled.findIndex(([x, y]) => x === di && y === s);
              return <span key={s} className={`pt-slot ${k >= 0 ? "pt-slot-on" : ""}`} style={k >= 0 ? { animationDelay: `${0.3 + k * 0.45}s` } : undefined}>{k >= 0 ? ["Sarah C.", "James R.", "Priya S.", "Tom H.", "Lena P.", "Amara O.", "Ben K.", "Zoe W.", "Ali M.", "Kate F."][k] : ""}</span>;
            })}
          </div>
        ))}
      </div>
      <div className="pt-toast" style={{ animationDelay: "5s" }}>
        <Icon name="checkCircle" size={15} /> New booking: Kate F. · Fri 2:00pm · Meet link sent
      </div>
    </div>
  );
}

function Results() {
  const booked = useCount(38);
  const show = useCount(87);
  const rev = useCount(24180, 1800);
  const cpb = useCount(18);
  return (
    <div className="pt-dash">
      <div className="pt-kpis">
        <div>
          <span>Booked calls</span>
          <b>{Math.round(booked)}</b>
        </div>
        <div>
          <span>Show rate</span>
          <b>{Math.round(show)}%</b>
        </div>
        <div>
          <span>Revenue</span>
          <b>£{Math.round(rev).toLocaleString("en-GB")}</b>
        </div>
        <div>
          <span>Cost per booked</span>
          <b>£{Math.round(cpb)}</b>
        </div>
      </div>
      <div className="pt-chart">
        {[["Meta", 82], ["Google", 64], ["Instagram", 48], ["Website", 37], ["Referral", 22]].map(([l, h], i) => (
          <div key={l as string} className="pt-bar-row">
            <span>{l}</span>
            <div className="pt-bar">
              <i style={{ width: `${h}%`, animationDelay: `${0.2 + i * 0.15}s` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="pt-sample">Example dashboard</p>
    </div>
  );
}

function Command() {
  const log = [
    ["AI REPLY", "Replied to Sarah in 4 seconds", "#2FA8EB"],
    ["BOOKED", "Priya booked Thursday 2:30pm", "#12b76a"],
    ["VOICE", "AI called Lucy, moved her to Saturday", "#7c3aed"],
    ["HANDOVER", "Tom asked for a person: sent to George", "#f79009"],
    ["CONFIRMED", "Emma replied YES to her reminder", "#12b76a"],
  ];
  return (
    <div className="pt-cmd">
      <div className="pt-log">
        {log.map(([tag, text, c], i) => (
          <div key={i} className="pt-log-row" style={{ animationDelay: `${0.3 + i * 0.7}s` }}>
            <span className="pt-log-tag" style={{ color: c, background: `${c}1a` }}>{tag}</span>
            <span>{text}</span>
            <em>{i + 1}m</em>
          </div>
        ))}
      </div>
      <div className="pt-toggles">
        {[["Speed to lead", true], ["Reactivation sprint", false], ["Review requests", true]].map(([l, on], i) => (
          <div key={l as string} className="pt-toggle-row">
            <span>{l}</span>
            <span className={`pt-switch ${on ? "pt-on" : "pt-flip"}`} style={{ animationDelay: `${2 + i * 0.5}s` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

const SCENES = [Chat, Voice, Calendar, Results, Command];

export function ProductTour() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (paused || !seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % TABS.length), STEP_MS);
    return () => clearTimeout(t);
  }, [active, paused, seen]);

  const Scene = SCENES[active];
  const tab = TABS[active];
  return (
    <section className="pt" id="tour">
      <div className="pt-wrap">
        <div className="pt-head rv">
          <span className="pt-tag">
            <span className="pt-dot" /> See it run
          </span>
          <h2 className="pt-h2">
            One AI system, <span className="pt-grad">every channel covered.</span>
          </h2>
        </div>
        <div className="pt-tabs rv" role="tablist" aria-label="Product tour">
          {TABS.map((t, i) => (
            <button key={t.key} type="button" role="tab" aria-selected={i === active} onClick={() => { setActive(i); setPaused(true); }} className={`pt-tabbtn ${i === active ? "pt-tab-on" : ""}`}>
              <Icon name={t.icon} size={16} />
              {t.label}
              {i === active && !paused && seen && <span className="pt-progress" style={{ animationDuration: `${STEP_MS}ms` }} />}
            </button>
          ))}
        </div>
        <div ref={box} className="pt-stage rv" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <div key={tab.key} className="pt-copy pt-enter">
            <span className="pt-copy-i">
              <Icon name={tab.icon} size={20} />
            </span>
            <h3>{tab.title}</h3>
            <p>{tab.text}</p>
            <a href="/signup" className="pt-link">
              Try it in Scalency <Icon name="arrowRight" size={15} />
            </a>
          </div>
          <div key={`${tab.key}-scene`} className="pt-scene pt-enter" aria-hidden="true">
            <Scene />
          </div>
        </div>
      </div>
    </section>
  );
}
