"use client";

// The homepage's AI front desk sections: a live chat that types itself, counting stats, the
// feature bento with small moving visuals, the command centre feed, and the UK compliance band.
// Everything moves, and everything rests for people who ask for reduced motion.

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icon";

type Msg = { who: "lead" | "ai" | "event"; text: string };
const CHAT: Msg[] = [
  { who: "lead", text: "hi" },
  { who: "ai", text: "Hi Sarah, I'm Jane from Glow Aesthetics. Thanks for getting in touch! What are you hoping to have done?" },
  { who: "lead", text: "thinking about my lips, never had anything before" },
  { who: "ai", text: "Lovely, first time is exciting. Is it more about a bit of volume, or shape and definition?" },
  { who: "lead", text: "a bit more volume but still natural" },
  { who: "ai", text: "Natural is exactly what we do. Your free consultation is 30 minutes with our nurse prescriber. Thursday at 6pm or Saturday at 11am?" },
  { who: "lead", text: "saturday!" },
  { who: "event", text: "Booked · Sat 11:00 · 4 reminders scheduled" },
];

/** A phone that runs the conversation: typing dots, then each message, then it starts again. */
function LiveChat() {
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      const t = setTimeout(() => setShown(CHAT.length), 0);
      return () => clearTimeout(t);
    }
    let i = 0;
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const step = () => {
      if (!alive) return;
      if (i >= CHAT.length) {
        timers.push(
          setTimeout(() => {
            i = 0;
            setShown(0);
            step();
          }, 3800),
        );
        return;
      }
      const m = CHAT[i];
      if (m.who === "ai") {
        setTyping(true);
        timers.push(
          setTimeout(() => {
            setTyping(false);
            setShown(++i);
            timers.push(setTimeout(step, 900));
          }, 1500),
        );
      } else {
        timers.push(
          setTimeout(() => {
            setShown(++i);
            step();
          }, m.who === "event" ? 700 : 1100),
        );
      }
    };
    step();
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, []);
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" });
  }, [shown, typing]);
  return (
    <div className="relative mx-auto w-full max-w-[380px]">
      <div className="pointer-events-none absolute -inset-10 rounded-full bg-[radial-gradient(closest-side,rgba(47,168,235,0.35),transparent)] blur-2xl" />
      <div className="relative rounded-[40px] bg-[#0b2447] p-3 shadow-[0_40px_80px_-30px_rgba(4,101,199,0.6)] ring-1 ring-white/10">
        <div className="overflow-hidden rounded-[30px] bg-[#f3f6fa]">
          <div className="flex items-center gap-3 bg-white px-4 pb-3 pt-5 shadow-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#64E7EF,#0465C7)] text-[13px] font-bold text-white">J</span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-[#0b2447]">Glow Aesthetics</div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#059669]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#059669]" /> AI front desk · replies in seconds
              </div>
            </div>
          </div>
          <div ref={box} className="flex h-[420px] flex-col gap-2.5 overflow-y-auto px-3.5 py-4 [scrollbar-width:none]">
            {CHAT.slice(0, shown).map((m, i) =>
              m.who === "event" ? (
                <div key={i} className="ai-pop self-center rounded-full bg-[#d1fae5] px-3 py-1.5 text-[11.5px] font-semibold text-[#047857]">
                  ✓ {m.text}
                </div>
              ) : (
                <div key={i} className={`ai-pop max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-snug ${m.who === "lead" ? "self-end rounded-br-md bg-[linear-gradient(180deg,#2B93EE,#0465C7)] text-white" : "self-start rounded-bl-md bg-white text-[#0b2447] shadow-sm ring-1 ring-[#e1e9f3]"}`}>
                  {m.text}
                </div>
              ),
            )}
            {typing && (
              <div className="ai-pop flex gap-1 self-start rounded-2xl rounded-bl-md bg-white px-3.5 py-3 shadow-sm ring-1 ring-[#e1e9f3]">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="ai-dot h-1.5 w-1.5 rounded-full bg-[#7b8aa3]" style={{ animationDelay: `${d * 0.15}s` }} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="ai-float absolute -left-8 top-24 hidden rounded-2xl bg-white px-3.5 py-2.5 shadow-[0_20px_40px_-16px_rgba(11,36,71,0.35)] ring-1 ring-[#e1e9f3] sm:block">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#7b8aa3]">First reply</div>
        <div className="text-[20px] font-semibold text-[#0465C7]">4 sec</div>
      </div>
      <div className="ai-float absolute -right-6 bottom-28 hidden rounded-2xl bg-white px-3.5 py-2.5 shadow-[0_20px_40px_-16px_rgba(11,36,71,0.35)] ring-1 ring-[#e1e9f3] sm:block" style={{ animationDelay: "1.5s" }}>
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#7b8aa3]">Lead score</div>
        <div className="text-[20px] font-semibold text-[#059669]">82/100</div>
      </div>
    </div>
  );
}

/** Words that type, pause, delete and type the next one. */
export function TypeWords({ words, className = "" }: { words: string[]; className?: string }) {
  const [text, setText] = useState(words[0]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let w = 0;
    let n = words[0].length;
    let deleting = true;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const word = words[w];
      if (deleting) {
        n--;
        if (n <= 0) {
          deleting = false;
          w = (w + 1) % words.length;
          n = 0;
        }
      } else {
        n++;
      }
      const now = words[w].slice(0, Math.max(0, n));
      setText(now);
      if (!deleting && n >= words[w].length) {
        deleting = true;
        t = setTimeout(tick, 2200);
        return;
      }
      t = setTimeout(tick, deleting ? 40 : 75);
      void word;
    };
    t = setTimeout(tick, 2400);
    return () => clearTimeout(t);
  }, [words]);
  return (
    <span className={className}>
      {text}
      <span className="ai-caret" aria-hidden />
    </span>
  );
}

