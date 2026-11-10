import "server-only";

// Small helpers shared by the server actions that save forms.

export type ActionResult = { error?: string; ok?: string };

export const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^\+[1-9][0-9]{6,14}$/;

export function text(fd: FormData, key: string, max = 200) {
  return String(fd.get(key) ?? "").trim().slice(0, max);
}

/** "07700 900123" becomes "+447700900123". Other numbers need the country code. Returns "invalid" if it can't be used. */
export function normalisePhone(raw: string): string | null {
  const p = raw.replace(/[\s().-]/g, "");
  if (!p) return null;
  let out = p;
  if (/^07\d{9}$/.test(p)) out = "+44" + p.slice(1);
  else if (/^00\d+$/.test(p)) out = "+" + p.slice(2);
  return PHONE.test(out) ? out : "invalid";
}

/** "£1,250" or "1250.50" becomes pence. Empty is null. Returns -1 if it isn't a number. */
export function parsePounds(raw: string): number | null {
  const cleaned = raw.replace(/[£,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0 || n > 100_000_000) return -1;
  return Math.round(n * 100);
}

export const PHONE_HELP = "Use a mobile like 07700 900123, or add the country code, like +1 555 010 2030.";
