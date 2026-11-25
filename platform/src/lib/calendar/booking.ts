import "server-only";
import { randomBytes } from "node:crypto";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deliverPending } from "@/lib/deliver";
import { runWorkflowsSoon } from "@/lib/run-soon";
import { normalisePhone } from "@/lib/forms";
import { pickMember, slotsFor, type Interval, type MemberInput, type Slot } from "./availability";
import { APP_URL, busyTimes, calendlyBookings, cancelEvent, CONNECTION_COLS, createEvent, moveEvent, type Connection } from "./providers";
import { dayLabel, timeLabel, validTimeZone } from "./time";
import { CALENDAR_COLUMNS, cleanOverrides, cleanWeekly, DEFAULT_WEEKLY, LOCATIONS, settingsFromRow, type CalendarSettings } from "./types";

// Everything that happens when someone books, moves or cancels: open times, round robin,
// the contact, the deal stage, the event in the member's own calendar (with a Meet or Teams
// link), the confirmation email and the team alert. Workflows start from the database.

type Db = SupabaseClient;
export type CalendarRow = CalendarSettings & { id: string; accountId: string };

export async function loadCalendar(admin: Db, where: { id?: string; accountSlug?: string; slug?: string }): Promise<CalendarRow | null> {
  let q = admin.from("calendars").select(CALENDAR_COLUMNS);
  if (where.id) q = q.eq("id", where.id);
  else {
    const { data: acc } = await admin.from("accounts").select("id").eq("slug", where.accountSlug ?? "").maybeSingle();
    if (!acc) return null;
    q = q.eq("account_id", acc.id).eq("slug", where.slug ?? "");
  }
  const { data } = await q.maybeSingle();
  if (!data) return null;
  return { ...settingsFromRow(data), id: data.id as string, accountId: data.account_id as string };
}

/** The people who take bookings on a calendar, with their hours. "One person" calendars use the first. */
export async function loadMembers(admin: Db, cal: CalendarRow) {
  const { data: rows } = await admin.from("calendar_members").select("user_id, priority, last_booked_at").eq("calendar_id", cal.id).order("priority", { ascending: false });
  let members = (rows ?? []).filter((r) => (r.priority as number) > 0);
  if (cal.kind === "one") members = members.slice(0, 1);
  if (!members.length) return [];
  const ids = members.map((m) => m.user_id as string);
  const { data: av } = await admin.from("calendar_availability").select("user_id, timezone, weekly, overrides").eq("account_id", cal.accountId).in("user_id", ids);
  const byUser = new Map((av ?? []).map((a) => [a.user_id as string, a]));
  return members.map((m) => {
    const a = byUser.get(m.user_id as string);
    return {
      userId: m.user_id as string,
      priority: m.priority as number,
      lastBookedAt: m.last_booked_at ? Date.parse(m.last_booked_at as string) : null,
      timezone: validTimeZone(a?.timezone) ? (a!.timezone as string) : "Europe/London",
      weekly: a ? cleanWeekly(a.weekly) : DEFAULT_WEEKLY,
      overrides: a ? cleanOverrides(a.overrides) : [],
    };
  });
}

async function connectionsFor(admin: Db, accountId: string, userIds: string[]) {
  if (!userIds.length) return [] as Connection[];
  const { data } = await admin.from("calendar_connections").select(CONNECTION_COLS).eq("account_id", accountId).in("user_id", userIds);
  return (data ?? []) as Connection[];
}

