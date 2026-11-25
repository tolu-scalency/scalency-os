import { adminClient } from "@/lib/admin";
import { APPT_COLS, cancelAppointment, rescheduleAppointment } from "@/lib/calendar/booking";

// The private link in every confirmation: the person who booked moves or cancels it.

export const dynamic = "force-dynamic";

const json = (status: number, data: unknown) => Response.json(data, { status });

export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!/^[a-f0-9]{36}$/.test(token)) return json(404, { error: "This link doesn't work any more." });
  const admin = adminClient();
  if (!admin) return json(503, { error: "Booking isn't set up yet." });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const { data: a } = await admin.from("appointments").select(APPT_COLS).eq("manage_token", token).maybeSingle();
  if (!a) return json(404, { error: "This link doesn't work any more." });
  if (a.status === "cancelled") return json(409, { error: "This booking has already been cancelled." });
  if (Date.parse(a.starts_at as string) < Date.now()) return json(409, { error: "This booking has already happened." });

  try {
    if (body.action === "cancel") {
      await cancelAppointment(admin, a as never, String(body.reason ?? "").slice(0, 500), { by: "booker", notifyBooker: true });
      return json(200, { ok: true, cancelled: true });
    }
    if (body.action === "reschedule") {
      const start = Date.parse(String(body.start ?? ""));
      if (!Number.isFinite(start)) return json(422, { error: "Please pick a time." });
      await rescheduleAppointment(admin, a as never, start, { checkOpen: true, notifyBooker: true });
      return json(200, { ok: true, start: new Date(start).toISOString() });
    }
    return json(400, { error: "Something went wrong. Please try again." });
  } catch (e) {
    return json(409, { error: String((e as Error).message ?? "That didn't work. Please try again.") });
  }
}
