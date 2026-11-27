"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { Pill } from "@/components/ui";
import { notify } from "@/components/toast";
import { shortId } from "@/lib/short-id-shared";
import { addDays, dateIn, dayLabel, partsIn, timeLabel, zonedToUtc } from "@/lib/calendar/time";
import { STATUS_LOOK, type AppointmentStatus } from "@/lib/calendar/types";
import { cancelAppointmentAction, createManualBooking, rescheduleAction, saveAppointmentNotes, setAppointmentStatus } from "./actions";

export type ApptView = {
  id: string;
  title: string;
  start: number;
  end: number;
  status: AppointmentStatus;
  calendarId: string | null;
  contactId: string | null;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  assignedTo: string | null;
  meetingUrl: string | null;
  location: string | null;
  source: string;
  notes: string;
  answers: { label: string; value: string }[];
  bookerTz: string | null;
};
type Cal = { id: string; name: string; color: string; durationMin: number };
type Member = { id: string; name: string };

const HOUR = 56;
const SOURCE: Record<string, string> = { booking_page: "Booking page", manual: "Booked by the team", calendly: "Calendly", google: "Google", microsoft: "Outlook", ai: "AI setter", api: "API" };

function said(r: { error?: string; ok?: string }) {
  if (r.error) notify(r.error, "bad");
  else if (r.ok) notify(r.ok);
}

