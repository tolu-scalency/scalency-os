import type { Metadata } from "next";
import { Page } from "@/components/ui";
import { can, getWorkspace, memberNames } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { APP_URL } from "@/lib/calendar/providers";
import { CalendarTabs } from "../tabs";
import { CalendarsList, type CalendarItem } from "./list";

export const metadata: Metadata = { title: "Calendars" };

/** Server-side clock, kept out of the component body. */
function nowIso() {
  return new Date().toISOString();
}

// Calendars (booking pages), like GHL: a table with groups, search and filters.
export default async function BookingPages({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [ws, { error }] = await Promise.all([getWorkspace(), searchParams]);
  const supabase = await createClient();
  const [{ data: acc }, { data: cals }, { data: mem }, { data: groups }, names] = await Promise.all([
    supabase.from("accounts").select("slug").eq("id", ws.account.id).single(),
    supabase.from("calendars").select("id, name, slug, kind, duration_min, location_type, color, status, group_id, updated_at").eq("account_id", ws.account.id).neq("status", "archived").order("name"),
    supabase.from("calendar_members").select("calendar_id, user_id, priority").eq("account_id", ws.account.id),
    supabase.from("calendar_groups").select("id, name").eq("account_id", ws.account.id).order("name"),
    memberNames(ws.account.id),
  ]);
  const { data: counts } = await supabase.from("appointments").select("calendar_id").eq("account_id", ws.account.id).neq("status", "cancelled").gte("starts_at", nowIso()).limit(5000);
  const upcoming = new Map<string, number>();
  for (const c of counts ?? []) upcoming.set(c.calendar_id as string, (upcoming.get(c.calendar_id as string) ?? 0) + 1);

  const items: CalendarItem[] = (cals ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    link: `${APP_URL}/book/${acc?.slug}/${c.slug}`,
    kind: c.kind === "round_robin" ? "round_robin" : "one",
    durationMin: c.duration_min as number,
    color: (c.color as string) || "#0465C7",
    status: c.status === "active" ? "active" : "paused",
    groupId: (c.group_id as string) ?? null,
    updatedAt: (c.updated_at as string) ?? null,
    people: (mem ?? []).filter((m) => m.calendar_id === c.id && (m.priority as number) > 0).map((m) => names[m.user_id as string] ?? "Teammate"),
    upcoming: upcoming.get(c.id as string) ?? 0,
  }));

  return (
    <Page>
      <CalendarTabs />
      {error && <div className="rounded-lg bg-[#fff1f1] px-3 py-2 text-[13px] text-bad">{error === "access" ? "You don't have access to manage calendars." : "That didn't work. Please try again."}</div>}
      <CalendarsList items={items} groups={(groups ?? []).map((g) => ({ id: g.id as string, name: g.name as string }))} manage={can(ws, "calendars.manage")} />
    </Page>
  );
}
