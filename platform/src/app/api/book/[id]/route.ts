import { createHash } from "node:crypto";
import { adminClient } from "@/lib/admin";
import { cleanPerson, createBooking, loadCalendar } from "@/lib/calendar/booking";
import { validTimeZone } from "@/lib/calendar/time";

// Someone books a time on a public booking page. No login: checks everything itself.

export const dynamic = "force-dynamic";

const json = (status: number, data: unknown) => Response.json(data, { status });

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json(404, { error: "This booking page doesn't exist." });
  const admin = adminClient();
  if (!admin) return json(503, { error: "Booking isn't set up yet." });
  const raw = await request.text();
  if (raw.length > 20_000) return json(413, { error: "That's too much text." });
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return json(400, { error: "Something went wrong. Please try again." });
  }
  // Spam: a hidden field people never fill in, and nobody books in under 3 seconds.
  if (typeof body.website === "string" && body.website.trim()) return json(200, { ok: true });
  const ms = Number(body.t);
  if (Number.isFinite(ms) && ms > 0 && ms < 3000) return json(200, { ok: true });

  const cal = await loadCalendar(admin, { id });
  if (!cal || cal.status !== "active") return json(404, { error: "This booking page isn't taking bookings right now." });

  const { person, error } = cleanPerson(body);
  if (!person) return json(422, { error });
  const start = Date.parse(String(body.start ?? ""));
  if (!Number.isFinite(start)) return json(422, { error: "Please pick a time." });

  // Extra questions.
  const given = (body.answers && typeof body.answers === "object" ? body.answers : {}) as Record<string, unknown>;
  const answers: { label: string; value: string }[] = [];
  for (const q of cal.questions) {
    const v = String(given[q.id] ?? "").trim().slice(0, q.type === "textarea" ? 2000 : 300);
    if (!v) {
      if (q.required) return json(422, { error: `Please answer: ${q.label}` });
      continue;
    }
    if (q.type === "select" && !q.options.includes(v)) return json(422, { error: `Please choose an option for: ${q.label}` });
    answers.push({ label: q.label, value: v });
  }

  // At most 3 bookings from the same email in 10 minutes.
  const { data: known } = await admin.from("contacts").select("id").eq("account_id", cal.accountId).ilike("email", person.email!.replace(/[%_\\]/g, "\\$&")).maybeSingle();
  if (known) {
    const { count } = await admin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("contact_id", known.id)
      .gte("created_at", new Date(Date.now() - 10 * 60_000).toISOString());
    if ((count ?? 0) >= 3) return json(429, { error: "You've booked a few times already. Please wait a few minutes." });
  }

  try {
    const b = await createBooking(admin, {
      cal,
      start,
      timezone: validTimeZone(body.tz) ? (body.tz as string) : "Europe/London",
      person,
      answers,
      consent: body.consent === true,
      source: "booking_page",
    });
    const ref = createHash("sha256").update(b.id).digest("hex").slice(0, 8).toUpperCase();
    return json(200, { ok: true, ref, start: new Date(b.start).toISOString(), end: new Date(b.end).toISOString(), meetingUrl: b.meetingUrl, manage: `/booking/${b.manageToken}`, redirect: cal.redirectUrl || null, thankYou: cal.thankYou || null });
  } catch (e) {
    return json(409, { error: String((e as Error).message ?? "We couldn't book that time. Please try another.") });
  }
}
