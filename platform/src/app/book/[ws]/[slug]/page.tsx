import type { Metadata } from "next";
import { adminClient } from "@/lib/admin";
import { loadCalendar, loadMembers } from "@/lib/calendar/booking";
import { LOCATIONS } from "@/lib/calendar/types";
import { BookingWidget } from "@/components/booking-widget";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ ws: string; slug: string }>; searchParams: Promise<{ embed?: string }> };

async function load(ws: string, slug: string) {
  const admin = adminClient();
  if (!admin || !/^[a-z0-9-]{1,80}$/.test(ws) || !/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const cal = await loadCalendar(admin, { accountSlug: ws, slug });
  if (!cal || cal.status === "archived") return null;
  const [{ data: acc }, members] = await Promise.all([admin.from("accounts").select("name").eq("id", cal.accountId).single(), loadMembers(admin, cal)]);
  let host: string | null = null;
  if (cal.kind === "one" && members[0]) {
    const { data: dir } = await admin.from("profiles").select("full_name").eq("user_id", members[0].userId).maybeSingle();
    host = (dir?.full_name as string) || null;
  }
  return { cal, business: (acc?.name as string) ?? "", host };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ws, slug } = await params;
  const x = await load(ws, slug);
  return { title: { absolute: x ? `${x.cal.name} · ${x.business}` : "Book a time" } };
}

export default async function PublicBooking({ params, searchParams }: Props) {
  const [{ ws, slug }, { embed }] = await Promise.all([params, searchParams]);
  const x = await load(ws, slug);
  if (!x || x.cal.status !== "active") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f8fd] p-6">
        <div className="max-w-md rounded-3xl bg-white p-10 text-center shadow-[0_30px_80px_-40px_rgba(11,36,71,0.45)]">
          <h1 className="text-[20px] font-semibold tracking-[-0.02em]">This booking page isn&apos;t taking bookings right now</h1>
          <p className="mt-2 text-[14px] text-[#52627a]">Please get in touch with the business directly.</p>
        </div>
      </main>
    );
  }
  const { cal } = x;
  return (
    <BookingWidget
      mode="book"
      calendarId={cal.id}
      embed={embed === "1"}
      business={x.business}
      host={x.host}
      name={cal.name}
      description={cal.description}
      durationMin={cal.durationMin}
      location={LOCATIONS.find((l) => l.id === cal.locationType)?.label ?? ""}
      color={cal.color}
      questions={cal.questions}
    />
  );
}
