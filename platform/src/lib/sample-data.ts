// Made-up sample data for the first version of every screen.
// No real people or clients. Each screen swaps this for Supabase queries as its step is built.

import type { IconName } from "@/components/icon";
import type { PillTone, Tone } from "@/components/ui";

export type Contact = {
  id: string;
  initials: string;
  tone: Tone;
  name: string;
  email: string;
  phone: string;
  stage: string;
  stageTone: PillTone;
  score: number;
  business: string;
  source: string;
  lastActive: string;
};

export const contacts: Contact[] = [
  { id: "sam-test", initials: "ST", tone: "blue", name: "Sam Test", email: "sam@example.com", phone: "+44 7700 900123", stage: "Confirmed", stageTone: "green", score: 90, business: "Aesthetic clinic, 3 sites", source: "Meta ad", lastActive: "2M AGO" },
  { id: "alex-demo", initials: "AD", tone: "green", name: "Alex Demo", email: "alex@example.com", phone: "+44 7700 900124", stage: "Follow-up", stageTone: "blue", score: 78, business: "Physio clinic, 4 sites", source: "Referral", lastActive: "1D AGO" },
  { id: "priya-sample", initials: "PS", tone: "violet", name: "Priya Sample", email: "priya@example.com", phone: "+44 7700 900125", stage: "Qualified", stageTone: "blue", score: 64, business: "Aesthetic clinic", source: "Meta ad", lastActive: "3H AGO" },
  { id: "jo-example", initials: "JE", tone: "pink", name: "Jo Example", email: "jo@example.com", phone: "+44 7700 900126", stage: "Call booked", stageTone: "blue", score: 55, business: "Physio clinic", source: "Landing page", lastActive: "26M AGO" },
  { id: "rob-trial", initials: "RT", tone: "orange", name: "Rob Trial", email: "rob@example.com", phone: "+44 7700 900127", stage: "Call booked", stageTone: "blue", score: 55, business: "Solar installer", source: "Landing page", lastActive: "1D AGO" },
  { id: "lee-dummy", initials: "LD", tone: "blue", name: "Lee Dummy", email: "lee@example.com", phone: "+44 7700 900128", stage: "Closed", stageTone: "green", score: 90, business: "Aesthetic clinic, 2 sites", source: "Referral", lastActive: "5D AGO" },
  { id: "chris-placeholder", initials: "CP", tone: "orange", name: "Chris Placeholder", email: "chris@example.com", phone: "+44 7700 900456", stage: "Started", stageTone: "amber", score: 41, business: "Boiler fitter", source: "Meta ad", lastActive: "1H AGO" },
  { id: "kim-sandbox", initials: "KS", tone: "violet", name: "Kim Sandbox", email: "kim@example.com", phone: "+44 7700 900129", stage: "No-show", stageTone: "amber", score: 30, business: "Heating engineer", source: "Meta ad", lastActive: "3D AGO" },
  { id: "morgan-mock", initials: "MM", tone: "green", name: "Morgan Mock", email: "morgan@example.com", phone: "+44 7700 900130", stage: "Unqualified", stageTone: "neutral", score: 12, business: "Handyman", source: "Meta ad", lastActive: "2D AGO" },
  { id: "taylor-fake", initials: "TF", tone: "pink", name: "Taylor Fake", email: "taylor@example.com", phone: "+44 7700 900131", stage: "Lost", stageTone: "red", score: 22, business: "Solar installer", source: "Landing page", lastActive: "1W AGO" },
];

export function findContact(id: string) {
  return contacts.find((c) => c.id === id);
}

export const kpis: { label: string; value: string; delta: string; icon: IconName; tone: Tone; points: number[] }[] = [
  { label: "New leads", value: "48", delta: "+18%", icon: "users", tone: "blue", points: [32, 28, 30, 22, 24, 16, 18, 10, 12, 6] },
  { label: "Qualified", value: "21", delta: "+9%", icon: "checkCircle", tone: "violet", points: [30, 31, 26, 27, 20, 22, 17, 14, 15, 9] },
  { label: "Calls booked", value: "12", delta: "+4", icon: "calendar", tone: "green", points: [34, 30, 31, 25, 27, 22, 18, 20, 13, 11] },
  { label: "Pipeline value", value: "£30,000", delta: "+£7.5k", icon: "pound", tone: "orange", points: [28, 26, 27, 23, 20, 21, 15, 16, 12, 8] },
];

export const funnel = [
  { label: "Application started", n: 48, pct: 100 },
  { label: "Qualified", n: 21, pct: 44 },
  { label: "Call booked", n: 12, pct: 25 },
  { label: "Showed up", n: 9, pct: 19 },
  { label: "Closed", n: 3, pct: 6 },
];

export const todaysCalls = [
  { time: "10:00", contactId: "alex-demo", detail: "Physio clinic · George", status: "Confirmed", tone: "green" as PillTone },
  { time: "13:00", contactId: "priya-sample", detail: "Aesthetic clinic · George", status: "Unconfirmed", tone: "amber" as PillTone },
  { time: "16:00", contactId: "rob-trial", detail: "Solar installer · George", status: "Confirmed", tone: "green" as PillTone },
];

export const activity: { icon: IconName; tone: Tone; text: string; when: string }[] = [
  { icon: "inbox", tone: "blue", text: "Sam Test replied YES. Call confirmed.", when: "2m" },
  { icon: "zap", tone: "violet", text: "L1 texted Chris Placeholder", when: "9m" },
  { icon: "calendar", tone: "green", text: "Jo Example booked Thu 13:00", when: "26m" },
  { icon: "users", tone: "orange", text: "New lead from Meta: Nat Blank", when: "41m" },
];

