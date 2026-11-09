import type { Metadata } from "next";
import { Button, PageHeader, Pill, Segmented, Tile, type PillTone, type Tone } from "@/components/ui";
import type { IconName } from "@/components/icon";

export const metadata: Metadata = { title: "Reports & ads" };

const stats: { label: string; value: string; delta: string; tone: PillTone; icon: IconName; tile: Tone }[] = [
  { label: "Ad spend", value: "£1,840", delta: "+12%", tone: "blue", icon: "pound", tile: "blue" },
  { label: "Leads", value: "96", delta: "+18%", tone: "green", icon: "users", tile: "violet" },
  { label: "Cost per lead", value: "£19.17", delta: "-6%", tone: "green", icon: "chart", tile: "orange" },
  { label: "Booked calls", value: "31", delta: "+7", tone: "green", icon: "calendar", tile: "green" },
  { label: "Cost per booked call", value: "£59", delta: "ON TARGET", tone: "blue", icon: "activity", tile: "pink" },
];

const bars = [38, 52, 30, 64, 46, 72, 58, 80, 100, 66, 54, 76, 88, 70];
const barDays = ["25", "26", "27", "28", "29", "30", "31", "01", "02", "03", "04", "05", "06", "07"];

const creatives = [
  { name: "Clinics A · “Which branch?”", cpl: "£14", booked: 12, tag: "Winner", tone: "green" as PillTone, gradient: "from-brand to-turquoise" },
  { name: "Clinics B · Front desk test", cpl: "£18", booked: 9, tag: "Scale", tone: "blue" as PillTone, gradient: "from-[#4f46e5] to-[#a5b4fc]" },
  { name: "Solar B · Survey diary", cpl: "£31", booked: 4, tag: "Watch", tone: "amber" as PillTone, gradient: "from-[#ea580c] to-[#fdba74]" },
];

const accounts: { initials: string; tone: Tone; name: string; spend: string; leads: number; cpl: string; booked: number; status: string; statusTone: PillTone }[] = [
  { initials: "SC", tone: "blue", name: "Scalency (own ads)", spend: "£980", leads: 54, cpl: "£18.15", booked: 18, status: "Healthy", statusTone: "green" },
  { initials: "MC", tone: "violet", name: "Sample Physio", spend: "£420", leads: 22, cpl: "£19.09", booked: 7, status: "Healthy", statusTone: "green" },
  { initials: "HS", tone: "orange", name: "Sample Energy", spend: "£300", leads: 12, cpl: "£25.00", booked: 4, status: "CPL rising", statusTone: "amber" },
  { initials: "BH", tone: "pink", name: "Sample Heating", spend: "£140", leads: 8, cpl: "£17.50", booked: 2, status: "Learning", statusTone: "blue" },
];

const tableGrid = "grid grid-cols-[minmax(200px,2fr)_repeat(5,minmax(90px,1fr))] items-center gap-3 px-[18px] py-[13px]";

export default function ReportsPage() {
  return (
    <main className="flex flex-col gap-[18px] px-7 pb-10 pt-7">
      <PageHeader
        eyebrow="Growth · Meta ads · Last 14 days · sample data"
        title="Reports & ads"
        subtitle="Spend, cost per lead and booked calls across every ad account, in one place."
        actions={
          <>
            <Segmented options={["7D", "14D", "30D", "90D"]} active="14D" mono />
            <Button icon="download">Export</Button>
            <Button variant="primary" icon="share">Share client report</Button>
          </>
        }
      />

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        {stats.map((s) => (
          <div key={s.label} className="card flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <Tile icon={s.icon} tone={s.tile} size={32} />
              <Pill tone={s.tone} mono>{s.delta}</Pill>
            </div>
            <div>
              <div className="eyebrow">{s.label}</div>
              <div className="mt-1 text-[26px] font-semibold tracking-[-0.04em]">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4">
        <section className="card min-w-0 flex-[2_1_520px] p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold">Booked calls per day</h2>
            <div className="flex gap-3.5 font-mono text-[10.5px] text-muted"><span>TOTAL 31</span><span>BEST DAY MON 02 NOV</span></div>
          </div>
          <div className="grid h-[200px] grid-cols-[repeat(14,1fr)] items-end gap-2" role="img" aria-label="Booked calls per day over 14 days, peaking on 2 November">
            {bars.map((h, i) => (
              <span
                key={i}
                className={`block rounded-[6px_6px_2px_2px] ${h === 100 ? "bg-gradient-to-b from-turquoise to-sky shadow-[0_0_16px_rgba(47,168,235,0.5)]" : "bg-gradient-to-b from-sky to-brand"}`}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-[repeat(14,1fr)] gap-2 text-center font-mono text-[9.5px] text-muted">
            {barDays.map((d) => <span key={d}>{d}</span>)}
          </div>
        </section>

        <section className="card min-w-0 flex-[1_1_320px] p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Top creatives</h2>
            <span className="font-mono text-[10.5px] text-muted">BY BOOKED CALLS</span>
          </div>
          {creatives.map((c, i) => (
            <div key={c.name} className="flex items-center gap-3 border-t border-line py-3">
              <span className="w-[18px] font-mono text-[11px] text-muted">{String(i + 1).padStart(2, "0")}</span>
              <span className={`h-14 w-14 flex-none rounded-xl bg-gradient-to-br ${c.gradient}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold">{c.name}</div>
                <div className="mt-0.5 font-mono text-[10.5px] text-muted">CPL {c.cpl} · {c.booked} BOOKED</div>
              </div>
              <Pill tone={c.tone}>{c.tag}</Pill>
            </div>
          ))}
        </section>
      </div>

      <section className="card overflow-x-auto">
        <div className="min-w-[860px]">
          <div className="flex items-center justify-between px-[18px] pb-1.5 pt-[18px]">
            <h2 className="text-[15px] font-semibold">Ad accounts</h2>
            <Button size="sm" icon="plus">Connect account</Button>
          </div>
          <div className={`${tableGrid} eyebrow border-b border-line`}>
            <span>Account</span><span>Spend</span><span>Leads</span><span>CPL</span><span>Booked</span><span>Status</span>
          </div>
          {accounts.map((a) => (
            <div key={a.name} className={`${tableGrid} border-t border-line first:border-t-0`}>
              <span className="flex items-center gap-2.5">
                <span className={`tile ${a.tone === "blue" ? "" : `tile-${a.tone}`} h-[30px] w-[30px] rounded-[9px] text-[11px] font-semibold`}>{a.initials}</span>
                <span className="text-[13.5px] font-semibold">{a.name}</span>
              </span>
              <span className="font-mono text-[13px]">{a.spend}</span>
              <span className="font-mono text-[13px]">{a.leads}</span>
              <span className="font-mono text-[13px]">{a.cpl}</span>
              <span className="font-mono text-[13px]">{a.booked}</span>
              <span><Pill tone={a.statusTone}>{a.status}</Pill></span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
