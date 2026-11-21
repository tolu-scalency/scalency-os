// Pages: what a landing page is made of. Shared by Page Studio (the builder) and
// the public page. Stored in site_pages.definition.
//
// A page is a stack of sections. Each section has its own background, spacing and
// width, and holds rows; each row has 1 to 4 columns; each column holds blocks.

export type PBlockKind =
  | "heading" | "text" | "image" | "video" | "button" | "form"
  | "list" | "features" | "testimonials" | "pricing" | "faq" | "countdown" | "logos" | "stats"
  | "menu" | "footer" | "divider" | "spacer" | "code";

export type Align = "left" | "center" | "right";
export type Item = { title?: string; text?: string; icon?: string; image?: string; name?: string; role?: string; link?: string; value?: string };
export type Plan = { name: string; price: string; period: string; features: string[]; button: string; link: string; highlight: boolean };
export type NavItem = { label: string; link: string };

export type PBlock = {
  id: string;
  kind: PBlockKind;
  text?: string;
  /** heading: 1 to 3. */
  level?: 1 | 2 | 3;
  size?: "s" | "m" | "l" | "xl";
  align?: Align;
  /** image, logo, menu logo. */
  src?: string;
  alt?: string;
  /** button, image, menu: where it goes. A web address, #section-name, or a phone (tel:) or email (mailto:). */
  link?: string;
  newTab?: boolean;
  style?: "primary" | "secondary" | "outline" | "text";
  full?: boolean;
  /** video: YouTube, Vimeo, Loom or a .mp4 address. */
  url?: string;
  /** form: which form. */
  formId?: string;
  /** spacer and code: height in pixels. */
  height?: number;
  /** image: rounded corners and width (%). */
  radius?: number;
  width?: number;
  items?: Item[];
  plans?: Plan[];
  nav?: NavItem[];
  /** list, features, testimonials, logos, stats: how many across on desktop. */
  cols?: 1 | 2 | 3 | 4;
  /** countdown: when it ends (ISO date and time). */
  until?: string;
  /** code: the HTML (shown in a sealed frame, so it can't touch the rest of the page). */
  html?: string;
  hideOn?: "mobile" | "desktop";
};

export type Column = { id: string; blocks: PBlock[] };
export type Row = { id: string; columns: Column[]; valign?: "top" | "center" };

export type SectionStyle = {
  background: string;
  image: string;
  /** How dark the overlay on a background image is, 0 to 80. */
  overlay: number;
  padding: "none" | "s" | "m" | "l" | "xl";
  width: "narrow" | "boxed" | "wide" | "full";
  text: "auto" | "light" | "dark";
  align: "left" | "center";
  hideOn?: "mobile" | "desktop";
};
export type Section = { id: string; name: string; anchor: string; rows: Row[]; style: SectionStyle };

export type PageTheme = {
  accent: string;
  text: string;
  background: string;
  font: "modern" | "classic" | "friendly" | "mono";
  headingFont: "same" | "modern" | "classic" | "friendly" | "bold";
  radius: number;
  buttonStyle: "solid" | "pill" | "outline";
  width: number;
};

export type PageDefinition = {
  version: 1;
  sections: Section[];
  theme: PageTheme;
  seo: { title: string; description: string; image: string; icon: string; noindex: boolean };
  tracking: { fbPixel: string; googleTag: string };
  meta?: { source?: "scratch" | "template" | "ai"; template?: string };
};

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export type BlockInfo = { kind: PBlockKind; label: string; group: "Basics" | "Media" | "Sections" | "Layout"; icon: string; hint: string };
export const BLOCK_KINDS: BlockInfo[] = [
  { kind: "heading", label: "Heading", group: "Basics", icon: "edit", hint: "A title or headline" },
  { kind: "text", label: "Text", group: "Basics", icon: "file", hint: "Paragraphs, with bold and links" },
  { kind: "button", label: "Button", group: "Basics", icon: "send", hint: "Links to a page, section, phone or email" },
  { kind: "list", label: "Tick list", group: "Basics", icon: "check", hint: "Benefits with ticks" },
  { kind: "form", label: "Form", group: "Basics", icon: "form", hint: "One of your forms" },
  { kind: "image", label: "Image", group: "Media", icon: "image", hint: "A picture, with an optional link" },
  { kind: "video", label: "Video", group: "Media", icon: "video", hint: "YouTube, Vimeo, Loom or a video file" },
  { kind: "logos", label: "Logos", group: "Media", icon: "star", hint: "\"As seen in\" or client logos" },
  { kind: "features", label: "Features", group: "Sections", icon: "zap", hint: "Icons with a title and text" },
  { kind: "testimonials", label: "Testimonials", group: "Sections", icon: "inbox", hint: "Quotes from happy customers" },
  { kind: "pricing", label: "Pricing", group: "Sections", icon: "pound", hint: "Plans side by side" },
  { kind: "faq", label: "FAQ", group: "Sections", icon: "help", hint: "Questions that open on click" },
  { kind: "stats", label: "Numbers", group: "Sections", icon: "chart", hint: "Big numbers with labels" },
  { kind: "countdown", label: "Countdown", group: "Sections", icon: "clock", hint: "Counts down to a date" },
  { kind: "menu", label: "Header menu", group: "Layout", icon: "list", hint: "Logo, links and a button" },
  { kind: "footer", label: "Footer", group: "Layout", icon: "columns", hint: "Small print and links" },
  { kind: "divider", label: "Divider", group: "Layout", icon: "minus", hint: "A thin line" },
  { kind: "spacer", label: "Spacer", group: "Layout", icon: "columns", hint: "Empty space" },
  { kind: "code", label: "Custom code", group: "Layout", icon: "code", hint: "HTML in a sealed box" },
];
export const blockInfo = (k: PBlockKind) => BLOCK_KINDS.find((b) => b.kind === k) ?? BLOCK_KINDS[0];