/** A number that counts up when it scrolls into view. */
function Count({ to, prefix = "", suffix = "" }: { to: number; prefix?: string; suffix?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => setN(to), 0);
      return () => clearTimeout(t);
    }
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const run = (now: number) => {
          const p = Math.min(1, (now - start) / 1400);
          setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
          if (p < 1) raf = requestAnimationFrame(run);
        };
        raf = requestAnimationFrame(run);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);
  return (
    <span ref={ref}>
      {prefix}
      {n}
      {suffix}
    </span>
  );
}

const FEED: { tag: string; title: string; sub: string; tone: string }[] = [
  { tag: "AI REPLY", title: "Replied to Sarah in 4 seconds", sub: "Asked what she's hoping for", tone: "bg-[#e7f1fe] text-[#0465C7]" },
  { tag: "BOOKED", title: "Priya booked Thursday 2:30pm", sub: "4 reminders scheduled", tone: "bg-[#d1fae5] text-[#047857]" },
  { tag: "GUARDRAIL", title: "Swelling after filler: sent to a clinician", sub: "Urgent · team alerted on WhatsApp", tone: "bg-[#fdecea] text-[#b42318]" },
  { tag: "CONFIRMED", title: "Emma replied YES to her reminder", sub: "Stage moved to Confirmed", tone: "bg-[#d1fae5] text-[#047857]" },
  { tag: "VOICE", title: "AI called Lucy, 2m 10s", sub: "Moved her to Saturday", tone: "bg-[#ede9fe] text-[#5b21b6]" },
  { tag: "REBOOK", title: "Jade is due her top-up", sub: "Reminder sent, booked in 3 minutes", tone: "bg-[#e7f1fe] text-[#0465C7]" },
  { tag: "REVIEW", title: "New 5-star Google review", sub: "Asked 3 hours after her visit", tone: "bg-[#fef3c7] text-[#92400e]" },
  { tag: "WAITLIST", title: "Cancelled slot offered to 3 people", sub: "Filled in 6 minutes", tone: "bg-[#e7f1fe] text-[#0465C7]" },
];

