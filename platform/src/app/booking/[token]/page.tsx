import type { Metadata } from "next";
import { adminClient } from "@/lib/admin";
import { loadCalendar } from "@/lib/calendar/booking";
import { LOCATIONS } from "@/lib/calendar/types";
import { BookingWidget } from "@/components/booking-widget";

// The private link in every confirmation: see the booking, move it or cancel it.

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Your booking" }, robots: { index: false, follow: false } };

export default async function ManageBooking({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = adminClient();
  const { data: a } =
    admin && /^[a-f0-9]{36}$/.test(token)
      ? await admin.from("appointments").select("id, account_id, calendar_id, starts_at, ends_at, status, booker_timezone, meeting_url, location, title").eq("manage_token", token).maybeSingle()
      : { data: null };
  const cal = a?.calendar_id && admin ? await loadCalendar(admin, { id: a.calendar_id as string }) : null;
  const { data: acc } = a && admin ? await admin.from("accounts").select("name").eq("id", a.account_id).single() : { data: null };

  if (!a) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f8fd] p-6">
        <div className="max-w-md rounded-3xl bg-white p-10 text-center shadow-[0_30px_80px_-40px_rgba(11,36,71,0.45)]">
          <h1 className="text-[20px] font-semibold tracking-[-0.02em]">This link doesn&apos;t work any more</h1>
          <p className="mt-2 text-[14px] text-[#52627a]">Please reply to your confirmation email and we&apos;ll help.</p>
        </div>
      </main>
    );
  }
  return (
    <BookingWidget
      mode="manage"
      manageToken={token}
      calendarId={(a.calendar_id as string) ?? ""}
      embed={false}
      business={(acc?.name as string) ?? ""}
      host={null}
      name={cal?.name ?? ((a.title as string) || "Your booking")}
      description=""
      durationMin={Math.round((Date.parse(a.ends_at as string) - Date.parse(a.starts_at as string)) / 60000)}
      location={(a.location as string) || (cal ? LOCATIONS.find((l) => l.id === cal.locationType)?.label ?? "" : "")}
      color={cal?.color ?? "#0465C7"}
      questions={[]}
      booking={{
        start: a.starts_at as string,
        status: a.status as string,
        meetingUrl: (a.meeting_url as string) ?? null,
        tz: (a.booker_timezone as string) ?? null,
        canMove: Boolean(cal && cal.status === "active"),
      }}
    />
  );
}
