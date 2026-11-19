// Lead forms: what a form is made of, shared by the builder, the public page and the
// submission API. Stored in forms.definition.

export type FormFieldKind =
  | "first_name"
  | "last_name"
  | "full_name"
  | "email"
  | "phone"
  | "custom" // saves to one of the workspace's contact fields
  | "text" // answers only (kept on the submission)
  | "textarea"
  | "select"
  | "checkbox";

export type FormField = {
  id: string;
  kind: FormFieldKind;
  label: string;
  placeholder?: string;
  required: boolean;
  /** For "custom": the contact field key. */
  key?: string;
  /** For "select". */
  options?: string[];
  /** Half width on wider screens, so two fields sit side by side. */
  half?: boolean;
};

export type FormDefinition = {
  title: string;
  intro: string;
  fields: FormField[];
  button: string;
  success: string;
  consent: { enabled: boolean; text: string; required: boolean };
  theme: { accent: string; rounded: boolean; dark: boolean };
};

export const FIELD_KINDS: { kind: FormFieldKind; label: string; once?: boolean; contact?: boolean }[] = [
  { kind: "first_name", label: "First name", once: true, contact: true },
  { kind: "last_name", label: "Last name", once: true, contact: true },
  { kind: "full_name", label: "Full name", once: true, contact: true },
  { kind: "email", label: "Email", once: true, contact: true },
  { kind: "phone", label: "Phone", once: true, contact: true },
  { kind: "custom", label: "Contact field", contact: true },
  { kind: "text", label: "Short answer" },
  { kind: "textarea", label: "Long answer" },
  { kind: "select", label: "Dropdown" },
  { kind: "checkbox", label: "Tick box" },
];

export const newFieldId = () => Math.random().toString(36).slice(2, 10);

export const DEFAULT_DEFINITION: FormDefinition = {
  title: "Get in touch",
  intro: "Leave your details and we'll be in touch shortly.",
  fields: [
    { id: "fn", kind: "first_name", label: "First name", required: true, half: true },
    { id: "ln", kind: "last_name", label: "Last name", required: false, half: true },
    { id: "em", kind: "email", label: "Email", required: true },
    { id: "ph", kind: "phone", label: "Phone", required: false },
  ],
  button: "Send",
  success: "Thanks, we've got your details and will be in touch soon.",
  consent: { enabled: true, text: "I agree to be contacted by email and text about my enquiry.", required: false },
  theme: { accent: "#0a5fe3", rounded: true, dark: false },
};

const str = (v: unknown, max: number, fallback = "") => (typeof v === "string" ? v.slice(0, max) : fallback);

/** Keeps a definition safe and complete, whatever was sent. */
export function cleanDefinition(raw: unknown): FormDefinition {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const kinds = new Set(FIELD_KINDS.map((k) => k.kind));
  const seen = new Set<string>();
  const once = new Set<string>();
  const fields: FormField[] = [];
  for (const f0 of Array.isArray(d.fields) ? d.fields.slice(0, 30) : []) {
    const f = (f0 ?? {}) as Record<string, unknown>;
    const kind = String(f.kind) as FormFieldKind;
    if (!kinds.has(kind)) continue;
    if (FIELD_KINDS.find((k) => k.kind === kind)?.once) {
      if (once.has(kind)) continue;
      once.add(kind);
    }
    let id = str(f.id, 16).replace(/[^a-z0-9]/gi, "");
    if (!id || seen.has(id)) id = newFieldId();
    seen.add(id);
    const field: FormField = {
      id,
      kind,
      label: str(f.label, 80).trim() || FIELD_KINDS.find((k) => k.kind === kind)!.label,
      required: Boolean(f.required),
    };
    const ph = str(f.placeholder, 80).trim();
    if (ph) field.placeholder = ph;
    if (f.half) field.half = true;
    if (kind === "custom") {
      const key = str(f.key, 60).replace(/[^a-z0-9_]/g, "");
      if (!key) continue;
      field.key = key;
    }
    if (kind === "select") {
      const opts = (Array.isArray(f.options) ? f.options : []).map((o) => str(o, 60).trim()).filter(Boolean);
      field.options = [...new Set(opts)].slice(0, 30);
    }
    fields.push(field);
  }
  const c = (d.consent ?? {}) as Record<string, unknown>;
  const t = (d.theme ?? {}) as Record<string, unknown>;
  const accent = /^#[0-9a-f]{6}$/i.test(String(t.accent)) ? String(t.accent) : DEFAULT_DEFINITION.theme.accent;
  return {
    title: str(d.title, 120, DEFAULT_DEFINITION.title),
    intro: str(d.intro, 400),
    fields,
    button: str(d.button, 40).trim() || "Send",
    success: str(d.success, 400).trim() || DEFAULT_DEFINITION.success,
    consent: { enabled: Boolean(c.enabled), text: str(c.text, 300).trim() || DEFAULT_DEFINITION.consent.text, required: Boolean(c.required) },
    theme: { accent, rounded: t.rounded !== false, dark: Boolean(t.dark) },
  };
}

/** A form can only be published with a way to reach the person. */
export function publishProblem(def: FormDefinition): string | null {
  const kinds = new Set(def.fields.map((f) => f.kind));
  if (!kinds.has("email") && !kinds.has("phone")) return "Add an Email or Phone field, so each submission can become a contact.";
  if (def.fields.some((f) => f.kind === "select" && !(f.options ?? []).length)) return "Give every dropdown at least one option.";
  return null;
}
