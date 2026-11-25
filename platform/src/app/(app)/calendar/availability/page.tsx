import type { Metadata } from "next";
import { Page, PageHeader } from "@/components/ui";
import { can, getWorkspace, memberNames } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { cleanOverrides, cleanWeekly, DEFAULT_WEEKLY } from "@/lib/calendar/types";
import { validTimeZone } from "@/lib/calendar/time";
import { CalendarTabs } from "../tabs";
import { AvailabilityEditor } from "./editor";

export const metadata: Metadata = { title: "Availability" };

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const [ws, { who }] = await Promise.all([getWorkspace(), searchParams]);
  const manage = can(ws, "calendars.manage");
  const names = await memberNames(ws.account.id);
  const userId = manage && who && names[who] ? who : ws.userId;
  const supabase = await createClient();
  const [{ data: av }, { data: acc }] = await Promise.all([
    supabase.from("calendar_availability").select("timezone, weekly, overrides").eq("account_id", ws.account.id).eq("user_id", userId).maybeSingle(),
    supabase.from("accounts").select("timezone").eq("id", ws.account.id).single(),
  ]);
  const tz = validTimeZone(av?.timezone) ? (av!.timezone as string) : validTimeZone(acc?.timezone) ? (acc!.timezone as string) : "Europe/London";
  return (
    <Page>
      <PageHeader eyebrow="Calendar" title="Availability" subtitle="When each person can be booked. Busy times in their connected Google or Outlook calendar are blocked as well." />
      <CalendarTabs />
      <AvailabilityEditor
        key={userId}
        userId={userId}
        who={names[userId] ?? "You"}
        isMe={userId === ws.userId}
        members={manage ? Object.entries(names).map(([id, name]) => ({ id, name })) : []}
        timezone={tz}
        weekly={av ? cleanWeekly(av.weekly) : DEFAULT_WEEKLY}
        overrides={av ? cleanOverrides(av.overrides) : []}
      />
    </Page>
  );
}
