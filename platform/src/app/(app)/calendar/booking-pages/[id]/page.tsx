import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Page } from "@/components/ui";
import { Icon } from "@/components/icon";
import { can, getWorkspace, listAllStages, memberNames } from "@/lib/data";
import { fullId } from "@/lib/short-id";
import { createClient } from "@/lib/supabase/server";
import { APP_URL } from "@/lib/calendar/providers";
import { CALENDAR_COLUMNS, settingsFromRow } from "@/lib/calendar/types";
import { BookingPageEditor, type OpenCheck } from "./editor";
import { adminClient } from "@/lib/admin";
import { loadCalendar, loadMembers, openSlots } from "@/lib/calendar/booking";

export const metadata: Metadata = { title: "Booking page" };

export default async function BookingPageEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = await fullId("calendars", raw);
  const ws = await getWorkspace();
  if (!can(ws, "calendars.manage")) notFound();
  const supabase = await createClient();
  const [{ data: row }, { data: acc }, { data: mem }, names, stages, { data: conns }] = await Promise.all([
    supabase.from("calendars").select(CALENDAR_COLUMNS).eq("id", id).eq("account_id", ws.account.id).maybeSingle(),
    supabase.from("accounts").select("slug").eq("id", ws.account.id).single(),
    supabase.from("calendar_members").select("user_id, priority").eq("calendar_id", id),
    memberNames(ws.account.id),
    listAllStages(ws.account.id),
    supabase.from("calendar_connections").select("user_id, provider, status").eq("account_id", ws.account.id),
  ]);
  if (!row) notFound();
  const chosen = new Map((mem ?? []).map((m) => [m.user_id as string, m.priority as number]));
  const team = Object.entries(names).map(([uid, name]) => ({
    id: uid,
    name,
    on: chosen.has(uid) && (chosen.get(uid) ?? 0) > 0,
    priority: chosen.get(uid) || 1,
    connected: (conns ?? []).filter((c) => c.user_id === uid && c.status === "connected").map((c) => c.provider as string),
  }));

  const check = await openTimesCheck(id, names);

  return (
    <Page>
      <Link href="/calendar/booking-pages" className="-mb-2 inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted hover:text-brand">
        <Icon name="arrowLeft" size={15} /> Booking pages
      </Link>
      <BookingPageEditor
        id={id}
        initial={settingsFromRow(row)}
        base={`${APP_URL}/book/${acc?.slug}/`}
        team={team}
        stages={stages}
        check={check}
      />
    </Page>
  );
}

/** What the booking page offers right now, and if nothing, the reasons why. Saved settings only. */
async function openTimesCheck(id: string, names: Record<string, string>): Promise<OpenCheck> {
  const admin = adminClient();
  if (!admin) return { next: [], reasons: [], tz: "Europe/London" };
  const cal = await loadCalendar(admin, { id });
  if (!cal) return { next: [], reasons: [], tz: "Europe/London" };
  const now = Date.now();
  const people = await loadMembers(admin, cal);
  const tz = people[0]?.timezone ?? "Europe/London";
  const { slots } = await openSlots(admin, cal, now, now + 60 * 86400_000, now);
  const fmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz });
  const reasons: string[] = [];
  if (!slots.length) {
    if (cal.status !== "active") reasons.push("The page is paused. Set it to “Taking bookings”.");
    if (!people.length) reasons.push("Nobody is ticked under “Who takes these bookings”.");
    const { data: av } = await admin.from("calendar_availability").select("user_id, weekly").eq("account_id", cal.accountId);
    for (const m of people) {
      const row = (av ?? []).find((a) => a.user_id === m.userId);
      const hours = Object.values(m.weekly ?? {}).some((d) => Array.isArray(d) && d.length > 0);
      if (!row) reasons.push(`${names[m.userId] ?? "This person"} hasn't set their hours yet, so the default Monday to Friday 9 to 5 (${m.timezone.replace(/_/g, " ")}) is used.`);
      else if (!hours) reasons.push(`${names[m.userId] ?? "This person"} has every day set to “Not available” in Availability.`);
    }
    if (cal.maxDaysAhead < 7) reasons.push(`“Book up to” is only ${cal.maxDaysAhead} day${cal.maxDaysAhead === 1 ? "" : "s"} ahead. Set it to a month or more.`);
    if (cal.minNoticeMin >= cal.maxDaysAhead * 1440) reasons.push("The minimum notice is as long as the booking window, so no time is ever far enough ahead.");
    if (people.length && !reasons.length) reasons.push("Every working hour in the next 60 days is already booked or blocked by a connected calendar.");
  }
  return { next: slots.slice(0, 6).map((x) => fmt.format(new Date(x.start))), total: slots.length, reasons, tz } as OpenCheck;
}
