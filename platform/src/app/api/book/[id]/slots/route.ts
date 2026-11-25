import { adminClient } from "@/lib/admin";
import { loadCalendar, openSlots } from "@/lib/calendar/booking";
import { addDays, dateIn, validTimeZone, zonedToUtc } from "@/lib/calendar/time";

// Open times on a booking page, grouped by day in the visitor's time zone.
// GET /api/book/<calendar id>/slots?from=2026-12-01&days=7&tz=Europe/London

export const dynamic = "force-dynamic";

const json = (status: number, data: unknown) => Response.json(data, { status, headers: { "cache-control": "no-store" } });

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json(404, { error: "This booking page doesn't exist." });
  const admin = adminClient();
  if (!admin) return json(503, { error: "Booking isn't set up yet." });
  const cal = await loadCalendar(admin, { id });
  if (!cal || cal.status !== "active") return json(404, { error: "This booking page isn't taking bookings right now." });

  const q = new URL(request.url).searchParams;
  const tz = validTimeZone(q.get("tz")) ? q.get("tz")! : "Europe/London";
  const days = Math.min(42, Math.max(1, Number(q.get("days")) || 7));
  const today = dateIn(Date.now(), tz);
  const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(q.get("from") ?? "") && q.get("from")! >= today ? q.get("from")! : today;
  const from = zonedToUtc(fromDate, "00:00", tz);
  const to = zonedToUtc(addDays(fromDate, days), "00:00", tz);

  const { slots } = await openSlots(admin, cal, from, to);
  const byDay: Record<string, string[]> = {};
  for (const s of slots) {
    const d = dateIn(s.start, tz);
    (byDay[d] ??= []).push(new Date(s.start).toISOString());
  }
  const last = addDays(today, cal.maxDaysAhead);
  return json(200, { tz, from: fromDate, days, byDay, lastDay: last, durationMin: cal.durationMin });
}
