import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { FRESH_SIGN_IN, KEEP_COOKIE, POLICY, SEEN_COOKIE } from "@/lib/session-policy";
import { PASS_COOKIE, loginCodesOn, needsCode, passValid, sessionStart } from "@/lib/login-code";

// Runs before every page. It keeps the login session fresh and sends anyone who isn't signed in to /login.
// This is a quick first check only: every data read is also protected by row-level security in the database.

// Pages anyone can open. "/" is the public homepage.
const PUBLIC_PATHS = ["/login", "/signup", "/auth", "/invite", "/f", "/p", "/d", "/api/cron", "/api/hooks", "/api/inbound", "/api/forms", "/book", "/booking", "/api/book"];

// Optional separate address for public forms, e.g. https://forms.scalency.us (NEXT_PUBLIC_FORMS_URL in Netlify).
// On that address only forms work; anything else goes to the app's own address.
const FORMS_HOST = (() => {
  try {
    return process.env.NEXT_PUBLIC_FORMS_URL ? new URL(process.env.NEXT_PUBLIC_FORMS_URL).host : "";
  } catch {
    return "";
  }
})();
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://os.scalency.us";
const APP_HOST = (() => {
  try {
    return new URL(APP_URL).host;
  } catch {
    return "os.scalency.us";
  }
})();

/** Scalency's own addresses. Any other address is a client's own domain for a page, funnel or website. */
function isAppHost(host: string) {
  const h = host.toLowerCase().replace(/:\d+$/, "");
  return (
    host === APP_HOST ||
    h === APP_HOST ||
    (FORMS_HOST && host === FORMS_HOST) ||
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.endsWith(".netlify.app") ||
    (process.env.APP_HOSTS ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean).includes(h)
  );
}

export async function proxy(request: NextRequest) {
  const p0 = request.nextUrl.pathname;
  // A client's own domain: show their site. Forms still load from /f/ on the same domain.
  const host = request.headers.get("host") ?? request.nextUrl.host;
  if (host && !isAppHost(host)) {
    if (p0.startsWith("/f/") || p0.startsWith("/api/forms/") || p0.startsWith("/_next/")) return NextResponse.next({ request });
    const page = p0.replace(/\/+$/, "");
    const to = request.nextUrl.clone();
    to.pathname = `/d/${encodeURIComponent(host.toLowerCase().replace(/:\d+$/, ""))}${page}`;
    return NextResponse.rewrite(to);
  }
  if (FORMS_HOST && request.nextUrl.host === FORMS_HOST) {
    if (p0.startsWith("/f/") || p0.startsWith("/api/forms/")) return NextResponse.next({ request });
    return NextResponse.redirect(new URL(p0 + request.nextUrl.search, APP_URL));
  }
  // Public forms, their embed script and submissions never need a login session.
  // Skipping the session check keeps them fast and means a sign-in problem can't break them.
  if (p0.startsWith("/f/") || p0.startsWith("/p/") || p0.startsWith("/d/") || p0.startsWith("/api/forms/") || p0.startsWith("/book/") || p0.startsWith("/booking/") || p0.startsWith("/api/book/")) return NextResponse.next({ request });

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

    // After a password sign-in, the emailed code must be entered before anything else.
    if (path !== "/verify" && !isPublic && loginCodesOn() && needsCode(claims as never)) {
      const sub = String((data!.claims as { sub?: string }).sub ?? "");
      if (!(await passValid(request.cookies.get(PASS_COOKIE)?.value, sub, sessionStart(claims as never)))) {
        const verify = new URL("/verify", request.url);
        if (path !== "/dashboard") verify.searchParams.set("next", path + request.nextUrl.search);
        const out = NextResponse.redirect(verify);
        for (const c of response.cookies.getAll()) out.cookies.set(c);
        return out;
      }
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
