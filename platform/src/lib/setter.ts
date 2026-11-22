// The AI setter's settings, shared by the setup page and the server.
// The AI itself runs in the Supabase function ai-setter, which reads the same fields.

export type SetterBusiness = {
  assistantName: string;
  clinicName: string;
  location: string;
  timezone: string;
  phone: string;
  website: string;
  consultName: string;
  consultLength: string;
  consultPrice: string;
  services: string;
  offer: string;
  financing: string;
  whoTreats: string;
  policies: string;
  proof: string;
  faqs: string;
  tone: string;
  bookingLink: string;
  spelling: "US" | "UK";
};

export type SetterRules = {
  start: string;
  end: string;
  days: number[];
  followUpDays: number[];
  teamTasks: boolean;
  minNoticeHours: number;
  replyDelaySeconds: number;
};

export type SetterStatus = "off" | "test" | "live";
export type ThreadState = "active" | "booked" | "handed_over" | "stopped" | "paused" | "finished";

export const THREAD_LOOK: Record<ThreadState, { label: string; tone: "green" | "blue" | "amber" | "neutral" | "red" }> = {
  active: { label: "In conversation", tone: "blue" },
  booked: { label: "Booked", tone: "green" },
  handed_over: { label: "Handed to the team", tone: "amber" },
  paused: { label: "Team replied", tone: "amber" },
  stopped: { label: "Not interested", tone: "neutral" },
  finished: { label: "No reply after follow-ups", tone: "neutral" },
};

export const DEFAULT_RULES: SetterRules = {
  start: "08:00",
  end: "20:00",
  days: [1, 2, 3, 4, 5, 6],
  followUpDays: [1, 3, 5, 8, 12, 16],
  teamTasks: true,
  minNoticeHours: 2,
  replyDelaySeconds: 20,
};

/** The pilot demo: a med spa built from the niche playbook's typical US prices. Replace with the real clinic's details. */
export const DEMO_BUSINESS: SetterBusiness = {
  assistantName: "Sophie",
  clinicName: "Glow Aesthetics",
  location: "Austin, Texas",
  timezone: "America/Chicago",
  phone: "",
  website: "",
  consultName: "free consultation",
  consultLength: "30 minutes",
  consultPrice: "free, no obligation",
  services: [
    "Botox, Dysport or Xeomin: $12 a unit (most people need 20 to 50 units)",
    "Lip and cheek filler: from $650 a syringe",
    "Morpheus8 skin tightening: from $1,800 a session",
    "HydraFacial: $199 ($99 for new patients)",
    "RF microneedling: from $450 a session, usually 3 sessions",
    "Laser hair removal: from $200 an area, packages available",
    "Glow membership: $99 a month, includes a monthly facial and 10% off injectables",
  ].join("\n"),
  offer: "New patients: $99 HydraFacial, or $10 a unit Botox on your first visit. One per person.",
  financing: "Payment plans through Cherry and CareCredit, with 0% options and instant approval.",
  whoTreats: "Treatments are done by registered nurse injectors and a nurse practitioner, under our board-certified medical director.",
  policies: [
    "Every new patient has a free consultation first.",
    "We need 24 hours' notice to cancel or move an appointment.",
    "All treatments are 18 and over.",
    "New-patient offers are for first visits only, one per person.",
  ].join("\n"),
  proof: "Rated 4.9 stars from 300+ Google reviews. Over 5,000 treatments since 2019.",
  faqs: "Parking is free behind the building. Open Monday to Saturday.",
  tone: "Warm, calm and confident. No pressure and honest pricing: many people have had a pushy upsell elsewhere.",
  bookingLink: "",
  spelling: "US",
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "");

export function cleanBusiness(v: unknown): SetterBusiness {
  const o = (v ?? {}) as Record<string, unknown>;
  const tz = str(o.timezone, 60);
  let timezone = "America/New_York";
  try {
    if (tz) {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      timezone = tz;
    }
  } catch {}
  const link = str(o.bookingLink, 500);
  return {
    assistantName: str(o.assistantName, 40) || "Sophie",
    clinicName: str(o.clinicName, 120),
    location: str(o.location, 200),
    timezone,
    phone: str(o.phone, 40),
    website: str(o.website, 200),
    consultName: str(o.consultName, 80) || "free consultation",
    consultLength: str(o.consultLength, 40),
    consultPrice: str(o.consultPrice, 120),
    services: str(o.services, 4000),
    offer: str(o.offer, 1000),
    financing: str(o.financing, 600),
    whoTreats: str(o.whoTreats, 600),
    policies: str(o.policies, 2000),
    proof: str(o.proof, 2000),
    faqs: str(o.faqs, 4000),
    tone: str(o.tone, 600),
    bookingLink: /^https:\/\/[^\s]+$/.test(link) ? link : "",
    spelling: o.spelling === "UK" ? "UK" : "US",
  };
}

export function cleanRules(v: unknown): SetterRules {
  const o = (v ?? {}) as Record<string, unknown>;
  const time = (x: unknown, d: string) => (typeof x === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(x) ? x : d);
  const days = Array.isArray(o.days) ? [...new Set(o.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : DEFAULT_RULES.days;
  const follow = Array.isArray(o.followUpDays)
    ? [...new Set(o.followUpDays.map(Number).filter((d) => Number.isInteger(d) && d > 0 && d <= 60))].sort((a, b) => a - b).slice(0, 10)
    : DEFAULT_RULES.followUpDays;
  return {
    start: time(o.start, DEFAULT_RULES.start),
    end: time(o.end, DEFAULT_RULES.end),
    days: days.length ? days : DEFAULT_RULES.days,
    followUpDays: follow,
    teamTasks: o.teamTasks !== false,
    minNoticeHours: Math.min(72, Math.max(0, Math.round(Number(o.minNoticeHours ?? DEFAULT_RULES.minNoticeHours)) || 0)),
    replyDelaySeconds: Math.min(60, Math.max(0, Math.round(Number(o.replyDelaySeconds ?? DEFAULT_RULES.replyDelaySeconds)) || 0)),
  };
}

export const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Australia/Sydney",
  "Africa/Lagos",
];

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
