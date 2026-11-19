// Ready-made forms. Each builds a fresh definition, so forms made from the same
// template never share anything.

import { blankDefinition, content, field, row, step, type FormDefinition, type Theme } from "./form-builder";

export type FormTemplate = { key: string; name: string; blurb: string; category: string; icon: string; accent: string; build: () => FormDefinition };

function make(parts: Partial<FormDefinition> & { steps: FormDefinition["steps"] }, theme: Partial<Theme> = {}, key = ""): FormDefinition {
  const base = blankDefinition();
  return { ...base, ...parts, theme: { ...base.theme, ...theme }, meta: { source: "template", template: key } };
}
const ask = (text: string) => row(content("paragraph", { text }));
const title = (text: string) => row(content("heading", { text }));
const choice = (kind: "radio" | "select" | "checkboxes", label: string, options: string[], extra = {}) => field(kind, label, { options, required: true, ...extra });

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    key: "contact",
    name: "Contact us",
    blurb: "Name, email, phone and a message. The everyday enquiry form.",
    category: "Lead capture",
    icon: "mail",
    accent: "#0a5fe3",
    build: () =>
      make(
        {
          steps: [
            step(
              "Your message",
              title("Get in touch"),
              ask("Tell us what you need and we'll reply within one working day."),
              row(field("first_name", undefined, { required: true }), field("last_name")),
              row(field("email"), field("phone")),
              row(field("textarea", "How can we help?", { required: true, placeholder: "A few lines is plenty" })),
            ),
          ],
        },
        {},
        "contact",
      ),
  },
  {
    key: "ai-audit",
    name: "Free AI audit (scorecard)",
    blurb: "Multi-step scorecard that scores the business and sorts leads into good fit or not.",
    category: "Qualify",
    icon: "spark",
    accent: "#7c3aed",
    build: () => {
      const revenue = choice("radio", "Roughly how much does the business turn over a month?", ["Under £10k", "£10k to £50k", "£50k to £150k", "Over £150k"], { scores: [0, 2, 4, 5] });
      const speed = choice("radio", "How quickly do you reply to a new enquiry?", ["Within 5 minutes", "Within an hour", "Same day", "Next day or later"], { scores: [0, 1, 2, 3] });
      const crm = choice("radio", "Do you use a CRM or booking system?", ["Yes, and it's set up well", "Yes, but it's messy", "No, it's spreadsheets and inboxes"], { scores: [0, 2, 3] });
      const pains = choice("checkboxes", "Where does time or money leak most?", ["Missed calls", "Slow follow-up", "No-shows", "Chasing quotes", "Getting reviews", "Admin and data entry"], { required: false, scores: [1, 1, 1, 1, 1, 1] });
      return make(
        {
          steps: [
            step("Your business", title("Your free AI opportunity audit"), ask("Two minutes, eight questions. We'll show you where AI can win you more work and save you time."), row(field("company", "Business name", { required: true }), field("website", "Website")), row(revenue)),
            step("How you work today", row(speed), row(crm), row(pains)),
            step(
              "Where to send it",
              title("Where should we send your audit?"),
              row(field("first_name", undefined, { required: true }), field("last_name")),
              row(field("email"), field("phone", undefined, { required: true })),
            ),
          ],
          button: "Get my audit",
          progress: "steps",
          qualify: {
            enabled: true,
            min: 6,
            qualified: { message: "Thanks! Your business is a strong fit. Book a 15-minute call and we'll walk you through your audit.", redirect: "", tag: "Audit: good fit" },
            unqualified: { message: "Thanks! We'll email your audit with the quick wins we found.", redirect: "", tag: "Audit: nurture" },
          },
        },
        { accent: "#7c3aed", background: "#f4f1ff" },
        "ai-audit",
      );
    },
  },
  {
    key: "application",
    name: "Book-a-call application",
    blurb: "Qualifying application before someone can book a sales call. Saves people who stop part way.",
    category: "Qualify",
    icon: "calendar",
    accent: "#0ea5e9",
    build: () => {
      const budget = choice("radio", "What's your monthly budget for growth?", ["Under £500", "£500 to £2,000", "£2,000 to £5,000", "£5,000+"], { scores: [-5, 2, 4, 5] });
      const start = choice("radio", "When do you want to start?", ["Straight away", "In the next month", "Just looking"], { scores: [3, 2, -2] });
      return make(
        {
          steps: [
            step("About you", title("Apply for a strategy call"), ask("Answer a few questions so we can make the call worth your time."), row(field("first_name", undefined, { required: true }), field("last_name")), row(field("email"), field("phone", undefined, { required: true }))),
            step("Your business", row(field("company", "Business name", { required: true })), row(field("textarea", "What do you sell, and who to?", { required: true })), row(budget)),
            step("Timing", row(start), row(field("textarea", "Anything else we should know?"))),
          ],
          button: "Submit application",
          qualify: {
            enabled: true,
            min: 4,
            qualified: { message: "You're a great fit. Pick a time for your call on the next page.", redirect: "", tag: "Application: qualified" },
            unqualified: { message: "Thanks for applying. We'll be in touch with resources that fit where you are now.", redirect: "", tag: "Application: not yet" },
          },
        },
        { accent: "#0ea5e9" },
        "application",
      );
    },
  },
  {
    key: "quote",
    name: "Quote request",
    blurb: "For trades and local services: job type, postcode, timing and budget.",
    category: "Local services",
    icon: "pound",
    accent: "#ea580c",
    build: () =>
      make(
        {
          steps: [
            step(
              "The job",
              title("Get a free quote"),
              row(choice("select", "What do you need?", ["Repair", "Installation", "Full project", "Something else"])),
              row(field("text", "Postcode", { required: true, placeholder: "e.g. M1 2AB" }), choice("select", "When?", ["As soon as possible", "Within a month", "In 1 to 3 months", "Just planning"])),
              row(choice("radio", "Rough budget", ["Under £1,000", "£1,000 to £5,000", "£5,000 to £20,000", "£20,000+"], { required: false })),
              row(field("textarea", "Tell us about the job", { placeholder: "Size, materials, access, anything useful" })),
            ),
            step("Your details", row(field("full_name", undefined, { required: true })), row(field("phone", undefined, { required: true }), field("email"))),
          ],
          button: "Get my quote",
        },
        { accent: "#ea580c", background: "#fff7ed" },
        "quote",
      ),
  },
  {
    key: "aesthetics",
    name: "Aesthetics consultation",
    blurb: "Treatment interest, preferred times and contact details for clinics.",
    category: "Local services",
    icon: "star",
    accent: "#db2777",
    build: () =>
      make(
        {
          steps: [
            step(
              "Consultation",
              title("Book your free consultation"),
              ask("Tell us what you're interested in and we'll call to find a time that suits you."),
              row(choice("checkboxes", "Which treatments interest you?", ["Anti-wrinkle", "Dermal fillers", "Skin boosters", "Chemical peels", "Laser", "Not sure yet"])),
              row(choice("radio", "Have you had this treatment before?", ["Yes", "No"], { required: false })),
              row(choice("select", "Best time to call", ["Morning", "Afternoon", "Evening"], { required: false })),
              row(field("first_name", undefined, { required: true }), field("last_name")),
              row(field("phone", undefined, { required: true }), field("email")),
            ),
          ],
          button: "Request my consultation",
        },
        { accent: "#db2777", background: "#fdf2f8", font: "classic", radius: 20, buttonStyle: "pill" },
        "aesthetics",
      ),
  },
  {
    key: "dental",
    name: "New patient enquiry",
    blurb: "Dental and health clinics: reason for visit, urgency and contact details.",
    category: "Local services",
    icon: "user",
    accent: "#0d9488",
    build: () =>
      make(
        {
          steps: [
            step(
              "Enquiry",
              title("New patient enquiry"),
              row(choice("select", "Reason for your visit", ["Check-up", "Pain or emergency", "Cosmetic", "Implants", "Invisalign or braces", "Other"])),
              row(choice("radio", "How urgent is it?", ["Today if possible", "This week", "No rush"])),
              row(field("full_name", undefined, { required: true }), field("date", "Date of birth")),
              row(field("phone", undefined, { required: true }), field("email")),
            ),
          ],
          button: "Send enquiry",
        },
        { accent: "#0d9488", background: "#f0fdfa" },
        "dental",
      ),
  },
  {
    key: "lead-magnet",
    name: "Free guide download",
    blurb: "Name and email in exchange for a guide, checklist or video.",
    category: "Lead capture",
    icon: "book",
    accent: "#16a34a",
    build: () =>
      make(
        {
          steps: [step("Download", title("Get the free guide"), ask("Enter your details and we'll email it straight over."), row(field("first_name", undefined, { required: true })), row(field("email")))],
          button: "Send me the guide",
          success: "Done! Check your inbox in the next couple of minutes.",
          consent: { enabled: true, text: "Send me the guide and occasional tips by email. Unsubscribe any time.", required: true },
        },
        { accent: "#16a34a", buttonStyle: "pill" },
        "lead-magnet",
      ),
  },
  {
    key: "event",
    name: "Event or webinar sign-up",
    blurb: "Register people for an event, with how they heard about it.",
    category: "Lead capture",
    icon: "video",
    accent: "#4f46e5",
    build: () =>
      make(
        {
          steps: [
            step(
              "Register",
              title("Save your seat"),
              row(field("first_name", undefined, { required: true }), field("last_name")),
              row(field("email"), field("phone")),
              row(choice("select", "How did you hear about us?", ["Instagram", "Facebook", "LinkedIn", "Google", "A friend", "Other"], { required: false })),
            ),
          ],
          button: "Register",
          success: "You're in! We've emailed you the details.",
        },
        { accent: "#4f46e5", dark: true, background: "#0b1220" },
        "event",
      ),
  },
  {
    key: "job",
    name: "Job application",
    blurb: "Role, experience, availability and a short pitch. Feeds your hiring pipeline.",
    category: "Hiring",
    icon: "team",
    accent: "#0b1b3a",
    build: () =>
      make(
        {
          steps: [
            step("About you", title("Join the team"), row(field("first_name", undefined, { required: true }), field("last_name", undefined, { required: true })), row(field("email"), field("phone", undefined, { required: true })), row(field("website", "LinkedIn or portfolio"))),
            step(
              "The role",
              row(choice("select", "Which role are you applying for?", ["Sales (BDM)", "Appointment setter", "Account manager", "Other"])),
              row(choice("radio", "Years of relevant experience", ["Less than 1", "1 to 3", "3 to 5", "5+"])),
              row(field("date", "When could you start?")),
              row(field("textarea", "Why you? (a few lines)", { required: true })),
            ),
          ],
          button: "Send application",
          success: "Thanks for applying! If you're shortlisted, you'll get a link to book an interview.",
        },
        { accent: "#0b1b3a" },
        "job",
      ),
  },
  {
    key: "onboarding",
    name: "Client onboarding questionnaire",
    blurb: "Offer, ideal customer, brand and access details from new clients.",
    category: "Clients",
    icon: "onboarding",
    accent: "#0a5fe3",
    build: () =>
      make(
        {
          steps: [
            step("Your business", title("Welcome aboard"), ask("This tells us everything we need to start building for you."), row(field("company", "Business name", { required: true }), field("website")), row(field("full_name", "Your name", { required: true })), row(field("email"), field("phone"))),
            step("Your offer", row(field("textarea", "What do you sell, and what does it cost?", { required: true })), row(field("textarea", "Who is your ideal customer?", { required: true })), row(field("textarea", "What makes you different?"))),
            step("Brand and access", row(field("text", "Brand colours (hex codes if you have them)")), row(field("textarea", "Links to your logo, photos and brand guide")), row(choice("checkboxes", "Which tools do you use today?", ["GoHighLevel", "HubSpot", "Calendly", "Mailchimp", "Shopify", "WordPress", "Other"], { required: false }))),
          ],
          button: "Finish",
          progress: "steps",
          success: "Thank you! We'll review this and be in touch within one working day.",
        },
        {},
        "onboarding",
      ),
  },
  {
    key: "feedback",
    name: "Feedback and reviews",
    blurb: "Rating plus comments. Happy customers can be sent to leave a review.",
    category: "Clients",
    icon: "thumbsUp",
    accent: "#f59e0b",
    build: () =>
      make(
        {
          steps: [
            step(
              "Feedback",
              title("How did we do?"),
              row(field("rating", "Overall, how happy are you?", { required: true })),
              row(field("textarea", "What could we do better?")),
              row(field("first_name"), field("email")),
            ),
          ],
          button: "Send feedback",
        },
        { accent: "#f59e0b", buttonStyle: "pill" },
        "feedback",
      ),
  },
];

