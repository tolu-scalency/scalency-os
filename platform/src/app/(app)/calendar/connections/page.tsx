import type { Metadata } from "next";
import { Page, PageHeader } from "@/components/ui";
import { can, getWorkspace, memberNames } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { providerReady } from "@/lib/calendar/providers";
import { CalendarTabs } from "../tabs";
import { Connections, type ConnView } from "./connections";

export const metadata: Metadata = { title: "Calendar connections" };

const ERRORS: Record<string, string> = {
  "google-setup": "Google Calendar isn't switched on for this workspace yet. The Google keys need adding in Netlify first.",
  "microsoft-setup": "Outlook isn't switched on yet. The Microsoft keys need adding in Netlify first.",
  state: "That sign-in had expired. Please try again.",
  denied: "Access wasn't allowed, so nothing was connected.",
  refresh: "Google didn't give us lasting access. Remove Scalency in your Google account's third-party access settings, then connect again.",
  exchange: "The sign-in didn't complete. Please try again.",
  save: "We couldn't save the connection. Please try again.",
  setup: "The server isn't set up yet.",
};

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [ws, { ok, error }] = await Promise.all([getWorkspace(), searchParams]);
  const supabase = await createClient();
  const [{ data }, names] = await Promise.all([
    supabase.from("calendar_connections").select("id, user_id, provider, account_email, check_conflicts, add_bookings, status, last_error, last_synced_at").eq("account_id", ws.account.id).order("created_at"),
    memberNames(ws.account.id),
  ]);
  const conns: ConnView[] = (data ?? []).map((c) => ({
    id: c.id as string,
    userId: c.user_id as string,
    who: names[c.user_id as string] ?? "Teammate",
    provider: c.provider as ConnView["provider"],
    email: (c.account_email as string) ?? null,
    checkConflicts: c.check_conflicts as boolean,
    addBookings: c.add_bookings as boolean,
    status: c.status as string,
    lastError: (c.last_error as string) ?? null,
    lastSynced: (c.last_synced_at as string) ?? null,
  }));
  return (
    <Page>
      <PageHeader
        eyebrow="Calendar"
        title="Connections"
        subtitle="Connect the calendars you already use. Busy times are blocked automatically, bookings are written in with a Google Meet or Teams link, and Calendly bookings come into Scalency."
      />
      <CalendarTabs />
      {ok && <div className="rounded-xl bg-[#e8f8f0] px-4 py-3 text-[13.5px] font-medium text-[#0f7a4f]">{ok === "google" ? "Google Calendar connected." : "Outlook connected."}</div>}
      {error && <div className="rounded-xl bg-[#fff1f1] px-4 py-3 text-[13.5px] text-bad">{ERRORS[error] ?? "That didn't work. Please try again."}</div>}
      <Connections
        me={ws.userId}
        canManage={can(ws, "calendars.manage")}
        conns={conns}
        ready={{ google: providerReady("google"), microsoft: providerReady("microsoft") }}
      />
    </Page>
  );
}
