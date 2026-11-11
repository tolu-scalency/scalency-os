import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Links in Scalency's sign-up, sign-in, invite and password emails land here.
// They carry a one-time token that works on any device or browser, not just the one that asked.

const TYPES: EmailOtpType[] = ["email", "signup", "magiclink", "invite", "recovery", "email_change"];

function safePath(p: string | null) {
  return p && p.startsWith("/") && !p.startsWith("//") ? p : null;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Where to go next: ?next=/x, or the "next" inside the app's original redirect address.
  let next = safePath(searchParams.get("next"));
  if (!next) {
    try {
      const inner = new URL(searchParams.get("redirect_to") ?? "");
      if (inner.origin === origin) next = safePath(inner.searchParams.get("next"));
    } catch {
      next = null;
    }
  }
  if (!next) next = type === "invite" || type === "signup" ? "/welcome" : type === "recovery" ? "/reset-password" : "/dashboard";

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
