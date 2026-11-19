// Forms (version 2): what a form is made of. Shared by Form Studio (the builder),
// the public form and the submission API. Stored in forms.definition.
//
// A form has steps (one step = a normal form, more = a multi-step form). Each step
// has rows; each row has 1 to 4 columns; each column holds blocks. A block is either
// a field (a question) or content (heading, text, image, divider, spacer). Any block
// can be shown only when an earlier answer matches ("logic"). Choice answers can
// carry points, and the total can sort people into qualified or not.

export type FieldKind =
  | "first_name" | "last_name" | "full_name" | "email" | "phone"
  | "company" | "website"
  | "custom"
  | "text" | "textarea" | "number" | "date"
  | "select" | "radio" | "checkboxes" | "yes_no" | "rating" | "checkbox"
  | "hidden";
export type ContentKind = "heading" | "paragraph" | "image" | "divider" | "spacer";
export type LogicOp = "is" | "is_not" | "contains" | "answered" | "empty";
export type Logic = { field: string; op: LogicOp; value?: string };

export type FieldBlock = {
  id: string;
  type: "field";
  kind: FieldKind;
  label: string;
  placeholder?: string;
  help?: string;
  required: boolean;
  /** "custom": the contact field it saves to. "hidden": the web address parameter it reads. */
  key?: string;
  options?: string[];
  /** Points for each option (same order as options), for qualifying. */
  scores?: number[];
  logic?: Logic;
};
export type ContentBlock = {
  id: string;
  type: "content";
  kind: ContentKind;
  text?: string;
  level?: 1 | 2 | 3;
  src?: string;
  alt?: string;
  height?: number;
  align?: "left" | "center";
  logic?: Logic;
};
export type Block = FieldBlock | ContentBlock;
export type Column = { id: string; blocks: Block[] };
export type Row = { id: string; columns: Column[] };
export type Step = { id: string; title: string; rows: Row[] };

export type Outcome = { message: string; redirect: string; tag: string };
export type Theme = {
  accent: string;
  dark: boolean;
  background: string;
  card: boolean;
  font: "modern" | "classic" | "friendly" | "mono";
  radius: number;
  fieldStyle: "outlined" | "filled" | "underline";
  buttonStyle: "solid" | "outline" | "pill";
  buttonAlign: "full" | "left" | "center";
  width: number;
};

export type FormDefinition = {
  version: 2;
  steps: Step[];
  button: string;
  next: string;
  back: string;
  success: string;
  progress: "bar" | "steps" | "none";
  /** Save people who stop part way (once they've given an email or phone). */
  saveProgress: boolean;
  consent: { enabled: boolean; text: string; required: boolean };
  qualify: { enabled: boolean; min: number; qualified: Outcome; unqualified: Outcome };
  theme: Theme;
  meta?: { source?: "scratch" | "template" | "ai"; template?: string };
};

// ---------------------------------------------------------------------------
// Catalogue of what can go on a form.
// ---------------------------------------------------------------------------

export type KindInfo = { kind: FieldKind; label: string; group: "Contact" | "Questions" | "Advanced"; icon: string; once?: boolean; choices?: boolean };
export const FIELD_KINDS: KindInfo[] = [
  { kind: "first_name", label: "First name", group: "Contact", icon: "user", once: true },
  { kind: "last_name", label: "Last name", group: "Contact", icon: "user", once: true },
  { kind: "full_name", label: "Full name", group: "Contact", icon: "user", once: true },
  { kind: "email", label: "Email", group: "Contact", icon: "mail", once: true },
  { kind: "phone", label: "Phone", group: "Contact", icon: "phone", once: true },
  { kind: "company", label: "Company", group: "Contact", icon: "building", once: true },
  { kind: "website", label: "Website", group: "Contact", icon: "globe", once: true },
  { kind: "text", label: "Short answer", group: "Questions", icon: "edit" },
  { kind: "textarea", label: "Long answer", group: "Questions", icon: "file" },
  { kind: "number", label: "Number", group: "Questions", icon: "hash" },
  { kind: "date", label: "Date", group: "Questions", icon: "calendar" },
  { kind: "select", label: "Dropdown", group: "Questions", icon: "down", choices: true },
  { kind: "radio", label: "Multiple choice", group: "Questions", icon: "list", choices: true },
  { kind: "checkboxes", label: "Tick all that apply", group: "Questions", icon: "check", choices: true },
  { kind: "yes_no", label: "Yes or no", group: "Questions", icon: "thumbsUp", choices: true },
  { kind: "rating", label: "Rating", group: "Questions", icon: "star" },
  { kind: "checkbox", label: "Single tick box", group: "Questions", icon: "check" },
  { kind: "hidden", label: "Hidden value", group: "Advanced", icon: "eyeOff" },
];
export const CONTENT_KINDS: { kind: ContentKind; label: string; icon: string }[] = [
  { kind: "heading", label: "Heading", icon: "edit" },
  { kind: "paragraph", label: "Text", icon: "file" },
  { kind: "image", label: "Image", icon: "eye" },
  { kind: "divider", label: "Divider", icon: "list" },
  { kind: "spacer", label: "Spacer", icon: "columns" },
];
export const kindInfo = (k: string) => FIELD_KINDS.find((x) => x.kind === k);