export const FEATURE_ICONS = ["zap", "check", "star", "clock", "phone", "mail", "calendar", "users", "shield", "heart", "chart", "pound", "home", "globe", "spark", "thumbsUp"] as const;

export const FONTS: Record<PageTheme["font"] | "bold", string> = {
  modern: "var(--font-geist-sans), 'Segoe UI', system-ui, -apple-system, sans-serif",
  classic: "Georgia, 'Times New Roman', serif",
  friendly: "'Nunito', 'Trebuchet MS', 'Segoe UI', sans-serif",
  mono: "var(--font-geist-mono), 'SFMono-Regular', Menlo, monospace",
  bold: "'Montserrat', 'Arial Black', 'Segoe UI', sans-serif",
};

export const BACKGROUNDS = [
  { key: "#ffffff", label: "White" },
  { key: "#f6f8fb", label: "Mist" },
  { key: "#fff8ef", label: "Cream" },
  { key: "#eef5ff", label: "Sky" },
  { key: "#0b1b3a", label: "Navy" },
  { key: "#111111", label: "Black" },
  { key: "accent", label: "Brand colour" },
  { key: "linear-gradient(135deg,#0b1b3a 0%,#1d4ed8 100%)", label: "Deep blue" },
  { key: "linear-gradient(135deg,#7c3aed 0%,#db2777 100%)", label: "Sunset" },
  { key: "linear-gradient(135deg,#0f766e 0%,#22c55e 100%)", label: "Fresh" },
  { key: "linear-gradient(180deg,#ffffff 0%,#eef5ff 100%)", label: "Soft fade" },
] as const;

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const DEFAULT_THEME: PageTheme = {
  accent: "#2563eb",
  text: "#0f172a",
  background: "#ffffff",
  font: "modern",
  headingFont: "same",
  radius: 12,
  buttonStyle: "solid",
  width: 1120,
};

export const DEFAULT_STYLE: SectionStyle = { background: "#ffffff", image: "", overlay: 40, padding: "l", width: "boxed", text: "auto", align: "left" };

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

