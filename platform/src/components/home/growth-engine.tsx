"use client";

// "Two engines, one system": what Scalency sells, lead generation and lead conversion, with
// small moving product visuals, and the calendar that fills at the end of it.

import { Icon, type IconName } from "@/components/icon";

const GEN: { icon: IconName; title: string; text: string }[] = [
  { icon: "megaphone", title: "Ads that bring enquiries", text: "Meta and Google ads built, run and improved for you." },
  { icon: "image", title: "AI creative studio", text: "Ads and posts written for you, checked against UK ad rules." },
  { icon: "funnel", title: "Funnels and booking pages", text: "Landing pages and applications that qualify every lead." },
];
const CONV: { icon: IconName; title: string; text: string }[] = [
  { icon: "spark", title: "AI front desk", text: "Answers texts, DMs and forms in seconds, like your best receptionist." },
  { icon: "calendar", title: "Books into your calendar", text: "Google Meet, Teams and Calendly connected. No back and forth." },
  { icon: "refresh", title: "Show-up and rebooking", text: "Reminders, no-show recovery and rebooking, all on autopilot." },
];

export function GrowthEngine() {
  return (
    <section id="engine" className="ge">
      <div className="ge-wrap">
        <div className="ge-head rv">
          <span className="ge-eyebrow">
            <span className="ge-dot" /> The AI growth system
          </span>
          <h2 className="ge-h2">
            Two engines. <span className="ge-grad">One system that grows you.</span>
          </h2>
          <p className="ge-sub">Most agencies stop at the ads. Scalency runs the whole journey with AI: we bring the leads, then convert them into booked, confirmed appointments, and show you the revenue.</p>
        </div>

        <div className="ge-grid">
          <div className="ge-card rv">
            <div className="ge-card-top">
              <span className="ge-tag">01 · Lead generation</span>
              <h3>Get found by the right people</h3>
            </div>
            <div className="ge-visual ge-ads" aria-hidden="true">
              <div className="ge-ad ge-ad-1">
                <div className="ge-ad-img" />
                <div className="ge-ad-line" />
                <div className="ge-ad-line ge-short" />
                <span className="ge-ok">✓ Passes UK ad rules</span>
              </div>
              <div className="ge-ad ge-ad-2">
                <div className="ge-ad-img ge-img-2" />
                <div className="ge-ad-line" />
                <div className="ge-ad-line ge-short" />
              </div>
              <div className="ge-metric">
                <div className="ge-metric-l">New leads this week</div>
                <div className="ge-metric-n">+148</div>
                <div className="ge-bars">
                  {[30, 42, 38, 55, 60, 72, 88].map((h, i) => (
                    <span key={i} style={{ height: `${h}%`, animationDelay: `${i * 0.12}s` }} />
                  ))}
                </div>
              </div>
            </div>
            <ul className="ge-list">
              {GEN.map((x) => (
                <li key={x.title}>
                  <span className="ge-li-i">
                    <Icon name={x.icon} size={16} />
                  </span>
                  <div>
                    <b>{x.title}</b>
                    <span>{x.text}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="ge-join" aria-hidden="true">
            <span className="ge-join-line" />
            <span className="ge-join-ai">AI</span>
          </div>

          <div className="ge-card ge-card-dark rv">
            <div className="ge-card-top">
              <span className="ge-tag ge-tag-light">02 · Lead conversion</span>
              <h3>Turn every enquiry into a booking</h3>
            </div>
            <div className="ge-visual ge-chat" aria-hidden="true">
              <div className="ge-msg ge-them">Hi, do you have anything this week?</div>
              <div className="ge-msg ge-ai">
                <span className="ge-ai-badge">AI · 4s</span>
                Yes! Thursday at 2:30pm or Friday at 10am?
              </div>
              <div className="ge-msg ge-them ge-m3">Thursday please</div>
              <div className="ge-booked">
                <Icon name="checkCircle" size={15} /> Booked · Google Meet link sent · 4 reminders set
              </div>
            </div>
            <ul className="ge-list ge-list-light">
              {CONV.map((x) => (
                <li key={x.title}>
                  <span className="ge-li-i">
                    <Icon name={x.icon} size={16} />
                  </span>
                  <div>
                    <b>{x.title}</b>
                    <span>{x.text}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="ge-diary rv" aria-hidden="true">
          <div className="ge-diary-head">
            <div>
              <div className="ge-diary-t">Your calendar, filling itself</div>
              <div className="ge-diary-s">Every slot below was booked by Scalency AI</div>
            </div>
            <div className="ge-diary-badges">
              <span>Google Meet</span>
              <span>Microsoft Teams</span>
              <span>Calendly</span>
            </div>
          </div>
          <div className="ge-days">
            {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d, i) => (
              <div key={d} className="ge-day">
                <div className="ge-day-l">{d}</div>
                {[0, 1, 2, 3].map((s) => (
                  <span key={s} className="ge-slot" style={{ animationDelay: `${(i * 4 + s) * 0.18}s` }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
