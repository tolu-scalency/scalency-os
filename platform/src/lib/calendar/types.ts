// Calendar: shared types and cleaning, used by the browser and the server.

export type Range = [string, string]; // ["09:00", "17:00"]
export type Weekly = Record<string, Range[]>; // "0" (Sunday) to "6"
export type Override = { date: string; ranges: Range[] };

export type QuestionType = "text" | "textarea" | "select";
export type Question = { id: string; label: string; type: QuestionType; required: boolean; options: string[] };

export type LocationType = "google_meet" | "teams" | "zoom" | "phone" | "in_person" | "link" | "ask_booker" | "none";
export type AppointmentStatus = "booked" | "confirmed" | "showed" | "no_show" | "cancelled";
export type Provider = "google" | "microsoft" | "calendly";

export type CalendarSettings = {
  name: string;
  slug: string;
  description: string;
  kind: "one" | "round_robin";
  durationMin: number;
  slotStepMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  minNoticeMin: number;
  maxDaysAhead: number;
  dailyLimit: number;
  locationType: LocationType;
  locationValue: string;
  questions: Question[];
  stageId: string | null;
  tags: string[];
  confirmEmail: boolean;
  notifyTeam: boolean;
  thankYou: string;
  redirectUrl: string;
  color: string;
  status: "active" | "paused" | "archived";
  groupId: string | null;
};

export const LOCATIONS: { id: LocationType; label: string; hint: string; needs?: "link" | "address" }[] = [
  { id: "google_meet", label: "Google Meet", hint: "A new Meet link for every booking (needs Google Calendar connected)." },
  { id: "teams", label: "Microsoft Teams", hint: "A new Teams link for every booking (needs a work Microsoft 365 calendar connected)." },
  { id: "zoom", label: "Zoom", hint: "Your Zoom meeting link, sent with every booking.", needs: "link" },
  { id: "phone", label: "Phone", hint: "You call them on the number they give." },
  { id: "in_person", label: "Full address", hint: "Your address goes in the confirmation.", needs: "address" },
  { id: "link", label: "Custom link", hint: "Any other meeting link, sent with every booking.", needs: "link" },
  { id: "ask_booker", label: "Ask the booker", hint: "The person booking says where (an address or their own link)." },
  { id: "none", label: "No location", hint: "" },
];

/** A team member's meeting place on one calendar (blank type: the calendar's own). */
export type MemberLocation = { type: LocationType; value: string };

/** Where a booking happens and the link to join, for one person. */
export function resolveLocation(type: LocationType, value: string, person: { phone?: string | null; location?: string }): { text: string; url: string | null } {
  const v = value.trim();
  const url = (s: string) => (/^https:\/\/\S+$/.test(s) ? s : null);
  switch (type) {
    case "phone":
      return { text: `Phone call${person.phone ? ` to ${person.phone}` : ""}`, url: null };
    case "in_person":
      return { text: v, url: null };
    case "zoom":
      return { text: "Zoom", url: url(v) };
    case "link":
      return { text: bookerLocation("link", v), url: url(v) };
    case "ask_booker": {
      const p = (person.location ?? "").trim().slice(0, 300);
      return { text: p, url: url(p) };
    }
    case "none":
      return { text: "", url: null };
    default:
      return { text: LOCATIONS.find((l) => l.id === type)?.label ?? "", url: null };
  }
}

/** What the person booking sees for "where": never the admin wording ("Your own link"). */
export function bookerLocation(type: LocationType, value: string): string {
  if (type === "link") {
    const v = value.toLowerCase();
    if (v.includes("zoom.")) return "Zoom";
    if (v.includes("meet.google.")) return "Google Meet";
    if (v.includes("teams.microsoft.") || v.includes("teams.live.")) return "Microsoft Teams";
    if (v.includes("whereby.")) return "Whereby";
    return "Video call";
  }
  if (type === "none") return "";
  if (type === "ask_booker") return "";
  return LOCATIONS.find((l) => l.id === type)?.label ?? "";
}