const FEATURES: { icon: IconName; title: string; text: string; visual: "scan" | "steps" | "bells" | "wave" | "shield" | "bars" | "dots" | "copy" | "feed" }[] = [
  { icon: "book", title: "Knowledge from your website", text: "Paste the clinic's site. The AI reads it and learns your treatments, prices and policies. You approve every answer.", visual: "scan" },
  { icon: "zap", title: "Journeys that never give up", text: "5 minutes, 30 minutes, 4 hours, next morning, then 21 days. Texts, emails, AI calls and your setters, in order.", visual: "steps" },
  { icon: "calendar", title: "Show-up engine", text: "Reminders 3 days, 48 hours, 24 hours and 2 hours before. Reply YES to confirm. No-shows won back.", visual: "bells" },
  { icon: "mic", title: "AI voice with live transfer", text: "Calls every new lead within 60 seconds, answers missed calls, and passes hot leads to a person live.", visual: "wave" },
  { icon: "shield", title: "Guardrails built for UK clinics", text: "Complications go straight to a clinician. Under-18s are stopped. No prescription medicine names in marketing.", visual: "shield" },
  { icon: "chart", title: "Revenue you can prove", text: "Bookings, shows and revenue by channel. Cost per shown consult. A guarantee tracker your clients can see.", visual: "bars" },
  { icon: "checkCircle", title: "Tested before it goes live", text: "A 50-conversation test lab grades the AI on listening, compliance and booking. It goes live when it passes.", visual: "dots" },
  { icon: "image", title: "Creative studio", text: "Ads and posts written from your details, checked against UK ad rules, and signed off before they run.", visual: "copy" },
  { icon: "inbox", title: "Command centre", text: "Every live conversation in one place. Read along, get a summary, take over and reply with an AI draft.", visual: "feed" },
];

