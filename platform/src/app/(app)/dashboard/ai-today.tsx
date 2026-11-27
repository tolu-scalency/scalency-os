import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";
import { createClient } from "@/lib/supabase/server";

function weekAgo() {
  return new Date(Date.now() - 7 * 86_400_000).toISOString();
}
function secs(s: number | null) {
  if (s == null) return "–";
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}

/** The home page's AI band: what the AI front desk is doing right now, with the way in to each part. */
export async function AiToday({ accountId }: { accountId: string }) {
  const supabase = await createClient();
  const since = weekAgo();
  const [{ count: setters }, { data: threads }, { count: waiting }] = await Promise.all([
    supabase.from("setter_agents").select("id", { count: "exact", head: true }).eq("account_id", accountId),
    supabase.from("setter_threads").select("state, created_at, first_reply_at, booked_at, origin").eq("account_id", accountId).gte("updated_at", since).limit(3000),
    supabase.from("setter_handoffs").select("id", { count: "exact", head: true }).eq("account_id", accountId).neq("status", "done"),
  ]);
  if (!setters) {
    return (
      <Link href="/agents" className="group relative flex w-full basis-full items-center gap-4 overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#0a3fa6,#0a5fe3_60%,#29b0f8)] p-5 text-white shadow-[var(--shadow-card)] sm:p-6">
        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-white text-brand">
          <Icon name="spark" size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-semibold">Switch on your AI front desk</span>
          <span className="block text-[13px] text-white/80">Replies to every lead in under a minute, books consultations and follows up for you.</span>
        </span>
        <span className="hidden items-center gap-1 rounded-xl bg-white/15 px-3 py-2 text-[13px] font-semibold ring-1 ring-white/20 sm:inline-flex">
          Set it up <Icon name="arrowRight" size={14} />
        </span>
      </Link>
    );
  }
  const rows = (threads ?? []) as { state: string; created_at: string; first_reply_at: string | null; booked_at: string | null; origin: string | null }[];
  const live = rows.filter((t) => t.state === "active").length;
  const booked = rows.filter((t) => t.booked_at && t.booked_at >= since).length;
  const speeds = rows
    .filter((t) => t.first_reply_at && (t.origin ?? "lead") === "lead")
    .map((t) => (new Date(t.first_reply_at!).getTime() - new Date(t.created_at).getTime()) / 1000)
    .filter((s) => s >= 0)
    .sort((a, b) => a - b);
  const median = speeds.length ? speeds[Math.floor((speeds.length - 1) / 2)] : null;
  const tiles: [string, string, string, IconName, string][] = [
    ["AI conversations live", String(live), "/command-centre", "spark", "Read along"],
    ["Need a person", String(waiting ?? 0), "/setter-console", "warning", "Open the queue"],
    ["Booked this week", String(booked), "/ai-results", "checkCircle", "See results"],
    ["First reply, typical", secs(median), "/ai-results", "clock", "Speed to lead"],
  ];
  return (
    <section className="relative w-full basis-full overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#0a3fa6,#0a5fe3_60%,#29b0f8)] p-4 text-white shadow-[var(--shadow-card)] sm:p-5">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(85,227,236,0.45),transparent)]" />
      <div className="relative mb-3 flex items-center gap-2 px-1">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#55e3ec]" />
        <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/80">Your AI front desk</span>
        <Link href="/command-centre" className="ml-auto text-[12.5px] font-semibold text-white hover:underline">
          Command centre
        </Link>
      </div>
      <div className="relative grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {tiles.map(([k, v, href, icon, cta]) => (
          <Link key={k} href={href} className="group flex items-center gap-3 rounded-xl bg-white/10 p-3.5 ring-1 ring-white/15 transition-colors hover:bg-white/15">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-white text-brand">
              <Icon name={icon} size={18} />
            </span>
            <span className="min-w-0">
              <span className="block font-mono text-[22px] font-semibold leading-none tracking-tight">{v}</span>
              <span className="mt-1 block truncate text-[12px] text-white/80">{k}</span>
              <span className="block truncate text-[11px] text-white/60 group-hover:text-white">{cta}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
