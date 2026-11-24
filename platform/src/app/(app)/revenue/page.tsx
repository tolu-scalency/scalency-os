import type { Metadata } from "next";
import Link from "next/link";
import { Page, PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { cleanBusiness } from "@/lib/setter";
import { SpendForm } from "./spend-form";

export const metadata: Metadata = { title: "Revenue" };

type Row = { account_id: string; agent_id: string; origin: string | null; lead_source: string | null; created_at: string; last_outbound_at: string | null; booked_at: string | null; showed_at: string | null; appointment_status: string | null; revenue: number | null };

function nowMs() {
  return Date.now();
}
const PERIODS = [30, 90, 365] as const;
const money = (n: number, cur: string) => new Intl.NumberFormat(cur === "GBP" ? "en-GB" : "en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "–");
const ORIGIN: Record<string, string> = { lead: "New leads", reply: "Messaged in", reactivation: "Reactivation", missed_call: "Missed calls", rebooking: "Rebooking" };

/** Revenue by channel: where leads came from, how many booked and showed, and what they were worth. */
export default async function RevenuePage({ searchParams }: { searchParams: Promise<{ days?: string; scope?: string }> }) {
  const [sp, ws] = await Promise.all([searchParams, getWorkspace()]);
  const days = PERIODS.find((p) => String(p) === sp.days) ?? 90;
  const all = false;
  const accounts = all ? ws.workspaces.map((w) => w.id) : [ws.account.id];
  const now = nowMs();
  const since = new Date(now - days * 86_400_000).toISOString();
  const supabase = await createClient();
  const [{ data }, { data: agents }, { data: spendRows }] = await Promise.all([
    supabase.from("setter_threads").select("account_id, agent_id, origin, lead_source, created_at, last_outbound_at, booked_at, showed_at, appointment_status, revenue").in("account_id", accounts).gte("created_at", since).limit(10000),
    supabase.from("setter_agents").select("id, account_id, business").in("account_id", accounts),
    supabase.from("ad_spend").select("id, account_id, month, source, amount").in("account_id", accounts).gte("month", since.slice(0, 8) + "01").order("month", { ascending: false }).limit(500),
  ]);
  const spend = (spendRows ?? []) as { id: string; account_id: string; month: string; source: string; amount: number }[];
  const spendBy = new Map<string, number>();
  for (const r of spend) {
    const k = r.source.trim().toLowerCase();
    spendBy.set(k, (spendBy.get(k) ?? 0) + Number(r.amount));
  }
  const totalSpend = [...spendBy.values()].reduce((a, b) => a + b, 0);
  const rows = (data ?? []) as Row[];
  const biz = new Map(((agents ?? []) as { id: string; business: unknown }[]).map((a) => [a.id, cleanBusiness(a.business)]));
  const uk = [...biz.values()].some((b) => b.spelling === "UK" || b.timezone.startsWith("Europe/London"));
  const cur = uk ? "GBP" : "USD";
  const valueOf = (r: Row) => (r.revenue != null ? Number(r.revenue) : r.showed_at ? biz.get(r.agent_id)?.avgValue || 0 : 0);
  const estOf = (r: Row) => (r.booked_at && !r.showed_at && r.appointment_status !== "noshow" && r.appointment_status !== "cancelled" ? biz.get(r.agent_id)?.avgValue || 0 : 0);

  type Agg = { leads: number; messaged: number; booked: number; showed: number; revenue: number; pipeline: number };
  const blank = (): Agg => ({ leads: 0, messaged: 0, booked: 0, showed: 0, revenue: 0, pipeline: 0 });
  const add = (a: Agg, r: Row) => {
    a.leads++;
    if (r.last_outbound_at) a.messaged++;
    if (r.booked_at) a.booked++;
    if (r.showed_at || r.appointment_status === "showed") a.showed++;
    a.revenue += valueOf(r);
    a.pipeline += estOf(r);
  };
  const total = blank();
  const bySource = new Map<string, Agg>();
  const byOrigin = new Map<string, Agg>();
  for (const r of rows) {
    add(total, r);
    const src = (r.lead_source || "Unknown").replace(/\b\w/g, (c) => c.toUpperCase());
    add(bySource.get(src) ?? bySource.set(src, blank()).get(src)!, r);
    const o = ORIGIN[r.origin ?? "lead"] ?? "New leads";
    add(byOrigin.get(o) ?? byOrigin.set(o, blank()).get(o)!, r);
  }
  const sources = [...bySource.entries()].sort((a, b) => b[1].revenue - a[1].revenue || b[1].leads - a[1].leads);
  const origins = [...byOrigin.entries()].sort((a, b) => b[1].revenue - a[1].revenue || b[1].leads - a[1].leads);
  const maxRev = Math.max(1, ...sources.map(([, a]) => a.revenue + a.pipeline));
  const noValues = !rows.some((r) => r.revenue != null) && ![...biz.values()].some((b) => b.avgValue > 0);

  const link = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ days: String(days), ...(all ? { scope: "all" } : {}), ...patch });
    if (patch.scope === "") p.delete("scope");
    return `/revenue?${p.toString()}`;
  };

  return (
    <Page wide>
      <PageHeader
        eyebrow="Prove it"
        title="Revenue"
        subtitle={`${all ? `All ${accounts.length} clinics` : ws.account.name} · last ${days} days`}
        actions={
          <>
            {false && (
              <div className="flex gap-1 rounded-xl bg-surface p-1">
                <Link href={link({ scope: "" })} className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${!all ? "bg-white text-navy shadow-sm" : "text-muted"}`}>
                  This clinic
                </Link>
                <Link href={link({ scope: "all" })} className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${all ? "bg-white text-navy shadow-sm" : "text-muted"}`}>
                  All clinics
                </Link>
              </div>
            )}
            <div className="flex gap-1 rounded-xl bg-surface p-1">
              {PERIODS.map((d) => (
                <Link key={d} href={link({ days: String(d) })} className={`rounded-lg px-3 py-1.5 font-mono text-[12.5px] font-semibold ${days === d ? "bg-white text-navy shadow-sm" : "text-muted"}`}>
                  {d}d
                </Link>
              ))}
            </div>
          </>
        }
      />

      {noValues && (
        <p className="rounded-2xl bg-chip px-4 py-3 text-[13px] text-brand">
          Add an average treatment value (AI setter, Reviews and rebooking) or send each appointment&apos;s value from GHL to see money here. Until then the counts still work.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ["Revenue from shows", money(total.revenue, cur), `${total.showed} showed`],
            ["Booked, still to come", money(total.pipeline, cur), "Estimated from average value"],
            ["Bookings", String(total.booked), `${pct(total.booked, total.messaged)} of everyone messaged`],
            ["Show rate", pct(total.showed, total.booked), `${total.showed} of ${total.booked} booked`],
            ["Revenue per lead", total.leads ? money(total.revenue / total.leads, cur) : "–", `${total.leads} leads`],
            ...(totalSpend
              ? ([
                  ["Ad spend", money(totalSpend, cur), `${money(total.leads ? totalSpend / total.leads : 0, cur)} a lead`],
                  ["Cost per shown consult", total.showed ? money(totalSpend / total.showed, cur) : "–", `${total.booked ? money(totalSpend / total.booked, cur) : "–"} per booking`],
                  ["Return on ad spend", totalSpend ? `${(total.revenue / totalSpend).toFixed(1)}x` : "–", "Revenue from shows ÷ spend"],
                ] as const)
              : []),
          ] as const
        ).map(([k, v, s], i) => (
          <div key={k} className={`card p-5 ${i === 0 ? "col-span-2 bg-[linear-gradient(135deg,#0a3fa6_0%,#0a5fe3_100%)] text-white lg:col-span-1" : ""}`}>
            <div className={`text-[12px] font-medium ${i === 0 ? "text-white/70" : "text-muted"}`}>{k}</div>
            <div className={`mt-1.5 font-mono text-[28px] font-semibold tracking-tight ${i === 0 ? "text-white" : "text-navy"}`}>{v}</div>
            <div className={`mt-0.5 text-[11.5px] ${i === 0 ? "text-white/70" : "text-muted"}`}>{s}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <div className="eyebrow mb-1">By channel</div>
            <h2 className="text-[16px] font-semibold">Where the money comes from</h2>
            <p className="text-[12.5px] text-muted">The lead source GHL records (ad, form, website, Instagram…).</p>
          </div>
          {sources.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-muted">No leads in this period yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-[13px]">
                <thead>
                  <tr className="text-left text-[11.5px] uppercase tracking-[0.08em] text-faint">
                    <th className="px-5 py-2.5 font-semibold">Source</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Leads</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Booked</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Showed</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Spend</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Per shown</th>
                    <th className="px-5 py-2.5 font-semibold">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map(([src, a]) => (
                    <tr key={src} className="border-t border-line">
                      <td className="px-5 py-3 font-semibold text-navy">{src}</td>
                      <td className="px-3 py-3 text-right font-mono">{a.leads}</td>
                      <td className="px-3 py-3 text-right font-mono">
                        {a.booked} <span className="text-faint">{pct(a.booked, a.leads)}</span>
                      </td>
                      <td className="px-3 py-3 text-right font-mono">{a.showed}</td>
                      <td className="px-3 py-3 text-right font-mono">{spendBy.get(src.toLowerCase()) ? money(spendBy.get(src.toLowerCase())!, cur) : "–"}</td>
                      <td className="px-3 py-3 text-right font-mono">{spendBy.get(src.toLowerCase()) && a.showed ? money(spendBy.get(src.toLowerCase())! / a.showed, cur) : "–"}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                            <div className="h-full rounded-full bg-[linear-gradient(90deg,#29b0f8,#0a5fe3)]" style={{ width: `${Math.max(2, ((a.revenue + a.pipeline) / maxRev) * 100)}%` }} />
                          </div>
                          <span className="w-[84px] text-right font-mono font-semibold text-navy">{money(a.revenue, cur)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card flex flex-col gap-4 p-5">
          <div>
            <div className="eyebrow mb-1">Ad spend</div>
            <h2 className="text-[16px] font-semibold">What you spent, by source and month</h2>
            <p className="text-[12.5px] text-muted">Gives cost per lead, per booking and per shown consult. Use the same source names GHL uses.</p>
          </div>
          <SpendForm sources={sources.map(([s]) => s).filter((s) => s !== "Unknown")} rows={spend.filter((r) => r.account_id === ws.account.id)} symbol={cur === "GBP" ? "£" : "$"} />
        </section>

        <section className="card p-5">
          <div className="eyebrow mb-1">By how it started</div>
          <h2 className="text-[16px] font-semibold">What each AI feature brings in</h2>
          <div className="mt-4 flex flex-col gap-3">
            {origins.length === 0 && <p className="text-[13px] text-muted">Nothing yet.</p>}
            {origins.map(([o, a]) => (
              <div key={o} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-navy">{o}</div>
                  <div className="text-[12px] text-muted">
                    {a.leads} people · {a.booked} booked · {a.showed} showed
                  </div>
                </div>
                <div className="font-mono text-[16px] font-semibold text-navy">{money(a.revenue, cur)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Page>
  );
}
