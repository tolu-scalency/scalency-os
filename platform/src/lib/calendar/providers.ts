import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { open, seal } from "@/lib/secret-box";
import type { Interval } from "./availability";
import type { Provider } from "./types";

// Talking to Google Calendar (with Meet), Microsoft Outlook (with Teams) and Calendly.
//
// Google and Microsoft: each person signs in with OAuth once; we keep an encrypted refresh
// token and use it to read busy times and write bookings (with a Meet or Teams link).
// Calendly: each person pastes a personal access token; we import their Calendly bookings
// every few minutes so they show in Scalency, block those times and start workflows.
//
// Keys (Netlify, never in code): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
// MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET.

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://os.scalency.us";

export type Connection = {
  id: string;
  account_id: string;
  user_id: string;
  provider: Provider;
  account_email: string | null;
  external_user: string | null;
  token_sealed: string;
  refresh_sealed: string | null;
  expires_at: string | null;
  check_conflicts: boolean;
  add_bookings: boolean;
  status: string;
  sync_cursor: string | null;
};
export const CONNECTION_COLS = "id, account_id, user_id, provider, account_email, external_user, token_sealed, refresh_sealed, expires_at, check_conflicts, add_bookings, status, sync_cursor";

export function providerReady(p: Provider) {
  if (p === "google") return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  if (p === "microsoft") return Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
  return true;
}

export function redirectUri(p: "google" | "microsoft") {
  return `${APP_URL}/api/calendar/oauth/${p}/callback`;
}

const GOOGLE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.freebusy"];
const MS_SCOPES = ["offline_access", "openid", "email", "User.Read", "Calendars.ReadWrite"];

export function authUrl(p: "google" | "microsoft", state: string) {
  if (p === "google") {
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.search = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      redirect_uri: redirectUri("google"),
      response_type: "code",
      scope: GOOGLE_SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    }).toString();
    return u.toString();
  }
  const u = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  u.search = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
    redirect_uri: redirectUri("microsoft"),
    response_type: "code",
    response_mode: "query",
    scope: MS_SCOPES.join(" "),
    prompt: "select_account",
    state,
  }).toString();
  return u.toString();
}

type TokenReply = { access_token?: string; refresh_token?: string; expires_in?: number; id_token?: string; error?: string; error_description?: string };

async function tokenCall(p: "google" | "microsoft", body: Record<string, string>): Promise<TokenReply> {
  const url = p === "google" ? "https://oauth2.googleapis.com/token" : "https://login.microsoftonline.com/common/oauth2/v2.0/token";
  const creds: Record<string, string> =
    p === "google"
      ? { client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "" }
      : { client_id: process.env.MICROSOFT_CLIENT_ID ?? "", client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "", scope: MS_SCOPES.join(" ") };
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...creds, ...body }).toString(),
    signal: AbortSignal.timeout(15000),
  });
  return (await r.json().catch(() => ({}))) as TokenReply;
}

function emailFromIdToken(idToken: string | undefined) {
  try {
    const payload = JSON.parse(Buffer.from(String(idToken).split(".")[1], "base64url").toString("utf8")) as { email?: string; preferred_username?: string };
    return payload.email ?? payload.preferred_username ?? null;
  } catch {
    return null;
  }
}

/** Swaps the sign-in code for tokens and the person's email. */
export async function exchangeCode(p: "google" | "microsoft", code: string) {
  const t = await tokenCall(p, { code, redirect_uri: redirectUri(p), grant_type: "authorization_code" });
  if (!t.access_token) throw new Error(t.error_description || t.error || "The sign-in didn't complete.");
  let email = emailFromIdToken(t.id_token);
  if (p === "microsoft" && !email) {
    const me = await fetch("https://graph.microsoft.com/v1.0/me", { headers: { authorization: `Bearer ${t.access_token}` } }).then((r) => r.json()).catch(() => ({}));
    email = (me as { mail?: string; userPrincipalName?: string }).mail ?? (me as { userPrincipalName?: string }).userPrincipalName ?? null;
  }
  return {
    access: t.access_token,
    refresh: t.refresh_token ?? null,
    expiresAt: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(),
    email,
  };
}

