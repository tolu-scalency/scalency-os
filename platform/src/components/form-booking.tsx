"use client";

// The booking calendar inside a form's last step. Either a Scalency booking page
// (a compact day and time picker, booked with the details already given on the
// form) or a Calendly link (Calendly's own inline calendar). When the booking is
// made it calls onBooked, and the form finishes.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, timeLabel, validTimeZone } from "@/lib/calendar/time";
import type { ContentBlock, Theme } from "@/lib/form-builder";
import { palette } from "@/components/lead-form";

export type Person = { first: string; last: string; email: string; phone: string };
export type Booked = { provider: "scalency" | "calendly"; start?: string; meetingUrl?: string | null; ref?: string; thankYou?: string | null; redirect?: string | null };

type Slots = { byDay: Record<string, string[]>; lastDay: string };

function todayIn(tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
const monthStart = (d: string) => `${d.slice(0, 8)}01`;
function shiftMonth(d: string, n: number) {
  const [y, m] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}
const dayName = (d: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

export function FormBooking({ b, theme, person, consent, design = false, onBooked }: { b: ContentBlock; theme: Theme; person: Person; consent: boolean; design?: boolean; onBooked: (x: Booked) => void }) {
  if (design) return <DesignPreview b={b} theme={theme} />;
  if (b.source === "calendly") return <CalendlyInline b={b} theme={theme} person={person} onBooked={onBooked} />;
  return <ScalencyPicker b={b} theme={theme} person={person} consent={consent} onBooked={onBooked} />;
}

function DesignPreview({ b, theme }: { b: ContentBlock; theme: Theme }) {
  const p = palette(theme);
  const ready = b.source === "calendly" ? Boolean(b.url) : Boolean(b.calendarId);
  return (
    <div style={{ borderRadius: theme.radius, border: `1.5px dashed ${ready ? theme.accent : p.line}`, padding: "22px 18px", textAlign: "center", color: p.muted, fontSize: 13.5, background: p.tint }}>
      <div style={{ fontSize: 26, marginBottom: 6 }}>📅</div>
      <div style={{ fontWeight: 700, color: p.fg, fontSize: 15 }}>{b.source === "calendly" ? "Calendly calendar" : "Scalency booking calendar"}</div>
      <div style={{ marginTop: 4 }}>
        {ready ? (b.source === "calendly" ? b.url!.replace(/^https:\/\//, "") : "They pick a day and time here, then they're booked in.") : b.source === "calendly" ? "Paste your Calendly link in the panel on the right." : "Choose a booking page in the panel on the right."}
      </div>
      {b.qualifiedOnly !== false && <div style={{ marginTop: 6, fontSize: 12 }}>Only shown to people who qualify.</div>}
    </div>
  );
}

function ScalencyPicker({ b, theme, person, consent, onBooked }: { b: ContentBlock; theme: Theme; person: Person; consent: boolean; onBooked: (x: Booked) => void }) {
  const p = palette(theme);
  const t = theme;
  const [tz, setTz] = useState("Europe/London");
  const [month, setMonth] = useState(() => monthStart(todayIn("Europe/London")));
  const [slots, setSlots] = useState<Slots | null>(null);
  const [loading, setLoading] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shown = useRef(0);

  useEffect(() => {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the visitor's time zone is only known in the browser
    if (validTimeZone(z)) setTz(z);
    shown.current = Date.now();
  }, []);

  const load = useCallback(async () => {
    if (!b.calendarId) return;
    setLoading(true);
    try {
      const today = todayIn(tz);
      const from = month < today ? today : month;
      const r = await fetch(`/api/book/${b.calendarId}/slots?from=${from}&days=42&tz=${encodeURIComponent(tz)}`, { cache: "no-store" });
      const j = (await r.json()) as Slots & { error?: string };
      if (j.error) setError(j.error);
      else setSlots(j);
    } catch {
      setError("We couldn't load the times. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, [b.calendarId, month, tz]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading the open times for the month on show
    void load();
  }, [load]);

  const grid = useMemo(() => {
    const lead = (new Date(`${month}T12:00:00Z`).getUTCDay() + 6) % 7;
    const first = addDays(month, -lead);
    return Array.from({ length: 42 }, (_, i) => addDays(first, i));
  }, [month]);
  const today = todayIn(tz);
  const firstOpen = useMemo(() => Object.keys(slots?.byDay ?? {}).sort()[0] ?? null, [slots]);
  const times = day ? (slots?.byDay[day] ?? []) : [];
  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}T12:00:00Z`));

  async function confirm() {
    if (!time || !b.calendarId) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/book/${b.calendarId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ start: time, tz, first_name: person.first, last_name: person.last, email: person.email, phone: person.phone, answers: {}, consent, website: "", t: Math.max(5000, Date.now() - shown.current) }),
      });
      const j = await r.json();
      if (!r.ok || j.error) {
        setError(j.error ?? "That didn't work. Please try again.");
        if (r.status === 409) {
          setTime(null);
          void load();
        }
        return;
      }
      onBooked({ provider: "scalency", start: j.start, meetingUrl: j.meetingUrl ?? null, ref: j.ref ?? undefined, thankYou: j.thankYou ?? null, redirect: j.redirect ?? null });
    } catch {
      setError("That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const navBtn = (label: string, disabled: boolean, onClick: () => void, aria: string) => (
    <button type="button" aria-label={aria} disabled={disabled} onClick={onClick} style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${p.line}`, background: "transparent", color: p.fg, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.3 : 1, fontSize: 16, fontFamily: "inherit" }}>
      {label}
    </button>
  );

  if (!b.calendarId) return <p style={{ color: p.error, fontSize: 14 }}>This calendar isn&apos;t set up yet.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error && <div style={{ borderRadius: t.radius, background: "#fff1f1", color: "#b42318", padding: "10px 14px", fontSize: 14 }}>{error}</div>}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {navBtn("‹", month <= monthStart(today), () => setMonth(shiftMonth(month, -1)), "Previous month")}
        <span style={{ fontWeight: 700, fontSize: 15, color: p.fg }}>{monthLabel}</span>
        {navBtn("›", !!slots && shiftMonth(month, 1) > (slots.lastDay ?? "9999"), () => setMonth(shiftMonth(month, 1)), "Next month")}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: p.muted }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, opacity: loading ? 0.5 : 1, transition: "opacity .2s" }}>
        {grid.map((d) => {
          const inMonth = d.startsWith(month.slice(0, 7));
          const open = !!slots?.byDay[d]?.length;
          const on = d === day;
          return (
            <button
              key={d}
              type="button"
              disabled={!open || !inMonth}
              onClick={() => {
                setDay(d);
                setTime(null);
              }}
              style={{
                visibility: inMonth ? "visible" : "hidden",
                height: 44,
                borderRadius: Math.min(t.radius, 14),
                border: 0,
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: open ? "pointer" : "default",
                background: on ? t.accent : open ? `${t.accent}1a` : "transparent",
                color: on ? "#fff" : open ? t.accent : p.line,
                position: "relative",
              }}
            >
              {Number(d.slice(8))}
              {d === today && <span style={{ position: "absolute", bottom: 5, left: "50%", width: 4, height: 4, marginLeft: -2, borderRadius: 9, background: on ? "#fff" : t.accent }} />}
            </button>
          );
        })}
      </div>
      {!loading && slots && !Object.keys(slots.byDay).length && <p style={{ margin: 0, fontSize: 14, color: p.muted }}>No times left this month. Try the next one.</p>}
      {!day && firstOpen && (
        <button type="button" onClick={() => setDay(firstOpen)} style={{ border: 0, background: "transparent", color: t.accent, fontWeight: 700, fontSize: 14, cursor: "pointer", textAlign: "left", padding: 0, fontFamily: "inherit" }}>
          Next available: {dayName(firstOpen)} →
        </button>
      )}

      {day && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: p.fg }}>{dayName(day)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
            {times.map((x) => {
              const on = x === time;
              return (
                <button
                  key={x}
                  type="button"
                  onClick={() => setTime(x)}
                  style={{ minHeight: 44, borderRadius: t.radius, border: `1.5px solid ${on ? t.accent : p.line}`, background: on ? t.accent : "transparent", color: on ? "#fff" : p.fg, fontWeight: 700, fontSize: 14.5, cursor: "pointer", fontFamily: "inherit", fontVariantNumeric: "tabular-nums" }}
                >
                  {timeLabel(Date.parse(x), tz)}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 12.5, color: p.muted }}>Times shown in {tz.replace(/_/g, " ")}.</div>
        </div>
      )}

      {time && (
        <button
          type="button"
          disabled={busy}
          onClick={confirm}
          style={{ minHeight: 50, borderRadius: t.buttonStyle === "pill" ? 999 : t.radius, border: 0, background: t.accent, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: busy ? 0.7 : 1 }}
        >
          {busy ? "Booking…" : `Book ${dayName(day!).split(" ").slice(0, 3).join(" ")} at ${timeLabel(Date.parse(time), tz)}`}
        </button>
      )}
    </div>
  );
}

