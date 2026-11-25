"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { addDays, dayLabel, timeLabel, validTimeZone } from "@/lib/calendar/time";
import { minutesLabel, type Question } from "@/lib/calendar/types";

// The public booking page (and the "move or cancel your booking" page). Works on its own
// page or embedded in any website: when embedded it tells the page around it how tall it is.

type Props = {
  mode: "book" | "manage";
  calendarId: string;
  manageToken?: string;
  embed: boolean;
  business: string;
  host: string | null;
  name: string;
  description: string;
  durationMin: number;
  location: string;
  color: string;
  questions: Question[];
  booking?: { start: string; status: string; meetingUrl: string | null; tz: string | null; canMove: boolean };
};

type Slots = { byDay: Record<string, string[]>; lastDay: string };
const ZONES = ["Europe/London", "Europe/Dublin", "Europe/Paris", "Africa/Lagos", "America/New_York", "America/Chicago", "America/Los_Angeles", "America/Toronto", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Australia/Sydney"];

function monthStart(d: string) {
  return `${d.slice(0, 8)}01`;
}
function shiftMonth(d: string, n: number) {
  const [y, m] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}
function todayIn(tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function BookingWidget(p: Props) {
  const [tz, setTz] = useState("Europe/London");
  const [month, setMonth] = useState(() => monthStart(todayIn("Europe/London")));
  const [slots, setSlots] = useState<Slots | null>(null);
  const [loading, setLoading] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "details" | "done" | "manage" | "cancelled">(p.mode === "manage" ? "manage" : "pick");
  const [form, setForm] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ start: string; meetingUrl: string | null; thankYou: string | null } | null>(null);
  const [reason, setReason] = useState("");
  const shownAt = useRef(0);
  const [openedAt] = useState(() => Date.now());
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the visitor's zone is only known in the browser
    if (validTimeZone(t)) setTz(p.booking?.tz && validTimeZone(p.booking.tz) ? p.booking.tz : t);
    shownAt.current = Date.now();
  }, [p.booking?.tz]);

  const load = useCallback(async () => {
    if (!p.calendarId) return;
    setLoading(true);
    try {
      const today = todayIn(tz);
      const from = month < today ? today : month;
      const r = await fetch(`/api/book/${p.calendarId}/slots?from=${from}&days=42&tz=${encodeURIComponent(tz)}`, { cache: "no-store" });
      const j = (await r.json()) as Slots & { error?: string };
      if (j.error) setError(j.error);
      else setSlots(j);
    } catch {
      setError("We couldn't load the times. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, [p.calendarId, month, tz]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading the open times for the month on show
    if (step === "pick") void load();
  }, [load, step]);

  // Embedded: keep the frame the right height.
  useEffect(() => {
    if (!p.embed || !box.current) return;
    const send = () => window.parent?.postMessage({ scalencyBooking: p.calendarId, height: Math.ceil(document.documentElement.scrollHeight) }, "*");
    const ro = new ResizeObserver(send);
    ro.observe(box.current);
    send();
    return () => ro.disconnect();
  }, [p.embed, p.calendarId, step]);

  const grid = useMemo(() => {
    const lead = (new Date(`${month}T12:00:00Z`).getUTCDay() + 6) % 7;
    const first = addDays(month, -lead);
    return Array.from({ length: 42 }, (_, i) => addDays(first, i));
  }, [month]);
  const today = todayIn(tz);
  const times = day ? (slots?.byDay[day] ?? []) : [];
  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}T12:00:00Z`));
  const firstOpen = useMemo(() => Object.keys(slots?.byDay ?? {}).sort()[0] ?? null, [slots]);

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (!time) return;
    setBusy(true);
    setError("");
    try {
      const answers: Record<string, string> = {};
      for (const q of p.questions) answers[q.id] = form[`q_${q.id}`] ?? "";
      const r = await fetch(`/api/book/${p.calendarId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ start: time, tz, first_name: form.first_name, last_name: form.last_name, email: form.email, phone: form.phone, answers, consent, website: form.website ?? "", t: shownAt.current ? Date.now() - shownAt.current : 0 }),
      });
      const j = await r.json();
      if (!r.ok || j.error) {
        setError(j.error ?? "That didn't work. Please try again.");
        if (r.status === 409) {
          setStep("pick");
          setTime(null);
          void load();
        }
        return;
      }
      if (j.redirect) {
        (p.embed ? (window.top ?? window) : window).location.href = j.redirect;
        return;
      }
      setDone({ start: j.start, meetingUrl: j.meetingUrl, thankYou: j.thankYou });
      setStep("done");
    } catch {
      setError("That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function manage(action: "cancel" | "reschedule") {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/book/manage/${p.manageToken}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, start: time, reason }) });
      const j = await r.json();
      if (!r.ok || j.error) {
        setError(j.error ?? "That didn't work. Please try again.");
        return;
      }
      if (action === "cancel") setStep("cancelled");
      else {
        setDone({ start: j.start, meetingUrl: p.booking?.meetingUrl ?? null, thankYou: "Your booking has been moved. We've emailed you the new time." });
        setStep("done");
      }
    } catch {
      setError("That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const accent = p.color;
  const field = "h-12 w-full rounded-xl border border-[#d9e6f2] bg-white px-4 text-[15px] outline-none transition focus:border-[var(--a)] focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--a)_14%,transparent)]";

  return (
    <div
      ref={box}
      style={{ ["--a" as string]: accent }}
      className={`${p.embed ? "" : "min-h-screen"} relative overflow-hidden bg-[#f4f8fd] px-4 py-6 font-sans text-[#0b2447] sm:py-12`}
    >
      {!p.embed && (
        <>
          <div className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full opacity-60 blur-3xl" style={{ background: `radial-gradient(circle, ${accent}33, transparent 65%)` }} />
          <div className="pointer-events-none absolute -bottom-48 -right-40 h-[560px] w-[560px] rounded-full opacity-60 blur-3xl" style={{ background: "radial-gradient(circle, rgba(100,231,239,0.35), transparent 65%)" }} />
        </>
      )}
      <div className="relative mx-auto w-full max-w-[1060px] overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-[0_40px_100px_-50px_rgba(11,36,71,0.55)] backdrop-blur">
        <div className="h-1.5" style={{ background: `linear-gradient(90deg, #64E7EF, ${accent})` }} />
        <div className="grid md:grid-cols-[300px_minmax(0,1fr)]">
          {/* About the call */}
          <div className="relative border-b border-[#e7eef7] p-7 md:border-b-0 md:border-r">
            {p.business && <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#52627a]">{p.business}</div>}
            {p.host && (
              <div className="mt-4 flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full text-[15px] font-semibold text-white" style={{ background: `linear-gradient(135deg, #64E7EF, ${accent})` }}>
                  {p.host.split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase()}
                </span>
                <span className="text-[14px] font-medium">{p.host}</span>
              </div>
            )}
            <h1 className="mt-4 text-[26px] font-semibold leading-tight tracking-[-0.03em]">{p.name}</h1>
            <div className="mt-4 flex flex-col gap-2.5 text-[14px] text-[#52627a]">
              <span className="flex items-center gap-2.5"><Icon name="clock" size={16} className="text-[var(--a)]" /> {minutesLabel(p.durationMin)}</span>
              {p.location && <span className="flex items-center gap-2.5"><Icon name="video" size={16} className="text-[var(--a)]" /> {p.location}</span>}
              <span className="flex items-center gap-2.5"><Icon name="globe" size={16} className="text-[var(--a)]" />
                <select value={tz} onChange={(e) => { setTz(e.target.value); setDay(null); setTime(null); }} className="max-w-[210px] truncate bg-transparent text-[13.5px] outline-none" aria-label="Your time zone">
                  {[...new Set([tz, ...ZONES])].map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
                </select>
              </span>
            </div>
            {p.description && <p className="mt-5 whitespace-pre-wrap text-[14px] leading-relaxed text-[#52627a]">{p.description}</p>}
            {time && step === "details" && (
              <div className="mt-6 rounded-2xl p-4 text-[14px] font-semibold" style={{ background: `color-mix(in srgb, ${accent} 9%, white)` }}>
                <div className="flex items-center gap-2"><Icon name="calendar" size={16} className="text-[var(--a)]" /> {dayLabel(Date.parse(time), tz)}</div>
                <div className="mt-1 pl-6 font-normal text-[#52627a]">{timeLabel(Date.parse(time), tz)} to {timeLabel(Date.parse(time) + p.durationMin * 60000, tz)}</div>
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8">
            {error && <div className="mb-4 rounded-xl bg-[#fff1f1] px-4 py-3 text-[14px] text-[#b42318]">{error}</div>}

            {step === "manage" && p.booking && (
              <div className="mx-auto max-w-md">
                <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#52627a]">Your booking</div>
                {p.booking.status === "cancelled" ? (
                  <h2 className="mt-2 text-[22px] font-semibold">This booking was cancelled.</h2>
                ) : (
                  <>
                    <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.02em]">{dayLabel(Date.parse(p.booking.start), tz)}</h2>
                    <div className="mt-1 text-[16px] text-[#52627a]">{timeLabel(Date.parse(p.booking.start), tz)} ({tz.replace(/_/g, " ")})</div>
                    {p.booking.meetingUrl && (
                      <a href={p.booking.meetingUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex h-12 items-center gap-2 rounded-xl px-5 text-[15px] font-semibold text-white" style={{ background: accent }}><Icon name="video" size={16} /> Join the call</a>
                    )}
                    <div className="mt-8 grid gap-3">
                      {p.booking.canMove && Date.parse(p.booking.start) > openedAt && (
                        <button type="button" onClick={() => setStep("pick")} className="h-12 rounded-xl border border-[#d9e6f2] text-[15px] font-semibold hover:border-[var(--a)]">Move to another time</button>
                      )}
                      <div className="rounded-2xl border border-[#f3d0cc] p-4">
                        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                          Can&apos;t make it? Let us know why (optional)
                          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={field} />
                        </label>
                        <button type="button" disabled={busy} onClick={() => manage("cancel")} className="mt-3 h-11 w-full rounded-xl bg-[#d92d20] text-[14.5px] font-semibold text-white disabled:opacity-60">Cancel my booking</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {step === "pick" && (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-[18px] font-semibold tracking-[-0.02em]">{p.mode === "manage" ? "Pick a new time" : "Pick a day"}</h2>
                    <div className="flex items-center gap-1">
                      <button type="button" disabled={month <= monthStart(today)} onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month" className="grid h-9 w-9 place-items-center rounded-xl hover:bg-[#eef6fd] disabled:opacity-30"><Icon name="chevronLeft" size={16} /></button>
                      <span className="w-36 text-center text-[14px] font-semibold">{monthLabel}</span>
                      <button type="button" disabled={!!slots && shiftMonth(month, 1) > (slots.lastDay ?? "9999")} onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month" className="grid h-9 w-9 place-items-center rounded-xl hover:bg-[#eef6fd] disabled:opacity-30"><Icon name="chevronRight" size={16} /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#8a9ab0]">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-1">{d}</div>)}
                  </div>
                  <div className={`grid grid-cols-7 gap-1 transition-opacity ${loading ? "opacity-50" : ""}`}>
                    {grid.map((d) => {
                      const inMonth = d.startsWith(month.slice(0, 7));
                      const open = !!slots?.byDay[d]?.length;
                      const on = d === day;
                      return (
                        <button
                          key={d}
                          type="button"
                          disabled={!open || !inMonth}
                          onClick={() => { setDay(d); setTime(null); }}
                          className={`relative aspect-square rounded-2xl text-[15px] font-semibold tabular-nums transition ${!inMonth ? "invisible" : on ? "text-white shadow-[0_10px_24px_-10px_var(--a)]" : open ? "hover:scale-[1.04]" : "text-[#c3cedb]"}`}
                          style={on ? { background: accent } : open ? { background: `color-mix(in srgb, ${accent} 10%, white)`, color: accent } : undefined}
                        >
                          {Number(d.slice(8))}
                          {d === today && <span className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full" style={{ background: on ? "white" : accent }} />}
                        </button>
                      );
                    })}
                  </div>
                  {!loading && slots && !Object.keys(slots.byDay).length && <p className="mt-4 text-[14px] text-[#52627a]">No times left this month. Try the next one.</p>}
                  {!day && firstOpen && (
                    <button type="button" onClick={() => setDay(firstOpen)} className="mt-4 text-[13.5px] font-semibold" style={{ color: accent }}>
                      Next available: {new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${firstOpen}T12:00:00Z`))} →
                    </button>
                  )}
                </div>
                <div>
                  <h3 className="mb-4 text-[15px] font-semibold">{day ? new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`)) : "Pick a day to see times"}</h3>
                  <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
                    {times.map((t) => {
                      const on = t === time;
                      return (
                        <div key={t} className="flex gap-2">
                          <button type="button" onClick={() => setTime(t)} className={`h-12 flex-1 rounded-xl border text-[15px] font-semibold tabular-nums transition ${on ? "border-transparent bg-[#0b2447] text-white" : "border-[#d9e6f2] hover:border-[var(--a)]"}`} style={on ? undefined : { color: accent }}>
                            {timeLabel(Date.parse(t), tz)}
                          </button>
                          {on && (
                            <button type="button" onClick={() => (p.mode === "manage" ? manage("reschedule") : setStep("details"))} disabled={busy} className="h-12 flex-1 rounded-xl text-[15px] font-semibold text-white shadow-[0_10px_24px_-12px_var(--a)]" style={{ background: accent }}>
                              {p.mode === "manage" ? "Move here" : "Next"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {step === "details" && (
              <form onSubmit={book} className="mx-auto flex max-w-[520px] flex-col gap-4">
                <button type="button" onClick={() => setStep("pick")} className="flex w-fit items-center gap-1.5 text-[13.5px] font-semibold text-[#52627a] hover:text-[#0b2447]"><Icon name="arrowLeft" size={15} /> Change time</button>
                <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Your details</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">First name<input required autoComplete="given-name" value={form.first_name ?? ""} onChange={(e) => setForm({ ...form, first_name: e.target.value })} maxLength={80} className={field} /></label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Last name<input autoComplete="family-name" value={form.last_name ?? ""} onChange={(e) => setForm({ ...form, last_name: e.target.value })} maxLength={80} className={field} /></label>
                </div>
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Email<input required type="email" autoComplete="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={200} className={field} /></label>
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Mobile<input type="tel" autoComplete="tel" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={30} placeholder="07700 900123" className={field} /></label>
                {p.questions.map((q) => (
                  <label key={q.id} className="flex flex-col gap-1.5 text-[13px] font-semibold">
                    {q.label}{q.required ? "" : " (optional)"}
                    {q.type === "textarea" ? (
                      <textarea required={q.required} value={form[`q_${q.id}`] ?? ""} onChange={(e) => setForm({ ...form, [`q_${q.id}`]: e.target.value })} rows={3} maxLength={2000} className={`${field} h-auto py-3`} />
                    ) : q.type === "select" ? (
                      <select required={q.required} value={form[`q_${q.id}`] ?? ""} onChange={(e) => setForm({ ...form, [`q_${q.id}`]: e.target.value })} className={field}>
                        <option value="">Choose one</option>
                        {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input required={q.required} value={form[`q_${q.id}`] ?? ""} onChange={(e) => setForm({ ...form, [`q_${q.id}`]: e.target.value })} maxLength={300} className={field} />
                    )}
                  </label>
                ))}
                <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website ?? ""} onChange={(e) => setForm({ ...form, website: e.target.value })} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
                <label className="flex items-start gap-2.5 text-[13px] text-[#52627a]">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4" style={{ accentColor: accent }} />
                  Send me reminders about this booking by email and text.
                </label>
                <button type="submit" disabled={busy} className="mt-2 inline-flex h-13 items-center justify-center gap-2 rounded-xl py-3.5 text-[16px] font-semibold text-white shadow-[0_14px_30px_-14px_var(--a)] transition hover:brightness-110 disabled:opacity-60" style={{ background: accent }}>
                  {busy ? "Booking…" : "Confirm booking"} <Icon name="arrowRight" size={16} />
                </button>
              </form>
            )}

            {step === "done" && done && (
              <div className="mx-auto flex max-w-md flex-col items-center py-6 text-center">
                <div className="relative grid h-20 w-20 place-items-center">
                  <span className="absolute inset-0 animate-ping rounded-full opacity-20" style={{ background: accent }} />
                  <span className="relative grid h-20 w-20 place-items-center rounded-full text-white shadow-[0_18px_40px_-16px_var(--a)]" style={{ background: `linear-gradient(135deg, #64E7EF, ${accent})` }}><Icon name="check" size={34} /></span>
                </div>
                <h2 className="mt-6 text-[26px] font-semibold tracking-[-0.03em]">You&apos;re booked</h2>
                <p className="mt-2 text-[16px] text-[#52627a]">{dayLabel(Date.parse(done.start), tz)} at {timeLabel(Date.parse(done.start), tz)}</p>
                <p className="mt-4 text-[14px] leading-relaxed text-[#52627a]">{done.thankYou || "We've emailed you the details and a link to move or cancel if you need to."}</p>
                {done.meetingUrl && <a href={done.meetingUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl border border-[#d9e6f2] px-5 text-[14px] font-semibold"><Icon name="video" size={15} /> Meeting link</a>}
              </div>
            )}

            {step === "cancelled" && (
              <div className="mx-auto max-w-md py-10 text-center">
                <h2 className="text-[24px] font-semibold tracking-[-0.02em]">Your booking is cancelled</h2>
                <p className="mt-2 text-[15px] text-[#52627a]">We&apos;ve let the team know. Reply to your confirmation email if you&apos;d like to book again.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      {!p.embed && <p className="relative mt-6 text-center text-[12px] text-[#8a9ab0]">Bookings by Scalency</p>}
    </div>
  );
}