/** A working access token for a connection, refreshing it when it's about to expire. */
export async function accessToken(admin: SupabaseClient, c: Connection): Promise<string> {
  if (c.provider === "calendly") return open(c.token_sealed);
  const fresh = c.expires_at && Date.parse(c.expires_at) - Date.now() > 120_000;
  if (fresh) return open(c.token_sealed);
  if (!c.refresh_sealed) throw new Error("Reconnect this calendar.");
  const t = await tokenCall(c.provider, { refresh_token: open(c.refresh_sealed), grant_type: "refresh_token" });
  if (!t.access_token) {
    await admin.from("calendar_connections").update({ status: "error", last_error: "The connection expired. Reconnect it." }).eq("id", c.id);
    throw new Error("The connection expired. Reconnect it.");
  }
  const patch: Record<string, unknown> = {
    token_sealed: seal(t.access_token),
    expires_at: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(),
    status: "connected",
    last_error: null,
  };
  if (t.refresh_token) patch.refresh_sealed = seal(t.refresh_token);
  await admin.from("calendar_connections").update(patch).eq("id", c.id);
  c.token_sealed = patch.token_sealed as string;
  c.expires_at = patch.expires_at as string;
  return t.access_token;
}

async function api<T>(url: string, token: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(15000),
  });
  if (r.status === 204) return {} as T;
  const j = (await r.json().catch(() => ({}))) as T & { error?: { message?: string } | string; message?: string };
  if (!r.ok) {
    const e = j.error;
    throw new Error((typeof e === "string" ? e : e?.message) || j.message || `The calendar replied ${r.status}.`);
  }
  return j;
}

// ------------------------------------------------------------------ busy times

/** Busy times from a Google or Microsoft calendar between two instants. */
export async function busyTimes(admin: SupabaseClient, c: Connection, from: number, to: number): Promise<Interval[]> {
  if (c.provider === "calendly" || !c.check_conflicts) return [];
  const token = await accessToken(admin, c);
  if (c.provider === "google") {
    const j = await api<{ calendars?: Record<string, { busy?: { start: string; end: string }[] }> }>("https://www.googleapis.com/calendar/v3/freeBusy", token, {
      method: "POST",
      body: JSON.stringify({ timeMin: new Date(from).toISOString(), timeMax: new Date(to).toISOString(), items: [{ id: "primary" }] }),
    });
    return (j.calendars?.primary?.busy ?? []).map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
  }
  const u = new URL("https://graph.microsoft.com/v1.0/me/calendarView");
  u.search = new URLSearchParams({ startDateTime: new Date(from).toISOString(), endDateTime: new Date(to).toISOString(), $select: "start,end,showAs,isCancelled", $top: "250" }).toString();
  const j = await api<{ value?: { start: { dateTime: string }; end: { dateTime: string }; showAs?: string; isCancelled?: boolean }[] }>(u.toString(), token, {
    headers: { Prefer: 'outlook.timezone="UTC"' },
  });
  return (j.value ?? [])
    .filter((e) => !e.isCancelled && e.showAs !== "free")
    .map((e) => ({ start: Date.parse(e.start.dateTime + "Z"), end: Date.parse(e.end.dateTime + "Z") }));
}

// ------------------------------------------------------------------ writing bookings

export type EventInput = {
  title: string;
  description: string;
  start: number;
  end: number;
  attendee: { email: string | null; name: string };
  location: string;
  meeting: "google_meet" | "teams" | null;
};

/** Writes the booking into the member's calendar. Returns the event id and the meeting link. */
export async function createEvent(admin: SupabaseClient, c: Connection, e: EventInput): Promise<{ id: string; meetingUrl: string | null }> {
  const token = await accessToken(admin, c);
  if (c.provider === "google") {
    const body: Record<string, unknown> = {
      summary: e.title,
      description: e.description,
      start: { dateTime: new Date(e.start).toISOString() },
      end: { dateTime: new Date(e.end).toISOString() },
      attendees: e.attendee.email ? [{ email: e.attendee.email, displayName: e.attendee.name }] : [],
      location: e.location || undefined,
      reminders: { useDefault: true },
    };
    if (e.meeting === "google_meet") body.conferenceData = { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } };
    const j = await api<{ id: string; hangoutLink?: string }>("https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all", token, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { id: j.id, meetingUrl: j.hangoutLink ?? null };
  }
  if (c.provider === "microsoft") {
    const body: Record<string, unknown> = {
      subject: e.title,
      body: { contentType: "text", content: e.description },
      start: { dateTime: new Date(e.start).toISOString().slice(0, 19), timeZone: "UTC" },
      end: { dateTime: new Date(e.end).toISOString().slice(0, 19), timeZone: "UTC" },
      attendees: e.attendee.email ? [{ emailAddress: { address: e.attendee.email, name: e.attendee.name }, type: "required" }] : [],
      location: e.location ? { displayName: e.location } : undefined,
    };
    if (e.meeting === "teams") {
      body.isOnlineMeeting = true;
      body.onlineMeetingProvider = "teamsForBusiness";
    }
    const j = await api<{ id: string; onlineMeeting?: { joinUrl?: string } | null }>("https://graph.microsoft.com/v1.0/me/events", token, { method: "POST", body: JSON.stringify(body) });
    return { id: j.id, meetingUrl: j.onlineMeeting?.joinUrl ?? null };
  }
  throw new Error("Calendly can't take bookings from Scalency.");
}

