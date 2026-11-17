import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Links in Scalency's sign-up, sign-in, invite and password emails land here.
// They carry a one-time token that works on any device or browser, not just the one that asked.
//
// Opening the link (GET) only shows a "Continue" button. The token is used when
// the person clicks it (POST). Email security scanners open links in emails to
// check them; if opening the link used the token, the person would find it
// "expired" before they ever clicked. Scanners don't click buttons, so this
// keeps the link fresh for the real person.

const TYPES: EmailOtpType[] = ["email", "signup", "magiclink", "invite", "recovery", "email_change"];

function safePath(p: string | null) {
  return p && p.startsWith("/") && !p.startsWith("//") ? p : null;
}

function nextFor(type: string | null, explicit: string | null, redirectTo: string | null, origin: string) {
  let next = safePath(explicit);
  if (!next && redirectTo) {
    try {
      const inner = new URL(redirectTo);
      if (inner.origin === origin) next = safePath(inner.searchParams.get("next"));
    } catch {
      next = null;
    }
  }
  return next ?? (type === "invite" || type === "signup" ? "/welcome" : type === "recovery" ? "/reset-password" : "/dashboard");
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const WORDS: Record<string, { title: string; button: string }> = {
  invite: { title: "Accept your invite", button: "Accept invite" },
  signup: { title: "Confirm your email", button: "Confirm and continue" },
  recovery: { title: "Reset your password", button: "Continue" },
  email_change: { title: "Confirm your new email", button: "Confirm" },
  email: { title: "Sign in", button: "Sign in" },
  magiclink: { title: "Sign in", button: "Sign in" },
};

function page(tokenHash: string, type: string, next: string) {
  const w = WORDS[type] ?? WORDS.email;
  return `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${w.title} | Scalency OS</title>
<style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F3F6FB;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#0B1B3A;padding:24px}
  .card{width:100%;max-width:400px;background:#fff;border-radius:20px;padding:36px 28px;text-align:center;box-shadow:0 10px 30px rgba(11,27,58,.08)}
  img{width:150px;height:auto;margin:0 auto 24px;display:block}h1{font-size:22px;margin:0 0 8px}p{margin:0 0 24px;color:#5B6B86;font-size:15px;line-height:1.5}
  button{width:100%;min-height:48px;border:0;border-radius:12px;font-size:16px;font-weight:600;color:#fff;background:linear-gradient(135deg,#22A6F2,#0B63E5);cursor:pointer}
  button:disabled{opacity:.7}
</style></head>
<body><main class="card">
  <img src="/brand/wordmark.png" alt="Scalency">
  <h1>${esc(w.title)}</h1>
  <p>Click the button to continue.</p>
  <form method="post" action="/auth/confirm" onsubmit="this.querySelector('button').disabled=true">
    <input type="hidden" name="token_hash" value="${esc(tokenHash)}">
    <input type="hidden" name="type" value="${esc(type)}">
    <input type="hidden" name="next" value="${esc(next)}">
    <button type="submit">${esc(w.button)}</button>
  </form>
</main></body></html>`;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  if (!tokenHash || !type || !TYPES.includes(type as EmailOtpType)) return NextResponse.redirect(`${origin}/login?error=link`);
  const next = nextFor(type, searchParams.get("next"), searchParams.get("redirect_to"), origin);
  return new NextResponse(page(tokenHash, type, next), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
}

export async function POST(request: NextRequest) {
  const { origin } = request.nextUrl;
  const fd = await request.formData();
  const tokenHash = String(fd.get("token_hash") ?? "");
  const type = String(fd.get("type") ?? "") as EmailOtpType;
  const next = safePath(String(fd.get("next") ?? "")) ?? "/dashboard";
  if (tokenHash && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`, 303);
  }
  return NextResponse.redirect(`${origin}/login?error=link`, 303);
}
