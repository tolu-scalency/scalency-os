// Ready-made sections people can drop onto a page, and that templates are built from.

import { block, row, section, type PBlock, type Section, type SectionStyle } from "./page-builder";

export type SectionPreset = { key: string; label: string; hint: string; icon: string; make: (o?: Copy) => Section };

/** Words to put in a section, so templates can reuse the same layouts. */
export type Copy = {
  heading?: string;
  text?: string;
  button?: string;
  link?: string;
  image?: string;
  brand?: string;
  items?: PBlock["items"];
  plans?: PBlock["plans"];
  style?: Partial<SectionStyle>;
  anchor?: string;
  formId?: string;
  eyebrow?: string;
};

const eyebrow = (t: string | undefined, align: "left" | "center" = "center") =>
  t ? [block("text", { text: `**${t.toUpperCase()}**`, size: "s", align })] : [];

export const SECTION_PRESETS: SectionPreset[] = [
  {
    key: "header",
    label: "Header",
    hint: "Logo, menu and a button",
    icon: "list",
    make: (o = {}) => section("Header", [row(block("menu", { text: o.brand ?? "Your business", alt: o.button ?? "Book a call", link: o.link ?? "#contact" }))], { padding: "s", ...o.style }),
  },
  {
    key: "hero",
    label: "Hero, centred",
    hint: "Big headline, text and a button",
    icon: "edit",
    make: (o = {}) =>
      section(
        "Hero",
        [
          row([
            ...eyebrow(o.eyebrow),
            block("heading", { text: o.heading ?? "A clear promise that makes people stop scrolling", level: 1, size: "xl", align: "center" }),
            block("text", { text: o.text ?? "One or two lines on who this is for and what they get.", size: "l", align: "center" }),
            block("button", { text: o.button ?? "Get started", link: o.link ?? "#contact", align: "center", size: "l" }),
          ]),
        ],
        { padding: "xl", align: "center", width: "narrow", background: "linear-gradient(180deg,#ffffff 0%,#eef5ff 100%)", ...o.style },
      ),
  },
  {
    key: "hero-split",
    label: "Hero with image",
    hint: "Text on the left, a picture on the right",
    icon: "columns",
    make: (o = {}) => {
      const s = section(
        "Hero",
        [
          row(
            [
              ...eyebrow(o.eyebrow, "left"),
              block("heading", { text: o.heading ?? "A clear promise that makes people stop scrolling", level: 1, size: "xl" }),
              block("text", { text: o.text ?? "One or two lines on who this is for and what they get.", size: "l" }),
              block("list", { items: o.items ?? [{ text: "First reason to act now" }, { text: "Second reason to act now" }, { text: "Third reason to act now" }] }),
              block("button", { text: o.button ?? "Book a free call", link: o.link ?? "#contact", size: "l" }),
            ],
            [block("image", { src: o.image ?? "", alt: "", radius: 20 })],
          ),
        ],
        { padding: "xl", ...o.style },
      );
      s.rows[0].valign = "center";
      return s;
    },
  },
  {
    key: "hero-form",
    label: "Hero with form",
    hint: "Headline beside your form",
    icon: "form",
    make: (o = {}) => {
      const s = section(
        "Hero",
        [
          row(
            [
              ...eyebrow(o.eyebrow, "left"),
              block("heading", { text: o.heading ?? "Get your free guide", level: 1, size: "xl" }),
              block("text", { text: o.text ?? "Fill in the form and it lands in your inbox in seconds.", size: "l" }),
              block("list", { items: o.items ?? [{ text: "What you'll learn first" }, { text: "What you'll learn next" }, { text: "The one thing most people miss" }] }),
            ],
            [block("form", { formId: o.formId ?? "" })],
          ),
        ],
        { padding: "xl", background: "linear-gradient(135deg,#0b1b3a 0%,#1d4ed8 100%)", ...o.style },
        o.anchor ?? "contact",
      );
      s.rows[0].valign = "center";
      return s;
    },
  },
  {
    key: "logos",
    label: "Logos",
    hint: "As seen in, or client logos",
    icon: "star",
    make: (o = {}) => section("Logos", [row([block("text", { text: o.text ?? "Trusted by local businesses", size: "s", align: "center" }), block("logos", { items: o.items ?? [] })])], { padding: "m", background: "#f6f8fb", align: "center", ...o.style }),
  },
  {
    key: "features",
    label: "Features",
    hint: "Three things you offer, with icons",
    icon: "zap",
    make: (o = {}) =>
      section(
        "Features",
        [
          row([...eyebrow(o.eyebrow), block("heading", { text: o.heading ?? "Why people choose us", align: "center" }), block("text", { text: o.text ?? "A short line that backs up the heading.", align: "center" })]),
          row(block("features", o.items ? { items: o.items } : {})),
        ],
        { background: "#f6f8fb", ...o.style },
        o.anchor ?? "about",
      ),
  },
  {
    key: "benefits",
    label: "Image and benefits",
    hint: "A picture beside a tick list",
    icon: "check",
    make: (o = {}) => {
      const s = section(
        "Benefits",
        [
          row(
            [block("image", { src: o.image ?? "", radius: 20 })],
            [
              block("heading", { text: o.heading ?? "Everything you need, done for you" }),
              block("text", { text: o.text ?? "Explain the outcome in plain words." }),
              block("list", { items: o.items ?? [{ text: "A real benefit, not a feature" }, { text: "Another benefit people care about" }, { text: "Something that removes a worry" }] }),
              block("button", { text: o.button ?? "Get started", link: o.link ?? "#contact" }),
            ],
          ),
        ],
        { ...o.style },
      );
      s.rows[0].valign = "center";
      return s;
    },
  },
  {
    key: "stats",
    label: "Numbers",
    hint: "Big numbers that build trust",
    icon: "chart",
    make: (o = {}) => section("Numbers", [row(block("stats", o.items ? { items: o.items } : {}))], { padding: "m", background: "accent", ...o.style }),
  },
  {
    key: "video",
    label: "Video",
    hint: "A heading and a video",
    icon: "video",
    make: (o = {}) => section("Video", [row([block("heading", { text: o.heading ?? "See how it works", align: "center" }), block("video", { url: o.link ?? "" })])], { width: "narrow", align: "center", ...o.style }),
  },
  {
    key: "testimonials",
    label: "Testimonials",
    hint: "Three customer quotes",
    icon: "inbox",
    make: (o = {}) =>
      section("Testimonials", [row([...eyebrow(o.eyebrow), block("heading", { text: o.heading ?? "What our clients say", align: "center" })]), row(block("testimonials", o.items ? { items: o.items } : {}))], { ...o.style }, o.anchor ?? "reviews"),
  },
  {
    key: "pricing",
    label: "Pricing",
    hint: "Plans side by side",
    icon: "pound",
    make: (o = {}) =>
      section(
        "Pricing",
        [row([block("heading", { text: o.heading ?? "Simple pricing", align: "center" }), block("text", { text: o.text ?? "No contracts. Cancel any time.", align: "center" })]), row(block("pricing", o.plans ? { plans: o.plans } : {}))],
        { background: "#f6f8fb", ...o.style },
        o.anchor ?? "pricing",
      ),
  },
  {
    key: "faq",
    label: "FAQ",
    hint: "Questions people ask before buying",
    icon: "help",
    make: (o = {}) => section("FAQ", [row([block("heading", { text: o.heading ?? "Questions", align: "center" }), block("faq", o.items ? { items: o.items } : {})])], { width: "narrow", ...o.style }, o.anchor ?? "faq"),
  },
  {
    key: "countdown",
    label: "Offer countdown",
    hint: "A deadline that counts down",
    icon: "clock",
    make: (o = {}) =>
      section(
        "Offer",
        [row([block("heading", { text: o.heading ?? "This offer ends soon", align: "center" }), block("countdown", {}), block("button", { text: o.button ?? "Claim it now", link: o.link ?? "#contact", align: "center", size: "l" })])],
        { background: "#0b1b3a", align: "center", ...o.style },
      ),
  },
  {
    key: "form",
    label: "Form",
    hint: "A heading and one of your forms",
    icon: "form",
    make: (o = {}) =>
      section("Contact", [row([block("heading", { text: o.heading ?? "Book your free call", align: "center" }), block("text", { text: o.text ?? "Pick a time that suits you. It takes 30 seconds.", align: "center" }), block("form", { formId: o.formId ?? "" })])], { width: "narrow", background: "#f6f8fb", ...o.style }, o.anchor ?? "contact"),
  },
  {
    key: "cta",
    label: "Call to action",
    hint: "A bold band with one button",
    icon: "send",
    make: (o = {}) =>
      section(
        "Call to action",
        [row([block("heading", { text: o.heading ?? "Ready to get started?", align: "center" }), block("text", { text: o.text ?? "It takes two minutes and there's no obligation.", align: "center" }), block("button", { text: o.button ?? "Book a free call", link: o.link ?? "#contact", align: "center", style: "secondary", size: "l" })])],
        { background: "linear-gradient(135deg,#0b1b3a 0%,#1d4ed8 100%)", align: "center", ...o.style },
      ),
  },
  {
    key: "footer",
    label: "Footer",
    hint: "Small print and links",
    icon: "columns",
    make: (o = {}) => section("Footer", [row(block("footer", o.text ? { text: o.text } : {}))], { padding: "m", background: "#0b1b3a", ...o.style }),
  },
];

export const presetByKey = (k: string) => SECTION_PRESETS.find((p) => p.key === k);
