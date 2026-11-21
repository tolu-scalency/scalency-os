// Funnels and websites: several pages that belong together.
//
// A funnel is pages in steps (opt-in, sales page, booking, thank you). Buttons can
// link to "the next step", and a form can move people on once it's sent.
// A website is pages with a shared header and footer (kept in sites.settings) and a
// menu that lists its pages by itself.

import { block, cleanPage, NEXT_LINK, row, section, slugify, type PageDefinition, type Section } from "./page-builder";
import { pageTemplateByKey } from "./page-templates";
import { presetByKey, type Copy } from "./page-sections";

export type SiteKind = "page" | "funnel" | "website";
export type SiteSettings = { header: Section[]; footer: Section[] };
export type SitePageInfo = { id: string; name: string; slug: string; position: number; in_menu: boolean };
/** What links on a live page point at. */
export type SiteLinks = { next: string | null; home: string; pages: Record<string, string>; menu: { label: string; href: string }[] };

export const KIND_LABEL: Record<SiteKind, string> = { page: "Page", funnel: "Funnel", website: "Website" };
export const STEP_WORD: Record<SiteKind, string> = { page: "page", funnel: "step", website: "page" };

/** The shared header and footer of a website, checked like a page. */
export function cleanSiteSettings(v: unknown): SiteSettings {
  const o = (v ?? {}) as Record<string, unknown>;
  const part = (x: unknown) => cleanPage({ sections: Array.isArray(x) ? x.slice(0, 4) : [] }).sections;
  return { header: part(o.header), footer: part(o.footer) };
}

/** A page's address on a site: base is "/p/<workspace>/<site>" or "" on the site's own domain. */
export function pageHref(base: string, slug: string) {
  return slug ? `${base}/${slug}` : base || "/";
}

export function siteLinks(pages: SitePageInfo[], currentId: string, base: string): SiteLinks {
  const sorted = [...pages].sort((a, b) => a.position - b.position);
  const ix = sorted.findIndex((p) => p.id === currentId);
  const next = ix >= 0 && ix < sorted.length - 1 ? pageHref(base, sorted[ix + 1].slug) : null;
  return {
    next,
    home: sorted[0] ? pageHref(base, sorted[0].slug) : "#",
    pages: Object.fromEntries(sorted.map((p) => [p.id, pageHref(base, p.slug)])),
    menu: sorted.filter((p) => p.in_menu).slice(0, 8).map((p) => ({ label: p.name, href: pageHref(base, p.slug) })),
  };
}

/** Turns "@next" and "@page:<id>" into real addresses. Anything else is left as it is. */
export function resolveLink(href: string | undefined, links: SiteLinks | null | undefined) {
  const h = href || "#";
  if (h === NEXT_LINK) return links?.next ?? "#";
  if (h.startsWith("@page:")) return links?.pages[h.slice(6)] ?? "#";
  return h;
}

