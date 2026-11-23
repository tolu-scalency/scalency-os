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
  bookingMode: "times" | "link" | "both";
  spelling: "US" | "UK";
  businessType: BusinessType;
  /** The business's own extra rules for the AI, in plain words. */
  instructions: string;
};

export type BusinessType = "med_spa" | "dental" | "home_services" | "coaching" | "real_estate" | "fitness" | "other";

/** Each kind of business: its name, and example details to start from (all editable). */
export const BUSINESS_TYPES: { id: BusinessType; label: string; expert: string; example: Partial<SetterBusiness> }[] = [
  { id: "med_spa", label: "Med spa or aesthetics", expert: "practitioner", example: {} },
  {
    id: "dental",
    label: "Dental practice",
    expert: "dentist",
    example: {
      clinicName: "Bright Smile Dental",
      consultName: "free smile consultation",
      consultLength: "30 minutes",
      consultPrice: "free, no obligation",
      services: "Teeth whitening: from £299\nInvisalign: from £2,500, with monthly payment plans\nComposite bonding: from £180 a tooth\nDental implants: from £2,000",
      offer: "Free smile consultation with a 3D scan for new patients this month.",
      financing: "0% finance over 12 months on treatments over £1,000.",
      whoTreats: "All treatments are done by GDC-registered dentists.",
      policies: "We need 48 hours' notice to cancel or move an appointment.",
      proof: "Rated 4.9 stars from 200+ Google reviews.",
      faqs: "Free parking on site. Open Monday to Saturday.",
      tone: "Friendly and reassuring. Many people are nervous about the dentist.",
    },
  },
  {
    id: "home_services",
    label: "Home services (plumbing, HVAC, roofing, cleaning…)",
    expert: "technician",
    example: {
      clinicName: "Spark Plumbing & Heating",
      consultName: "free quote visit",
      consultLength: "about 30 minutes",
      consultPrice: "free, no obligation",
      services: "Boiler service: £89\nNew boiler installed: from £1,950\nLeak repairs: from £75 call-out\nBathroom fitting: free quote",
      offer: "£50 off any new boiler booked this month.",
      financing: "Pay monthly available on new boilers.",
      whoTreats: "Gas Safe registered engineers, fully insured.",
      policies: "Quotes are free and valid for 30 days.",
      proof: "Over 1,000 jobs done, 4.8 stars on Google.",
      faqs: "We cover the whole city and nearby towns.",
      tone: "Practical, friendly and quick. People want a clear price and a time.",
    },
  },
  {
    id: "coaching",
    label: "Coaching or consulting",
    expert: "coach",
    example: {
      clinicName: "Clear Path Coaching",
      consultName: "free discovery call",
      consultLength: "20 minutes",
      consultPrice: "free",
      services: "1:1 coaching: 12 weeks\nGroup programme: 8 weeks\nVIP day: one full day",
      offer: "A free 20-minute discovery call to map out your next step.",
      financing: "Monthly payment options on all programmes.",
      whoTreats: "Calls are with the founder, a certified coach with 10 years' experience.",
      policies: "Please give 24 hours' notice to move a call.",
      proof: "Over 300 clients coached.",
      faqs: "All calls are on Zoom.",
      tone: "Warm, encouraging and direct.",
    },
  },
  {
    id: "real_estate",
    label: "Real estate",
    expert: "agent",
    example: {
      clinicName: "Oak & Co Estates",
      consultName: "free valuation",
      consultLength: "45 minutes",
      consultPrice: "free, no obligation",
      services: "Selling your home\nLettings and property management\nBuying help for first-time buyers",
      offer: "Free valuation with a local market report.",
      financing: "",
      whoTreats: "Valuations are done by our senior agents.",
      policies: "",
      proof: "Over 500 homes sold in the area.",
      faqs: "Office open Monday to Saturday.",
      tone: "Professional, local and helpful.",
    },
  },
  {
    id: "fitness",
    label: "Gym or fitness",
    expert: "coach",
    example: {
      clinicName: "Forge Fitness",
      consultName: "free trial session",
      consultLength: "45 minutes",
      consultPrice: "free",
      services: "Membership: £49 a month\nPersonal training: from £35 a session\n6-week kickstart: £149",
      offer: "First session free, plus no joining fee this month.",
      financing: "",
      whoTreats: "Sessions are run by qualified personal trainers.",
      policies: "No contract: cancel with 30 days' notice.",
      proof: "4.9 stars from 150+ members.",
      faqs: "Open 6am to 10pm every day. Free parking.",
      tone: "Upbeat and encouraging, never pushy. Beginners are welcome.",
    },
  },
  { id: "other", label: "Something else", expert: "team", example: { consultName: "free consultation" } },
];

export const businessTypeOf = (b: Pick<SetterBusiness, "businessType">) => BUSINESS_TYPES.find((t) => t.id === b.businessType) ?? BUSINESS_TYPES[0];

export type SetterRules = {
  start: string;
  end: string;
  days: number[];
  followUpDays: number[];
  teamTasks: boolean;
  syncContacts: boolean;
  minNoticeHours: number;
  replyDelaySeconds: number;
  /** When the AI joins. */
  joinNewLeads: boolean;
  joinReplies: "all" | "own";
  onlyTags: string[];
  skipTags: string[];
  /** After a team member replies: 0 = until handed back, otherwise hours. */
  teamPauseHours: number;
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
  syncContacts: true,
  minNoticeHours: 2,
  replyDelaySeconds: 20,
  joinNewLeads: true,
  joinReplies: "all",
  onlyTags: [],
  skipTags: [],
  teamPauseHours: 0,
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
  bookingMode: "times",
  spelling: "US",
  businessType: "med_spa",
  instructions: "",
};

// The med spa example is the demo itself.
const EXAMPLE_KEYS = ["clinicName", "consultName", "consultLength", "consultPrice", "services", "offer", "financing", "whoTreats", "policies", "proof", "faqs", "tone"] as const;
BUSINESS_TYPES[0].example = Object.fromEntries(EXAMPLE_KEYS.map((k) => [k, DEMO_BUSINESS[k]]));

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
    bookingMode: o.bookingMode === "link" || o.bookingMode === "both" ? o.bookingMode : "times",
    spelling: o.spelling === "UK" ? "UK" : "US",
    businessType: BUSINESS_TYPES.some((t) => t.id === o.businessType) ? (o.businessType as BusinessType) : "med_spa",
    instructions: str(o.instructions, 3000),
  };
}

const cleanTags = (v: unknown) =>
  [...new Set((Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : []).map((t) => String(t).trim().toLowerCase().slice(0, 60)).filter(Boolean))].slice(0, 20);

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
    syncContacts: o.syncContacts !== false,
    minNoticeHours: Math.min(72, Math.max(0, Math.round(Number(o.minNoticeHours ?? DEFAULT_RULES.minNoticeHours)) || 0)),
    // At least 10 seconds, so it never answers the instant someone hits send.
    replyDelaySeconds: Math.min(60, Math.max(10, Math.round(Number(o.replyDelaySeconds ?? DEFAULT_RULES.replyDelaySeconds)) || DEFAULT_RULES.replyDelaySeconds)),
    joinNewLeads: o.joinNewLeads !== false,
    joinReplies: o.joinReplies === "own" ? "own" : "all",
    onlyTags: cleanTags(o.onlyTags),
    skipTags: cleanTags(o.skipTags),
    teamPauseHours: [0, 4, 24, 72, 168].includes(Number(o.teamPauseHours)) ? Number(o.teamPauseHours) : 0,
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
