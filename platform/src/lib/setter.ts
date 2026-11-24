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
  /** Example replies or scripts in the business's own words; the AI copies the style. */
  scripts: string;
  /** What the reactivation message offers old leads (blank: the current offer). */
  reactivationOffer: string;
  /** A deposit to secure a treatment booking: payment link and amount. */
  depositLink: string;
  depositAmount: string;
  /** Google review link sent after a visit. */
  reviewLink: string;
  /** Average value of a treatment, for revenue when GHL doesn't send one (0: unknown). */
  avgValue: number;
  /** Guarantee tracker: a promise such as "8 extra bookings in 60 days" (0: no guarantee). */
  guaranteeTarget: number;
  guaranteeDays: number;
  guaranteeStart: string;
  /** Number for urgent problems after a treatment (on-call practitioner). Blank: the main phone. */
  urgentPhone: string;
  /** The clinic's own words for urgent problems after a treatment. Blank: the safe default. */
  urgentAdvice: string;
};

export type JourneyAction = "message" | "sms" | "email" | "whatsapp" | "call_task" | "setter" | "ai_call";
/** A journey step: on day N, or (day 0) N minutes after the first message. */
export type JourneyStep = { day: number; minutes?: number; action: JourneyAction };
export const JOURNEY_ACTIONS: { id: JourneyAction; label: string; hint: string }[] = [
  { id: "message", label: "AI message", hint: "On the channel they used" },
  { id: "sms", label: "AI text", hint: "Text message" },
  { id: "email", label: "AI email", hint: "Email" },
  { id: "whatsapp", label: "AI WhatsApp", hint: "WhatsApp (if connected in GHL)" },
  { id: "call_task", label: "Call task", hint: "A GHL task for the team to call" },
  { id: "setter", label: "Setter", hint: "Into the setter console" },
  { id: "ai_call", label: "AI call", hint: "Voice AI calls them (once voice is connected)" },
];

/** The spec pipeline stages the AI moves leads through in GHL. */
export const STAGE_KEYS: { key: string; label: string; hint: string }[] = [
  { key: "contacted", label: "Contacted", hint: "The AI sent the first message" },
  { key: "engaged", label: "Engaged", hint: "They replied" },
  { key: "qualified", label: "Qualified", hint: "Lead score reached 60" },
  { key: "booked", label: "Booked", hint: "Consultation booked" },
  { key: "confirmed", label: "Confirmed", hint: "Replied YES, or confirmed in GHL" },
  { key: "attended", label: "Attended", hint: "Marked showed in GHL" },
  { key: "rebooked", label: "Rebooked", hint: "Booked again from a rebooking reminder" },
  { key: "no_show", label: "No-show", hint: "Marked no-show in GHL" },
  { key: "cancelled", label: "Cancelled", hint: "Appointment cancelled" },
  { key: "not_interested", label: "Lost", hint: "Said they're not interested" },
  { key: "opted_out", label: "Opted out", hint: "Texted STOP" },
];
export type RebookItem = { treatment: string; days: number };
export type VoiceMode = "off" | "missed" | "after_hours" | "all_day";

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
  /** Speed to lead: the first message goes straight away, any time. */
  instantFirstMessage: boolean;
  /** Team alerts: which events, and where (a webhook such as a GHL workflow that posts to WhatsApp, and email). */
  alertOn: "off" | "urgent" | "handoffs" | "all";
  alertWebhook: string;
  alertEmail: string;
  joinNewLeads: boolean;
  joinReplies: "all" | "own";
  onlyTags: string[];
  skipTags: string[];
  /** After a team member replies: 0 = until handed back, otherwise hours. */
  teamPauseHours: number;
  /** Follow-up journey (empty: the standard AI follow-ups on followUpDays). */
  journey: JourneyStep[];
  /** Words or phrases that alert the team, or hand the lead straight over. */
  alertKeywords: string[];
  keywordAction: "alert" | "handoff";
  missedCall: boolean;
  reviewOn: boolean;
  reviewHours: number;
  rebookOn: boolean;
  rebookDays: number;
  rebookItems: RebookItem[];
  /** Voice AI (needs a voice provider and a UK number before it can go live). */
  voiceProvider: "" | "retell" | "vapi";
  voiceMode: VoiceMode;
  voiceCallNewLeads: boolean;
  voiceTransfer: string;
  /** Show-up (spec I): reminders before the appointment, no-show recovery after, waitlist backfill. */
  remindersOn: boolean;
  noShowOn: boolean;
  waitlistOn: boolean;
  /** Messages when a lead does something (GHL behaviour workflow). */
  behaviourOn: boolean;
  /** Marketing messages only to contacts with the consent tag. */
  consentRequired: boolean;
  consentTag: string;
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
  instantFirstMessage: true,
  alertOn: "handoffs",
  alertWebhook: "",
  alertEmail: "",
  joinNewLeads: true,
  joinReplies: "all",
  onlyTags: [],
  skipTags: [],
  teamPauseHours: 0,
  journey: [],
  alertKeywords: [],
  keywordAction: "alert",
  missedCall: false,
  reviewOn: false,
  reviewHours: 3,
  rebookOn: false,
  rebookDays: 90,
  rebookItems: [],
  voiceProvider: "",
  voiceMode: "off",
  voiceCallNewLeads: false,
  voiceTransfer: "",
  remindersOn: false,
  noShowOn: false,
  waitlistOn: false,
  behaviourOn: false,
  consentRequired: false,
  consentTag: "marketing-consent",
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
  scripts: "",
  reactivationOffer: "",
  depositLink: "",
  depositAmount: "",
  reviewLink: "",
  avgValue: 0,
  guaranteeTarget: 0,
  guaranteeDays: 60,
  guaranteeStart: "",
  urgentPhone: "",
  urgentAdvice: "",
};