export const insights = [
  { title: "5 leads went quiet after step 1", text: "All from the Solar B ad. A text at minute 5 could bring them back.", action: "Draft the follow-up", href: "/workflows/builder" },
  { title: "Priya hasn't confirmed her 13:00 call", text: "No reply to 2 reminders. Suggest a setter call now.", action: "Assign to George", href: "/contacts/priya-sample" },
  { title: "Clinics book 2x more than solar", text: "Based on the last 30 days of sample data.", action: null, href: null },
];

export type Thread = { contactId: string; last: string; when: string; channel: "SMS" | "EMAIL" | "WHATSAPP"; unread: boolean };

export const threads: Thread[] = [
  { contactId: "sam-test", last: "YES, see you Tuesday", when: "2M", channel: "SMS", unread: false },
  { contactId: "jo-example", last: "Can we move the call to Thursday?", when: "26M", channel: "EMAIL", unread: true },
  { contactId: "chris-placeholder", last: "Who is this?", when: "1H", channel: "SMS", unread: true },
  { contactId: "priya-sample", last: "You: Here is the link to pick a time", when: "3H", channel: "EMAIL", unread: false },
  { contactId: "rob-trial", last: "Thanks, booked in", when: "1D", channel: "SMS", unread: false },
];

export const pipelineColumns: { name: string; colour: string; note: string; ids: string[]; values: string[] }[] = [
  { name: "Application started", colour: "#64e7ef", note: "SETTER CALLS TO FINISH", ids: ["chris-placeholder"], values: ["£2,500"] },
  { name: "Qualified", colour: "#2fa8eb", note: "£17,500 POTENTIAL", ids: ["priya-sample"], values: ["£5,000"] },
  { name: "Call booked", colour: "#6d8bff", note: "£15,000 POTENTIAL", ids: ["jo-example", "rob-trial"], values: ["£5,000", "£2,500"] },
  { name: "Confirmed", colour: "#a78bfa", note: "£12,500 POTENTIAL", ids: ["sam-test", "alex-demo"], values: ["£5,000", "£5,000"] },
  { name: "No-show", colour: "#fbbf24", note: "SETTER REBOOKS", ids: ["kim-sandbox"], values: ["£2,500"] },
  { name: "Closed won", colour: "#34d399", note: "£10,000 / MO WON", ids: ["lee-dummy"], values: ["£5,000"] },
];

export type Workflow = { code: string; name: string; trigger: string; steps: number; inNow: number; done: number; status: "Testing" | "Draft" | "Live"; icon: IconName; tone: Tone };

export const workflows: Workflow[] = [
  { code: "L1", name: "Application Started", trigger: "Step 1 of the application is sent", steps: 8, inNow: 3, done: 41, status: "Testing", icon: "form", tone: "pink" },
  { code: "L2", name: "Unqualified", trigger: "Form finished with a disqualifying answer", steps: 5, inNow: 1, done: 12, status: "Testing", icon: "x", tone: "red" },
  { code: "L3", name: "Qualified, Not Booked", trigger: "Qualified but no booking yet", steps: 6, inNow: 0, done: 0, status: "Draft", icon: "checkCircle", tone: "green" },
  { code: "L4", name: "Booked Call", trigger: "A call is booked on the sales calendar", steps: 11, inNow: 0, done: 0, status: "Draft", icon: "calendar", tone: "blue" },
  { code: "L5", name: "Confirmed", trigger: "The lead replies YES by text or email", steps: 3, inNow: 0, done: 0, status: "Draft", icon: "inbox", tone: "violet" },
  { code: "L6", name: "No-Show", trigger: "The closer marks a no-show", steps: 6, inNow: 0, done: 0, status: "Draft", icon: "refresh", tone: "orange" },
  { code: "L7", name: "SMS Failure", trigger: "A text fails to send", steps: 2, inNow: 0, done: 0, status: "Draft", icon: "warning", tone: "red" },
];

export const integrations: { name: string; what: string; icon: IconName; tone: Tone; status: string; statusTone: PillTone; action: string }[] = [
  { name: "Twilio", what: "Texts to and from leads on a UK number.", icon: "inbox", tone: "red", status: "Waiting for number", statusTone: "amber", action: "Set up" },
  { name: "Resend", what: "Emails sent from send.scalency.us.", icon: "mail", tone: "blue", status: "Connected · test", statusTone: "blue", action: "Manage" },
  { name: "Supabase", what: "Database, logins and the workflow clock.", icon: "database", tone: "green", status: "Connected", statusTone: "green", action: "Manage" },
  { name: "Google Calendar", what: "Busy times and bookings for each closer.", icon: "calendar", tone: "violet", status: "Connected", statusTone: "green", action: "Manage" },
  { name: "Meta Lead Ads", what: "Instant-form leads and ad spend, straight in.", icon: "megaphone", tone: "blue", status: "Not connected", statusTone: "neutral", action: "Connect" },
  { name: "Claude AI", what: "Powers the AI builder, summaries and scoring.", icon: "spark", tone: "pink", status: "Connected", statusTone: "green", action: "Manage" },
  { name: "WhatsApp Business", what: "Two-way WhatsApp in the same inbox.", icon: "inbox", tone: "green", status: "Coming later", statusTone: "amber", action: "Notify me" },
  { name: "Stripe", what: "Mark deals as won when a client pays.", icon: "card", tone: "grey", status: "Coming later", statusTone: "amber", action: "Notify me" },
  { name: "Webhooks", what: "Send or receive events from any other tool.", icon: "link", tone: "orange", status: "2 active", statusTone: "green", action: "Manage" },
];
