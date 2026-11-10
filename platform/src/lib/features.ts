import type { IconName } from "@/components/icon";
import type { Tone } from "@/components/ui";

// Features on the roadmap. Each has a preview page so people can see what's coming.
export type Feature = {
  key: string;
  href: string;
  title: string;
  tagline: string;
  icon: IconName;
  tone: Tone;
  points: { title: string; text: string }[];
  meanwhile?: { label: string; href: string };
};

export const FEATURES: Record<string, Feature> = {
  inbox: {
    key: "inbox",
    href: "/inbox",
    title: "Inbox",
    tagline: "Every email, text and call with a lead, in one thread.",
    icon: "inbox",
    tone: "blue",
    points: [
      { title: "One conversation per person", text: "Email, SMS and WhatsApp side by side." },
      { title: "Assign and follow up", text: "Hand a thread to a teammate with a due date." },
      { title: "Saved replies", text: "Answer common questions in one click." },
    ],
    meanwhile: { label: "Log calls as notes on a contact", href: "/contacts" },
  },
  calendar: {
    key: "calendar",
    href: "/calendar",
    title: "Calendar",
    tagline: "Booking links, reminders and no-show follow-ups.",
    icon: "calendar",
    tone: "violet",
    points: [
      { title: "Booking pages", text: "Leads pick a time that suits your team." },
      { title: "Reminders", text: "Texts and emails before every call." },
      { title: "Google and Outlook", text: "Two-way sync with the calendars you use." },
    ],
    meanwhile: { label: "Add a task with a due date", href: "/tasks" },
  },
  companies: {
    key: "companies",
    href: "/companies",
    title: "Companies",
    tagline: "Group contacts by the business they work for.",
    icon: "building",
    tone: "grey",
    points: [
      { title: "Company records", text: "Website, size and every person you know there." },
      { title: "Deals by company", text: "See the whole account at a glance." },
      { title: "Auto-match", text: "New contacts link to their company by email domain." },
    ],
    meanwhile: { label: "Go to contacts", href: "/contacts" },
  },
  funnels: {
    key: "funnels",
    href: "/funnels",
    title: "Funnels and pages",
    tagline: "Landing pages that turn visitors into booked calls.",
    icon: "funnel",
    tone: "orange",
    points: [
      { title: "Templates", text: "Start from a proven page and make it yours." },
      { title: "A/B tests", text: "Try two versions and keep the winner." },
      { title: "Your domain", text: "Publish on your own web address." },
    ],
  },
  forms: {
    key: "forms",
    href: "/forms",
    title: "Forms and surveys",
    tagline: "Application forms that qualify leads as they answer.",
    icon: "form",
    tone: "pink",
    points: [
      { title: "Multi-step forms", text: "One question at a time, saved as they go." },
      { title: "Qualify automatically", text: "Route good fits to booking, others to nurture." },
      { title: "Straight into your pipeline", text: "Every answer lands on the contact record." },
    ],
  },
  contracts: {
    key: "contracts",
    href: "/contracts",
    title: "Proposals and contracts",
    tagline: "Send, sign and get paid without leaving Scalency.",
    icon: "edit",
    tone: "orange",
    points: [
      { title: "Templates", text: "Reuse your best proposals with merge fields." },
      { title: "E-signatures", text: "Clients sign on any device." },
      { title: "Payments", text: "Take the deposit the moment they sign." },
    ],
  },
  onboarding: {
    key: "onboarding",
    href: "/onboarding",
    title: "Client onboarding",
    tagline: "A guided checklist for every new client.",
    icon: "onboarding",
    tone: "green",
    points: [
      { title: "Step-by-step portal", text: "Clients see exactly what to do next." },
      { title: "Collect files and access", text: "Logos, logins and documents in one place." },
      { title: "Progress for your team", text: "Know who's stuck before they ask." },
    ],
  },
  campaigns: {
    key: "campaigns",
    href: "/campaigns",
    title: "Campaigns",
    tagline: "Email and SMS broadcasts to the right people.",
    icon: "megaphone",
    tone: "pink",
    points: [
      { title: "Segments", text: "Send by stage, tag or anything you know." },
      { title: "Email and SMS", text: "Branded emails and texts from your own number." },
      { title: "Results", text: "Opens, clicks, replies and bookings." },
    ],
  },
  ads: {
    key: "ads",
    href: "/ads",
    title: "Ads insights",
    tagline: "See which ads bring leads that actually book.",
    icon: "chart",
    tone: "violet",
    points: [
      { title: "Meta and Google", text: "Spend and results in one view." },
      { title: "Cost per booked call", text: "Not just cost per click." },
      { title: "Winning creatives", text: "Spot what works and do more of it." },
    ],
  },
  reports: {
    key: "reports",
    href: "/reports",
    title: "Reports",
    tagline: "Clear numbers for your team and your clients.",
    icon: "activity",
    tone: "blue",
    points: [
      { title: "Pipeline reports", text: "Conversion by stage and by source." },
      { title: "Team performance", text: "Calls, bookings and wins per person." },
      { title: "Share with clients", text: "Send a live link instead of a spreadsheet." },
    ],
  },
  workflows: {
    key: "workflows",
    href: "/workflows",
    title: "Workflows",
    tagline: "Follow-ups that run themselves.",
    icon: "zap",
    tone: "blue",
    points: [
      { title: "Triggers", text: "New lead, stage change, form answer or booking." },
      { title: "Actions", text: "Send a text or email, add a task, move a stage." },
      { title: "Test mode", text: "Nothing reaches a real lead until you say so." },
    ],
  },
  "ai-builder": {
    key: "ai-builder",
    href: "/ai-builder",
    title: "AI builder",
    tagline: "Describe a follow-up in plain English. Scalency builds the workflow.",
    icon: "spark",
    tone: "violet",
    points: [
      { title: "Describe it", text: "“Text new leads within 5 minutes, then email a day later.”" },
      { title: "Review it", text: "See every step before anything goes live." },
      { title: "Improve it", text: "Ask for changes and watch it update." },
    ],
  },
  agents: {
    key: "agents",
    href: "/agents",
    title: "AI agents",
    tagline: "Assistants that qualify leads and book calls for you.",
    icon: "users",
    tone: "green",
    points: [
      { title: "Reply in seconds", text: "Answer new enquiries day and night." },
      { title: "Qualify and book", text: "Ask your questions, then offer times." },
      { title: "You stay in control", text: "Approve messages or let them run." },
    ],
  },
  chat: {
    key: "chat",
    href: "/chat",
    title: "Team chat",
    tagline: "Channels for your team, with lead alerts built in.",
    icon: "hash",
    tone: "orange",
    points: [
      { title: "Channels and DMs", text: "Replace Slack for day-to-day work." },
      { title: "Live lead alerts", text: "New leads and booked calls post themselves." },
      { title: "Talk about a contact", text: "Link a record and everyone has context." },
    ],
  },
  integrations: {
    key: "integrations",
    href: "/settings/integrations",
    title: "Integrations",
    tagline: "Connect the tools you already use.",
    icon: "link",
    tone: "blue",
    points: [
      { title: "Calendars", text: "Google Calendar and Outlook." },
      { title: "Messaging", text: "Email, SMS and WhatsApp." },
      { title: "Zapier and webhooks", text: "Send data anywhere else." },
    ],
  },
  billing: {
    key: "billing",
    href: "/settings/billing",
    title: "Plans and billing",
    tagline: "Simple plans that grow with your team.",
    icon: "card",
    tone: "green",
    points: [
      { title: "Free while in early access", text: "No card needed today." },
      { title: "Per-workspace pricing", text: "Add your team without surprises." },
      { title: "Invoices", text: "Download every receipt." },
    ],
  },
  notifications: {
    key: "notifications",
    href: "/settings/notifications",
    title: "Notifications",
    tagline: "Choose what you hear about, and where.",
    icon: "bell",
    tone: "orange",
    points: [
      { title: "New lead alerts", text: "By email, text or in the app." },
      { title: "Daily summary", text: "One email with what needs doing." },
      { title: "Quiet hours", text: "Nothing after work unless it's urgent." },
    ],
  },
};
