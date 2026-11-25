import type { Metadata } from "next";
import Link from "next/link";
import { Page, PageHeader, Pill } from "@/components/ui";
import { Icon } from "@/components/icon";
import { can, getWorkspace, memberNames } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { shortId } from "@/lib/short-id-shared";
import { APP_URL } from "@/lib/calendar/providers";
import { LOCATIONS, minutesLabel } from "@/lib/calendar/types";
import { CalendarTabs } from "../tabs";
import { createCalendar } from "../actions";
import { CopyLink } from "./copy-link";

export const metadata: Metadata = { title: "Booking pages" };

/** Server-side clock, kept out of the component body. */
function nowIso() {
  return new Date().toISOString();
}

export default async function BookingPages({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [ws, { error }] = await Promise.all([getWorkspace(), searchParams]);
  const supabase = await createClient();
  const [{ data: acc }, { data: cals }, { data: mem }, names] = await Promise.all([
    supabase.from("accounts").select("slug").eq("id", ws.account.id).single(),
    supabase.from("calendars").select("id, name, slug, kind, duration_min, location_type, color, status").eq("account_id", ws.account.id).neq("status", "archived").order("created_at"),
    supabase.from("calendar_members").select("calendar_id, user_id, priority").eq("account_id", ws.account.id),
    memberNames(ws.account.id),
  ]);
  const { data: counts } = await supabase.from("appointments").select("calendar_id").eq("account_id", ws.account.id).neq("status", "cancelled").gte("starts_at", nowIso()).limit(5000);
  const upcoming = new Map<string, number>();
  for (const c of counts ?? []) upcoming.set(c.calendar_id as string, (upcoming.get(c.calendar_id as string) ?? 0) + 1);
  const manage = can(ws, "calendars.manage");

  return (
    <Page>
      <PageHeader
        eyebrow="Calendar"
        title="Booking pages"
        subtitle="The links people use to pick a time. Share one, put it on a landing page, or embed it on any website."
        actions={
          manage ? (
            <form action={createCalendar} className="flex gap-2">
              <input name="name" placeholder="e.g. Strategy call" maxLength={80} className="field h-10 w-56 text-[13.5px]" aria-label="Name of the new booking page" />
              <button className="btn-primary inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-[13.5px] font-semibold"><Icon name="plus" size={14} /> New booking page</button>
            </form>
          ) : undefined
        }
      />
      <CalendarTabs />
      {error && <div className="rounded-xl bg-[#fff1f1] px-4 py-3 text-[13.5px] text-bad">{error === "access" ? "You don't have access to manage calendars." : "That didn't work. Please try again."}</div>}
      {!cals?.length ? (
        <div className="card p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,#64E7EF,#0465C7)] text-white shadow-[0_12px_30px_-12px_rgba(4,101,199,0.7)]"><Icon name="calendar" size={24} /></div>
          <h2 className="mt-4 text-[18px] font-semibold">No booking pages yet</h2>
          <p className="mx-auto mt-1.5 max-w-md text-[14px] text-muted">Give it a name above, like &ldquo;Strategy call&rdquo;, and you&apos;ll choose the length, who takes the calls and what happens after someone books.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cals.map((c) => {
            const link = `${APP_URL}/book/${acc?.slug}/${c.slug}`;
            const people = (mem ?? []).filter((m) => m.calendar_id === c.id && (m.priority as number) > 0).map((m) => names[m.user_id as string] ?? "Teammate");
            return (
              <div key={c.id} className="card group relative flex flex-col overflow-hidden p-0">
                <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${c.color}, #64E7EF)` }} />
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/calendar/booking-pages/${shortId(c.id)}`} className="block truncate text-[16px] font-semibold tracking-[-0.01em] hover:text-brand">{c.name}</Link>
                      <div className="mt-0.5 text-[12.5px] text-muted">
                        {minutesLabel(c.duration_min as number)} · {LOCATIONS.find((l) => l.id === c.location_type)?.label} · {c.kind === "round_robin" ? "Round robin" : "One person"}
                      </div>
                    </div>
                    <Pill tone={c.status === "active" ? "green" : "neutral"}>{c.status === "active" ? "Taking bookings" : "Paused"}</Pill>
                  </div>
                  <div className="flex items-center gap-2 text-[12.5px] text-muted">
                    <Icon name="users" size={14} />
                    <span className="truncate">{people.length ? people.join(", ") : "Nobody yet"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[12.5px] text-muted">
                    <Icon name="calendar" size={14} />
                    {upcoming.get(c.id as string) ?? 0} upcoming
                  </div>
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <CopyLink link={link} />
                    <a href={link} target="_blank" rel="noreferrer" className="btn-ghost inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold"><Icon name="eye" size={14} /> Open</a>
                    {manage && <Link href={`/calendar/booking-pages/${shortId(c.id)}`} className="btn-ghost inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold"><Icon name="edit" size={14} /> Edit</Link>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
