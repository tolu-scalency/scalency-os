import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";
import { getWorkspace } from "@/lib/data";
import { exchangeCode } from "@/lib/calendar/providers";
import { seal } from "@/lib/secret-box";

// Google or Microsoft sends the person back here after they allow access.

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const url = new URL(request.url);
  const back = new URL("/calendar/connections", request.url);
  const fail = (code: string) => {
    back.searchParams.set("error", code);
    const r = NextResponse.redirect(back);
    r.cookies.delete({ name: "scalency_cal_oauth", path: "/api/calendar/oauth" });
    return r;
  };
  if (provider !== "google" && provider !== "microsoft") return fail("unknown");
  const cookie = request.headers.get("cookie")?.match(/(?:^|;\s*)scalency_cal_oauth=([^;]+)/)?.[1] ?? "";
  const [state, accountId, forProvider] = decodeURIComponent(cookie).split(".");
  if (!state || state !== url.searchParams.get("state") || forProvider !== provider) return fail("state");
  if (url.searchParams.get("error")) return fail("denied");
  const code = url.searchParams.get("code");
  if (!code) return fail("denied");

  const ws = await getWorkspace();
  if (ws.account.id !== accountId) return fail("state");
  const admin = adminClient();
  if (!admin) return fail("setup");
  try {
    const t = await exchangeCode(provider, code);
    if (!t.refresh) return fail("refresh");
    const { error } = await admin.from("calendar_connections").upsert(
      {
        account_id: accountId,
        user_id: ws.userId,
        provider,
        account_email: t.email,
        external_user: "primary",
        token_sealed: seal(t.access),
        refresh_sealed: seal(t.refresh),
        expires_at: t.expiresAt,
        status: "connected",
        last_error: null,
      },
      { onConflict: "account_id,user_id,provider" },
    );
    if (error) return fail("save");
  } catch (e) {
    console.error("Calendar connect failed", provider, String(e).slice(0, 300));
    return fail("exchange");
  }
  back.searchParams.set("ok", provider);
  const r = NextResponse.redirect(back);
  r.cookies.delete({ name: "scalency_cal_oauth", path: "/api/calendar/oauth" });
  return r;
}
