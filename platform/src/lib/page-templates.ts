// Ready-made pages for the businesses Scalency serves. Each is fully editable.

import { blankPage, block, row, section, type PageDefinition, type Section } from "./page-builder";
import { presetByKey, type Copy } from "./page-sections";

export type PageTemplate = { key: string; name: string; blurb: string; category: string; accent: string; icon: string; build: () => PageDefinition };

const S = (key: string, o: Copy = {}): Section => presetByKey(key)!.make(o);

function page(accent: string, sections: Section[], extra: Partial<PageDefinition["theme"]> = {}, template = ""): PageDefinition {
  const base = blankPage();
  return { ...base, sections, theme: { ...base.theme, accent, ...extra }, meta: { source: "template", template } };
}

const DEEP = (from: string, to: string) => `linear-gradient(135deg,${from} 0%,${to} 100%)`;

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    key: "book-call",
    name: "Book a call",
    blurb: "For coaches and consultants: a strong promise, proof and a booking form.",
    category: "Coaching",
    accent: "#2563eb",
    icon: "calendar",
    build: () =>
      page(
        "#2563eb",
        [
          S("header", { brand: "Your name", button: "Book a call" }),
          S("hero-split", { eyebrow: "Free 30-minute strategy call", heading: "Grow to your next £10k month without working more hours", text: "A clear plan for your business in one call. No pitch, no pressure.", items: [{ text: "A 90-day plan made for your business" }, { text: "Where your next clients will come from" }, { text: "Honest advice, even if we don't work together" }] }),
          S("stats", { items: [{ value: "120+", text: "Clients helped" }, { value: "4.9★", text: "Average rating" }, { value: "90 days", text: "To see results" }] }),
          S("benefits", { heading: "What you'll leave the call with", items: [{ text: "Where your next customers will come from" }, { text: "The one thing slowing you down" }, { text: "A 90-day plan you can start tomorrow" }] }),
          S("testimonials"),
          S("faq", { items: [{ title: "Is the call really free?", text: "Yes. If it's a fit, I'll explain how we can work together. If not, you keep the plan." }, { title: "Who is this for?", text: "Business owners who already have customers and want more of them." }, { title: "How long is the call?", text: "Around 30 minutes, on Zoom or the phone." }] }),
          S("form", { heading: "Book your free call", text: "Answer a few quick questions and pick a time." }),
          S("footer"),
        ],
        {},
        "book-call",
      ),
  },
  {
    key: "lead-magnet",
    name: "Free guide",
    blurb: "Give away a guide or checklist in exchange for an email address.",
    category: "Lead capture",
    accent: "#7c3aed",
    icon: "file",
    build: () =>
      page(
        "#7c3aed",
        [
          S("hero-form", { eyebrow: "Free download", heading: "The 7-step checklist to double your enquiries", text: "The exact steps we use with every client, in one page.", items: [{ text: "Three quick wins you can do today" }, { text: "The follow-up most businesses forget" }, { text: "Sent to your inbox straight away" }], style: { background: DEEP("#3b0764", "#7c3aed") } }),
          S("features", { heading: "Inside the checklist", items: [{ icon: "check", title: "Quick wins", text: "Three changes you can make today." }, { icon: "chart", title: "What to measure", text: "The numbers that actually matter." }, { icon: "zap", title: "Follow-up that works", text: "How to turn enquiries into bookings." }] }),
          S("testimonials", { heading: "People who used it" }),
          S("footer"),
        ],
        { buttonStyle: "pill" },
        "lead-magnet",
      ),
  },
  {
    key: "aesthetics",
    name: "Aesthetics clinic",
    blurb: "Treatments, before and after proof, prices and a consultation form.",
    category: "Local business",
    accent: "#db2777",
    icon: "star",
    build: () =>
      page(
        "#db2777",
        [
          S("header", { brand: "Your Clinic", button: "Book a consultation" }),
          S("hero", { eyebrow: "Award-winning clinic in Manchester", heading: "Natural results, from people you can trust", text: "Medically led treatments with a free consultation first, so you know exactly what to expect.", button: "Book a free consultation", style: { background: DEEP("#fdf2f8", "#fce7f3") } }),
          S("features", { heading: "Popular treatments", items: [{ icon: "spark", title: "Anti-wrinkle", text: "Soften lines with a natural finish. From £180." }, { icon: "heart", title: "Dermal fillers", text: "Restore volume and balance. From £250." }, { icon: "star", title: "Skin boosters", text: "Hydrated, glowing skin. From £200." }] }),
          S("testimonials", { heading: "Loved by our clients" }),
          S("faq", { items: [{ title: "Does it hurt?", text: "Most people feel very little. We use numbing cream where needed." }, { title: "How long do results last?", text: "Usually 3 to 12 months depending on the treatment." }, { title: "Who carries out treatments?", text: "Qualified medical practitioners only." }] }),
          S("form", { heading: "Book your free consultation", text: "Tell us what you'd like help with and we'll call you back today." }),
          S("footer", { style: { background: "#500724" } }),
        ],
        { headingFont: "classic", buttonStyle: "pill" },
        "aesthetics",
      ),
  },
  {
    key: "dental",
    name: "Dental practice",
    blurb: "New patient offer, treatments, reviews and a booking form.",
    category: "Local business",
    accent: "#0d9488",
    icon: "heart",
    build: () =>
      page(
        "#0d9488",
        [
          S("header", { brand: "Your Dental", button: "Book now" }),
          S("hero-split", { eyebrow: "Now welcoming new patients", heading: "A dentist you'll actually look forward to seeing", text: "Gentle care, clear prices and appointments that suit you.", button: "Book a new patient check-up", items: [{ text: "£49 new patient check-up and X-rays" }, { text: "Evening and Saturday appointments" }, { text: "Nervous patients very welcome" }] }),
          S("stats", { items: [{ value: "£49", text: "New patient check-up" }, { value: "5★", text: "Google reviews" }, { value: "Same week", text: "Appointments" }] }),
          S("features", { heading: "Treatments", items: [{ icon: "spark", title: "Teeth whitening", text: "A brighter smile in two weeks." }, { icon: "check", title: "Invisalign", text: "Straighter teeth without metal braces." }, { icon: "shield", title: "Implants", text: "Permanent, natural-looking replacements." }] }),
          S("testimonials"),
          S("form", { heading: "Book your appointment", text: "Leave your details and we'll confirm a time by text." }),
          S("footer", { style: { background: "#134e4a" } }),
        ],
        {},
        "dental",
      ),
  },
  {
    key: "trades",
    name: "Builder or trades quote",
    blurb: "Services, proof and a quote request for construction and trades.",
    category: "Local business",
    accent: "#ea580c",
    icon: "home",
    build: () =>
      page(
        "#ea580c",
        [
          S("header", { brand: "Your Building Co.", button: "Get a quote" }),
          S("hero-form", { eyebrow: "Free, no-obligation quotes", heading: "Extensions and renovations done right, on time and on budget", text: "Fully insured. Every job guaranteed for 10 years.", items: [{ text: "Fixed quotes with no hidden extras" }, { text: "One project manager from start to finish" }, { text: "Local team with 15 years' experience" }], style: { background: DEEP("#1c1917", "#9a3412") } }),
          S("stats", { items: [{ value: "15 years", text: "In business" }, { value: "350+", text: "Projects finished" }, { value: "10 years", text: "Guarantee" }] }),
          S("features", { heading: "What we do", items: [{ icon: "home", title: "Extensions", text: "Single and double storey, from plans to finish." }, { icon: "zap", title: "Loft conversions", text: "Extra bedrooms without moving house." }, { icon: "star", title: "Kitchens and bathrooms", text: "Designed, fitted and finished." }] }),
          S("testimonials", { heading: "Recent customers" }),
          S("cta", { heading: "Get your free quote this week", button: "Request a quote", style: { background: DEEP("#9a3412", "#ea580c") } }),
          S("footer", { style: { background: "#1c1917" } }),
        ],
        { radius: 6 },
        "trades",
      ),
  },
  {
    key: "property",
    name: "Property valuation",
    blurb: "Free valuation offer for estate and letting agents.",
    category: "Local business",
    accent: "#16a34a",
    icon: "home",
    build: () =>
      page(
        "#16a34a",
        [
          S("header", { brand: "Your Estate Agents", button: "Free valuation" }),
          S("hero-form", { eyebrow: "Instant and free", heading: "What's your home really worth?", text: "Get an accurate valuation from a local expert within 24 hours.", items: [{ text: "Based on real local sold prices" }, { text: "A visit from an agent who knows your street" }, { text: "No obligation to sell with us" }], style: { background: DEEP("#052e16", "#15803d") } }),
          S("stats", { items: [{ value: "97%", text: "Of asking price achieved" }, { value: "28 days", text: "Average time to sell" }, { value: "0%", text: "Fees until you sell" }] }),
          S("testimonials", { heading: "Sellers who moved with us" }),
          S("faq", { items: [{ title: "Is the valuation really free?", text: "Yes, with no obligation to sell with us." }, { title: "How accurate is it?", text: "We use recent local sales and visit the property in person." }] }),
          S("footer", { style: { background: "#052e16" } }),
        ],
        {},
        "property",
      ),
  },
  {
    key: "webinar",
    name: "Webinar sign-up",
    blurb: "Registration page with a countdown to the live session.",
    category: "Events",
    accent: "#4f46e5",
    icon: "video",
    build: () =>
      page(
        "#4f46e5",
        [
          S("hero-form", { eyebrow: "Free live training", heading: "How to book 20 more clients a month with automation", text: "Live on Zoom. Can't make it? Register and we'll send the replay.", items: [{ text: "Thursday at 7pm UK time, about 45 minutes" }, { text: "Live questions and answers at the end" }, { text: "Free to join, replay sent to everyone" }], style: { background: DEEP("#1e1b4b", "#4f46e5") } }),
          S("countdown", { heading: "Starts in", button: "Save my seat", style: { background: "#1e1b4b" } }),
          S("features", { heading: "What you'll learn", items: [{ icon: "zap", title: "The follow-up system", text: "Reply to every lead in under a minute." }, { icon: "calendar", title: "Booking on autopilot", text: "Fill your calendar without chasing." }, { icon: "chart", title: "The numbers to watch", text: "Know what's working every week." }] }),
          S("testimonials"),
          S("footer", { style: { background: "#1e1b4b" } }),
        ],
        { buttonStyle: "pill" },
        "webinar",
      ),
  },
  {
    key: "sales",
    name: "Sales page",
    blurb: "Long-form page with video, benefits, pricing and a deadline.",
    category: "Selling",
    accent: "#2563eb",
    icon: "pound",
    build: () =>
      page(
        "#2563eb",
        [
          S("hero", { eyebrow: "New programme", heading: "The 12-week programme that turns your expertise into a steady stream of clients", text: "Everything we've learned working with 300+ businesses, step by step.", button: "Join now" }),
          S("video", { heading: "Watch this first" }),
          S("benefits", { heading: "What's included", items: [{ text: "12 weekly lessons you can watch any time" }, { text: "Weekly live Q&A calls" }, { text: "Templates, scripts and checklists" }, { text: "A private community" }] }),
          S("testimonials", { heading: "Results from past members" }),
          S("pricing"),
          S("countdown", { heading: "Early price ends in" }),
          S("faq"),
          S("cta"),
          S("footer"),
        ],
        {},
        "sales",
      ),
  },
  {
    key: "thank-you",
    name: "Thank you",
    blurb: "After someone signs up or books: confirm and tell them what's next.",
    category: "Funnel steps",
    accent: "#16a34a",
    icon: "checkCircle",
    build: () =>
      page(
        "#16a34a",
        [
          section(
            "Thank you",
            [
              row([
                block("heading", { text: "You're in! Check your email", level: 1, size: "xl", align: "center" }),
                block("text", { text: "We've just sent you everything you need. While you wait, watch this short video.", size: "l", align: "center" }),
                block("video", { url: "" }),
                block("button", { text: "Back to the website", link: "#", align: "center", style: "outline" }),
              ]),
            ],
            { padding: "xl", width: "narrow", align: "center", background: "linear-gradient(180deg,#ffffff 0%,#eef5ff 100%)" },
          ),
        ],
        {},
        "thank-you",
      ),
  },
  {
    key: "coming-soon",
    name: "Coming soon",
    blurb: "A launch countdown and a waiting list.",
    category: "Lead capture",
    accent: "#0ea5e9",
    icon: "clock",
    build: () =>
      page(
        "#0ea5e9",
        [
          section(
            "Coming soon",
            [row([block("text", { text: "**COMING SOON**", size: "s", align: "center" }), block("heading", { text: "Something new is on its way", level: 1, size: "xl", align: "center" }), block("countdown", {}), block("text", { text: "Join the waiting list and be the first to know.", align: "center" }), block("form", {})])],
            { padding: "xl", width: "narrow", align: "center", background: DEEP("#082f49", "#0ea5e9") },
          ),
        ],
        { buttonStyle: "pill" },
        "coming-soon",
      ),
  },
];

