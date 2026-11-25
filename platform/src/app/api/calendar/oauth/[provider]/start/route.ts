import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getWorkspace } from "@/lib/data";
import { authUrl, providerReady } from "@/lib/calendar/providers";

// Starts "Connect Google Calendar" or "Connect Outlook" for the signed-in person, in the
// workspace they're in. A one-time state value in a cookie proves the reply is theirs.

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const back = new URL("/calendar/connections", request.url);
  if (provider !== "google" && provider !== "microsoft") return NextResponse.redirect(back);
  if (!providerReady(provider)) {
    back.searchParams.set("error", `${provider}-setup`);
    return NextResponse.redirect(back);
  }
  const ws = await getWorkspace();
  const state = randomBytes(18).toString("hex");
  const res = NextResponse.redirect(authUrl(provider, state));
  res.cookies.set("scalency_cal_oauth", `${state}.${ws.account.id}.${provider}`, {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/api/calendar/oauth",
    maxAge: 600,
  });
  return res;
}
