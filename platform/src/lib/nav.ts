import type { IconName } from "@/components/icon";
import type { Permission } from "@/lib/permissions";

// The whole product as a map. Each sidebar item opens a panel of its pages on
// hover. Live pages link straight to their screen; pages still being built
// ("soon") open a preview at /soon/<slug>.

export type NavLink = { label: string; href: string; soon?: boolean; hint?: string };
export type NavGroup = { key: string; label: string; icon: IconName; href: string; soon?: boolean; links?: NavLink[]; section?: string };

export type SoonPage = { slug: string; title: string; tagline: string; icon: IconName; bullets: string[]; group: string };

const S = (slug: string) => `/soon/${slug}`;

export const SOON_PAGES: SoonPage[] = [
  // Inbox
  { slug: "calls", group: "inbox", icon: "phone", title: "Phone calls", tagline: "Make and take calls in the browser, recorded on the contact.", bullets: ["Click to call any contact", "Call recordings and notes", "Missed-call text back"] },
  { slug: "whatsapp", group: "inbox", icon: "inbox", title: "WhatsApp", tagline: "WhatsApp conversations next to email and texts.", bullets: ["One thread per person", "Templates for first messages", "Workflows can send WhatsApp"] },
  { slug: "social-dms", group: "inbox", icon: "inbox", title: "Social messages", tagline: "Facebook, Instagram and Google messages in the inbox.", bullets: ["Reply without leaving Scalency", "Leads created automatically", "Assign threads to the team"] },
  // Calendar
  { slug: "calendars", group: "calendar", icon: "calendar", title: "Calendars", tagline: "Team, round-robin and personal calendars.", bullets: ["Round-robin across the sales team", "Buffers and daily limits", "Working hours per person"] },
  { slug: "appointments", group: "calendar", icon: "clock", title: "Appointments", tagline: "Every booked call in one list.", bullets: ["Confirm, reschedule or cancel", "No-show tracking", "Reminders by text and email"] },
  { slug: "booking-pages", group: "calendar", icon: "link", title: "Booking pages", tagline: "Links leads use to pick a time.", bullets: ["Branded pages", "Questions before booking", "Bookings start workflows"] },
  { slug: "meeting-apps", group: "calendar", icon: "video", title: "Meeting apps", tagline: "Connect Zoom, Google Meet and Microsoft Teams.", bullets: ["Meeting link added to every booking", "Google and Outlook calendar sync", "Busy times blocked automatically"] },
  // Contacts
  { slug: "smart-lists", group: "contacts", icon: "filter", title: "Smart lists", tagline: "Saved filters that update themselves.", bullets: ["Filter by tags, fields and activity", "Bulk email, text or tag", "Share lists with the team"] },
  { slug: "import", group: "contacts", icon: "upload", title: "Import contacts", tagline: "Bring contacts in from a spreadsheet.", bullets: ["Map columns to fields", "Skip duplicates", "Tag everyone you import"] },
  // Opportunities
  // Payments
  { slug: "invoices", group: "payments", icon: "card", title: "Invoices", tagline: "Send invoices and get paid online.", bullets: ["Card and bank payments", "Automatic reminders", "Recurring invoices"] },
  { slug: "products", group: "payments", icon: "tag", title: "Products", tagline: "Your services and prices in one place.", bullets: ["One-off and recurring prices", "Use in invoices and funnels", "Tax settings"] },
  { slug: "subscriptions", group: "payments", icon: "refresh", title: "Subscriptions", tagline: "Retainers and memberships billed automatically.", bullets: ["Monthly or yearly billing", "Failed payment follow-ups", "Pause or cancel"] },
  { slug: "payment-links", group: "payments", icon: "link", title: "Payment links", tagline: "Share a link, get paid.", bullets: ["No website needed", "Works on any device", "Payments start workflows"] },
  { slug: "transactions", group: "payments", icon: "pound", title: "Transactions", tagline: "Every payment and refund.", bullets: ["Filter by date and status", "Refunds in one click", "Export for accounts"] },
  { slug: "coupons", group: "payments", icon: "tag", title: "Coupons", tagline: "Discount codes for offers.", bullets: ["Percentage or fixed amount", "Expiry dates", "Usage limits"] },
  // Marketing
  { slug: "email-campaigns", group: "marketing", icon: "mail", title: "Email campaigns", tagline: "Send newsletters and offers to a list or tag.", bullets: ["Drag-and-drop email builder", "Schedule and send in batches", "Opens, clicks and unsubscribes"] },
  { slug: "sms-campaigns", group: "marketing", icon: "phone", title: "Text campaigns", tagline: "Bulk texts with opt-out handled.", bullets: ["Send to a tag or list", "Quiet hours respected", "Replies land in the inbox"] },
  { slug: "social-planner", group: "marketing", icon: "share", title: "Social planner", tagline: "Plan and post to every social channel.", bullets: ["Facebook, Instagram, LinkedIn, TikTok", "Calendar view", "AI captions"] },
  { slug: "templates", group: "marketing", icon: "file", title: "Templates", tagline: "Saved emails and texts for the team.", bullets: ["Shared library", "Merge fields", "Use in workflows and the inbox"] },
  { slug: "trigger-links", group: "marketing", icon: "link", title: "Trigger links", tagline: "Links that tag people and start workflows when clicked.", bullets: ["Track who clicked", "Start follow-ups", "Use in any message"] },
  { slug: "affiliates", group: "marketing", icon: "team", title: "Affiliates", tagline: "Partners who refer customers for commission.", bullets: ["Referral links", "Commission tracking", "Partner portal"] },
  // AI
  // Sites
  { slug: "surveys", group: "sites", icon: "form", title: "Surveys and quizzes", tagline: "Multi-step forms that qualify leads.", bullets: ["Logic based on answers", "Scores and results pages", "Answers saved to fields"] },
  { slug: "chat-widget", group: "sites", icon: "inbox", title: "Chat widget", tagline: "A chat bubble for your website.", bullets: ["Chats land in the inbox", "Collects name and phone", "AI replies out of hours"] },
  { slug: "blogs", group: "sites", icon: "edit", title: "Blogs", tagline: "Write and publish posts for SEO.", bullets: ["AI writing help", "Categories and authors", "Your own domain"] },
  { slug: "webinars", group: "sites", icon: "video", title: "Webinars", tagline: "Registration pages and reminders for live events.", bullets: ["Sign-up pages", "Reminder sequences", "Replay follow-ups"] },
  // Memberships
  { slug: "courses", group: "memberships", icon: "book", title: "Courses", tagline: "Sell and host online courses.", bullets: ["Lessons, videos and quizzes", "Drip content", "Paid or free access"] },
  { slug: "communities", group: "memberships", icon: "team", title: "Communities", tagline: "A members' community for your customers.", bullets: ["Groups and channels", "Events", "Paid memberships"] },
  { slug: "certificates", group: "memberships", icon: "star", title: "Certificates", tagline: "Certificates when people finish a course.", bullets: ["Your branding", "Sent automatically", "Verifiable links"] },
  // Reputation
  { slug: "reviews", group: "reputation", icon: "star", title: "Reviews", tagline: "Google and Facebook reviews in one place.", bullets: ["Reply from Scalency", "AI suggested replies", "Alerts for bad reviews"] },
  { slug: "review-widgets", group: "reputation", icon: "star", title: "Review widgets", tagline: "Show your best reviews on your website.", bullets: ["Copy and paste code", "Matches your brand", "Updates itself"] },
  // Reporting
  { slug: "call-reporting", group: "reporting", icon: "phone", title: "Call reporting", tagline: "Calls answered, missed and booked.", bullets: ["By person and number", "Recordings", "Busiest times"] },
  { slug: "appointment-report", group: "reporting", icon: "calendar", title: "Appointment report", tagline: "Bookings, shows and no-shows.", bullets: ["Show rate by calendar", "By team member", "Trends over time"] },
];