/** Open times between two instants. */
export async function openSlots(admin: Db, cal: CalendarRow, from: number, to: number, now = Date.now(), ignoreAppointment?: string): Promise<{ slots: Slot[]; members: MemberInput[] }> {
  const people = await loadMembers(admin, cal);
  if (!people.length || cal.status !== "active") return { slots: [], members: [] };
  const ids = people.map((p) => p.userId);
  const pad = 86400_000;
  let q = admin
    .from("appointments")
    .select("id, assigned_to, starts_at, ends_at")
    .eq("account_id", cal.accountId)
    .in("assigned_to", ids)
    .neq("status", "cancelled")
    .lt("starts_at", new Date(to + pad).toISOString())
    .gt("ends_at", new Date(from - pad).toISOString());
  if (ignoreAppointment) q = q.neq("id", ignoreAppointment);
  const [{ data: appts }, conns] = await Promise.all([q, connectionsFor(admin, cal.accountId, ids)]);

  const external = new Map<string, Interval[]>();
  await Promise.all(
    conns
      .filter((c) => c.provider !== "calendly" && c.check_conflicts)
      .map(async (c) => {
        try {
          const busy = await busyTimes(admin, c, from - pad, to + pad);
          external.set(c.user_id, [...(external.get(c.user_id) ?? []), ...busy]);
        } catch (e) {
          console.error("Busy times failed", c.provider, String(e).slice(0, 200));
        }
      }),
  );

  const members: MemberInput[] = people.map((p) => {
    const mine = (appts ?? []).filter((a) => a.assigned_to === p.userId);
    return {
      ...p,
      busy: [...mine.map((a) => ({ start: Date.parse(a.starts_at as string), end: Date.parse(a.ends_at as string) })), ...(external.get(p.userId) ?? [])],
      booked: mine.map((a) => Date.parse(a.starts_at as string)),
    };
  });
  return { slots: slotsFor(members, cal, from, to, now), members };
}

// ------------------------------------------------------------------ contacts

export type Person = { first: string; last: string; email: string | null; phone: string | null };