export function block(kind: PBlockKind, patch: Partial<PBlock> = {}): PBlock {
  const base: PBlock = { id: uid(), kind };
  switch (kind) {
    case "heading":
      return { ...base, text: "Your headline goes here", level: 2, size: "l", ...patch };
    case "text":
      return { ...base, text: "Say what you do, who it's for and why it's worth their time. Keep it short and clear.", ...patch };
    case "button":
      return { ...base, text: "Get started", link: "#", style: "primary", size: "m", ...patch };
    case "image":
      return { ...base, src: "", alt: "", radius: 12, width: 100, ...patch };
    case "video":
      return { ...base, url: "", ...patch };
    case "form":
      return { ...base, formId: "", ...patch };
    case "list":
      return { ...base, items: [{ text: "First benefit" }, { text: "Second benefit" }, { text: "Third benefit" }], cols: 1, ...patch };
    case "features":
      return {
        ...base,
        cols: 3,
        items: [
          { icon: "zap", title: "Fast", text: "Explain the first thing people get." },
          { icon: "shield", title: "Safe", text: "Explain the second thing people get." },
          { icon: "heart", title: "Friendly", text: "Explain the third thing people get." },
        ],
        ...patch,
      };
    case "testimonials":
      return {
        ...base,
        cols: 3,
        items: [
          { text: "They made the whole thing easy. Highly recommended.", name: "Sarah J.", role: "Manchester" },
          { text: "Quick, professional and great value.", name: "Mark T.", role: "Liverpool" },
          { text: "We booked more in a month than the whole last quarter.", name: "Priya K.", role: "Leeds" },
        ],
        ...patch,
      };
    case "pricing":
      return {
        ...base,
        plans: [
          { name: "Starter", price: "£99", period: "per month", features: ["One thing", "Another thing"], button: "Choose Starter", link: "#", highlight: false },
          { name: "Growth", price: "£199", period: "per month", features: ["Everything in Starter", "More things", "Priority support"], button: "Choose Growth", link: "#", highlight: true },
          { name: "Pro", price: "£399", period: "per month", features: ["Everything in Growth", "Even more"], button: "Choose Pro", link: "#", highlight: false },
        ],
        ...patch,
      };
    case "faq":
      return {
        ...base,
        items: [
          { title: "How long does it take?", text: "Most people are set up within a week." },
          { title: "Is there a contract?", text: "No. You can stop at any time." },
          { title: "What do I need to get started?", text: "Just book a call and we'll do the rest." },
        ],
        ...patch,
      };
    case "stats":
      return { ...base, cols: 3, items: [{ value: "500+", text: "Happy clients" }, { value: "4.9★", text: "Average rating" }, { value: "24h", text: "Response time" }], ...patch };
    case "countdown":
      return { ...base, until: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 16), text: "This offer has ended.", ...patch };
    case "logos":
      return { ...base, cols: 4, items: [], ...patch };
    case "menu":
      return { ...base, text: "Your business", src: "", nav: [{ label: "About", link: "#about" }, { label: "Prices", link: "#pricing" }, { label: "FAQ", link: "#faq" }], link: "#contact", alt: "Book a call", ...patch };
    case "footer":
      return { ...base, text: `© ${new Date().getFullYear()} Your business. All rights reserved.`, nav: [{ label: "Privacy", link: "#" }, { label: "Contact", link: "#contact" }], ...patch };
    case "divider":
      return { ...base, ...patch };
    case "spacer":
      return { ...base, height: 40, ...patch };
    case "code":
      return { ...base, html: "", height: 200, ...patch };
  }
}

export function row(...blocks: (PBlock | PBlock[])[]): Row {
  return { id: uid(), columns: blocks.map((b) => ({ id: uid(), blocks: Array.isArray(b) ? b : [b] })) };
}

export function section(name: string, rows: Row[], style: Partial<SectionStyle> = {}, anchor = ""): Section {
  return { id: uid(), name, anchor, rows, style: { ...DEFAULT_STYLE, ...style } };
}