export function CalendarView(props: {
  view: "day" | "week" | "month" | "list";
  date: string;
  today: string;
  first: string;
  days: number;
  tz: string;
  appts: ApptView[];
  busy: { start: number; end: number }[];
  calendars: Cal[];
  members: Member[];
  me: string;
  who: string;
  calFilter: string;
  canManage: boolean;
}) {
  const { view, date, today, first, days, tz, appts, calendars, members } = props;
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ date: string; time: string } | null>(null);
  const router = useRouter();
  const color = (id: string | null) => calendars.find((c) => c.id === id)?.color ?? "#0465C7";
  const memberName = (id: string | null) => members.find((m) => m.id === id)?.name ?? "Unassigned";

  const href = (p: Partial<Record<"view" | "date" | "who" | "cal", string>>) => {
    const q = new URLSearchParams({ view, date, who: props.who, cal: props.calFilter, ...p });
    return `/calendar?${q.toString()}`;
  };
  const step = view === "day" ? 1 : view === "week" ? 7 : view === "month" ? 0 : 7;
  const prev = view === "month" ? `${shiftMonth(date, -1)}` : addDays(date, -step);
  const next = view === "month" ? `${shiftMonth(date, 1)}` : addDays(date, step);
  const label = useMemo(() => {
    const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...o, timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
    if (view === "day") return fmt(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (view === "month") return fmt(date, { month: "long", year: "numeric" });
    if (view === "list") return "Coming up";
    const last = addDays(first, 6);
    return `${fmt(first, { day: "numeric", month: "short" })} to ${fmt(last, { day: "numeric", month: "short", year: "numeric" })}`;
  }, [view, date, first]);

  const shown = appts;
  const upcoming = appts.filter((a) => a.status !== "cancelled" && a.end >= nowMs()).length;
  const selected = appts.find((a) => a.id === open) ?? null;

  return (
    <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1">
      {/* Toolbar */}
      <div className="card flex flex-none flex-wrap items-center gap-3 p-3">
        <div className="flex items-center gap-1.5">
          <Link href={href({ date: today })} className="btn-ghost inline-flex h-9 items-center rounded-xl px-3 text-[13px] font-semibold">Today</Link>
          <Link href={href({ date: prev })} aria-label="Previous" className="btn-ghost inline-flex h-9 w-9 items-center justify-center rounded-xl"><Icon name="chevronLeft" size={16} /></Link>
          <Link href={href({ date: next })} aria-label="Next" className="btn-ghost inline-flex h-9 w-9 items-center justify-center rounded-xl"><Icon name="chevronRight" size={16} /></Link>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-semibold tracking-[-0.01em]">{label}</div>
          <div className="text-[12px] text-muted">{upcoming} upcoming · times in {tz.replace(/_/g, " ")}</div>
        </div>
        <div className="inline-flex rounded-[11px] border border-line bg-surface p-[3px]" role="tablist" aria-label="View">
          {(["day", "week", "month", "list"] as const).map((v) => (
            <Link key={v} href={href({ view: v })} role="tab" aria-selected={view === v} className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold capitalize ${view === v ? "bg-white text-navy shadow-sm" : "text-muted hover:text-navy"}`}>
              {v}
            </Link>
          ))}
        </div>
        <select value={props.who} onChange={(e) => router.push(href({ who: e.target.value }))} aria-label="Whose bookings" className="field h-9 w-auto text-[13px]">
          <option value="all">Everyone</option>
          <option value="me">Just me</option>
          {members.filter((m) => m.id !== props.me).map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select value={props.calFilter} onChange={(e) => router.push(href({ cal: e.target.value }))} aria-label="Which calendar" className="field h-9 w-auto text-[13px]">
          <option value="all">All calendars</option>
          {calendars.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {calendars.length > 0 && (
          <button type="button" onClick={() => setCreating({ date: date >= today ? date : today, time: "10:00" })} className="btn-primary inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold">
            <Icon name="plus" size={14} /> New booking
          </button>
        )}
      </div>

      {calendars.length === 0 && (
        <div className="card relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,168,235,0.25),transparent_70%)]" />
          <div className="relative max-w-xl">
            <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Set up your first booking page</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">A booking page is the link people use to pick a time. Choose who takes the calls, connect Google or Outlook so busy times are blocked, and bookings land here, in the pipeline and in your workflows.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/calendar/booking-pages" className="btn-primary inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-[13.5px] font-semibold"><Icon name="plus" size={14} /> Create a booking page</Link>
              <Link href="/calendar/connections" className="btn-ghost inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-[13.5px] font-semibold"><Icon name="globe" size={14} /> Connect a calendar</Link>
            </div>
          </div>
        </div>
      )}

      {(view === "week" || view === "day") && (
        <TimeGrid first={first} days={days} today={today} tz={tz} appts={shown} busy={props.busy} color={color} onOpen={setOpen} onSlot={(d, t) => calendars.length && setCreating({ date: d, time: t })} />
      )}
      {view === "month" && <MonthGrid first={first} month={date.slice(0, 7)} today={today} tz={tz} appts={shown} color={color} onOpen={setOpen} dayHref={(d) => href({ view: "day", date: d })} />}
      {view === "list" && (
        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <ListView tz={tz} appts={shown} color={color} memberName={memberName} onOpen={setOpen} />
        </div>
      )}

      {selected && <Drawer a={selected} tz={tz} color={color(selected.calendarId)} calName={calendars.find((c) => c.id === selected.calendarId)?.name ?? null} memberName={memberName(selected.assignedTo)} onClose={() => setOpen(null)} />}
      {creating && <NewBooking init={creating} tz={tz} calendars={calendars} members={members} me={props.me} canManage={props.canManage} onClose={() => setCreating(null)} />}
    </div>
  );
}

function nowMs() {
  return Date.now();
}

function shiftMonth(date: string, n: number) {
  const [y, m] = date.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}

/** Side-by-side lanes for overlapping bookings on one day. */
function lanes(list: ApptView[]) {
  const sorted = [...list].sort((a, b) => a.start - b.start || b.end - a.end);
  const ends: number[] = [];
  const out = new Map<string, { lane: number; of: number }>();
  const groups: ApptView[][] = [];
  let group: ApptView[] = [];
  let groupEnd = 0;
  for (const a of sorted) {
    if (group.length && a.start >= groupEnd) {
      groups.push(group);
      group = [];
      ends.length = 0;
    }
    let lane = ends.findIndex((e) => e <= a.start);
    if (lane < 0) lane = ends.push(a.end) - 1;
    else ends[lane] = a.end;
    out.set(a.id, { lane, of: 0 });
    group.push(a);
    groupEnd = Math.max(groupEnd, a.end);
  }
  if (group.length) groups.push(group);
  for (const g of groups) {
    const n = Math.max(...g.map((a) => out.get(a.id)!.lane)) + 1;
    for (const a of g) out.get(a.id)!.of = n;
  }
  return out;
}

function TimeGrid(p: {
  first: string;
  days: number;
  today: string;
  tz: string;
  appts: ApptView[];
  busy: { start: number; end: number }[];
  color: (id: string | null) => string;
  onOpen: (id: string) => void;
  onSlot: (date: string, time: string) => void;
}) {
  const dates = Array.from({ length: p.days }, (_, i) => addDays(p.first, i));
  const hourOf = (ms: number) => {
    const x = partsIn(ms, p.tz);
    return x.hour + x.minute / 60;
  };
  const inView = p.appts.filter((a) => dates.includes(dateIn(a.start, p.tz)));
  const minH = Math.max(0, Math.min(7, ...inView.map((a) => Math.floor(hourOf(a.start)))));
  const maxH = Math.min(24, Math.max(20, ...inView.map((a) => Math.ceil(hourOf(a.end) || 24))));
  const hours = Array.from({ length: maxH - minH }, (_, i) => minH + i);
  const now = nowMs();
  // Open the grid at the first booking (or 8am), so the day's appointments are in view.
  const scroller = useRef<HTMLDivElement>(null);
  const firstHour = inView.length ? Math.min(...inView.map((a) => hourOf(a.start))) : 8;
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = Math.max(0, (Math.min(firstHour, 8) - minH) * HOUR - 12);
  }, [firstHour, minH]);
  const nowDate = dateIn(now, p.tz);
  const nowTop = (hourOf(now) - minH) * HOUR;

  return (
    <div className="card overflow-hidden p-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
      <div className="overflow-x-auto lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
        <div style={{ minWidth: p.days > 1 ? 860 : 0 }} className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          <div className="grid border-b border-line bg-surface/70" style={{ gridTemplateColumns: `64px repeat(${p.days}, minmax(0, 1fr))` }}>
            <div />
            {dates.map((d) => {
              const isToday = d === p.today;
              const dt = new Date(`${d}T12:00:00Z`);
              return (
                <div key={d} className="border-l border-line px-3 py-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(dt)}</div>
                  <div className={`mt-0.5 inline-grid h-8 min-w-8 place-items-center rounded-full px-1 text-[17px] font-semibold tabular-nums ${isToday ? "bg-brand text-white" : ""}`}>{dt.getUTCDate()}</div>
                </div>
              );
            })}
          </div>
          <div ref={scroller} className="relative grid max-h-[68vh] overflow-y-auto lg:max-h-none lg:min-h-0 lg:flex-1" style={{ gridTemplateColumns: `64px repeat(${p.days}, minmax(0, 1fr))` }}>
            <div className="relative">
              {hours.map((h) => (
                <div key={h} style={{ height: HOUR }} className="relative pr-2 text-right text-[11px] tabular-nums text-faint">
                  <span className="relative -top-2">{h === minH ? "" : `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`}</span>
                </div>
              ))}
            </div>
            {dates.map((d) => {
              const mine = inView.filter((a) => dateIn(a.start, p.tz) === d);
              const lane = lanes(mine);
              const busyHere = p.busy.filter((b) => dateIn(b.start, p.tz) === d);
              return (
                <div key={d} className={`relative border-l border-line ${d === p.today ? "bg-[#f5f9ff]" : ""}`} style={{ height: hours.length * HOUR }}>
                  {hours.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => p.onSlot(d, `${String(h).padStart(2, "0")}:00`)}
                      aria-label={`Book ${d} at ${h}:00`}
                      className="block w-full border-b border-dashed border-line/70 transition-colors hover:bg-[#eef6fd]"
                      style={{ height: HOUR }}
                    />
                  ))}
                  {busyHere.map((b, i) => (
                    <div
                      key={i}
                      className="pointer-events-none absolute inset-x-1 rounded-lg border border-dashed border-[#c9d6e6] bg-[repeating-linear-gradient(135deg,#f3f6fa,#f3f6fa_6px,#e9eef5_6px,#e9eef5_12px)] px-2 py-1 text-[10.5px] font-semibold text-muted"
                      style={{ top: (hourOf(b.start) - minH) * HOUR, height: Math.max(18, ((b.end - b.start) / 3600_000) * HOUR - 2) }}
                    >
                      Busy
                    </div>
                  ))}
                  {mine.map((a) => {
                    const l = lane.get(a.id)!;
                    const top = (hourOf(a.start) - minH) * HOUR;
                    const height = Math.max(26, ((a.end - a.start) / 3600_000) * HOUR - 3);
                    const c = p.color(a.calendarId);
                    const off = a.status === "cancelled";
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => p.onOpen(a.id)}
                        className={`group absolute overflow-hidden rounded-xl border px-2.5 py-1.5 text-left transition hover:z-10 hover:-translate-y-px ${off ? "opacity-50" : ""}`}
                        style={{
                          top,
                          height,
                          left: `calc(${(l.lane / l.of) * 100}% + 4px)`,
                          width: `calc(${100 / l.of}% - 8px)`,
                          background: `linear-gradient(180deg, ${c}1f, ${c}14)`,
                          borderColor: `${c}55`,
                        }}
                      >
                        <span className="absolute inset-y-1.5 left-1 w-[3px] rounded-full" style={{ background: c }} />
                        <div className={`truncate pl-1.5 text-[12px] font-semibold text-navy ${off ? "line-through" : ""}`}>{a.contactName}</div>
                        {height > 36 && <div className="truncate pl-1.5 text-[11px] text-muted">{timeLabel(a.start, p.tz)} · {a.title.split(" with ")[0]}</div>}
                        {a.status === "no_show" && <span className="absolute right-1.5 top-1.5 rounded bg-[#fde2e2] px-1 text-[9.5px] font-bold uppercase text-[#b42318]">No-show</span>}
                      </button>
                    );
                  })}
                  {d === nowDate && nowTop > 0 && nowTop < hours.length * HOUR && (
                    <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: nowTop }}>
                      <div className="h-[2px] bg-[#e5484d]" />
                      <div className="absolute -left-1 -top-[4px] h-2.5 w-2.5 rounded-full bg-[#e5484d]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MonthGrid(p: { first: string; month: string; today: string; tz: string; appts: ApptView[]; color: (id: string | null) => string; onOpen: (id: string) => void; dayHref: (d: string) => string }) {
  const dates = Array.from({ length: 42 }, (_, i) => addDays(p.first, i));
  return (
    <div className="card overflow-hidden p-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
      <div className="grid flex-none grid-cols-7 border-b border-line bg-surface/70 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="px-3 py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 lg:min-h-0 lg:flex-1 lg:grid-rows-6 lg:overflow-y-auto">
        {dates.map((d, i) => {
          const list = p.appts.filter((a) => dateIn(a.start, p.tz) === d && a.status !== "cancelled");
          const inMonth = d.startsWith(p.month);
          return (
            <div key={d} className={`min-h-[118px] border-line p-1.5 lg:min-h-0 lg:overflow-hidden ${i % 7 ? "border-l" : ""} ${i >= 7 ? "border-t" : ""} ${inMonth ? "" : "bg-surface/50"}`}>
              <Link href={p.dayHref(d)} className={`mb-1 inline-grid h-7 min-w-7 place-items-center rounded-full px-1 text-[12.5px] font-semibold tabular-nums ${d === p.today ? "bg-brand text-white" : inMonth ? "text-navy hover:bg-surface" : "text-faint"}`}>
                {Number(d.slice(8))}
              </Link>
              <div className="flex flex-col gap-1">
                {list.slice(0, 3).map((a) => (
                  <button key={a.id} type="button" onClick={() => p.onOpen(a.id)} className="flex items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-left text-[11.5px] hover:bg-surface">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color(a.calendarId) }} />
                    <span className="tabular-nums text-muted">{timeLabel(a.start, p.tz)}</span>
                    <span className="truncate font-medium">{a.contactName}</span>
                  </button>
                ))}
                {list.length > 3 && <Link href={p.dayHref(d)} className="px-1.5 text-[11px] font-semibold text-brand">+{list.length - 3} more</Link>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView(p: { tz: string; appts: ApptView[]; color: (id: string | null) => string; memberName: (id: string | null) => string; onOpen: (id: string) => void }) {
  const groups = new Map<string, ApptView[]>();
  for (const a of p.appts) {
    const d = dateIn(a.start, p.tz);
    groups.set(d, [...(groups.get(d) ?? []), a]);
  }
  if (!p.appts.length) return <div className="card p-6 text-center text-[14px] text-muted">Nothing booked in the next 60 days yet.</div>;
  return (
    <div className="flex flex-col gap-4">
      {[...groups.entries()].map(([d, list]) => (
        <div key={d} className="card overflow-hidden p-0">
          <div className="border-b border-line bg-surface/70 px-5 py-2.5 text-[12.5px] font-semibold text-muted">{dayLabel(list[0].start, p.tz)}</div>
          <div className="divide-y divide-line">
            {list.map((a) => (
              <button key={a.id} type="button" onClick={() => p.onOpen(a.id)} className="flex w-full flex-wrap items-center gap-4 px-5 py-3.5 text-left hover:bg-surface">
                <div className="w-24 shrink-0 text-[13.5px] font-semibold tabular-nums">{timeLabel(a.start, p.tz)}</div>
                <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: p.color(a.calendarId) }} />
                <div className="min-w-0 flex-[1_1_200px]">
                  <div className="truncate text-[14px] font-semibold">{a.contactName}</div>
                  <div className="truncate text-[12px] text-muted">{a.title} · with {p.memberName(a.assignedTo)} · {SOURCE[a.source] ?? a.source}</div>
                </div>
                <Pill tone={STATUS_LOOK[a.status].tone}>{STATUS_LOOK[a.status].label}</Pill>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function localInput(ms: number, tz: string) {
  const x = partsIn(ms, tz);
  return `${x.date}T${String(x.hour).padStart(2, "0")}:${String(x.minute).padStart(2, "0")}`;
}

function Drawer({ a, tz, color, calName, memberName, onClose }: { a: ApptView; tz: string; color: string; calName: string | null; memberName: string; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [moving, setMoving] = useState(false);
  const [when, setWhen] = useState(localInput(a.start, tz));
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [tell, setTell] = useState(true);
  const [notes, setNotes] = useState(a.notes);
  const past = a.end < nowMs();
  const run = (fn: () => Promise<{ error?: string; ok?: string }>, close = false) =>
    start(async () => {
      const r = await fn();
      said(r);
      if (!r.error && close) onClose();
    });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[rgba(8,15,30,0.35)] backdrop-blur-[2px]" onClick={onClose}>
      <aside className="fade-in flex h-full w-full max-w-[440px] flex-col overflow-y-auto bg-white" onClick={(e) => e.stopPropagation()} aria-label="Booking">
        <div className="relative overflow-hidden px-6 pb-5 pt-6" style={{ background: `linear-gradient(135deg, ${color}22, transparent 70%)` }}>
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 inline-grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-white/70"><Icon name="x" size={16} /></button>
          <Pill tone={STATUS_LOOK[a.status].tone}>{STATUS_LOOK[a.status].label}</Pill>
          <h2 className="mt-3 text-[21px] font-semibold tracking-[-0.02em]">{a.contactName}</h2>
          <div className="mt-1 text-[13.5px] text-muted">{calName ?? a.title}</div>
          <div className="mt-4 flex items-center gap-2.5 text-[14px] font-semibold">
            <Icon name="calendar" size={16} className="text-brand" />
            {dayLabel(a.start, tz)}, {timeLabel(a.start, tz)} to {timeLabel(a.end, tz)}
          </div>
          {a.bookerTz && a.bookerTz !== tz && <div className="mt-1 pl-[26px] text-[12px] text-muted">Their time: {timeLabel(a.start, a.bookerTz)} ({a.bookerTz.replace(/_/g, " ")})</div>}
        </div>

        <div className="flex flex-col gap-5 px-6 pb-8">
          <div className="flex flex-wrap gap-2">
            {a.meetingUrl && (
              <a href={a.meetingUrl} target="_blank" rel="noreferrer" className="btn-primary inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-[13.5px] font-semibold"><Icon name="video" size={15} /> Join meeting</a>
            )}
            {a.contactId && (
              <Link href={`/contacts/${shortId(a.contactId)}`} className="btn-ghost inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-[13.5px] font-semibold"><Icon name="user" size={15} /> Open contact</Link>
            )}
          </div>

          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2.5 text-[13.5px]">
            <dt className="text-muted">With</dt>
            <dd className="font-medium">{memberName}</dd>
            {a.contactEmail && (<><dt className="text-muted">Email</dt><dd className="truncate"><a className="text-brand hover:underline" href={`mailto:${a.contactEmail}`}>{a.contactEmail}</a></dd></>)}
            {a.contactPhone && (<><dt className="text-muted">Phone</dt><dd><a className="text-brand hover:underline" href={`tel:${a.contactPhone}`}>{a.contactPhone}</a></dd></>)}
            {a.location && (<><dt className="text-muted">Where</dt><dd>{a.location}</dd></>)}
            <dt className="text-muted">Came from</dt>
            <dd>{SOURCE[a.source] ?? a.source}</dd>
            {a.answers.map((x, i) => (
              <div key={i} className="contents"><dt className="text-muted">{x.label}</dt><dd className="whitespace-pre-wrap">{x.value}</dd></div>
            ))}
          </dl>

          {a.status !== "cancelled" && (
            <div>
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">Outcome</div>
              <div className="grid grid-cols-2 gap-2">
                {(past ? (["showed", "no_show"] as const) : (["confirmed", "booked"] as const)).map((s) => (
                  <button key={s} type="button" disabled={pending || a.status === s} onClick={() => run(() => setAppointmentStatus(a.id, s))} className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border text-[13px] font-semibold transition ${a.status === s ? "border-brand bg-[#eef6fd] text-brand" : "border-line hover:border-brand/40"}`}>
                    <Icon name={s === "no_show" ? "x" : "check"} size={14} />
                    {STATUS_LOOK[s].label}
                  </button>
                ))}
              </div>
              {past ? null : <p className="mt-2 text-[12px] text-faint">After the call, mark it Showed or No-show. No-shows can start a rebooking workflow.</p>}
            </div>
          )}

          {a.status !== "cancelled" && (
            <div className="flex flex-col gap-2">
              {!moving ? (
                <button type="button" onClick={() => setMoving(true)} className="btn-ghost inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold"><Icon name="clock" size={14} /> Move to another time</button>
              ) : (
                <div className="rounded-xl border border-line p-3">
                  <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold">
                    New date and time ({tz.replace(/_/g, " ")})
                    <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="field h-10" />
                  </label>
                  <label className="mt-2 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={tell} onChange={(e) => setTell(e.target.checked)} className="h-4 w-4 accent-[#0465C7]" /> Email them the new time</label>
                  <div className="mt-3 flex gap-2">
                    <button type="button" disabled={pending} onClick={() => run(() => rescheduleAction(a.id, new Date(zonedToUtc(when.slice(0, 10), when.slice(11, 16), tz)).toISOString(), tell), true)} className="btn-primary inline-flex h-9 items-center rounded-xl px-4 text-[13px] font-semibold">Move it</button>
                    <button type="button" onClick={() => setMoving(false)} className="btn-ghost inline-flex h-9 items-center rounded-xl px-3 text-[13px] font-semibold">Back</button>
                  </div>
                </div>
              )}
              {!cancelling ? (
                <button type="button" onClick={() => setCancelling(true)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold text-bad hover:bg-[#fff1f1]"><Icon name="x" size={14} /> Cancel booking</button>
              ) : (
                <div className="rounded-xl border border-[#f3c4c4] bg-[#fff8f8] p-3">
                  <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold">
                    Reason (optional)
                    <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className="field h-10" />
                  </label>
                  <label className="mt-2 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={tell} onChange={(e) => setTell(e.target.checked)} className="h-4 w-4 accent-[#0465C7]" /> Email them that it&apos;s cancelled</label>
                  <div className="mt-3 flex gap-2">
                    <button type="button" disabled={pending} onClick={() => run(() => cancelAppointmentAction(a.id, reason, tell), true)} className="inline-flex h-9 items-center rounded-xl bg-[#d92d20] px-4 text-[13px] font-semibold text-white">Cancel it</button>
                    <button type="button" onClick={() => setCancelling(false)} className="btn-ghost inline-flex h-9 items-center rounded-xl px-3 text-[13px] font-semibold">Keep it</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold">
            Notes for the team
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={5000} className="field w-full py-2.5 text-[13.5px] font-normal" />
          </label>
          {notes !== a.notes && (
            <button type="button" disabled={pending} onClick={() => run(() => saveAppointmentNotes(a.id, notes))} className="btn-primary inline-flex h-9 w-fit items-center rounded-xl px-4 text-[13px] font-semibold">Save notes</button>
          )}
        </div>
      </aside>
    </div>
  );
}

function NewBooking({ init, tz, calendars, members, me, canManage, onClose }: { init: { date: string; time: string }; tz: string; calendars: Cal[]; members: Member[]; me: string; canManage: boolean; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [f, setF] = useState({ calendarId: calendars[0]?.id ?? "", assignTo: me, date: init.date, time: init.time, first_name: "", last_name: "", email: "", phone: "", notes: "" });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const field = "field h-10 w-full text-[13.5px]";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(8,15,30,0.45)] p-4 backdrop-blur-[2px]" onClick={onClose}>
      <form
        className="fade-in w-full max-w-[520px] rounded-xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await createManualBooking({ ...f, startIso: new Date(zonedToUtc(f.date, f.time, tz)).toISOString(), timezone: tz });
            said(r);
            if (!r.error) onClose();
          });
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[18px] font-semibold tracking-[-0.02em]">New booking</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-surface"><Icon name="x" size={16} /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold">
            Calendar
            <select value={f.calendarId} onChange={(e) => set({ calendarId: e.target.value })} className={field}>
              {calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold">
            With
            <select value={f.assignTo} onChange={(e) => set({ assignTo: e.target.value })} disabled={!canManage} className={field}>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold">
            Date
            <input type="date" required value={f.date} onChange={(e) => set({ date: e.target.value })} className={field} />
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold">
            Time ({tz.replace(/_/g, " ")})
            <input type="time" required value={f.time} onChange={(e) => set({ time: e.target.value })} className={field} />
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold">
            First name
            <input required value={f.first_name} onChange={(e) => set({ first_name: e.target.value })} maxLength={80} className={field} />
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold">
            Last name
            <input value={f.last_name} onChange={(e) => set({ last_name: e.target.value })} maxLength={80} className={field} />
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold">
            Email
            <input type="email" required value={f.email} onChange={(e) => set({ email: e.target.value })} maxLength={200} className={field} />
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold">
            Mobile
            <input value={f.phone} onChange={(e) => set({ phone: e.target.value })} maxLength={30} placeholder="07700 900123" className={field} />
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold sm:col-span-2">
            Notes
            <textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} maxLength={2000} className="field w-full py-2 text-[13.5px] font-normal" />
          </label>
        </div>
        <p className="mt-3 text-[12px] text-faint">They get the confirmation email, the booking goes into the person&apos;s Google or Outlook calendar with a meeting link, and your workflows start.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost inline-flex h-10 items-center rounded-xl px-4 text-[13.5px] font-semibold">Cancel</button>
          <button type="submit" disabled={pending} className="btn-primary inline-flex h-10 items-center gap-1.5 rounded-xl px-5 text-[13.5px] font-semibold"><Icon name="check" size={14} /> Book it</button>
        </div>
      </form>
    </div>
  );
}
