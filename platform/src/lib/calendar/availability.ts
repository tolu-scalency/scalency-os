// Open times for a booking page: working hours, minus busy times (other bookings, connected
// calendars), minus buffers, notice and daily limits. Pure, so it's easy to test.

import { addDays, dateIn, weekdayOf, zonedToUtc } from "./time";
import type { Override, Weekly } from "./types";

export type Interval = { start: number; end: number };

export type MemberInput = {
  userId: string;
  priority: number;
  lastBookedAt: number | null;
  timezone: string;
  weekly: Weekly;
  overrides: Override[];
  /** Times they can't be booked: other appointments and connected calendars' busy times. */
  busy: Interval[];
  /** Start times of their appointments, for the daily limit. */
  booked: number[];
};

export type Rules = {
  durationMin: number;
  slotStepMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  minNoticeMin: number;
  maxDaysAhead: number;
  dailyLimit: number;
};

export type Slot = { start: number; end: number; userIds: string[] };

const MIN = 60_000;

function overlaps(busy: Interval[], s: number, e: number) {
  for (const b of busy) if (b.start < e && b.end > s) return true;
  return false;
}

/** The working hours for one member on one date (in their time zone), as instants. */
export function workingWindows(m: Pick<MemberInput, "timezone" | "weekly" | "overrides">, date: string): Interval[] {
  const o = m.overrides.find((x) => x.date === date);
  const ranges = o ? o.ranges : (m.weekly[String(weekdayOf(date))] ?? []);
  return ranges.map(([a, b]) => ({ start: zonedToUtc(date, a, m.timezone), end: zonedToUtc(date, b, m.timezone) })).filter((w) => w.end > w.start);
}

export function slotsFor(members: MemberInput[], rules: Rules, from: number, to: number, now: number): Slot[] {
  const dur = rules.durationMin * MIN;
  const step = Math.max(5, rules.slotStepMin) * MIN;
  const earliest = Math.max(from, now + rules.minNoticeMin * MIN);
  const latest = Math.min(to, now + rules.maxDaysAhead * 1440 * MIN);
  if (latest <= earliest) return [];
  const byStart = new Map<number, Slot>();

  for (const m of members) {
    if (m.priority <= 0) continue;
    const perDay = new Map<string, number>();
    for (const t of m.booked) {
      const d = dateIn(t, m.timezone);
      perDay.set(d, (perDay.get(d) ?? 0) + 1);
    }
    const first = addDays(dateIn(earliest, m.timezone), -1);
    const last = addDays(dateIn(latest, m.timezone), 1);
    for (let date = first; date <= last; date = addDays(date, 1)) {
      if (rules.dailyLimit > 0 && (perDay.get(date) ?? 0) >= rules.dailyLimit) continue;
      for (const w of workingWindows(m, date)) {
        for (let s = w.start; s + dur <= w.end; s += step) {
          if (s < earliest || s > latest) continue;
          const e = s + dur;
          if (overlaps(m.busy, s - rules.bufferBeforeMin * MIN, e + rules.bufferAfterMin * MIN)) continue;
          const slot = byStart.get(s) ?? { start: s, end: e, userIds: [] };
          slot.userIds.push(m.userId);
          byStart.set(s, slot);
        }
      }
    }
  }
  return [...byStart.values()].sort((a, b) => a.start - b.start);
}

/** Round robin: of the people free at that time, the one booked least recently (higher priority breaks ties). */
export function pickMember(free: string[], members: Pick<MemberInput, "userId" | "priority" | "lastBookedAt">[]): string | null {
  const pool = members.filter((m) => free.includes(m.userId) && m.priority > 0);
  if (!pool.length) return null;
  pool.sort((a, b) => (a.lastBookedAt ?? 0) - (b.lastBookedAt ?? 0) || b.priority - a.priority || a.userId.localeCompare(b.userId));
  return pool[0].userId;
}