export function soonPage(slug: string) {
  return SOON_PAGES.find((p) => p.slug === slug);
}

const soonLinks = (group: string): NavLink[] => SOON_PAGES.filter((p) => p.group === group).map((p) => ({ label: p.title, href: S(p.slug), soon: true }));

export const NAV: NavGroup[] = [
  { key: "home", label: "Home", icon: "home", href: "/dashboard" },
  {
    key: "ai",
    label: "AI",
    icon: "spark",
    href: "/agents",
    links: [
      { label: "AI setter", href: "/agents" },
      { label: "Command centre", href: "/command-centre" },
      { label: "Setter console", href: "/setter-console" },
      { label: "Results", href: "/ai-results" },
      { label: "Revenue", href: "/revenue" },
      { label: "Knowledge", href: "/ai/knowledge" },
      { label: "Journeys", href: "/ai/journey" },
      { label: "Show-up and consent", href: "/ai/showup" },
      { label: "Reviews and rebooking", href: "/ai/retention" },
      { label: "Reactivation", href: "/ai/reactivate" },
      { label: "Voice AI", href: "/ai/voice" },
      { label: "QA and test lab", href: "/qa" },
      { label: "Guardrails log", href: "/guardrails" },
      { label: "Creative studio", href: "/creative-studio" },
      { label: "Usage", href: "/usage" },
      { label: "Free audit", href: "/audit" },
      ...soonLinks("ai"),
    ],
  },
  {
    key: "inbox",
    label: "Inbox",
    icon: "inbox",
    href: "/inbox",
    links: [{ label: "Conversations", href: "/inbox" }, { label: "Team chat", href: "/chat" }, ...soonLinks("inbox")],
  },
  { key: "tasks", label: "Tasks", icon: "tasks", href: "/tasks" },
  { key: "calendar", label: "Calendar", icon: "calendar", href: "/calendar", soon: true, links: [{ label: "Overview", href: "/calendar", soon: true }, ...soonLinks("calendar")] },

  {
    key: "contacts",
    section: "Records",
    label: "Contacts",
    icon: "users",
    href: "/contacts",
    links: [{ label: "All contacts", href: "/contacts" }, { label: "Notes", href: "/notes" }, { label: "Companies", href: "/companies", soon: true }, ...soonLinks("contacts")],
  },
  {
    key: "opportunities",
    label: "Opportunities",
    icon: "pipeline",
    href: "/pipeline",
    links: [
      { label: "Pipeline board", href: "/pipeline" },
      { label: "Opportunity list", href: "/pipeline?view=list" },
      ...soonLinks("opportunities"),
      { label: "Proposals", href: "/contracts", soon: true },
      { label: "Client onboarding", href: "/onboarding", soon: true },
    ],
  },
  { key: "payments", label: "Payments", icon: "card", href: S("invoices"), soon: true, links: soonLinks("payments") },

  {
    key: "marketing",
    section: "Growth",
    label: "Marketing",
    icon: "megaphone",
    href: "/creative-studio",
    links: [{ label: "Creative studio", href: "/creative-studio" }, { label: "Ad spend and cost per lead", href: "/revenue" }, { label: "Campaigns overview", href: "/campaigns", soon: true }, ...soonLinks("marketing"), { label: "Ads insights", href: "/ads", soon: true }],
  },
  {
    key: "sites",
    label: "Sites",
    icon: "globe",
    href: "/funnels",
    links: [
      { label: "Funnels and pages", href: "/funnels" },
      { label: "Websites", href: "/funnels?kind=website" },
      { label: "Forms", href: "/forms" },
      { label: "Domains", href: "/domains" },
      { label: "QR codes", href: "/qr-codes" },
      ...soonLinks("sites"),
    ],
  },
  { key: "memberships", label: "Memberships", icon: "book", href: S("courses"), soon: true, links: soonLinks("memberships") },
  { key: "reputation", label: "Reputation", icon: "star", href: S("reviews"), links: [{ label: "Review requests", href: "/ai/retention" }, ...soonLinks("reputation")] },

  {
    key: "automation",
    section: "Automation",
    label: "Automation",
    icon: "zap",
    href: "/workflows",
    links: [{ label: "Workflows", href: "/workflows" }, { label: "AI setup", href: "/ai-builder" }],
  },
  { key: "reporting", label: "Reporting", icon: "chart", href: "/revenue", links: [{ label: "Revenue by channel", href: "/revenue" }, { label: "AI results", href: "/ai-results" }, { label: "Reports", href: "/reports", soon: true }, ...soonLinks("reporting")] },
];