export function blankPage(): PageDefinition {
  return {
    version: 1,
    sections: [
      section("Hero", [row([block("heading", { text: "Your headline goes here", level: 1, size: "xl", align: "center" }), block("text", { align: "center" }), block("button", { align: "center" })])], { padding: "xl", align: "center" }),
    ],
    theme: { ...DEFAULT_THEME },
    seo: { title: "", description: "", image: "", icon: "", noindex: false },
    tracking: { fbPixel: "", googleTag: "" },
    meta: { source: "scratch" },
  };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export function allBlocks(d: PageDefinition) {
  return d.sections.flatMap((s) => s.rows.flatMap((r) => r.columns.flatMap((c) => c.blocks)));
}

export function slugify(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

/** A section's text colour, worked out from its background when set to "auto". */
export function textTone(s: SectionStyle, theme: PageTheme): "light" | "dark" {
  if (s.text !== "auto") return s.text;
  if (s.image) return "light";
  const bg = s.background === "accent" ? theme.accent : s.background;
  if (bg.startsWith("linear-gradient")) {
    const first = bg.match(/#([0-9a-f]{6})/i)?.[1];
    return first && lum(first) < 0.5 ? "light" : "dark";
  }
  const hex = bg.match(/^#([0-9a-f]{6})$/i)?.[1];
  return hex && lum(hex) < 0.5 ? "light" : "dark";
}
function lum(hex: string) {
  const n = parseInt(hex, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/** Turns a YouTube, Vimeo or Loom address into something that can be embedded. */
export function videoEmbed(url: string): { kind: "iframe" | "file"; src: string } | null {
  const u = url.trim();
  if (!u) return null;
  let m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
  if (m) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0` };
  m = u.match(/vimeo\.com\/(?:video\/)?(\d{5,})/i);
  if (m) return { kind: "iframe", src: `https://player.vimeo.com/video/${m[1]}` };
  m = u.match(/loom\.com\/(?:share|embed)\/([a-f0-9]{16,})/i);
  if (m) return { kind: "iframe", src: `https://www.loom.com/embed/${m[1]}` };
  if (/^https:\/\/[^\s"'<>]+\.(mp4|webm)(\?[^\s"'<>]*)?$/i.test(u)) return { kind: "file", src: u };
  return null;
}

/** Links people can put on buttons and images: web addresses, #sections, phone and email. */
export function safeLink(v: unknown): string {
  const s = String(v ?? "").trim().slice(0, 500);
  if (!s || s === "#") return "#";
  if (/^#[a-z0-9-]{1,60}$/i.test(s)) return s.toLowerCase();
  if (/^(https?:\/\/)[^\s"'<>]+$/i.test(s)) return s;
  if (/^\/[^\s"'<>]*$/.test(s) && !s.startsWith("//")) return s;
  if (/^tel:\+?[0-9 ()-]{3,20}$/i.test(s)) return s.replace(/\s/g, "");
  if (/^mailto:[^\s"'<>@]+@[^\s"'<>]+$/i.test(s)) return s;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/[^\s"'<>]*)?$/i.test(s)) return `https://${s}`;
  return "#";
}

const safeImage = (v: unknown) => {
  const s = String(v ?? "").trim();
  return /^https:\/\/[^\s"'<>()]+$/i.test(s) ? s.slice(0, 1000) : "";
};
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};
const hex = (v: unknown, fallback: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback);
const id = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{4,24}$/i.test(v) ? v : uid());

function cleanBackground(v: unknown) {
  if (typeof v !== "string") return "#ffffff";
  if (v === "accent" || /^#[0-9a-f]{6}$/i.test(v)) return v;
  if (/^linear-gradient\(\d{1,3}deg,#[0-9a-f]{6} \d{1,3}%,#[0-9a-f]{6} \d{1,3}%\)$/i.test(v)) return v;
  return BACKGROUNDS.some((b) => b.key === v) ? v : "#ffffff";
}

function cleanItems(v: unknown, max = 24): Item[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, max).map((x) => {
    const o = (x ?? {}) as Record<string, unknown>;
    const it: Item = {};
    if (o.title) it.title = str(o.title, 200);
    if (o.text) it.text = str(o.text, 1200);
    if (o.icon) it.icon = (FEATURE_ICONS as readonly string[]).includes(String(o.icon)) ? String(o.icon) : "check";
    if (o.image) it.image = safeImage(o.image);
    if (o.name) it.name = str(o.name, 120);
    if (o.role) it.role = str(o.role, 120);
    if (o.value) it.value = str(o.value, 40);
    if (o.link) it.link = safeLink(o.link);
    return it;
  });
}

const KINDS = BLOCK_KINDS.map((b) => b.kind);

export function cleanBlock(v: unknown): PBlock | null {
  const o = (v ?? {}) as Record<string, unknown>;
  const kind = o.kind as PBlockKind;
  if (!KINDS.includes(kind)) return null;
  const b: PBlock = { id: id(o.id), kind };
  if (o.text != null) b.text = str(o.text, kind === "text" ? 6000 : 600);
  if (kind === "heading") b.level = oneOf(o.level as never, [1, 2, 3] as never[], 2 as never);
  if (o.size) b.size = oneOf(o.size, ["s", "m", "l", "xl"] as const, "m");
  if (o.align) b.align = oneOf(o.align, ["left", "center", "right"] as const, "left");
  if (o.src) b.src = safeImage(o.src);
  if (o.alt != null) b.alt = str(o.alt, 200);
  if (o.link != null) b.link = safeLink(o.link);
  if (o.newTab) b.newTab = true;
  if (o.style) b.style = oneOf(o.style, ["primary", "secondary", "outline", "text"] as const, "primary");
  if (o.full) b.full = true;
  if (o.url != null) b.url = str(o.url, 500);
  if (o.formId != null) b.formId = /^[0-9a-f-]{36}$/i.test(String(o.formId)) ? String(o.formId) : "";
  if (o.height != null) b.height = num(o.height, 8, kind === "code" ? 2000 : 400, 40);
  if (o.radius != null) b.radius = num(o.radius, 0, 48, 12);
  if (o.width != null) b.width = num(o.width, 20, 100, 100);
  if (o.items) b.items = cleanItems(o.items);
  if (Array.isArray(o.plans))
    b.plans = (o.plans as Record<string, unknown>[]).slice(0, 4).map((p) => ({
      name: str(p?.name, 60),
      price: str(p?.price, 30),
      period: str(p?.period, 40),
      features: (Array.isArray(p?.features) ? (p.features as unknown[]) : []).slice(0, 12).map((f) => str(f, 160)),
      button: str(p?.button, 40),
      link: safeLink(p?.link),
      highlight: Boolean(p?.highlight),
    }));
  if (Array.isArray(o.nav)) b.nav = (o.nav as Record<string, unknown>[]).slice(0, 8).map((n) => ({ label: str(n?.label, 40), link: safeLink(n?.link) }));
  if (o.cols != null) b.cols = oneOf(Number(o.cols) as never, [1, 2, 3, 4] as never[], 3 as never);
  if (o.until != null) b.until = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(o.until)) ? String(o.until).slice(0, 16) : "";
  if (o.html != null) b.html = str(o.html, 20_000);
  if (o.hideOn) b.hideOn = oneOf(o.hideOn, ["mobile", "desktop"] as const, "mobile");
  return b;
}

/** Checks everything a page can contain, with limits, so nothing unexpected is saved or shown. */
export function cleanPage(v: unknown): PageDefinition {
  const o = (v ?? {}) as Record<string, unknown>;
  const base = blankPage();
  const t = (o.theme ?? {}) as Record<string, unknown>;
  const seo = (o.seo ?? {}) as Record<string, unknown>;
  const tr = (o.tracking ?? {}) as Record<string, unknown>;
  let blocks = 0;
  const sections: Section[] = (Array.isArray(o.sections) ? o.sections : []).slice(0, 40).map((sv: Record<string, unknown>) => {
    const st = (sv?.style ?? {}) as Record<string, unknown>;
    return {
      id: id(sv?.id),
      name: str(sv?.name, 60) || "Section",
      anchor: slugify(str(sv?.anchor, 60)),
      style: {
        background: cleanBackground(st.background),
        image: safeImage(st.image),
        overlay: num(st.overlay, 0, 80, 40),
        padding: oneOf(st.padding, ["none", "s", "m", "l", "xl"] as const, "l"),
        width: oneOf(st.width, ["narrow", "boxed", "wide", "full"] as const, "boxed"),
        text: oneOf(st.text, ["auto", "light", "dark"] as const, "auto"),
        align: oneOf(st.align, ["left", "center"] as const, "left"),
        ...(st.hideOn ? { hideOn: oneOf(st.hideOn, ["mobile", "desktop"] as const, "mobile") } : {}),
      },
      rows: (Array.isArray(sv?.rows) ? (sv.rows as Record<string, unknown>[]) : []).slice(0, 12).map((rv) => ({
        id: id(rv?.id),
        ...(rv?.valign === "center" ? { valign: "center" as const } : {}),
        columns: (Array.isArray(rv?.columns) ? (rv.columns as Record<string, unknown>[]) : []).slice(0, 4).map((cv) => ({
          id: id(cv?.id),
          blocks: (Array.isArray(cv?.blocks) ? (cv.blocks as unknown[]) : [])
            .slice(0, 30)
            .map(cleanBlock)
            .filter((b): b is PBlock => Boolean(b) && blocks++ < 400),
        })),
      })).filter((r) => r.columns.length),
    };
  });
  return {
    version: 1,
    sections,
    theme: {
      accent: hex(t.accent, base.theme.accent),
      text: hex(t.text, base.theme.text),
      background: hex(t.background, base.theme.background),
      font: oneOf(t.font, ["modern", "classic", "friendly", "mono"] as const, "modern"),
      headingFont: oneOf(t.headingFont, ["same", "modern", "classic", "friendly", "bold"] as const, "same"),
      radius: num(t.radius, 0, 32, 12),
      buttonStyle: oneOf(t.buttonStyle, ["solid", "pill", "outline"] as const, "solid"),
      width: num(t.width, 720, 1440, 1120),
    },
    seo: {
      title: str(seo.title, 120),
      description: str(seo.description, 300),
      image: safeImage(seo.image),
      icon: safeImage(seo.icon),
      noindex: Boolean(seo.noindex),
    },
    tracking: {
      fbPixel: /^\d{6,20}$/.test(String(tr.fbPixel ?? "")) ? String(tr.fbPixel) : "",
      googleTag: /^(G|AW|GT|UA)-[A-Z0-9-]{4,20}$/i.test(String(tr.googleTag ?? "")) ? String(tr.googleTag).toUpperCase() : "",
    },
    ...(o.meta ? { meta: { source: oneOf((o.meta as Record<string, unknown>).source, ["scratch", "template", "ai"] as const, "scratch"), template: str((o.meta as Record<string, unknown>).template, 40) || undefined } } : {}),
  };
}
