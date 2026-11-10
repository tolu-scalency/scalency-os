import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Runs before every page. It keeps the login session fresh and sends anyone who isn't signed in to /login.
// This is a quick first check only: every data read is also protected by row-level security in the database.

// Pages anyone can open. "/" is the public homepage.
const PUBLIC_PATHS = ["/login", "/signup", "/auth"];

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

  if (signedIn && (path === "/login" || path === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  // Skip Next.js internals and static files such as the logo.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
