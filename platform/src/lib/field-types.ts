// Custom field types: what each one is called, how its value is checked and
// how it is shown. Used by Settings, the contact page, workflows and AI setup.
// The database shapes values the same way (see the field_types migration).

export const FIELD_TYPES = [
  { type: "text", label: "Short text", hint: "A name, a short answer" },
  { type: "long_text", label: "Long text", hint: "Notes, a few sentences" },
  { type: "number", label: "Number", hint: "Team size, number of seats" },
  { type: "money", label: "Money", hint: "Budget, deal value" },
  { type: "date", label: "Date", hint: "Renewal date, next call" },
  { type: "select", label: "Dropdown", hint: "Pick one option" },
  { type: "multi_select", label: "Multi-select", hint: "Pick any number of options" },
  { type: "yes_no", label: "Yes / No", hint: "A simple tick" },
  { type: "url", label: "Website link", hint: "Portfolio, LinkedIn" },
  { type: "email", label: "Email", hint: "A second email address" },
  { type: "phone", label: "Phone", hint: "A second phone number" },
] as const;

export type FieldType = (typeof FIELD_TYPES)[number]["type"];
export type FieldValue = string | number | boolean | string[];

export const FIELD_TYPE_KEYS = FIELD_TYPES.map((t) => t.type) as FieldType[];
export const OPTION_TYPES: FieldType[] = ["select", "multi_select"];

export function isFieldType(t: unknown): t is FieldType {
  return typeof t === "string" && (FIELD_TYPE_KEYS as string[]).includes(t);
}

export function fieldTypeLabel(t: string) {
  return FIELD_TYPES.find((f) => f.type === t)?.label ?? "Short text";
}

/** Up to 50 unique, trimmed options. Accepts a list or text with one option per line (or commas). */
export function cleanOptions(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/\r?\n|,/) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const o = item.trim().replace(/\s+/g, " ").slice(0, 60);
    if (!o || seen.has(o.toLowerCase())) continue;
    seen.add(o.toLowerCase());
    out.push(o);
    if (out.length === 50) break;
  }
  return out;
}

/**
 * Checks a value typed into a form and returns it in its stored shape.
 * `raw` is a string, or a list for multi-select. An empty value means "clear it".
 */
export function parseFieldValue(type: string, options: string[], raw: string | string[], label = "This field"): { value: FieldValue | null } | { error: string } {
  if (type === "multi_select") {
    const picked = (Array.isArray(raw) ? raw : String(raw).split(",")).map((v) => v.trim()).filter(Boolean);
    const bad = picked.find((p) => options.length && !options.includes(p));
    if (bad) return { error: `${label}: "${bad}" isn't one of the options.` };
    return { value: picked.length ? Array.from(new Set(picked)) : null };
  }
  const s = (Array.isArray(raw) ? raw.join(", ") : String(raw ?? "")).trim();
  if (!s) return { value: null };
  switch (type) {
    case "number":
    case "money": {
      const n = Number(s.replace(/[£$€,\s]/g, ""));
      if (!Number.isFinite(n)) return { error: `${label} needs a number.` };
      return { value: type === "money" ? Math.round(n * 100) / 100 : n };
    }
    case "date":
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) return { error: `${label} needs a date.` };
      return { value: s };
    case "yes_no":
      if (["yes", "true", "on", "1"].includes(s.toLowerCase())) return { value: true };
      if (["no", "false", "off", "0"].includes(s.toLowerCase())) return { value: false };
      return { error: `${label} needs yes or no.` };
    case "select":
      if (options.length && !options.includes(s)) return { error: `${label}: choose one of the options.` };
      return { value: s.slice(0, 60) };
    case "url": {
      const url = /^https?:\/\//i.test(s) ? s : `https://${s}`;
      try {
        new URL(url);
      } catch {
        return { error: `${label} needs a web address.` };
      }
      return { value: url.slice(0, 500) };
    }
    case "email":
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return { error: `${label} needs an email address.` };
      return { value: s.toLowerCase().slice(0, 200) };
    case "phone":
      if (!/^[+0-9 ()-]{6,25}$/.test(s)) return { error: `${label} needs a phone number.` };
      return { value: s };
    case "long_text":
      return { value: s.slice(0, 5000) };
    default:
      return { value: s.slice(0, 500) };
  }
}

/** How a stored value is shown on screen. */
export function formatFieldValue(type: string, value: unknown): string {
  if (value == null || value === "") return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (type === "money" && typeof value === "number") return value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (type === "number" && typeof value === "number") return value.toLocaleString("en-GB");
  if (type === "date" && typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }
  return String(value);
}

/** The value as a string for a form input. */
export function inputValue(type: string, value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}