export const SETTINGS_NAV: NavGroup = {
  key: "settings",
  label: "Settings",
  icon: "settings",
  href: "/settings",
  links: [
    { label: "General", href: "/settings" },
    { label: "Pipeline", href: "/settings/pipeline" },
    { label: "Members", href: "/settings/team" },
    { label: "Roles and access", href: "/settings/roles" },
    { label: "Custom fields", href: "/settings/fields" },
    { label: "Email sending", href: "/settings/email" },
    { label: "Integrations", href: "/settings/integrations", soon: true },
    { label: "Billing", href: "/settings/billing", soon: true },
    { label: "Notifications", href: "/settings/notifications", soon: true },
  ],
};

/** Which group the current page belongs to. */
export function activeGroup(pathname: string) {
  let best: { key: string; len: number } | null = null;
  for (const g of [...NAV, SETTINGS_NAV]) {
    for (const href of [g.href, ...(g.links ?? []).map((l) => l.href)]) {
      if ((pathname === href || pathname.startsWith(href + "/")) && (!best || href.length > best.len)) best = { key: g.key, len: href.length };
    }
  }
  return best?.key;
}

export function activeLink(pathname: string, links: NavLink[]) {
  return links
    .map((l) => l.href)
    .filter((h) => pathname === h || pathname.startsWith(h + "/"))
    .sort((a, b) => b.length - a.length)[0];
}

