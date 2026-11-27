"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { adminClient } from "@/lib/admin";
import { can, getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { seal } from "@/lib/secret-box";
import { shortId } from "@/lib/short-id-shared";
import { APPT_COLS, cancelAppointment, cleanPerson, createBooking, loadCalendar, rescheduleAppointment } from "@/lib/calendar/booking";
import { calendlyMe } from "@/lib/calendar/providers";
import { validTimeZone } from "@/lib/calendar/time";
import { cleanOverrides, cleanSettings, cleanWeekly, LOCATIONS, settingsToRow, slugify, type AppointmentStatus, type CalendarSettings } from "@/lib/calendar/types";

type Result = { error?: string; ok?: string };
const NO_ACCESS = "You don't have access to manage calendars. Ask the workspace owner.";

async function ctx() {
  const ws = await getWorkspace();
  const admin = adminClient();
  return { ws, admin, manage: can(ws, "calendars.manage") };
}

/** An appointment in this workspace that this person may change. */
async function myAppointment(id: string) {
  const { ws, admin, manage } = await ctx();
  if (!admin) return { error: "The server isn't set up yet." as const };
  const { data: a } = await admin.from("appointments").select(APPT_COLS).eq("id", id).eq("account_id", ws.account.id).maybeSingle();
  if (!a) return { error: "That booking no longer exists." as const };
  if (!manage && a.assigned_to !== ws.userId) return { error: NO_ACCESS };
  return { ws, admin, a };
}

// ------------------------------------------------------------------ appointments

export async function setAppointmentStatus(id: string, status: AppointmentStatus): Promise<Result> {
  if (!["booked", "confirmed", "showed", "no_show"].includes(status)) return { error: "Choose a status." };
  const r = await myAppointment(id);
  if ("error" in r) return { error: r.error };
  const { error } = await r.admin.from("appointments").update({ status }).eq("id", id);
  if (error) return { error: "That didn't save. Please try again." };
  if (r.a.contact_id) {
    const label = { booked: "booked", confirmed: "confirmed", showed: "showed", no_show: "no-show" }[status as "booked"];
    await r.admin.from("activity").insert({ account_id: r.a.account_id, contact_id: r.a.contact_id, type: `appointment.${status}`, summary: `Appointment marked ${label}` });
  }
  const { runWorkflowsSoon } = await import("@/lib/run-soon");
  runWorkflowsSoon(r.admin, r.a.account_id);
  refresh();
  return { ok: "Saved" };
}

export async function cancelAppointmentAction(id: string, reason: string, tellThem: boolean): Promise<Result> {
  const r = await myAppointment(id);
  if ("error" in r) return { error: r.error };
  await cancelAppointment(r.admin, r.a as never, reason.slice(0, 500), { by: "team", notifyBooker: tellThem });
  refresh();
  return { ok: "Cancelled" };
}

export async function rescheduleAction(id: string, startIso: string, tellThem: boolean): Promise<Result> {
  const start = Date.parse(startIso);
  if (!Number.isFinite(start)) return { error: "Choose a new time." };
  const r = await myAppointment(id);
  if ("error" in r) return { error: r.error };
  try {
    await rescheduleAppointment(r.admin, r.a as never, start, { checkOpen: false, notifyBooker: tellThem });
  } catch (e) {
    return { error: String((e as Error).message ?? e) };
  }
  refresh();
  return { ok: "Moved" };
}

export async function saveAppointmentNotes(id: string, notes: string): Promise<Result> {
  const r = await myAppointment(id);
  if ("error" in r) return { error: r.error };
  await r.admin.from("appointments").update({ notes: notes.slice(0, 5000) }).eq("id", id);
  refresh();
  return { ok: "Saved" };
}

/** The team books someone in by hand (any time, for any member). */
export async function createManualBooking(input: {
  calendarId: string;
  startIso: string;
  assignTo: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  notes: string;
  timezone: string;
}): Promise<Result> {
  const { ws, admin, manage } = await ctx();
  if (!admin) return { error: "The server isn't set up yet." };
  if (!manage && input.assignTo !== ws.userId) return { error: NO_ACCESS };
  const cal = await loadCalendar(admin, { id: input.calendarId });
  if (!cal || cal.accountId !== ws.account.id) return { error: "Choose a calendar." };
  const { data: member } = await admin.from("account_members").select("user_id").eq("account_id", ws.account.id).eq("user_id", input.assignTo).maybeSingle();
  if (!member) return { error: "Choose who the booking is with." };
  const { person, error } = cleanPerson(input);
  if (!person) return { error };
  const start = Date.parse(input.startIso);
  if (!Number.isFinite(start)) return { error: "Choose a date and time." };
  try {
    await createBooking(admin, {
      cal: { ...cal, status: "active" },
      start,
      timezone: validTimeZone(input.timezone) ? input.timezone : "Europe/London",
      person,
      answers: [],
      consent: false,
      source: "manual",
      createdBy: ws.userId,
      assignTo: input.assignTo,
      notes: input.notes,
    });
  } catch (e) {
    return { error: String((e as Error).message ?? e) };
  }
  refresh();
  return { ok: "Booked" };
}

// ------------------------------------------------------------------ booking pages

async function freeSlug(accountId: string, base: string, exceptId?: string) {
  const supabase = await createClient();
  for (let i = 1; i < 60; i++) {
    const slug = i === 1 ? base : `${base}-${i}`.slice(0, 60);
    let q = supabase.from("calendars").select("id", { count: "exact", head: true }).eq("account_id", accountId).eq("slug", slug);
    if (exceptId) q = q.neq("id", exceptId);
    const { count } = await q;
    if (!count) return slug;
  }
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function createCalendar(fd: FormData) {
  const { ws, manage } = await ctx();
  if (!manage) redirect("/calendar/booking-pages?error=access");
  const name = String(fd.get("name") ?? "").trim().slice(0, 80) || "Book a call";
  const supabase = await createClient();
  const s = cleanSettings({ name, slug: await freeSlug(ws.account.id, slugify(name)), durationMin: 30, minNoticeMin: 240 });
  const { data, error } = await supabase.from("calendars").insert({ account_id: ws.account.id, ...settingsToRow(s), created_by: ws.userId }).select("id").single();
  if (error || !data) redirect("/calendar/booking-pages?error=1");
  await supabase.from("calendar_members").insert({ calendar_id: data.id, account_id: ws.account.id, user_id: ws.userId, priority: 1 });
  redirect(`/calendar/booking-pages/${shortId(data.id)}`);
}

export async function saveCalendar(id: string, raw: CalendarSettings, members: { userId: string; priority: number; locationType?: string; locationValue?: string }[]): Promise<Result> {
  const { ws, manage } = await ctx();
  if (!manage) return { error: NO_ACCESS };
  const supabase = await createClient();
  const { data: cur } = await supabase.from("calendars").select("id").eq("id", id).eq("account_id", ws.account.id).maybeSingle();
  if (!cur) return { error: "That booking page no longer exists." };
  const s = cleanSettings(raw);
  s.slug = await freeSlug(ws.account.id, s.slug, id);
  if (s.stageId) {
    const { data: st } = await supabase.from("pipeline_stages").select("pipeline_id").eq("id", s.stageId).maybeSingle();
    const { data: pl } = st ? await supabase.from("pipelines").select("id").eq("id", st.pipeline_id).eq("account_id", ws.account.id).maybeSingle() : { data: null };
    if (!pl) s.stageId = null;
  }
  const { data: team } = await supabase.from("account_members").select("user_id").eq("account_id", ws.account.id);
  const allowed = new Set((team ?? []).map((m) => m.user_id as string));
  const chosen = members.filter((m) => allowed.has(m.userId)).slice(0, 50);
  if (!chosen.length) return { error: "Choose at least one person who takes these bookings." };
  if (s.groupId) {
    const { data: g } = await supabase.from("calendar_groups").select("id").eq("id", s.groupId).eq("account_id", ws.account.id).maybeSingle();
    if (!g) s.groupId = null;
  }
  const { error } = await supabase.from("calendars").update(settingsToRow(s)).eq("id", id);
  if (error) return { error: "That didn't save. Please try again." };
  const { data: existing } = await supabase.from("calendar_members").select("user_id").eq("calendar_id", id);
  const keep = new Set(chosen.map((m) => m.userId));
  const drop = (existing ?? []).map((m) => m.user_id as string).filter((u) => !keep.has(u));
  if (drop.length) await supabase.from("calendar_members").delete().eq("calendar_id", id).in("user_id", drop);
  await supabase
    .from("calendar_members")
    .upsert(
      chosen.map((m, i) => ({
        calendar_id: id,
        account_id: ws.account.id,
        user_id: m.userId,
        priority: Math.min(10, Math.max(0, Math.round(m.priority))) || (i === 0 ? 1 : 0),
        location_type: LOCATIONS.some((l) => l.id === m.locationType) ? m.locationType : null,
        location_value: String(m.locationValue ?? "").trim().slice(0, 300),
      })),
      { onConflict: "calendar_id,user_id" },
    );
  refresh();
  return { ok: s.slug !== raw.slug ? `Saved. The link is now /${s.slug} because that one was taken.` : "Saved" };
}

export async function archiveCalendar(id: string): Promise<Result> {
  const { ws, manage } = await ctx();
  if (!manage) return { error: NO_ACCESS };
  const supabase = await createClient();
  await supabase.from("calendars").update({ status: "archived" }).eq("id", id).eq("account_id", ws.account.id);
  refresh();
  return { ok: "Archived" };
}

// ------------------------------------------------------------------ availability

export async function saveAvailability(userId: string, timezone: string, weekly: unknown, overrides: unknown): Promise<Result> {
  const { ws, manage } = await ctx();
  if (userId !== ws.userId && !manage) return { error: NO_ACCESS };
  if (!validTimeZone(timezone)) return { error: "Choose a time zone." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("calendar_availability")
    .upsert({ account_id: ws.account.id, user_id: userId, timezone, weekly: cleanWeekly(weekly), overrides: cleanOverrides(overrides), updated_at: new Date().toISOString() }, { onConflict: "account_id,user_id" });
  if (error) return { error: "That didn't save. Please try again." };
  refresh();
  return { ok: "Saved" };
}

// ------------------------------------------------------------------ connections

async function myConnection(id: string) {
  const { ws, admin, manage } = await ctx();
  if (!admin) return { error: "The server isn't set up yet." as const };
  const { data } = await admin.from("calendar_connections").select("id, user_id").eq("id", id).eq("account_id", ws.account.id).maybeSingle();
  if (!data) return { error: "That connection no longer exists." as const };
  if (data.user_id !== ws.userId && !manage) return { error: NO_ACCESS };
  return { admin };
}

export async function setConnectionOptions(id: string, checkConflicts: boolean, addBookings: boolean): Promise<Result> {
  const r = await myConnection(id);
  if ("error" in r) return { error: r.error };
  await r.admin.from("calendar_connections").update({ check_conflicts: checkConflicts, add_bookings: addBookings }).eq("id", id);
  refresh();
  return { ok: "Saved" };
}

export async function disconnectCalendar(id: string): Promise<Result> {
  const r = await myConnection(id);
  if ("error" in r) return { error: r.error };
  await r.admin.from("calendar_connections").delete().eq("id", id);
  refresh();
  return { ok: "Disconnected" };
}

/** Calendly: the person pastes a personal access token from Calendly (Integrations, API and webhooks). */
export async function connectCalendly(token: string): Promise<Result> {
  const { ws, admin } = await ctx();
  if (!admin) return { error: "The server isn't set up yet." };
  const t = token.trim();
  if (t.length < 20 || t.length > 4000 || /\s/.test(t)) return { error: "Paste the whole Calendly token." };
  try {
    const me = await calendlyMe(t);
    const { error } = await admin.from("calendar_connections").upsert(
      {
        account_id: ws.account.id,
        user_id: ws.userId,
        provider: "calendly",
        account_email: me.email,
        external_user: me.uri,
        token_sealed: seal(t),
        refresh_sealed: null,
        expires_at: null,
        check_conflicts: true,
        add_bookings: false,
        status: "connected",
        last_error: null,
      },
      { onConflict: "account_id,user_id,provider" },
    );
    if (error) return { error: "That didn't save. Please try again." };
  } catch (e) {
    return { error: String((e as Error).message ?? e) };
  }
  refresh();
  return { ok: "Calendly connected. Bookings come in within 5 minutes." };
}

/** Runs the Calendly import now, for people who don't want to wait for the clock. */
export async function syncCalendlyNow(): Promise<Result> {
  const { ws, admin } = await ctx();
  if (!admin) return { error: "The server isn't set up yet." };
  const { syncCalendly } = await import("@/lib/calendar/booking");
  const n = await syncCalendly(admin, ws.account.id);
  refresh();
  return { ok: n ? `${n} new booking${n === 1 ? "" : "s"} imported` : "Up to date" };
}

// ------------------------------------------------------------------ groups

export async function saveGroup(input: { id?: string; name: string }): Promise<Result & { id?: string }> {
  const { ws, manage } = await ctx();
  if (!manage) return { error: NO_ACCESS };
  const name = input.name.trim().slice(0, 80);
  if (!name) return { error: "Give the group a name." };
  const supabase = await createClient();
  if (input.id) {
    const { error } = await supabase.from("calendar_groups").update({ name }).eq("id", input.id).eq("account_id", ws.account.id);
    if (error) return { error: "That didn't save. Please try again." };
    refresh();
    return { ok: "Renamed", id: input.id };
  }
  const { data, error } = await supabase.from("calendar_groups").insert({ account_id: ws.account.id, name }).select("id").single();
  if (error || !data) return { error: "That didn't save. Please try again." };
  refresh();
  return { ok: "Group added", id: data.id as string };
}

export async function deleteGroup(id: string): Promise<Result> {
  const { ws, manage } = await ctx();
  if (!manage) return { error: NO_ACCESS };
  const supabase = await createClient();
  const { error } = await supabase.from("calendar_groups").delete().eq("id", id).eq("account_id", ws.account.id);
  if (error) return { error: "That didn't delete. Please try again." };
  refresh();
  return { ok: "Group deleted. Its calendars are now not grouped." };
}

export async function setCalendarGroup(calendarId: string, groupId: string | null): Promise<Result> {
  const { ws, manage } = await ctx();
  if (!manage) return { error: NO_ACCESS };
  const supabase = await createClient();
  if (groupId) {
    const { data: g } = await supabase.from("calendar_groups").select("id").eq("id", groupId).eq("account_id", ws.account.id).maybeSingle();
    if (!g) return { error: "That group no longer exists." };
  }
  const { error } = await supabase.from("calendars").update({ group_id: groupId }).eq("id", calendarId).eq("account_id", ws.account.id);
  if (error) return { error: "That didn't save. Please try again." };
  refresh();
  return { ok: "Moved" };
}

export async function setCalendarStatus(calendarId: string, status: "active" | "paused"): Promise<Result> {
  const { ws, manage } = await ctx();
  if (!manage) return { error: NO_ACCESS };
  const supabase = await createClient();
  const { error } = await supabase.from("calendars").update({ status }).eq("id", calendarId).eq("account_id", ws.account.id);
  if (error) return { error: "That didn't save. Please try again." };
  refresh();
  return { ok: status === "active" ? "Taking bookings" : "Paused" };
}