function Visual({ kind }: { kind: (typeof FEATURES)[number]["visual"] }) {
  if (kind === "scan")
    return (
      <div className="relative h-24 overflow-hidden rounded-xl bg-white p-3 ring-1 ring-[#e1e9f3]">
        {[90, 70, 82, 55].map((w, i) => (
          <div key={i} className="mb-2 h-2 rounded-full bg-[#e1e9f3]" style={{ width: `${w}%` }} />
        ))}
        <div className="ai-scan absolute inset-x-0 h-8 bg-[linear-gradient(180deg,transparent,rgba(47,168,235,0.35),transparent)]" />
      </div>
    );
  if (kind === "steps")
    return (
      <div className="flex h-24 items-center justify-between rounded-xl bg-white px-4 ring-1 ring-[#e1e9f3]">
        {["5m", "30m", "4h", "D1", "D3", "D7"].map((l, i) => (
          <div key={l} className="flex flex-col items-center gap-1.5">
            <span className="ai-step h-3 w-3 rounded-full bg-[#d3dfec]" style={{ animationDelay: `${i * 0.45}s` }} />
            <span className="font-mono text-[10px] text-[#7b8aa3]">{l}</span>
          </div>
        ))}
      </div>
    );
  if (kind === "bells")
    return (
      <div className="flex h-24 flex-col justify-center gap-1.5 rounded-xl bg-white px-3 ring-1 ring-[#e1e9f3]">
        {["3 days · heads-up", "48h · reply YES", "2h · see you soon"].map((l, i) => (
          <div key={l} className="ai-slide flex items-center gap-2 rounded-lg bg-[#f3f6fa] px-2.5 py-1 text-[11.5px] text-[#0b2447]" style={{ animationDelay: `${i * 0.6}s` }}>
            <span className="h-1.5 w-1.5 rounded-full bg-[#2FA8EB]" /> {l}
          </div>
        ))}
      </div>
    );
  if (kind === "wave")
    return (
      <div className="flex h-24 items-center justify-center gap-1 rounded-xl bg-[linear-gradient(135deg,#0465C7,#2FA8EB)] ring-1 ring-[#e1e9f3]">
        {Array.from({ length: 28 }, (_, i) => (
          <span key={i} className="ai-wave w-1 rounded-full bg-white/85" style={{ animationDelay: `${(i % 7) * 0.12}s`, height: `${20 + ((i * 37) % 50)}%` }} />
        ))}
      </div>
    );
  if (kind === "shield")
    return (
      <div className="flex h-24 flex-col justify-center gap-1.5 rounded-xl bg-white px-3 ring-1 ring-[#e1e9f3] text-[12px]">
        <div className="flex items-center gap-2">
          <span className="ai-strike relative text-[#7b8aa3]">&quot;Botox from £150&quot;</span>
          <span className="rounded-full bg-[#fdecea] px-2 py-0.5 text-[10.5px] font-semibold text-[#b42318]">blocked</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#0b2447]">&quot;Smoother-looking forehead lines&quot;</span>
          <span className="rounded-full bg-[#d1fae5] px-2 py-0.5 text-[10.5px] font-semibold text-[#047857]">passes</span>
        </div>
      </div>
    );
  if (kind === "bars")
    return (
      <div className="flex h-24 items-end gap-1.5 rounded-xl bg-white px-3 pb-3 pt-4 ring-1 ring-[#e1e9f3]">
        {[35, 48, 42, 60, 55, 72, 68, 85, 92].map((h, i) => (
          <span key={i} className="ai-bar flex-1 rounded-t-md bg-[linear-gradient(180deg,#2FA8EB,#0465C7)]" style={{ height: `${h}%`, animationDelay: `${i * 0.08}s` }} />
        ))}
      </div>
    );
  if (kind === "dots")
    return (
      <div className="grid h-24 grid-cols-10 content-center gap-1.5 rounded-xl bg-white px-3 ring-1 ring-[#e1e9f3]">
        {Array.from({ length: 50 }, (_, i) => (
          <span key={i} className="ai-fill aspect-square rounded-full bg-[#e1e9f3]" style={{ animationDelay: `${i * 0.06}s` }} />
        ))}
      </div>
    );
  if (kind === "copy")
    return (
      <div className="h-24 rounded-xl bg-white p-3 ring-1 ring-[#e1e9f3]">
        <div className="text-[12.5px] font-semibold text-[#0b2447]">Fuller lips that still look like you</div>
        <div className="mt-1 text-[11px] leading-snug text-[#52627A]">Free 30-minute consultation with our nurse prescriber.</div>
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#d1fae5] px-2 py-0.5 text-[10.5px] font-semibold text-[#047857]">✓ Passes UK ad rules · Approved</div>
      </div>
    );
  return (
    <div className="relative h-24 overflow-hidden rounded-xl bg-white ring-1 ring-[#e1e9f3]">
      <div className="ai-ticker flex flex-col gap-1.5 p-2.5">
        {[...FEED, ...FEED].slice(0, 10).map((f, i) => (
          <div key={i} className="flex items-center gap-2 text-[11.5px]">
            <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold ${f.tone}`}>{f.tag}</span>
            <span className="truncate text-[#0b2447]">{f.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AiShowcase() {
  return (
    <div className="overflow-x-clip bg-white font-sans text-[#0b2447]">
      {/* The AI front desk */}
      <section id="front-desk" className="relative overflow-hidden py-20 sm:py-28">
        <div className="pointer-events-none absolute -left-40 top-20 h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(100,231,239,0.25),transparent)]" />
        <div className="pointer-events-none absolute -right-40 bottom-0 h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(47,168,235,0.2),transparent)]" />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-14 px-6 sm:px-8 lg:grid-cols-[1.05fr_1fr]">
          <div className="rv">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d3dfec] bg-white px-3.5 py-1.5 font-mono text-[11.5px] font-medium uppercase tracking-[0.12em] shadow-sm">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2FA8EB]" /> AI front desk
            </span>
            <h2 className="mt-5 text-[42px] font-semibold leading-[1.04] tracking-[-0.045em] sm:text-[58px]">
              It listens first.
              <br />
              <span className="bg-[linear-gradient(90deg,#0465C7_0%,#2FA8EB_55%,#3CC9D6_100%)] bg-clip-text text-transparent">
                <TypeWords words={["Then it books.", "Then it reminds.", "Then it rebooks.", "Then it reports."]} />
              </span>
            </h2>
            <p className="mt-5 max-w-[520px] text-[18px] leading-relaxed text-[#52627A]">
              Your AI front desk replies to every enquiry in seconds, on text, email, WhatsApp, Instagram and the phone. It asks what people want before it ever mentions a price, books them into your real calendar, and makes sure they turn up.
            </p>
            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {["Replies in under 60 seconds, 24/7", "One question at a time, like a person", "Books, moves and cancels in your calendar", "Hands hot or tricky leads to your team"].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[14.5px]">
                  <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[linear-gradient(135deg,#64E7EF,#0465C7)] text-white">
                    <Icon name="check" size={11} strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/signup" className="inline-flex min-h-[52px] items-center gap-2 rounded-[13px] bg-[linear-gradient(180deg,#2B93EE,#0465C7)] px-6 text-[15px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_12px_30px_-10px_rgba(4,101,199,.75)]">
                Switch on your AI front desk <Icon name="arrowRight" size={15} />
              </a>
              <a href="#ai-features" className="inline-flex min-h-[52px] items-center rounded-[13px] border border-[#d3dfec] bg-white px-6 text-[15px] font-medium">
                See everything it does
              </a>
            </div>
          </div>
          <div className="rv" style={{ ["--rv-delay" as string]: "0.15s" }}>
            <LiveChat />
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="relative py-6">
        <div className="mx-auto max-w-[1200px] px-6 sm:px-8">
          <div className="rv grid grid-cols-2 overflow-hidden rounded-[26px] bg-[linear-gradient(120deg,#0465C7,#2FA8EB)] text-white shadow-[0_30px_60px_-30px_rgba(4,101,199,0.7)] md:grid-cols-4">
            {(
              [
                [<Count key="a" to={60} prefix="<" suffix="s" />, "first reply, day or night"],
                [<Count key="b" to={21} suffix=" days" />, "of follow-up before it stops"],
                [<Count key="c" to={4} />, "reminders before every visit"],
                [<Count key="d" to={50} />, "test conversations before go-live"],
              ] as const
            ).map(([v, l], i) => (
              <div key={i} className="border-white/15 px-6 py-8 text-center md:border-l md:first:border-l-0">
                <div className="font-mono text-[40px] font-semibold tracking-tight sm:text-[48px]">{v}</div>
                <div className="mt-1 text-[13.5px] text-white/80">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Everything it does */}
      <section id="ai-features" className="relative py-20 sm:py-28">
        <div className="mx-auto max-w-[1200px] px-6 sm:px-8">
          <div className="rv mx-auto max-w-[760px] text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d3dfec] bg-white px-3.5 py-1.5 font-mono text-[11.5px] font-medium uppercase tracking-[0.12em] shadow-sm">The whole AI system</span>
            <h2 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-[-0.045em] sm:text-[54px]">
              Found, answered, booked,{" "}
              <span className="bg-[linear-gradient(90deg,#0465C7_0%,#2FA8EB_55%,#3CC9D6_100%)] bg-clip-text text-transparent">shown up and back again.</span>
            </h2>
            <p className="mt-5 text-[18px] leading-relaxed text-[#52627A]">Nine parts that work as one. Every one of them is live in Scalency today.</p>
          </div>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <article key={f.title} className="rv group rounded-[22px] border border-[#e1e9f3] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-5 shadow-[0_1px_2px_rgba(11,36,71,.04),0_24px_48px_-24px_rgba(11,36,71,.18)] transition-transform duration-300 hover:-translate-y-1" style={{ ["--rv-delay" as string]: `${(i % 3) * 0.08}s` }}>
                <Visual kind={f.visual} />
                <div className="mt-5 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#64E7EF,#0465C7)] text-white shadow-[0_10px_22px_-8px_rgba(47,168,235,.7)]">
                    <Icon name={f.icon} size={18} />
                  </span>
                  <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{f.title}</h3>
                </div>
                <p className="mt-2.5 text-[14px] leading-relaxed text-[#52627A]">{f.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Command centre feed */}
      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#0571D9_0%,#0465C7_45%,#034A92_100%)] py-20 text-white sm:py-28">
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.6)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-14 px-6 sm:px-8 lg:grid-cols-2">
          <div className="rv">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 font-mono text-[11.5px] font-medium uppercase tracking-[0.12em] ring-1 ring-white/20">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#55e3ec]" /> Live, right now
            </span>
            <h2 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-[-0.045em] sm:text-[52px]">Watch your diary fill itself.</h2>
            <p className="mt-5 max-w-[500px] text-[18px] leading-relaxed text-white/80">
              The command centre shows every conversation as it happens. Urgent ones flash for your team, setters pick up hot leads in one click, and you can take over any chat and reply with an AI draft you edit first.
            </p>
            <div className="mt-8 grid max-w-[460px] grid-cols-3 gap-3">
              {(
                [
                  ["34%", "diary filled"],
                  ["4s", "median reply"],
                  ["0", "missed leads"],
                ] as const
              ).map(([v, l]) => (
                <div key={l} className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
                  <div className="font-mono text-[24px] font-semibold">{v}</div>
                  <div className="text-[12px] text-white/75">{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rv relative h-[440px] overflow-hidden rounded-[26px] bg-white/[0.06] p-4 ring-1 ring-white/15 [mask-image:linear-gradient(180deg,transparent,black_12%,black_88%,transparent)]">
            <div className="ai-feed flex flex-col gap-3">
              {[...FEED, ...FEED].map((f, i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-[#0b2447] shadow-[0_16px_30px_-18px_rgba(2,20,60,0.6)]">
                  <span className={`rounded-md px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.08em] ${f.tone}`}>{f.tag}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{f.title}</span>
                    <span className="block truncate text-[12px] text-[#52627A]">{f.sub}</span>
                  </span>
                  <span className="font-mono text-[11px] text-[#7b8aa3]">{(i % 8) + 1}m</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Built for UK clinics */}
      <section className="relative py-20 sm:py-24">
        <div className="mx-auto max-w-[1200px] px-6 sm:px-8">
          <div className="rv grid items-center gap-10 rounded-[28px] border border-[#e1e9f3] bg-[linear-gradient(135deg,#f3f9ff,#ffffff)] p-8 sm:p-12 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <span className="font-mono text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[#0465C7]">Built for UK clinics</span>
              <h2 className="mt-3 text-[34px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-[44px]">Safe by design, not by luck.</h2>
              <p className="mt-4 text-[17px] leading-relaxed text-[#52627A]">One guardrails engine sits behind every message, call and ad, and logs every time it steps in.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["warning", "Complications go to a clinician", "Pain, swelling, blanching or vision changes: a safe reply and an urgent alert, no AI guesswork."],
                  ["shield", "No prescription medicine promotion", "Kept out of every message the clinic starts and every ad, in line with UK rules."],
                  ["user", "Age gate for injectables", "Under-18s are never booked for injectable treatments."],
                  ["lock", "Consent and opt-outs", "Marketing only to people who opted in. STOP works instantly."],
                ] as const
              ).map(([ic, t, d], i) => (
                <div key={t} className="rv rounded-2xl bg-white p-4 shadow-[0_16px_32px_-22px_rgba(11,36,71,0.35)] ring-1 ring-[#e1e9f3]" style={{ ["--rv-delay" as string]: `${i * 0.08}s` }}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e7f1fe] text-[#0465C7]">
                    <Icon name={ic as IconName} size={16} />
                  </span>
                  <div className="mt-3 text-[15px] font-semibold">{t}</div>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#52627A]">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