export function cleanPerson(raw: Record<string, unknown>): { person?: Person; error?: string } {
  const first = String(raw.first_name ?? "").trim().slice(0, 80);
  const last = String(raw.last_name ?? "").trim().slice(0, 80);
  const emailIn = String(raw.email ?? "").trim().toLowerCase().slice(0, 200);
  const phoneIn = String(raw.phone ?? "").trim();
  if (!first) return { error: "Please give your first name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailIn)) return { error: "Please enter a valid email address." };
  let phone: string | null = null;
  if (phoneIn) {
    const p = normalisePhone(phoneIn);
    if (p === "invalid") return { error: "Please enter a mobile like 07700 900123, or add your country code." };
    phone = p;
  }
  return { person: { first, last, email: emailIn, phone } };
}

export async function findOrCreateContact(admin: Db, accountId: string, p: Person, source: string, consent: boolean) {
  let id: string | null = null;
  if (p.email) {
    const { data } = await admin.from("contacts").select("id").eq("account_id", accountId).ilike("email", p.email.replace(/[%_\\]/g, "\\$&")).maybeSingle();
    id = (data?.id as string) ?? null;
  }
  if (!id && p.phone) {
    const { data } = await admin.from("contacts").select("id").eq("account_id", accountId).eq("phone", p.phone).order("created_at", { ascending: false }).limit(1).maybeSingle();
    id = (data?.id as string) ?? null;
  }
  const now = new Date().toISOString();
  const consentPatch = consent ? { ...(p.email ? { email_consent_at: now } : {}), ...(p.phone ? { sms_consent_at: now } : {}) } : {};
  if (id) {
    const { data: c } = await admin.from("contacts").select("first_name, last_name, email, phone").eq("id", id).single();
    const patch: Record<string, unknown> = { ...consentPatch };
    if (!c?.first_name && p.first) patch.first_name = p.first;
    if (!c?.last_name && p.last) patch.last_name = p.last;
    if (!c?.email && p.email) patch.email = p.email;
    if (!c?.phone && p.phone) patch.phone = p.phone;
    if (Object.keys(patch).length) await admin.from("contacts").update(patch).eq("id", id);
    return id;
  }
  const { data, error } = await admin
    .from("contacts")
    .insert({ account_id: accountId, first_name: p.first || null, last_name: p.last || null, email: p.email, phone: p.phone, source: source.slice(0, 60), ...consentPatch })
    .select("id")
    .single();
  if (error || !data) throw new Error("We couldn't save your details. Please try again.");
  await admin.from("activity").insert({ account_id: accountId, contact_id: data.id, type: "contact.created", summary: `Added by a booking: ${source}`.slice(0, 200) });
  return data.id as string;
}

async function tagContact(admin: Db, accountId: string, contactId: string, names: string[]) {
  for (const name of names.slice(0, 12)) {
    let { data: tag } = await admin.from("tags").select("id").eq("account_id", accountId).ilike("name", name.replace(/[%_\\]/g, "\\$&")).maybeSingle();
    if (!tag) ({ data: tag } = await admin.from("tags").insert({ account_id: accountId, name }).select("id").single());
    if (tag) await admin.from("contact_tags").upsert({ account_id: accountId, contact_id: contactId, tag_id: tag.id }, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
  }
}

/** Puts the contact's deal in the calendar's stage: moves an open deal in that pipeline, or opens one. */
async function placeInStage(admin: Db, accountId: string, contactId: string, stageId: string | null, name: string, source: string) {
  if (!stageId) return null;
  const { data: st } = await admin.from("pipeline_stages").select("id, pipeline_id").eq("id", stageId).maybeSingle();
  if (!st) return null;
  const { data: open } = await admin.from("opportunities").select("id, stage_id").eq("contact_id", contactId).eq("pipeline_id", st.pipeline_id).eq("status", "open").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (open) {
    if (open.stage_id !== st.id) await admin.from("opportunities").update({ stage_id: st.id }).eq("id", open.id);
    return open.id as string;
  }
  const { data: opp } = await admin.from("opportunities").insert({ account_id: accountId, contact_id: contactId, pipeline_id: st.pipeline_id, stage_id: st.id, name: name.slice(0, 120), source: source.slice(0, 60) }).select("id").single();
  return (opp?.id as string) ?? null;
}

// ------------------------------------------------------------------ booking

export type BookingInput = {
  cal: CalendarRow;
  start: number;
  timezone: string;
  person: Person;
  answers: { label: string; value: string }[];
  consent: boolean;
  source: "booking_page" | "manual" | "ai" | "api";
  createdBy?: string | null;
  /** Team bookings: book this person, even outside their open times. */
  assignTo?: string | null;
  notes?: string;
};

export async function createBooking(admin: Db, x: BookingInput): Promise<{ id: string; manageToken: string; assignedTo: string; meetingUrl: string | null; start: number; end: number }> {
  const { cal } = x;
  const end = x.start + cal.durationMin * 60_000;
  let assignedTo = x.assignTo ?? null;
  if (!assignedTo) {
    const { slots, members } = await openSlots(admin, cal, x.start - 60_000, x.start + 60_000);
    const slot = slots.find((s) => s.start === x.start);
    if (!slot) throw new Error("Sorry, that time has just been taken. Please pick another.");
    assignedTo = pickMember(slot.userIds, members);
    if (!assignedTo) throw new Error("Sorry, that time has just been taken. Please pick another.");
  }
  // Last check against a double booking made a moment ago.
  const { count } = await admin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("assigned_to", assignedTo)
    .neq("status", "cancelled")
    .lt("starts_at", new Date(end).toISOString())
    .gt("ends_at", new Date(x.start).toISOString());
  if ((count ?? 0) > 0 && x.source === "booking_page") throw new Error("Sorry, that time has just been taken. Please pick another.");

  const source = `Booking: ${cal.name}`;
  const contactId = await findOrCreateContact(admin, cal.accountId, x.person, source, x.consent);
  const name = [x.person.first, x.person.last].filter(Boolean).join(" ") || x.person.email || "New booking";
  await tagContact(admin, cal.accountId, contactId, cal.tags);
  const opportunityId = await placeInStage(admin, cal.accountId, contactId, cal.stageId, name, source);

  const manageToken = randomBytes(18).toString("hex");
  const loc = cal.locationType;
  const locationText = loc === "phone" ? `Phone call${x.person.phone ? ` to ${x.person.phone}` : ""}` : loc === "in_person" || loc === "link" ? cal.locationValue : LOCATIONS.find((l) => l.id === loc)?.label ?? "";
  const { data: appt, error } = await admin
    .from("appointments")
    .insert({
      account_id: cal.accountId,
      calendar_id: cal.id,
      contact_id: contactId,
      opportunity_id: opportunityId,
      assigned_to: assignedTo,
      title: `${cal.name} with ${name}`.slice(0, 200),
      starts_at: new Date(x.start).toISOString(),
      ends_at: new Date(end).toISOString(),
      booker_timezone: validTimeZone(x.timezone) ? x.timezone : null,
      status: "booked",
      source: x.source,
      location_type: loc,
      location: locationText.slice(0, 300) || null,
      meeting_url: loc === "link" && /^https:\/\//.test(cal.locationValue) ? cal.locationValue : null,
      answers: x.answers.slice(0, 20),
      notes: (x.notes ?? "").slice(0, 5000),
      manage_token: manageToken,
      created_by: x.createdBy ?? null,
    })
    .select("id")
    .single();
  if (error || !appt) throw new Error("We couldn't save the booking. Please try again.");
  await admin.from("calendar_members").update({ last_booked_at: new Date().toISOString() }).eq("calendar_id", cal.id).eq("user_id", assignedTo);

  // Into the member's own calendar, with a meeting link.
  let meetingUrl: string | null = loc === "link" && /^https:\/\//.test(cal.locationValue) ? cal.locationValue : null;
  const conns = (await connectionsFor(admin, cal.accountId, [assignedTo])).filter((c) => c.provider !== "calendly" && c.add_bookings && c.status === "connected");
  const target = conns.find((c) => (loc === "teams" ? c.provider === "microsoft" : loc === "google_meet" ? c.provider === "google" : true)) ?? conns[0];
  if (target) {
    try {
      const desc = [
        `Booked through Scalency (${cal.name}).`,
        `Name: ${name}`,
        x.person.email ? `Email: ${x.person.email}` : "",
        x.person.phone ? `Phone: ${x.person.phone}` : "",
        ...x.answers.map((a) => `${a.label}: ${a.value}`),
        "",
        `Reschedule or cancel: ${APP_URL}/booking/${manageToken}`,
      ]
        .filter((l) => l !== "")
        .join("\n");
      const ev = await createEvent(admin, target, {
        title: `${cal.name}: ${name}`.slice(0, 200),
        description: desc,
        start: x.start,
        end,
        attendee: { email: x.person.email, name },
        location: locationText,
        meeting: loc === "google_meet" && target.provider === "google" ? "google_meet" : loc === "teams" && target.provider === "microsoft" ? "teams" : null,
      });
      meetingUrl = ev.meetingUrl ?? meetingUrl;
      await admin.from("appointments").update({ external_provider: target.provider, external_id: ev.id, external_calendar: target.id, meeting_url: meetingUrl }).eq("id", appt.id);
    } catch (e) {
      console.error("Writing the booking to the calendar failed", String(e).slice(0, 300));
      await admin.from("calendar_connections").update({ last_error: `Couldn't add a booking: ${String((e as Error).message ?? e).slice(0, 200)}` }).eq("id", target.id);
    }
  }

  await admin.from("activity").insert({
    account_id: cal.accountId,
    contact_id: contactId,
    opportunity_id: opportunityId,
    type: "appointment.booked",
    summary: `Booked "${cal.name}" for ${dayLabel(x.start, "Europe/London")} at ${timeLabel(x.start, "Europe/London")} (UK time)`.slice(0, 300),
  });

  bookingSideEffects(admin, { cal, appointmentId: appt.id as string, contactId, person: x.person, start: x.start, timezone: x.timezone, meetingUrl, manageToken, locationText, kind: "booked" });
  runWorkflowsSoon(admin, cal.accountId);
  return { id: appt.id as string, manageToken, assignedTo, meetingUrl, start: x.start, end };
}

type Effects = {
  cal: CalendarRow;
  appointmentId: string;
  contactId: string;
  person: Person;
  start: number;
  timezone: string;
  meetingUrl: string | null;
  manageToken: string;
  locationText: string;
  kind: "booked" | "moved" | "cancelled";
};

/** Confirmation email and team alert, after the reply has gone back to the visitor. */
function bookingSideEffects(admin: Db, x: Effects) {
  after(async () => {
    try {
      const tz = validTimeZone(x.timezone) ? x.timezone : "Europe/London";
      const when = `${dayLabel(x.start, tz)} at ${timeLabel(x.start, tz)} (${tz.replace(/_/g, " ")})`;
      const who = [x.person.first, x.person.last].filter(Boolean).join(" ") || x.person.email || "Someone";
      const verb = x.kind === "booked" ? "booked" : x.kind === "moved" ? "moved" : "cancelled";
      if (x.cal.notifyTeam) {
        const msg = `${who} ${verb} "${x.cal.name}"${x.kind === "cancelled" ? "" : ` for ${dayLabel(x.start, "Europe/London")} at ${timeLabel(x.start, "Europe/London")} (UK time)`}.`;
        const { error } = await admin.rpc("form_post_to_chat", { target_account: x.cal.accountId, target_contact: x.contactId, message: msg });
        if (error) console.error("Booking chat alert failed", error.message);
      }
      if (x.cal.confirmEmail && x.person.email) {
        const [{ data: acc }, { data: c }] = await Promise.all([
          admin.from("accounts").select("name, test_mode, test_email").eq("id", x.cal.accountId).single(),
          admin.from("contacts").select("email_unsubscribed_at").eq("id", x.contactId).single(),
        ]);
        const to = acc?.test_mode ? (acc.test_email as string | null) : x.person.email;
        if (to && !c?.email_unsubscribed_at) {
          const manage = `${APP_URL}/booking/${x.manageToken}`;
          const subject =
            x.kind === "cancelled" ? `Cancelled: ${x.cal.name}` : x.kind === "moved" ? `Moved: ${x.cal.name}, ${when}` : `Confirmed: ${x.cal.name}, ${when}`;
          const body =
            x.kind === "cancelled"
              ? [`Hi ${x.person.first || "there"},`, "", `Your ${x.cal.name} has been cancelled.`, "", `If you'd like to book again, reply to this email.`, "", acc?.name ?? ""].join("\n")
              : [
                  `Hi ${x.person.first || "there"},`,
                  "",
                  x.kind === "moved" ? `Your ${x.cal.name} has moved to:` : `You're booked in for ${x.cal.name}:`,
                  when,
                  "",
                  x.meetingUrl ? `Join here: ${x.meetingUrl}` : x.locationText ? `Where: ${x.locationText}` : "",
                  "",
                  `Need to change it? ${manage}`,
                  "",
                  acc?.name ?? "",
                ]
                  .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
                  .join("\n");
          const { error } = await admin.from("messages").insert({
            account_id: x.cal.accountId,
            contact_id: x.contactId,
            direction: "outbound",
            channel: "email",
            to_address: to,
            subject: subject.slice(0, 200),
            body,
            status: "queued",
          });
          if (error) console.error("Queueing the booking email failed", error.message);
          else await deliverPending(admin, x.cal.accountId);
        }
      }
    } catch (e) {
      console.error("Booking side effects failed", e);
    }
  });
}

// ------------------------------------------------------------------ changes

type ApptRow = {
  id: string;
  account_id: string;
  calendar_id: string | null;
  contact_id: string | null;
  assigned_to: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  booker_timezone: string | null;
  meeting_url: string | null;
  location: string | null;
  manage_token: string | null;
  external_provider: string | null;
  external_id: string | null;
  external_calendar: string | null;
  source: string;
};
export const APPT_COLS = "id, account_id, calendar_id, contact_id, assigned_to, starts_at, ends_at, status, booker_timezone, meeting_url, location, manage_token, external_provider, external_id, external_calendar, source";

async function personOf(admin: Db, contactId: string | null): Promise<Person> {
  if (!contactId) return { first: "", last: "", email: null, phone: null };
  const { data } = await admin.from("contacts").select("first_name, last_name, email, phone").eq("id", contactId).maybeSingle();
  return { first: (data?.first_name as string) ?? "", last: (data?.last_name as string) ?? "", email: (data?.email as string) ?? null, phone: (data?.phone as string) ?? null };
}

async function externalConn(admin: Db, a: ApptRow) {
  if (!a.external_calendar || !a.external_id || a.external_provider === "calendly") return null;
  const { data } = await admin.from("calendar_connections").select(CONNECTION_COLS).eq("id", a.external_calendar).maybeSingle();
  return (data as Connection | null) ?? null;
}

export async function cancelAppointment(admin: Db, a: ApptRow, reason: string, opts: { by: "booker" | "team"; notifyBooker: boolean }) {
  if (a.status === "cancelled") return;
  await admin.from("appointments").update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: reason.slice(0, 500) || null }).eq("id", a.id);
  const conn = await externalConn(admin, a);
  if (conn)
    await cancelEvent(admin, conn, a.external_id!, reason || "Cancelled").catch((e) => console.error("Cancelling the calendar event failed", String(e).slice(0, 200)));
  if (a.contact_id)
    await admin.from("activity").insert({ account_id: a.account_id, contact_id: a.contact_id, type: "appointment.cancelled", summary: `Appointment cancelled by ${opts.by === "booker" ? "the contact" : "the team"}${reason ? `: ${reason}` : ""}`.slice(0, 300) });
  const cal = a.calendar_id ? await loadCalendar(admin, { id: a.calendar_id }) : null;
  if (cal && a.contact_id) {
    const person = await personOf(admin, a.contact_id);
    bookingSideEffects(admin, {
      cal: { ...cal, confirmEmail: cal.confirmEmail && opts.notifyBooker },
      appointmentId: a.id,
      contactId: a.contact_id,
      person,
      start: Date.parse(a.starts_at),
      timezone: a.booker_timezone ?? "Europe/London",
      meetingUrl: null,
      manageToken: a.manage_token ?? "",
      locationText: "",
      kind: "cancelled",
    });
  }
  runWorkflowsSoon(admin, a.account_id);
}

