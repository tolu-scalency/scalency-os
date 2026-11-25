"use client";

// The floating "Ask Scalency AI" button: opens a small panel with common questions, and the
// answer types itself in. Answers are fixed text from the FAQ (no AI call, nothing stored).

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";

const QA: { q: string; a: string }[] = [
  { q: "What does Scalency actually do?", a: "We bring you leads with ads, then our AI answers every enquiry in under 60 seconds, books them into your calendar and follows up until they turn up. Ads, AI front desk, CRM and calendar in one place." },
  { q: "Will people know it's AI?", a: "It writes like a friendly member of your team, and if someone asks, it says it's your virtual assistant. Your team can take over any conversation in one click." },
  { q: "Does it work with my calendar?", a: "Yes. Scalency has its own booking pages and connects Google Calendar with Meet, Outlook with Teams, and Calendly." },
  { q: "Am I locked in?", a: "No 12-month contracts. You own your ad account and your data, and every workspace starts in test mode." },
];

export function AskLauncher() {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<number | null>(null);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (pick === null) return;
    const full = QA[pick].a;
    let n = 0;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setInterval(() => {
      n = still ? full.length : n + 3;
      setTyped(full.slice(0, n));
      if (n >= full.length) clearInterval(t);
    }, 18);
    return () => clearInterval(t);
  }, [pick]);

  return (
    <div className="ask">
      {open && (
        <div className="ask-panel" role="dialog" aria-label="Ask Scalency AI">
          <div className="ask-top">
            <span className="ask-av">
              <Icon name="spark" size={16} />
            </span>
            <div>
              <b>Scalency AI</b>
              <span>
                <i className="ask-live" /> Replies instantly
              </span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="ask-x">
              <Icon name="x" size={15} />
            </button>
          </div>
          <div className="ask-body">
            <div className="ask-msg">Hi! What would you like to know about Scalency?</div>
            {pick !== null && (
              <>
                <div className="ask-msg ask-me">{QA[pick].q}</div>
                <div className="ask-msg">{typed}</div>
              </>
            )}
          </div>
          <div className="ask-qs">
            {QA.map((x, i) => (
              <button key={x.q} type="button" onClick={() => { setTyped(""); setPick(i); }} className={pick === i ? "ask-q-on" : ""}>
                {x.q}
              </button>
            ))}
            <a href="/signup" className="ask-cta">
              Get started <Icon name="arrowRight" size={14} />
            </a>
          </div>
        </div>
      )}
      <button type="button" onClick={() => setOpen((o) => !o)} className="ask-btn" aria-expanded={open}>
        <span className="ask-btn-i">
          <Icon name={open ? "x" : "spark"} size={17} />
        </span>
        Ask Scalency AI
      </button>
    </div>
  );
}
