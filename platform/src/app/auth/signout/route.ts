import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { KEEP_COOKIE, SEEN_COOKIE } from "@/lib/session-policy";

// Signs the person out (POST only, so a link elsewhere can't sign someone out) and returns them to the login page.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const res = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  res.cookies.delete(SEEN_COOKIE);
  res.cookies.delete(KEEP_COOKIE);
  return res;
}