export const STATUS_LOOK: Record<AppointmentStatus, { label: string; tone: "blue" | "green" | "amber" | "red" | "neutral" }> = {
  booked: { label: "Booked", tone: "blue" },
  confirmed: { label: "Confirmed", tone: "green" },
  showed: { label: "Showed", tone: "green" },
  no_show: { label: "No-show", tone: "red" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const DEFAULT_WEEKLY: Weekly = { "1": [["09:00", "17:00"]], "2": [["09:00", "17:00"]], "3": [["09:00", "17:00"]], "4": [["09:00", "17:00"]], "5": [["09:00", "17:00"]] };
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "booking";
}

const num = (v: unknown, min: number, max: number, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function cleanRanges(raw: unknown): Range[] {
  if (!Array.isArray(raw)) return [];
  const out: Range[] = [];
  for (const r of raw.slice(0, 6)) {
    if (!Array.isArray(r) || !TIME.test(String(r[0])) || !TIME.test(String(r[1]))) continue;
    if (String(r[0]) >= String(r[1])) continue;
    out.push([String(r[0]), String(r[1])]);
  }
  return out.sort((a, b) => a[0].localeCompare(b[0]));
}

export function cleanWeekly(raw: unknown): Weekly {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Weekly = {};
  for (let d = 0; d < 7; d++) {
    const r = cleanRanges(o[String(d)]);
    if (r.length) out[String(d)] = r;
  }
  return out;
}

export function cleanOverrides(raw: unknown): Override[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Override[] = [];
  for (const x of raw.slice(0, 200)) {
    const o = (x ?? {}) as Record<string, unknown>;
    const date = String(o.date ?? "");
    if (!DAY.test(date) || seen.has(date)) continue;
    seen.add(date);
    out.push({ date, ranges: cleanRanges(o.ranges) });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function cleanQuestions(raw: unknown): Question[] {
  if (!Array.isArray(raw)) return [];
  const out: Question[] = [];
  for (const x of raw.slice(0, 12)) {
    const o = (x ?? {}) as Record<string, unknown>;
    const label = str(o.label, 160);
    if (!label) continue;
    const type: QuestionType = o.type === "textarea" || o.type === "select" ? o.type : "text";
    const options = type === "select" && Array.isArray(o.options) ? o.options.map((v) => str(v, 80)).filter(Boolean).slice(0, 20) : [];
    if (type === "select" && !options.length) continue;
    out.push({ id: /^[a-z0-9]{4,16}$/.test(String(o.id)) ? String(o.id) : Math.random().toString(36).slice(2, 10), label, type, required: o.required === true, options });
  }
  return out;
}

export function cleanSettings(raw: unknown): CalendarSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const loc = LOCATIONS.some((l) => l.id === o.locationType) ? (o.locationType as LocationType) : "google_meet";
  const redirect = str(o.redirectUrl, 500);
  const color = str(o.color, 7);
  return {
    name: str(o.name, 80) || "Book a call",
    slug: SLUG.test(String(o.slug ?? "")) ? String(o.slug).slice(0, 60) : slugify(str(o.name, 80) || "book-a-call"),
    description: str(o.description, 1000),
    kind: o.kind === "round_robin" ? "round_robin" : "one",
    durationMin: num(o.durationMin, 5, 480, 30),
    slotStepMin: num(o.slotStepMin, 5, 240, 30),
    bufferBeforeMin: num(o.bufferBeforeMin, 0, 240, 0),
    bufferAfterMin: num(o.bufferAfterMin, 0, 240, 0),
    minNoticeMin: num(o.minNoticeMin, 0, 43200, 240),
    maxDaysAhead: num(o.maxDaysAhead, 1, 365, 30),
    dailyLimit: num(o.dailyLimit, 0, 100, 0),
    locationType: loc,
    locationValue: str(o.locationValue, 300),
    questions: cleanQuestions(o.questions),
    stageId: typeof o.stageId === "string" && /^[0-9a-f-]{36}$/i.test(o.stageId) ? o.stageId : null,
    tags: Array.isArray(o.tags) ? [...new Set(o.tags.map((t) => str(t, 60)).filter(Boolean))].slice(0, 10) : [],
    confirmEmail: o.confirmEmail !== false,
    notifyTeam: o.notifyTeam !== false,
    thankYou: str(o.thankYou, 1000),
    redirectUrl: /^https:\/\/[^\s]+$/.test(redirect) ? redirect : "",
    color: /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#0465C7",
    status: o.status === "paused" || o.status === "archived" ? o.status : "active",
    groupId: typeof o.groupId === "string" && /^[0-9a-f-]{36}$/i.test(o.groupId) ? o.groupId : null,
  };
}

/** Database row (snake_case) to settings. */
export function settingsFromRow(r: Record<string, unknown>): CalendarSettings {
  return cleanSettings({
    name: r.name,
    slug: r.slug,
    description: r.description,
    kind: r.kind,
    durationMin: r.duration_min,
    slotStepMin: r.slot_step_min,
    bufferBeforeMin: r.buffer_before_min,
    bufferAfterMin: r.buffer_after_min,
    minNoticeMin: r.min_notice_min,
    maxDaysAhead: r.max_days_ahead,
    dailyLimit: r.daily_limit,
    locationType: r.location_type,
    locationValue: r.location_value,
    questions: r.questions,
    stageId: r.stage_id,
    tags: r.tags,
    confirmEmail: r.confirm_email,
    notifyTeam: r.notify_team,
    thankYou: r.thank_you,
    redirectUrl: r.redirect_url ?? "",
    color: r.color,
    status: r.status,
    groupId: r.group_id,
  });
}

export function settingsToRow(s: CalendarSettings) {
  return {
    name: s.name,
    slug: s.slug,
    description: s.description,
    kind: s.kind,
    duration_min: s.durationMin,
    slot_step_min: s.slotStepMin,
    buffer_before_min: s.bufferBeforeMin,
    buffer_after_min: s.bufferAfterMin,
    min_notice_min: s.minNoticeMin,
    max_days_ahead: s.maxDaysAhead,
    daily_limit: s.dailyLimit,
    location_type: s.locationType,
    location_value: s.locationValue,
    questions: s.questions,
    stage_id: s.stageId,
    tags: s.tags,
    confirm_email: s.confirmEmail,
    notify_team: s.notifyTeam,
    thank_you: s.thankYou,
    redirect_url: s.redirectUrl || null,
    color: s.color,
    status: s.status,
    group_id: s.groupId,
  };
}

export const CALENDAR_COLUMNS =
  "id, account_id, name, slug, description, kind, duration_min, slot_step_min, buffer_before_min, buffer_after_min, min_notice_min, max_days_ahead, daily_limit, location_type, location_value, questions, stage_id, tags, confirm_email, notify_team, thank_you, redirect_url, color, status, group_id";

/** "30 min", "1 hr", "1 hr 30 min". */
export function minutesLabel(m: number) {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} hr ${r} min` : `${h} hr`;
}
