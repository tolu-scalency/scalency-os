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
import { BookingPageEditor } from "./editor";

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
      />
    </Page>
  );
}