export const FONTS: Record<Theme["font"], { label: string; stack: string }> = {
  modern: { label: "Modern", stack: "var(--font-sans, Inter, system-ui, sans-serif)" },
  classic: { label: "Classic", stack: "Georgia, 'Times New Roman', serif" },
  friendly: { label: "Friendly", stack: "ui-rounded, 'SF Pro Rounded', 'Nunito', system-ui, sans-serif" },
  mono: { label: "Technical", stack: "ui-monospace, 'SF Mono', Menlo, monospace" },
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export const DEFAULT_THEME: Theme = {
  accent: "#0a5fe3",
  dark: false,
  background: "#f3f6fb",
  card: true,
  font: "modern",
  radius: 12,
  fieldStyle: "outlined",
  buttonStyle: "solid",
  buttonAlign: "full",
  width: 560,
};

// ---------------------------------------------------------------------------
// Builders, used by templates, the AI and the builder.
// ---------------------------------------------------------------------------

export function field(kind: FieldKind, label?: string, extra: Partial<FieldBlock> = {}): FieldBlock {
  const info = kindInfo(kind);
  const options =
    kind === "yes_no" ? ["Yes", "No"] : info?.choices ? ["Option 1", "Option 2", "Option 3"] : undefined;
  return { id: uid(), type: "field", kind, label: label ?? info?.label ?? "Question", required: kind === "email", ...(options ? { options } : {}), ...extra };
}
export function content(kind: ContentKind, extra: Partial<ContentBlock> = {}): ContentBlock {
  const base: Partial<ContentBlock> =
    kind === "heading" ? { text: "Heading", level: 1 } : kind === "paragraph" ? { text: "Add some text here." } : kind === "spacer" ? { height: 24 } : kind === "image" ? { src: "", alt: "" } : {};
  return { id: uid(), type: "content", kind, ...base, ...extra } as ContentBlock;
}
/** A row from blocks: one column per argument (an array = several blocks in that column). */
export function row(...cols: (Block | Block[])[]): Row {
  return { id: uid(), columns: cols.map((c) => ({ id: uid(), blocks: Array.isArray(c) ? c : [c] })) };
}
export function step(title: string, ...rows: Row[]): Step {
  return { id: uid(), title, rows };
}

export function blankDefinition(): FormDefinition {
  return {
    version: 2,
    steps: [
      step(
        "Your details",
        row(content("heading", { text: "Get in touch" })),
        row(content("paragraph", { text: "Leave your details and we'll be in touch shortly." })),
        row(field("first_name", undefined, { required: true }), field("last_name")),
        row(field("email")),
        row(field("phone")),
      ),
    ],
    button: "Send",
    next: "Next",
    back: "Back",
    success: "Thanks, we've got your details and will be in touch soon.",
    progress: "bar",
    saveProgress: true,
    consent: { enabled: true, text: "I agree to be contacted by email and text about my enquiry.", required: false },
    qualify: {
      enabled: false,
      min: 5,
      qualified: { message: "Great news, you're a good fit. Pick a time on the next page.", redirect: "", tag: "Qualified" },
      unqualified: { message: "Thanks for your answers. We'll be in touch if we can help.", redirect: "", tag: "Not a fit" },
    },
    theme: { ...DEFAULT_THEME },
    meta: { source: "scratch" },
  };
}

// ---------------------------------------------------------------------------
// Reading a form.
// ---------------------------------------------------------------------------

export function allBlocks(def: FormDefinition): Block[] {
  return def.steps.flatMap((s) => s.rows.flatMap((r) => r.columns.flatMap((c) => c.blocks)));
}
export function allFields(def: FormDefinition): FieldBlock[] {
  return allBlocks(def).filter((b): b is FieldBlock => b.type === "field");
}
export function stepFields(st: Step): FieldBlock[] {
  return st.rows.flatMap((r) => r.columns.flatMap((c) => c.blocks)).filter((b): b is FieldBlock => b.type === "field");
}

export type Answers = Record<string, string | string[] | boolean>;

export function answerText(v: Answers[string] | undefined): string {
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "";
  return (v ?? "").toString();
}

/** Whether a block shows, given the answers so far. Blocks without logic always show. */
export function isVisible(b: Block, answers: Answers, def?: FormDefinition): boolean {
  if (!b.logic?.field) return true;
  // A rule pointing at a question that is itself hidden counts as unanswered.
  if (def) {
    const target = allFields(def).find((f) => f.id === b.logic!.field);
    if (target && target.id !== b.id && !isVisible(target, answers)) return b.logic.op === "empty";
  }
  const v = answers[b.logic.field];
  const list = Array.isArray(v) ? v.map((x) => x.toLowerCase()) : [answerText(v).toLowerCase()];
  const want = (b.logic.value ?? "").toLowerCase();
  const answered = list.some((x) => x.trim() !== "");
  switch (b.logic.op) {
    case "answered":
      return answered;
    case "empty":
      return !answered;
    case "is_not":
      return !list.includes(want);
    case "contains":
      return list.some((x) => x.includes(want));
    default:
      return list.includes(want);
  }
}

/** Points from choice answers. */
export function scoreOf(def: FormDefinition, answers: Answers): number {
  let total = 0;
  for (const f of allFields(def)) {
    if (!f.scores?.length || !f.options?.length || !isVisible(f, answers, def)) continue;
    const v = answers[f.id];
    const picked = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
    for (const p of picked) {
      const i = f.options.indexOf(p);
      if (i >= 0) total += Number(f.scores[i]) || 0;
    }
  }
  return total;
}

/** A form can only be published with a way to reach the person. */
export function publishProblem(def: FormDefinition): string | null {
  const fields = allFields(def);
  if (!fields.some((f) => f.kind === "email" || f.kind === "phone")) return "Add an Email or Phone field, so each submission can become a contact.";
  if (fields.some((f) => kindInfo(f.kind)?.choices && !(f.options ?? []).length)) return "Give every choice question at least one option.";
  if (fields.some((f) => f.kind === "custom" && !f.key)) return "Choose which contact field each “Contact field” question saves to.";
  return null;
}

// ---------------------------------------------------------------------------
// Cleaning: keeps any definition safe and complete, and upgrades version 1.
// ---------------------------------------------------------------------------

const str = (v: unknown, max: number, fallback = "") => (typeof v === "string" ? v.slice(0, max) : fallback);
const KIND_SET = new Set(FIELD_KINDS.map((k) => k.kind));
const CONTENT_SET = new Set(CONTENT_KINDS.map((k) => k.kind));
const OPS = new Set(["is", "is_not", "contains", "answered", "empty"]);

/** Version 1 (a flat list of fields) becomes one step of rows. */
function upgradeV1(d: Record<string, unknown>): Record<string, unknown> {
  const rows: Row[] = [];
  if (typeof d.title === "string" && d.title.trim()) rows.push(row(content("heading", { text: d.title })));
  if (typeof d.intro === "string" && d.intro.trim()) rows.push(row(content("paragraph", { text: d.intro })));
  const fields = (Array.isArray(d.fields) ? d.fields : []) as Record<string, unknown>[];
  let pending: Block | null = null;
  for (const f of fields) {
    const b = { ...f, type: "field", options: f.options } as unknown as FieldBlock;
    if (f.half) {
      if (pending) {
        rows.push(row(pending, b));
        pending = null;
      } else pending = b;
    } else {
      if (pending) {
        rows.push(row(pending));
        pending = null;
      }
      rows.push(row(b));
    }
  }
  if (pending) rows.push(row(pending));
  const t = (d.theme ?? {}) as Record<string, unknown>;
  return {
    ...d,
    version: 2,
    steps: [{ id: uid(), title: "Step 1", rows }],
    theme: { ...DEFAULT_THEME, accent: t.accent, dark: t.dark, radius: t.rounded === false ? 4 : 12, background: t.dark ? "#0b1220" : DEFAULT_THEME.background },
  };
}

function cleanLogic(raw: unknown): Logic | undefined {
  const l = (raw ?? {}) as Record<string, unknown>;
  const fieldId = str(l.field, 16).replace(/[^a-z0-9]/gi, "");
  if (!fieldId || !OPS.has(String(l.op))) return undefined;
  return { field: fieldId, op: String(l.op) as LogicOp, ...(typeof l.value === "string" ? { value: l.value.slice(0, 120) } : {}) };
}

function cleanBlock(raw: unknown, seen: Set<string>, once: Set<string>): Block | null {
  const b = (raw ?? {}) as Record<string, unknown>;
  let id = str(b.id, 16).replace(/[^a-z0-9]/gi, "");
  if (!id || seen.has(id)) id = uid();
  seen.add(id);
  const logic = cleanLogic(b.logic);
  if (b.type === "content") {
    const kind = String(b.kind) as ContentKind;
    if (!CONTENT_SET.has(kind)) return null;
    const out: ContentBlock = { id, type: "content", kind };
    if (kind === "heading" || kind === "paragraph") out.text = str(b.text, kind === "heading" ? 200 : 2000);
    if (kind === "heading") out.level = b.level === 2 || b.level === 3 ? b.level : 1;
    if (kind === "image") {
      const src = str(b.src, 1000).trim();
      out.src = /^https:\/\//.test(src) ? src : "";
      out.alt = str(b.alt, 200);
    }
    if (kind === "spacer") out.height = Math.min(160, Math.max(8, Number(b.height) || 24));
    if (b.align === "center") out.align = "center";
    if (logic) out.logic = logic;
    return out;
  }
  const kind = String(b.kind) as FieldKind;
  if (!KIND_SET.has(kind)) return null;
  const info = kindInfo(kind)!;
  if (info.once) {
    if (once.has(kind)) return null;
    once.add(kind);
  }
  const out: FieldBlock = { id, type: "field", kind, label: str(b.label, 200).trim() || info.label, required: kind !== "hidden" && Boolean(b.required) };
  const ph = str(b.placeholder, 120).trim();
  if (ph) out.placeholder = ph;
  const help = str(b.help, 300).trim();
  if (help) out.help = help;
  if (kind === "custom" || kind === "hidden") {
    const key = str(b.key, 60).replace(kind === "hidden" ? /[^a-zA-Z0-9_.-]/g : /[^a-z0-9_]/g, "");
    if (key) out.key = key;
  }
  if (info.choices) {
    const opts = (Array.isArray(b.options) ? b.options : []).map((o) => str(o, 120).trim()).filter(Boolean);
    out.options = [...new Set(opts)].slice(0, 40);
    if (kind === "yes_no" && !out.options.length) out.options = ["Yes", "No"];
    if (Array.isArray(b.scores) && b.scores.some((x) => Number(x))) out.scores = out.options.map((_, i) => Math.max(-100, Math.min(100, Math.round(Number((b.scores as unknown[])[i]) || 0))));
  }
  if (logic) out.logic = logic;
  return out;
}

const hex = (v: unknown, fallback: string) => (/^#[0-9a-f]{6}$/i.test(String(v)) ? String(v) : fallback);
function cleanOutcome(raw: unknown, fallback: Outcome): Outcome {
  const o = (raw ?? {}) as Record<string, unknown>;
  const redirect = str(o.redirect, 500).trim();
  return { message: str(o.message, 400).trim() || fallback.message, redirect: /^https:\/\/\S+\.\S+$/.test(redirect) ? redirect : "", tag: str(o.tag, 40).trim() };
}

export function cleanDefinition(raw: unknown): FormDefinition {
  let d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (d.version !== 2 && Array.isArray(d.fields)) d = upgradeV1(d);
  const base = blankDefinition();
  const seen = new Set<string>();
  const once = new Set<string>();
  let total = 0;
  const steps: Step[] = [];
  for (const s0 of (Array.isArray(d.steps) ? d.steps : []).slice(0, 10)) {
    const s = (s0 ?? {}) as Record<string, unknown>;
    const rows: Row[] = [];
    for (const r0 of (Array.isArray(s.rows) ? s.rows : []).slice(0, 40)) {
      const r = (r0 ?? {}) as Record<string, unknown>;
      const columns: Column[] = [];
      for (const c0 of (Array.isArray(r.columns) ? r.columns : []).slice(0, 4)) {
        const c = (c0 ?? {}) as Record<string, unknown>;
        const blocks: Block[] = [];
        for (const b0 of (Array.isArray(c.blocks) ? c.blocks : []).slice(0, 20)) {
          if (total >= 80) break;
          const b = cleanBlock(b0, seen, once);
          if (b) {
            blocks.push(b);
            total++;
          }
        }
        columns.push({ id: str(c.id, 16).replace(/[^a-z0-9]/gi, "") || uid(), blocks });
      }
      if (columns.length && columns.some((c) => c.blocks.length)) rows.push({ id: str(r.id, 16).replace(/[^a-z0-9]/gi, "") || uid(), columns });
    }
    steps.push({ id: str(s.id, 16).replace(/[^a-z0-9]/gi, "") || uid(), title: str(s.title, 80).trim() || `Step ${steps.length + 1}`, rows });
  }
  if (!steps.length) steps.push(step("Step 1"));

  const c = (d.consent ?? {}) as Record<string, unknown>;
  const q = (d.qualify ?? {}) as Record<string, unknown>;
  const t = (d.theme ?? {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, allowed: readonly T[], fb: T): T => (allowed.includes(v as T) ? (v as T) : fb);
  const meta = (d.meta ?? {}) as Record<string, unknown>;
  return {
    version: 2,
    steps,
    button: str(d.button, 40).trim() || base.button,
    next: str(d.next, 40).trim() || base.next,
    back: str(d.back, 40).trim() || base.back,
    success: str(d.success, 400).trim() || base.success,
    progress: pick(d.progress, ["bar", "steps", "none"] as const, "bar"),
    saveProgress: d.saveProgress !== false,
    consent: { enabled: Boolean(c.enabled), text: str(c.text, 300).trim() || base.consent.text, required: Boolean(c.required) },
    qualify: {
      enabled: Boolean(q.enabled),
      min: Math.max(-1000, Math.min(1000, Math.round(Number(q.min) || 0))),
      qualified: cleanOutcome(q.qualified, base.qualify.qualified),
      unqualified: cleanOutcome(q.unqualified, base.qualify.unqualified),
    },
    theme: {
      accent: hex(t.accent, DEFAULT_THEME.accent),
      dark: Boolean(t.dark),
      background: hex(t.background, t.dark ? "#0b1220" : DEFAULT_THEME.background),
      card: t.card !== false,
      font: pick(t.font, ["modern", "classic", "friendly", "mono"] as const, "modern"),
      radius: Math.max(0, Math.min(28, Math.round(Number(t.radius ?? 12)))),
      fieldStyle: pick(t.fieldStyle, ["outlined", "filled", "underline"] as const, "outlined"),
      buttonStyle: pick(t.buttonStyle, ["solid", "outline", "pill"] as const, "solid"),
      buttonAlign: pick(t.buttonAlign, ["full", "left", "center"] as const, "full"),
      width: Math.max(360, Math.min(960, Math.round(Number(t.width) || 560))),
    },
    meta: { source: pick(meta.source, ["scratch", "template", "ai"] as const, "scratch"), ...(typeof meta.template === "string" ? { template: meta.template.slice(0, 40) } : {}) },
  };
}
