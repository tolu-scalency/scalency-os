import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { PASS_COOKIE, loginCodesOn, needsCode, passValid, sessionStart } from "./login-code";

/** For API routes the proxy doesn't cover: true if this sign-in has passed the emailed code (or doesn't need one). */
export async function signInComplete() {
  if (!loginCodesOn()) return true;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as { sub?: string; amr?: { method?: string; timestamp?: number }[]; iat?: number } | undefined;
  if (!claims?.sub) return false;
  if (!needsCode(claims)) return true;
  const jar = await cookies();
  return passValid(jar.get(PASS_COOKIE)?.value, claims.sub, sessionStart(claims));
}