/** A free link name for a new page in a site: "about", then "about-2". */
export function freePageSlug(taken: string[], name: string) {
  const root = slugify(name) || "page";
  for (let i = 1; i < 99; i++) {
    const s = (i === 1 ? root : `${root}-${i}`).slice(0, 70);
    if (!taken.includes(s)) return s;
  }
  return `${root}-${Math.random().toString(36).slice(2, 6)}`;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export type StepPlan = { name: string; slug: string; def: PageDefinition; in_menu?: boolean };
export type SiteTemplate = { key: string; name: string; blurb: string; icon: string; accent: string; build: () => { steps: StepPlan[]; settings?: SiteSettings } };

const tpl = (key: string) => pageTemplateByKey(key)!.build();
const S = (key: string, o: Copy = {}): Section => presetByKey(key)!.make(o);

/** In every step but the last, forms move people on and "#contact" buttons still scroll to the form. */
function asFunnelStep(def: PageDefinition, last: boolean): PageDefinition {
  if (last) return def;
  for (const s of def.sections) for (const r of s.rows) for (const c of r.columns) for (const b of c.blocks) if (b.kind === "form") b.after = "next";
  return def;
}

function thankYou(heading: string, text: string): PageDefinition {
  const d = tpl("thank-you");
  const blocks = d.sections[0].rows[0].columns[0].blocks;
  blocks[0].text = heading;
  blocks[1].text = text;
  return d;
}

function funnel(steps: StepPlan[]) {
  return { steps: steps.map((s, i) => ({ ...s, def: asFunnelStep(s.def, i === steps.length - 1) })) };
}

export const FUNNEL_TEMPLATES: SiteTemplate[] = [
  {
    key: "lead-to-call",
    name: "Free guide, then book a call",
    blurb: "Give away a guide, then invite people to a call. Three steps.",
    icon: "calendar",
    accent: "#7c3aed",
    build: () =>
      funnel([
        { name: "Free guide", slug: "", def: tpl("lead-magnet") },
        { name: "Book a call", slug: "book-a-call", def: tpl("book-call") },
        { name: "Thank you", slug: "thank-you", def: thankYou("You're booked in", "We've emailed you the details and a calendar invite. Speak soon.") },
      ]),
  },
  {
    key: "webinar",
    name: "Webinar sign-up",
    blurb: "Register for a free webinar, then a confirmation page.",
    icon: "video",
    accent: "#db2777",
    build: () =>
      funnel([
        { name: "Register", slug: "", def: tpl("webinar") },
        { name: "You're registered", slug: "registered", def: thankYou("You're registered!", "Check your email for the joining link. Add it to your calendar so you don't miss it.") },
      ]),
  },
  {
    key: "sales",
    name: "Sales page",
    blurb: "A long sales page for an offer, then a thank you page.",
    icon: "pound",
    accent: "#ea580c",
    build: () =>
      funnel([
        { name: "Sales page", slug: "", def: tpl("sales") },
        { name: "Thank you", slug: "thank-you", def: thankYou("Thank you for your order", "We've emailed your receipt and everything you need to get started.") },
      ]),
  },
  {
    key: "consultation",
    name: "Clinic consultation",
    blurb: "For clinics: book a consultation, then what happens next.",
    icon: "heart",
    accent: "#be185d",
    build: () =>
      funnel([
        { name: "Book a consultation", slug: "", def: tpl("aesthetics") },
        { name: "Thank you", slug: "thank-you", def: thankYou("Your request is in", "A member of our team will call you within one working day to confirm your appointment.") },
      ]),
  },
  {
    key: "quote",
    name: "Free quote",
    blurb: "For trades and home services: request a quote, then a thank you.",
    icon: "settings",
    accent: "#0f766e",
    build: () =>
      funnel([
        { name: "Get a quote", slug: "", def: tpl("trades") },
        { name: "Thank you", slug: "thank-you", def: thankYou("Thanks, we've got your details", "We'll be in touch today with your free quote.") },
      ]),
  },
  {
    key: "blank-funnel",
    name: "Blank funnel",
    blurb: "An opt-in page and a thank you page to build on.",
    icon: "plus",
    accent: "#2563eb",
    build: () => {
      const optIn = tpl("lead-magnet");
      return funnel([
        { name: "Opt-in", slug: "", def: optIn },
        { name: "Thank you", slug: "thank-you", def: thankYou("Thank you!", "Check your email for what happens next.") },
      ]);
    },
  },
];

// Websites -----------------------------------------------------------------

const withoutChrome = (d: PageDefinition) => ({ ...d, sections: d.sections.filter((s) => s.name !== "Header" && s.name !== "Footer") });

function websiteParts(brand: string, button: string): SiteSettings {
  const header = S("header", { brand, button, link: "#contact" });
  const menu = header.rows[0].columns[0].blocks[0];
  menu.auto = true;
  menu.nav = [];
  return { header: [header], footer: [S("footer", { text: `© ${new Date().getFullYear()} ${brand}. All rights reserved.` })] };
}

function aboutPage(accent: string, who: string): PageDefinition {
  const d = tpl("book-call");
  return {
    ...d,
    theme: { ...d.theme, accent },
    sections: [
      S("hero", { eyebrow: "About us", heading: `The people behind ${who}`, text: "Who we are, why we started and what we care about.", button: "Get in touch", link: "#contact" }),
      S("hero-split", { heading: "Our story", text: "Tell people how you started and what makes you different. Keep it short and human.", button: "Meet the team", link: "#contact", items: [{ text: "Local and independent" }, { text: "Years of experience" }, { text: "Hundreds of happy customers" }] }),
      S("stats"),
      S("testimonials"),
      S("cta", { heading: "Like what you see?", text: "We'd love to hear from you.", button: "Contact us", link: "#contact" }),
    ],
  };
}

function servicesPage(accent: string): PageDefinition {
  const d = tpl("book-call");
  return {
    ...d,
    theme: { ...d.theme, accent },
    sections: [
      S("hero", { eyebrow: "Services", heading: "What we can do for you", text: "Everything we offer, with clear prices and no surprises.", button: "Ask a question", link: "#contact" }),
      S("features"),
      S("pricing"),
      S("faq"),
      S("cta", { heading: "Not sure what you need?", text: "Tell us what's going on and we'll point you the right way.", button: "Contact us", link: "#contact" }),
    ],
  };
}

function contactPage(accent: string): PageDefinition {
  const d = tpl("book-call");
  return {
    ...d,
    theme: { ...d.theme, accent },
    sections: [
      S("form", { heading: "Get in touch", text: "Send us a message and we'll reply within one working day.", anchor: "contact" }),
      section("Where to find us", [row([block("heading", { text: "Opening hours", level: 3 }), block("text", { text: "Monday to Friday: 9am to 5:30pm\nSaturday: 10am to 2pm" })]), row([block("heading", { text: "Call or email", level: 3 }), block("text", { text: "[01234 567890](tel:+441234567890)\n[hello@yourbusiness.co.uk](mailto:hello@yourbusiness.co.uk)" })])], { padding: "l", background: "#f6f8fc" }),
    ],
  };
}

function website(homeKey: string, brand: string, button: string): () => { steps: StepPlan[]; settings: SiteSettings } {
  return () => {
    const home = withoutChrome(tpl(homeKey));
    const accent = home.theme.accent;
    return {
      settings: websiteParts(brand, button),
      steps: [
        { name: "Home", slug: "", def: home },
        { name: "About", slug: "about", def: aboutPage(accent, brand) },
        { name: "Services", slug: "services", def: servicesPage(accent) },
        { name: "Contact", slug: "contact", def: contactPage(accent) },
      ],
    };
  };
}

export const WEBSITE_TEMPLATES: SiteTemplate[] = [
  { key: "business", name: "Small business", blurb: "Home, About, Services and Contact for any local business.", icon: "home", accent: "#2563eb", build: website("book-call", "Your business", "Contact us") },
  { key: "clinic", name: "Clinic", blurb: "For aesthetics and beauty clinics, with treatments and booking.", icon: "heart", accent: "#be185d", build: website("aesthetics", "Your clinic", "Book now") },
  { key: "dental", name: "Dental practice", blurb: "For dentists: treatments, prices and new patient booking.", icon: "star", accent: "#0891b2", build: website("dental", "Your practice", "Book an appointment") },
  { key: "trades", name: "Trades", blurb: "For builders, plumbers and electricians, with quotes.", icon: "settings", accent: "#0f766e", build: website("trades", "Your company", "Get a quote") },
  { key: "property", name: "Estate agent", blurb: "For property: valuations, listings and contact.", icon: "home", accent: "#1e3a8a", build: website("property", "Your agency", "Book a valuation") },
];

export const siteTemplateByKey = (kind: SiteKind, key: string) => (kind === "funnel" ? FUNNEL_TEMPLATES : kind === "website" ? WEBSITE_TEMPLATES : []).find((t) => t.key === key);

/** A starting point when someone adds a step or page to an existing site. */
export const STEP_STARTERS: { key: string; name: string; icon: string }[] = [
  { key: "blank", name: "Blank", icon: "plus" },
  { key: "lead-magnet", name: "Opt-in", icon: "file" },
  { key: "book-call", name: "Book a call", icon: "calendar" },
  { key: "sales", name: "Sales page", icon: "pound" },
  { key: "webinar", name: "Webinar", icon: "video" },
  { key: "thank-you", name: "Thank you", icon: "checkCircle" },
];

export { NEXT_LINK };