export async function rescheduleAppointment(admin: Db, a: ApptRow, start: number, opts: { checkOpen: boolean; notifyBooker: boolean }) {
  if (a.status === "cancelled") throw new Error("This booking was cancelled.");
  const cal = a.calendar_id ? await loadCalendar(admin, { id: a.calendar_id }) : null;
  const length = Date.parse(a.ends_at) - Date.parse(a.starts_at);
  if (opts.checkOpen) {
    if (!cal) throw new Error("This booking can't be moved online. Please contact us.");
    const { slots } = await openSlots(admin, cal, start - 60_000, start + 60_000, Date.now(), a.id);
    const slot = slots.find((s) => s.start === start);
    if (!slot || (a.assigned_to && !slot.userIds.includes(a.assigned_to))) throw new Error("Sorry, that time isn't free. Please pick another.");
  }
  await admin.from("appointments").update({ starts_at: new Date(start).toISOString(), ends_at: new Date(start + length).toISOString(), status: "booked" }).eq("id", a.id);
  const conn = await externalConn(admin, a);
  if (conn) await moveEvent(admin, conn, a.external_id!, start, start + length).catch((e) => console.error("Moving the calendar event failed", String(e).slice(0, 200)));
  if (a.contact_id)
    await admin.from("activity").insert({ account_id: a.account_id, contact_id: a.contact_id, type: "appointment.moved", summary: `Appointment moved to ${dayLabel(start, "Europe/London")} at ${timeLabel(start, "Europe/London")} (UK time)` });
  if (cal && a.contact_id) {
    const person = await personOf(admin, a.contact_id);
    bookingSideEffects(admin, {
      cal: { ...cal, confirmEmail: cal.confirmEmail && opts.notifyBooker },
      appointmentId: a.id,
      contactId: a.contact_id,
      person,
      start,
      timezone: a.booker_timezone ?? "Europe/London",
      meetingUrl: a.meeting_url,
      manageToken: a.manage_token ?? "",
      locationText: a.location ?? "",
      kind: "moved",
    });
  }
  runWorkflowsSoon(admin, a.account_id);
}

