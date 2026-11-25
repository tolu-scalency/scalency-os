import type { Metadata } from "next";
import { Page, PageHeader } from "@/components/ui";
import { adminClient } from "@/lib/admin";
import { can, getWorkspace, memberNames } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { busyTimes, CONNECTION_COLS, type Connection } from "@/lib/calendar/providers";
import { addDays, dateIn, validTimeZone, weekdayOf, zonedToUtc } from "@/lib/calendar/time";
import { CalendarTabs } from "./tabs";
import { CalendarView, type ApptView } from "./view";

export const metadata: Metadata = { title: "Calendar" };

type View = "day" | "week" | "month" | "list";

/** Server-side clock, kept out of the component body. */
function nowMs() {
  return Date.now();
}

/** The first and last day shown, in the workspace's time zone. */
function rangeFor(view: View, date: string) {
  if (view === "day") return { first: date, days: 1 };
  if (view === "week") {
    const wd = (weekdayOf(date) + 6) % 7; // Monday first
    return { first: addDays(date, -wd), days: 7 };
  }
  if (view === "month") {
    const first = `${date.slice(0, 8)}01`;
    const lead = (weekdayOf(first) + 6) % 7;
    return { first: addDays(first, -lead), days: 42 };
  }
  return { first: date, days: 60 };
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [ws, sp] = await Promise.all([getWorkspace(), searchParams]);
  const supabase = await createClient();
  const { data: acc } = await supabase.from("accounts").select("timezone").eq("id", ws.account.id).single();
  const tz = validTimeZone(acc?.timezone) ? (acc!.timezone as string) : "Europe/London";
  const view: View = (["day", "week", "month", "list"] as const).includes(sp.view as View) ? (sp.view as View) : "week";
  const today = dateIn(nowMs(), tz);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  const { first, days } = rangeFor(view, date);
  const from = view === "list" ? nowMs() - 3600_000 : zonedToUtc(first, "00:00", tz);
  const to = zonedToUtc(addDays(first, days), "00:00", tz);
  const who = sp.who ?? "all";
  const calFilter = sp.cal ?? "all";

  let q = supabase
    .from("appointments")
    .select("id, title, starts_at, ends_at, status, calendar_id, contact_id, assigned_to, meeting_url, location, source, notes, answers, booker_timezone")
    .eq("account_id", ws.account.id)
    .lt("starts_at", new Date(to).toISOString())
    .gt("ends_at", new Date(from).toISOString())
    .order("starts_at")
    .limit(1000);
  if (who === "me") q = q.eq("assigned_to", ws.userId);
  else if (/^[0-9a-f-]{36}$/i.test(who)) q = q.eq("assigned_to", who);
  if (/^[0-9a-f-]{36}$/i.test(calFilter)) q = q.eq("calendar_id", calFilter);
  if (view === "list") q = q.neq("status", "cancelled");

  const [{ data: rows }, { data: cals }, names] = await Promise.all([
    q,
    supabase.from("calendars").select("id, name, color, duration_min, status").eq("account_id", ws.account.id).neq("status", "archived").order("name"),
    memberNames(ws.account.id),
  ]);
  const contactIds = [...new Set((rows ?? []).map((r) => r.contact_id as string).filter(Boolean))];
  const { data: contacts } = contactIds.length ? await supabase.from("contacts").select("id, first_name, last_name, email, phone").in("id", contactIds) : { data: [] };
  const byContact = new Map((contacts ?? []).map((c) => [c.id as string, c]));

  // Busy times from my own Google or Outlook calendar, so the week shows the whole picture.
  let busy: { start: number; end: number }[] = [];
  const admin = adminClient();
  if (admin && (view === "week" || view === "day") && (who === "all" || who === "me" || who === ws.userId)) {
    const { data: conns } = await admin.from("calendar_connections").select(CONNECTION_COLS).eq("account_id", ws.account.id).eq("user_id", ws.userId).neq("provider", "calendly");
    for (const c of (conns ?? []) as Connection[]) {
      try {
        busy = busy.concat(await busyTimes(admin, { ...c, check_conflicts: true }, from, to));
      } catch {
        // The connection page shows the error.
      }
    }
    const mine = (rows ?? []).filter((r) => r.assigned_to === ws.userId && r.status !== "cancelled");
    busy = busy.filter((b) => !mine.some((r) => Math.abs(Date.parse(r.starts_at as string) - b.start) < 60_000));
  }

  const appts: ApptView[] = (rows ?? []).map((r) => {
    const c = r.contact_id ? byContact.get(r.contact_id as string) : undefined;
    const name = c ? [c.first_name, c.last_name].filter(Boolean).join(" ") || (c.email as string) || (c.phone as string) || "Contact" : "No contact";
    return {
      id: r.id as string,
      title: (r.title as string) || "Appointment",
      start: Date.parse(r.starts_at as string),
      end: Date.parse(r.ends_at as string),
      status: r.status as ApptView["status"],
      calendarId: (r.calendar_id as string) ?? null,
      contactId: (r.contact_id as string) ?? null,
      contactName: name,
      contactEmail: (c?.email as string) ?? null,
      contactPhone: (c?.phone as string) ?? null,
      assignedTo: (r.assigned_to as string) ?? null,
      meetingUrl: (r.meeting_url as string) ?? null,
      location: (r.location as string) ?? null,
      source: r.source as string,
      notes: (r.notes as string) ?? "",
      answers: Array.isArray(r.answers) ? (r.answers as { label: string; value: string }[]) : [],
      bookerTz: (r.booker_timezone as string) ?? null,
    };
  });

  return (
    <Page>
      <PageHeader
        eyebrow="Calendar"
        title="Calendar"
        subtitle="Every booking in one place: from your booking pages, Calendly, and bookings made by the team or the AI. Bookings create the contact, move the deal and start your workflows."
      />
      <CalendarTabs />
      <CalendarView
        view={view}
        date={date}
        today={today}
        first={first}
        days={days}
        tz={tz}
        appts={appts}
        busy={busy}
        calendars={(cals ?? []).map((c) => ({ id: c.id as string, name: c.name as string, color: c.color as string, durationMin: c.duration_min as number }))}
        members={Object.entries(names).map(([id, name]) => ({ id, name }))}
        me={ws.userId}
        who={who}
        calFilter={calFilter}
        canManage={can(ws, "calendars.manage")}
      />
    </Page>
  );
}
