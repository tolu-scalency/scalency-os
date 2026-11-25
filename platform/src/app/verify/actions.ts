"use server";

import { randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { adminClient } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { KEEP_COOKIE, POLICY } from "@/lib/session-policy";
import { PASS_COOKIE, hashCode, passFor, sessionStart } from "@/lib/login-code";

type Result = { ok?: string; error?: string; next?: string };

async function who() {
  const supabase = await createClient().catch(() => null);
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as { sub?: string; email?: string; amr?: { method?: string; timestamp?: number }[]; iat?: number } | undefined;
  if (!claims?.sub) return null;
  return { userId: claims.sub, email: claims.email ?? "", startedAt: sessionStart(claims) };
}

function safeNext(value: unknown) {
  const v = String(value ?? "");
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/verify") ? v : "/dashboard";
}

/** Emails a new 6-digit code, at most once a minute and 6 times an hour. */
export async function sendLoginCode(force = false): Promise<Result> {
  const me = await who();
  if (!me) return { error: "Please sign in again." };
  const admin = adminClient();
  if (!admin) return { error: "The server isn't set up to send codes yet." };

  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { data: recent } = await admin.from("login_codes").select("created_at, session_at, used_at").eq("user_id", me.userId).gte("created_at", hourAgo).order("created_at", { ascending: false });
  const last = recent?.[0];
  if (last && Number(last.session_at) === me.startedAt && !last.used_at && Date.now() - new Date(last.created_at).getTime() < 60_000) {
    return force ? { error: "Please wait a minute before asking for another code." } : { ok: "sent" };
  }
  if ((recent?.length ?? 0) >= 6) return { error: "Too many codes in the last hour. Please wait a little and try again." };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  // Older codes for this sign-in stop working.
  await admin.from("login_codes").update({ used_at: new Date().toISOString() }).eq("user_id", me.userId).is("used_at", null);
  const { error } = await admin.from("login_codes").insert({
    user_id: me.userId,
    session_at: me.startedAt,
    code_hash: await hashCode(me.userId, code),
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (error) return { error: "Couldn't create a code. Please try again." };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: `Scalency <${process.env.EMAIL_FROM}>`,
      to: [me.email],
      subject: `${code} is your Scalency sign-in code`,
      text: `Your Scalency sign-in code is ${code}\n\nIt works for 10 minutes. If you didn't just sign in, change your password.`,
      html: `<!DOCTYPE html><html><body style="margin:0;background:#F4F7FB;font-family:-apple-system,Segoe UI,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#fff;border-radius:16px;">
<tr><td style="padding:32px;color:#1F2D45;font-size:15px;line-height:24px;">
<p style="margin:0 0 12px;">Your Scalency sign-in code:</p>
<p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:8px;color:#0A1F44;">${code}</p>
<p style="margin:0;color:#5B6B82;font-size:13px;">It works for 10 minutes. If you didn't just sign in, change your password.</p>
</td></tr></table></td></tr></table></body></html>`,
    }),
  }).catch(() => null);
  if (!res?.ok) return { error: "We couldn't send the email. Please try again in a minute." };
  return { ok: "sent" };
}

/** Checks the code. Five wrong tries and it stops working. */
export async function verifyLoginCode(_prev: Result, fd: FormData): Promise<Result> {
  const me = await who();
  if (!me) return { error: "Please sign in again." };
  const admin = adminClient();
  if (!admin) return { error: "The server isn't set up to check codes yet." };
  const code = String(fd.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { error: "Enter the 6-digit code from the email." };

  const { data: row } = await admin
    .from("login_codes")
    .select("id, code_hash, attempts, expires_at, session_at")
    .eq("user_id", me.userId)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row || Number(row.session_at) !== me.startedAt || new Date(row.expires_at).getTime() < Date.now()) return { error: "That code has expired. Send a new one." };
  if (row.attempts >= 5) return { error: "Too many wrong tries. Send a new code." };
  if ((await hashCode(me.userId, code)) !== row.code_hash) {
    await admin.from("login_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
    const left = 4 - row.attempts;
    return { error: left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong tries. Send a new code." };
  }
  await admin.from("login_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);

  const jar = await cookies();
  const keep = jar.get(KEEP_COOKIE)?.value === "1";
  jar.set(PASS_COOKIE, await passFor(me.userId, me.startedAt), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    ...(keep ? { maxAge: POLICY.keep.maxAge } : {}),
  });
  return { ok: "verified", next: safeNext(fd.get("next")) };
}