export async function moveEvent(admin: SupabaseClient, c: Connection, id: string, start: number, end: number) {
  const token = await accessToken(admin, c);
  if (c.provider === "google") {
    await api(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(id)}?sendUpdates=all`, token, {
      method: "PATCH",
      body: JSON.stringify({ start: { dateTime: new Date(start).toISOString() }, end: { dateTime: new Date(end).toISOString() } }),
    });
  } else if (c.provider === "microsoft") {
    await api(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(id)}`, token, {
      method: "PATCH",
      body: JSON.stringify({ start: { dateTime: new Date(start).toISOString().slice(0, 19), timeZone: "UTC" }, end: { dateTime: new Date(end).toISOString().slice(0, 19), timeZone: "UTC" } }),
    });
  }
}

export async function cancelEvent(admin: SupabaseClient, c: Connection, id: string, reason: string) {
  const token = await accessToken(admin, c);
  if (c.provider === "google") {
    await api(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(id)}?sendUpdates=all`, token, { method: "DELETE" });
  } else if (c.provider === "microsoft") {
    try {
      await api(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(id)}/cancel`, token, { method: "POST", body: JSON.stringify({ comment: reason.slice(0, 300) }) });
    } catch {
      await api(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(id)}`, token, { method: "DELETE" });
    }
  }
}

// ------------------------------------------------------------------ Calendly

export async function calendlyMe(token: string) {
  const j = await api<{ resource?: { uri: string; email: string; name: string } }>("https://api.calendly.com/users/me", token);
  if (!j.resource?.uri) throw new Error("That Calendly token didn't work. Check you copied all of it.");
  return j.resource;
}

export type CalendlyBooking = {
  id: string;
  name: string;
  start: number;
  end: number;
  status: "active" | "canceled";
  location: string;
  meetingUrl: string | null;
  invitee: { name: string; email: string | null; phone: string | null; timezone: string | null; answers: { label: string; value: string }[] } | null;
};

type CalendlyEvent = {
  uri: string;
  name: string;
  start_time: string;
  end_time: string;
  status: "active" | "canceled";
  location?: { type?: string; location?: string; join_url?: string } | null;
};
type CalendlyInvitee = {
  name: string;
  email?: string;
  text_reminder_number?: string | null;
  timezone?: string | null;
  questions_and_answers?: { question: string; answer: string }[];
};

/** Calendly bookings for the connected person, from yesterday to 60 days ahead (active and cancelled). */
export async function calendlyBookings(c: Connection): Promise<CalendlyBooking[]> {
  const token = open(c.token_sealed);
  const out: CalendlyBooking[] = [];
  for (const status of ["active", "canceled"] as const) {
    const u = new URL("https://api.calendly.com/scheduled_events");
    u.search = new URLSearchParams({
      user: c.external_user ?? "",
      status,
      min_start_time: new Date(Date.now() - 86400_000).toISOString(),
      max_start_time: new Date(Date.now() + 60 * 86400_000).toISOString(),
      count: "100",
      sort: "start_time:asc",
    }).toString();
    const j = await api<{ collection?: CalendlyEvent[] }>(u.toString(), token);
    for (const ev of j.collection ?? []) {
      let invitee: CalendlyBooking["invitee"] = null;
      if (status === "active") {
        const iv = await api<{ collection?: CalendlyInvitee[] }>(`${ev.uri}/invitees?count=1`, token).catch(() => ({ collection: [] as CalendlyInvitee[] }));
        const x = iv.collection?.[0];
        if (x)
          invitee = {
            name: x.name,
            email: x.email ?? null,
            phone: x.text_reminder_number ?? null,
            timezone: x.timezone ?? null,
            answers: (x.questions_and_answers ?? []).map((q) => ({ label: q.question, value: q.answer })),
          };
      }
      out.push({
        id: ev.uri.split("/").pop() ?? ev.uri,
        name: ev.name,
        start: Date.parse(ev.start_time),
        end: Date.parse(ev.end_time),
        status,
        location: ev.location?.location ?? ev.location?.type ?? "",
        meetingUrl: ev.location?.join_url ?? null,
        invitee,
      });
    }
  }
  return out;
}