// The med spa example is the demo itself.
const EXAMPLE_KEYS = ["clinicName", "consultName", "consultLength", "consultPrice", "services", "offer", "financing", "whoTreats", "policies", "proof", "faqs", "tone"] as const;
BUSINESS_TYPES[0].example = Object.fromEntries(EXAMPLE_KEYS.map((k) => [k, DEMO_BUSINESS[k]]));

const num = (v: unknown, min: number, max: number, d: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && v !== "" && v != null ? Math.min(max, Math.max(min, n)) : d;
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
    bookingMode: o.bookingMode === "link" || o.bookingMode === "both" ? o.bookingMode : "times",
    spelling: o.spelling === "UK" ? "UK" : "US",
    businessType: BUSINESS_TYPES.some((t) => t.id === o.businessType) ? (o.businessType as BusinessType) : "med_spa",
    instructions: str(o.instructions, 3000),
    scripts: str(o.scripts, 6000),
    reactivationOffer: str(o.reactivationOffer, 500),
    depositLink: /^https:\/\/[^\s]+$/.test(String(o.depositLink ?? "").trim()) ? String(o.depositLink).trim().slice(0, 500) : "",
    depositAmount: str(o.depositAmount, 40),
    reviewLink: /^https:\/\/[^\s]+$/.test(String(o.reviewLink ?? "").trim()) ? String(o.reviewLink).trim().slice(0, 500) : "",
    avgValue: num(o.avgValue, 0, 100000, 0),
    guaranteeTarget: num(o.guaranteeTarget, 0, 10000, 0),
    guaranteeDays: num(o.guaranteeDays, 7, 365, 60),
    guaranteeStart: /^\d{4}-\d{2}-\d{2}$/.test(String(o.guaranteeStart ?? "")) ? String(o.guaranteeStart) : "",
    urgentPhone: str(o.urgentPhone, 40),
    urgentAdvice: str(o.urgentAdvice, 600),
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
    instantFirstMessage: o.instantFirstMessage !== false,
    alertOn: (["off", "urgent", "handoffs", "all"] as const).includes(o.alertOn as never) ? (o.alertOn as SetterRules["alertOn"]) : "handoffs",
    alertWebhook: /^https:\/\/[^\s]+$/.test(String(o.alertWebhook ?? "").trim()) ? String(o.alertWebhook).trim().slice(0, 500) : "",
    alertEmail: String(o.alertEmail ?? "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x))
      .slice(0, 5)
      .join(", "),
    joinNewLeads: o.joinNewLeads !== false,
    joinReplies: o.joinReplies === "own" ? "own" : "all",
    onlyTags: cleanTags(o.onlyTags),
    skipTags: cleanTags(o.skipTags),
    teamPauseHours: [0, 4, 24, 72, 168].includes(Number(o.teamPauseHours)) ? Number(o.teamPauseHours) : 0,
    journey: cleanJourney(o.journey),
    alertKeywords: [...new Set((Array.isArray(o.alertKeywords) ? o.alertKeywords : typeof o.alertKeywords === "string" ? o.alertKeywords.split(",") : []).map((k) => String(k).trim().toLowerCase().slice(0, 60)).filter((k) => k.length >= 2))].slice(0, 40),
    keywordAction: o.keywordAction === "handoff" ? "handoff" : "alert",
    missedCall: o.missedCall === true,
    reviewOn: o.reviewOn === true,
    reviewHours: num(o.reviewHours, 1, 168, 3),
    rebookOn: o.rebookOn === true,
    rebookDays: num(o.rebookDays, 7, 730, 90),
    rebookItems: (Array.isArray(o.rebookItems) ? o.rebookItems : [])
      .map((i) => ({ treatment: str((i as RebookItem)?.treatment, 60), days: num((i as RebookItem)?.days, 7, 730, 90) }))
      .filter((i) => i.treatment)
      .slice(0, 20),
    voiceProvider: o.voiceProvider === "retell" || o.voiceProvider === "vapi" ? o.voiceProvider : "",
    voiceMode: (["off", "missed", "after_hours", "all_day"] as const).includes(o.voiceMode as never) ? (o.voiceMode as VoiceMode) : "off",
    voiceCallNewLeads: o.voiceCallNewLeads === true,
    voiceTransfer: /^\+?[0-9 ]{7,20}$/.test(String(o.voiceTransfer ?? "").trim()) ? String(o.voiceTransfer).trim() : "",
    remindersOn: o.remindersOn === true,
    noShowOn: o.noShowOn === true,
    waitlistOn: o.waitlistOn === true,
    behaviourOn: o.behaviourOn === true,
    consentRequired: o.consentRequired === true,
    consentTag: String(o.consentTag ?? "").trim().toLowerCase().slice(0, 60) || "marketing-consent",
  };
}

export function cleanJourney(v: unknown): JourneyStep[] {
  const ids = JOURNEY_ACTIONS.map((a) => a.id) as string[];
  return (Array.isArray(v) ? v : [])
    .map((j) => {
      const day = Math.round(Number((j as JourneyStep)?.day));
      const minutes = Math.round(Number((j as JourneyStep)?.minutes));
      const action = (ids.includes((j as JourneyStep)?.action) ? (j as JourneyStep).action : "message") as JourneyAction;
      return day === 0 && minutes > 0 && minutes <= 1440 ? { day: 0, minutes, action } : { day, action };
    })
    .filter((j) => Number.isInteger(j.day) && ((j.day === 0 && (j as JourneyStep).minutes) || (j.day > 0 && j.day <= 60)))
    .sort((a, b) => a.day - b.day || ((a as JourneyStep).minutes ?? 0) - ((b as JourneyStep).minutes ?? 0))
    .slice(0, 20);
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