export const pageTemplateByKey = (k: string) => PAGE_TEMPLATES.find((t) => t.key === k);

// ---------------------------------------------------------------------------
// "Build with AI": turns the AI's outline into a real page.
// ---------------------------------------------------------------------------

export const AI_SECTION_TYPES = ["header", "hero", "hero-split", "hero-form", "logos", "features", "benefits", "stats", "video", "testimonials", "pricing", "faq", "countdown", "form", "cta", "footer"] as const;

export type AiPageSection = {
  type: string;
  eyebrow?: string;
  heading?: string;
  text?: string;
  button?: string;
  items?: { title?: string; text?: string; icon?: string; name?: string; role?: string; value?: string }[];
  plans?: { name: string; price: string; period?: string; features?: string[]; button?: string; highlight?: boolean }[];
};
export type AiPageDraft = {
  name: string;
  accent?: string;
  font?: string;
  buttonStyle?: string;
  brand?: string;
  seo?: { title?: string; description?: string };
  sections: AiPageSection[];
};

/** Builds a page from an AI draft. Form sections use the form chosen before drafting. */
export function pageFromDraft(d: AiPageDraft, formId = ""): PageDefinition {
  const base = blankPage();
  const accent = /^#[0-9a-f]{6}$/i.test(d.accent ?? "") ? d.accent! : base.theme.accent;
  const sections = d.sections
    .filter((s) => (AI_SECTION_TYPES as readonly string[]).includes(s.type))
    .slice(0, 14)
    .map((s) =>
      presetByKey(s.type)!.make({
        eyebrow: s.eyebrow,
        heading: s.heading,
        text: s.text,
        button: s.button,
        brand: d.brand,
        formId,
        ...(s.items?.length ? { items: s.items } : {}),
        ...(s.plans?.length
          ? { plans: s.plans.map((p) => ({ name: p.name, price: p.price, period: p.period ?? "", features: p.features ?? [], button: p.button ?? "Choose", link: "#contact", highlight: Boolean(p.highlight) })) }
          : {}),
      }),
    );
  return {
    ...base,
    sections: sections.length ? sections : base.sections,
    theme: {
      ...base.theme,
      accent,
      font: (["modern", "classic", "friendly"] as const).includes(d.font as "modern") ? (d.font as "modern") : "modern",
      buttonStyle: (["solid", "pill", "outline"] as const).includes(d.buttonStyle as "solid") ? (d.buttonStyle as "solid") : "solid",
    },
    seo: { ...base.seo, title: d.seo?.title ?? "", description: d.seo?.description ?? "" },
    meta: { source: "ai" },
  };
}
