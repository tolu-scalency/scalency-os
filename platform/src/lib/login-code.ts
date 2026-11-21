// The "check your email" step after signing in with a password.
// Shared by proxy.ts (which checks the pass cookie) and the /verify page (which sets it).
// Uses Web Crypto only, so it runs anywhere.

export const PASS_COOKIE = "sc_2fa";

/** On when emails can be sent and the server can store codes. Set LOGIN_CODES=off in Netlify to turn it off. */
export function loginCodesOn() {
  if ((process.env.LOGIN_CODES ?? "").toLowerCase() === "off") return false;
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
}

type Claims = { sub?: string; amr?: { method?: string; timestamp?: number }[]; iat?: number };

/** Only password sign-ins need a code. Email links and invites already proved the email. */
export function needsCode(claims: Claims) {
  const amr = claims.amr ?? [];
  const latest = [...amr].sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0))[0];
  return latest?.method === "password";
}

export function sessionStart(claims: Claims) {
  return Math.max(0, ...(claims.amr ?? []).map((a) => Number(a.timestamp) || 0)) || Number(claims.iat) || 0;
}

const enc = new TextEncoder();

async function hmacKey() {
  const base = process.env.LOGIN_CODE_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`scalency-login-pass-v1:${base}`));
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

function b64url(buf: ArrayBuffer) {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The cookie value that says "this sign-in passed the code check". */
export async function passFor(userId: string, startedAt: number) {
  const msg = `${userId}:${startedAt}`;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(msg));
  return `${startedAt}.${b64url(sig)}`;
}

export async function passValid(value: string | undefined, userId: string, startedAt: number) {
  if (!value || !userId || !startedAt) return false;
  const expected = await passFor(userId, startedAt);
  if (value.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < value.length; i++) diff |= value.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** Hash of a code, so the code itself is never stored. */
export async function hashCode(userId: string, code: string) {
  return b64url(await crypto.subtle.digest("SHA-256", enc.encode(`${userId}:${code}:${process.env.SUPABASE_SECRET_KEY ?? ""}`)));
}