// ---------------------------------------------------------------------------
// Access: people only see the parts of the product they're allowed to use.
// ---------------------------------------------------------------------------

/** Access a whole menu group needs. Groups not listed are open to everyone in the workspace. */
const GROUP_PERM: Record<string, Permission> = {
  calendar: "calendars.manage",
  payments: "payments.manage",
  marketing: "marketing.manage",
  sites: "sites.manage",
  memberships: "sites.manage",
  reputation: "marketing.manage",
  ai: "ai.manage",
  reporting: "reporting.view",
};

/** Access a single page needs. */
export const PAGE_PERM: Record<string, Permission> = {
  "/workflows": "workflows.manage",
  "/ai-builder": "settings.manage",
  "/forms": "sites.manage",
  "/funnels": "sites.manage",
  "/domains": "sites.manage",
  "/setter-console": "inbox.send",
  "/command-centre": "inbox.send",
  "/ai": "ai.manage",
  "/usage": "ai.manage",
  "/qa": "ai.manage",
  "/guardrails": "ai.manage",
  "/revenue": "reporting.view",
  "/qr-codes": "sites.manage",
  "/campaigns": "marketing.manage",
  "/agents": "ai.manage",
  "/reports": "reporting.view",
  "/settings": "settings.manage",
  "/settings/pipeline": "pipeline.manage",
  "/settings/team": "team.manage",
  "/settings/roles": "team.manage",
  "/settings/fields": "settings.manage",
  "/settings/email": "settings.manage",
  "/settings/integrations": "settings.manage",
  "/settings/billing": "settings.manage",
  "/settings/notifications": "settings.manage",
  "/soon/calls": "calls.make",
  "/soon/import": "contacts.import",
};

/** The access needed for a path, if any (the longest matching page wins). */
export function permForPath(path: string): Permission | undefined {
  const pathname = path.split("?")[0];
  const match = Object.keys(PAGE_PERM)
    .filter((h) => pathname === h || pathname.startsWith(h + "/"))
    .sort((a, b) => b.length - a.length)[0];
  if (match) return PAGE_PERM[match];
  const soon = pathname.startsWith("/soon/") ? SOON_PAGES.find((p) => `/soon/${p.slug}` === pathname)?.group : undefined;
  return soon ? GROUP_PERM[soon] : undefined;
}

/** The menu as this person should see it. */
export function navFor(perms: readonly string[]) {
  const has = (p?: Permission) => !p || perms.includes(p);
  const filter = (g: NavGroup): NavGroup | null => {
    if (!has(GROUP_PERM[g.key])) return null;
    if (!g.links) return has(PAGE_PERM[g.href]) ? g : null;
    const links = g.links.filter((l) => has(PAGE_PERM[l.href]) && has(permForPath(l.href)));
    if (!links.length) return null;
    const href = links.some((l) => l.href === g.href) ? g.href : links[0].href;
    return { ...g, href, links };
  };
  return {
    nav: NAV.map(filter).filter((g): g is NavGroup => Boolean(g)),
    settings: filter(SETTINGS_NAV),
  };
}