// ------------------------------------------------------------------ Calendly import

/** Pulls Calendly bookings into Scalency. Called by the clock every few minutes. */
export async function syncCalendly(admin: Db, accountId?: string) {
  let q = admin.from("calendar_connections").select(CONNECTION_COLS).eq("provider", "calendly").eq("status", "connected").limit(50);
  if (accountId) q = q.eq("account_id", accountId);
  const { data } = await q;
  let imported = 0;
  for (const c of (data ?? []) as Connection[]) {
    try {
      const bookings = await calendlyBookings(c);
      const ids = bookings.map((b) => b.id);
      const { data: existing } = ids.length
        ? await admin.from("appointments").select("id, external_id, status, starts_at, ends_at").eq("account_id", c.account_id).eq("external_provider", "calendly").in("external_id", ids)
        : { data: [] };
      const have = new Map((existing ?? []).map((e) => [e.external_id as string, e]));
      for (const b of bookings) {
        const e = have.get(b.id);
        if (e) {
          if (b.status === "canceled" && e.status !== "cancelled")
            await admin.from("appointments").update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: "Cancelled in Calendly" }).eq("id", e.id);
          else if (b.status === "active" && (Date.parse(e.starts_at as string) !== b.start || Date.parse(e.ends_at as string) !== b.end))
            await admin.from("appointments").update({ starts_at: new Date(b.start).toISOString(), ends_at: new Date(b.end).toISOString() }).eq("id", e.id);
          continue;
        }
        if (b.status !== "active" || !b.invitee) continue;
        const [first, ...rest] = b.invitee.name.trim().split(/\s+/);
        const phone = b.invitee.phone ? normalisePhone(b.invitee.phone) : null;
        const person: Person = { first: first ?? "", last: rest.join(" "), email: b.invitee.email?.toLowerCase() ?? null, phone: phone && phone !== "invalid" ? phone : null };
        if (!person.email && !person.phone) continue;
        const contactId = await findOrCreateContact(admin, c.account_id, person, "Calendly", false);
        const { error } = await admin.from("appointments").insert({
          account_id: c.account_id,
          contact_id: contactId,
          assigned_to: c.user_id,
          title: `${b.name} with ${b.invitee.name}`.slice(0, 200),
          starts_at: new Date(b.start).toISOString(),
          ends_at: new Date(b.end).toISOString(),
          booker_timezone: validTimeZone(b.invitee.timezone) ? b.invitee.timezone : null,
          status: "booked",
          source: "calendly",
          location: b.location.slice(0, 300) || null,
          meeting_url: b.meetingUrl,
          answers: b.invitee.answers.slice(0, 20),
          external_provider: "calendly",
          external_id: b.id,
          manage_token: randomBytes(18).toString("hex"),
        });
        if (!error) {
          imported++;
          await admin.from("activity").insert({ account_id: c.account_id, contact_id: contactId, type: "appointment.booked", summary: `Booked "${b.name}" in Calendly` });
        }
      }
      await admin.from("calendar_connections").update({ last_synced_at: new Date().toISOString(), last_error: null, status: "connected" }).eq("id", c.id);
      if (imported) runWorkflowsSoon(admin, c.account_id);
    } catch (e) {
      await admin.from("calendar_connections").update({ last_error: String((e as Error).message ?? e).slice(0, 300) }).eq("id", c.id);
    }
  }
  return imported;
}