function CalendlyInline({ b, theme, person, onBooked }: { b: ContentBlock; theme: Theme; person: Person; onBooked: (x: Booked) => void }) {
  const done = useRef(false);
  const [height, setHeight] = useState(700);
  const src = useMemo(() => {
    if (!b.url) return "";
    const u = new URL(b.url);
    u.searchParams.set("embed_domain", typeof window === "undefined" ? "scalency.us" : window.location.hostname);
    u.searchParams.set("embed_type", "Inline");
    u.searchParams.set("hide_gdpr_banner", "1");
    u.searchParams.set("primary_color", theme.accent.replace("#", ""));
    const name = [person.first, person.last].filter(Boolean).join(" ");
    if (name) u.searchParams.set("name", name);
    if (person.first) u.searchParams.set("first_name", person.first);
    if (person.last) u.searchParams.set("last_name", person.last);
    if (person.email) u.searchParams.set("email", person.email);
    return u.toString();
  }, [b.url, theme.accent, person.first, person.last, person.email]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== "https://calendly.com") return;
      const d = e.data as { event?: string; payload?: { event?: { uri?: string }; invitee?: { uri?: string }; height?: string } };
      if (d?.event === "calendly.page_height" && d.payload?.height) {
        const h = parseInt(String(d.payload.height), 10);
        if (Number.isFinite(h) && h > 300) setHeight(Math.min(1400, h));
      }
      if (d?.event === "calendly.event_scheduled" && !done.current) {
        done.current = true;
        onBooked({ provider: "calendly", ref: d.payload?.invitee?.uri ?? d.payload?.event?.uri });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onBooked]);

  if (!src) return <p style={{ color: palette(theme).error, fontSize: 14 }}>This calendar isn&apos;t set up yet.</p>;
  return <iframe title="Book a time" src={src} style={{ width: "100%", height, border: 0, borderRadius: theme.radius, background: "#fff" }} />;
}
