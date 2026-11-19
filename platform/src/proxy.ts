import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { FRESH_SIGN_IN, KEEP_COOKIE, POLICY, SEEN_COOKIE } from "@/lib/session-policy";

// Runs before every page. It keeps the login session fresh and sends anyone who isn't signed in to /login.
// This is a quick first check only: every data read is also protected by row-level security in the database.

// Pages anyone can open. "/" is the public homepage.
const PUBLIC_PATHS = ["/login", "/signup", "/auth", "/invite", "/f", "/api/cron", "/api/hooks", "/api/inbound", "/api/forms"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    // Without settings nobody can sign in, so show the login page, which explains what's missing.
    if (request.nextUrl.pathname === "/" || request.nextUrl.pathname.startsWith("/login")) return response;
    return NextResponse.redirect(new URL("/login?error=setup", request.url));
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });

  // Refreshes the session if needed. getClaims() checks the token's signature, so it can't be faked.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;
  const isPublic = path === "/" || PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (!signedIn && !isPublic) {
    const login = new URL("/login", request.url);
    if (path !== "/") login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  // Sign people out after too long, or after too long without using the app.
  // /auth and /api are left alone: they're part of signing in, or called by other services.
  if (signedIn && !path.startsWith("/auth") && !path.startsWith("/api") && !path.startsWith("/f/")) {
    const claims = data!.claims as { amr?: { timestamp?: number }[]; iat?: number };
    const now = Math.floor(Date.now() / 1000);
    const signedInAt = Math.max(0, ...(claims.amr ?? []).map((a) => Number(a.timestamp) || 0)) || Number(claims.iat) || now;
    const keep = request.cookies.get(KEEP_COOKIE)?.value === "1";
    const rule = keep ? POLICY.keep : POLICY.normal;
    const seen = Number(request.cookies.get(SEEN_COOKIE)?.value) || 0;
    const fresh = now - signedInAt < FRESH_SIGN_IN;

    const tooOld = now - signedInAt > rule.maxAge;
    const idle = seen ? now - seen > rule.idle : !fresh; // no record (browser closed) and not a new sign-in
    if (tooOld || idle) {
      await supabase.auth.signOut({ scope: "local" });
      const login = new URL("/login", request.url);
      login.searchParams.set("error", "expired");
      if (!isPublic && path !== "/") login.searchParams.set("next", path);
      const out = NextResponse.redirect(login);
      for (const c of response.cookies.getAll()) out.cookies.set(c);
      out.cookies.delete(SEEN_COOKIE);
      out.cookies.delete(KEEP_COOKIE);
      return out;
    }

    // Note activity at most once a minute. Without "keep me signed in" this is a
    // browser-session cookie, so closing the browser signs you out.
    if (!seen || now - seen > 60) {
      response.cookies.set(SEEN_COOKIE, String(now), {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
        ...(keep ? { maxAge: POLICY.keep.maxAge } : {}),
      });
    }
  }

  if (signedIn && (path === "/login" || path === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  // Skip Next.js internals and static files such as the logo.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