export const templateByKey = (k: string) => FORM_TEMPLATES.find((t) => t.key === k);

// ---------------------------------------------------------------------------
// "Build with AI": turns the AI's outline into a real form.
// ---------------------------------------------------------------------------

export type AiField = {
  kind: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: string[];
  scores?: number[];
  key?: string;
  half?: boolean;
};
export type AiDraft = {
  name: string;
  heading?: string;
  intro?: string;
  accent?: string;
  button?: string;
  success?: string;
  steps: { title: string; fields: AiField[] }[];
  qualify?: { enabled?: boolean; min?: number; qualified_message?: string; unqualified_message?: string };
};

/** Builds a Form Studio definition from an AI draft. Half-width fields pair up side by side. */
export function definitionFromDraft(d: AiDraft): FormDefinition {
  const base = blankDefinition();
  const steps = d.steps.map((s, i) => {
    const rows = [];
    if (i === 0 && d.heading) rows.push(title(d.heading));
    if (i === 0 && d.intro) rows.push(ask(d.intro));
    let pending: ReturnType<typeof field> | null = null;
    for (const f of s.fields) {
      const block = field(f.kind as Parameters<typeof field>[0], f.label, {
        required: Boolean(f.required) || f.kind === "email",
        ...(f.placeholder ? { placeholder: f.placeholder } : {}),
        ...(f.help ? { help: f.help } : {}),
        ...(f.options?.length ? { options: f.options } : {}),
        ...(f.scores?.length ? { scores: f.scores } : {}),
        ...(f.key ? { key: f.key } : {}),
      });
      if (f.half && f.kind !== "textarea") {
        if (pending) {
          rows.push(row(pending, block));
          pending = null;
        } else pending = block;
      } else {
        if (pending) rows.push(row(pending));
        pending = null;
        rows.push(row(block));
      }
    }
    if (pending) rows.push(row(pending));
    return step(s.title || `Step ${i + 1}`, ...rows);
  });
  const q = d.qualify;
  return {
    ...base,
    steps: steps.length ? steps : base.steps,
    button: d.button || base.button,
    success: d.success || base.success,
    progress: steps.length > 1 ? "bar" : "none",
    qualify: q?.enabled
      ? {
          enabled: true,
          min: Math.max(0, Number(q.min) || 0),
          qualified: { ...base.qualify.qualified, message: q.qualified_message || base.qualify.qualified.message },
          unqualified: { ...base.qualify.unqualified, message: q.unqualified_message || base.qualify.unqualified.message },
        }
      : base.qualify,
    theme: { ...base.theme, ...(d.accent && /^#[0-9a-f]{6}$/i.test(d.accent) ? { accent: d.accent } : {}) },
    meta: { source: "ai" },
  };
}
