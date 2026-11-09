import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Button, Segmented, Tile } from "@/components/ui";

export const metadata: Metadata = { title: "Calendar" };

const days = [
  { n: "Mon", d: 9 }, { n: "Tue", d: 10 }, { n: "Wed", d: 11 }, { n: "Thu", d: 12 }, { n: "Fri", d: 13 }, { n: "Sat", d: 14 }, { n: "Sun", d: 15 },
];
const hours = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

// day: 0 = Monday. hour: 0 = 09:00. span: hours.
const events = [
  { day: 0, hour: 1, span: 1, title: "Alex Demo", meta: "10:00 · GEORGE", kind: "call", href: "/contacts/alex-demo" },
  { day: 1, hour: 1, span: 1, title: "Sam Test", meta: "10:00 · CONFIRMED", kind: "call", href: "/contacts/sam-test" },
  { day: 1, hour: 4, span: 1, title: "Priya Sample", meta: "13:00 · UNCONFIRMED", kind: "pending", href: "/contacts/priya-sample" },
  { day: 3, hour: 4, span: 1, title: "Jo Example", meta: "13:00 · GEORGE", kind: "call", href: "/contacts/jo-example" },
  { day: 2, hour: 5, span: 2, title: "Weekly demo", meta: "14:00–15:30 · TOLU, DAVID", kind: "internal", href: null },
  { day: 0, hour: 7, span: 1, title: "Rob Trial", meta: "16:00 · GEORGE", kind: "call", href: "/contacts/rob-trial" },
  { day: 4, hour: 2, span: 1, title: "Kim Sandbox", meta: "11:00 · REBOOKED", kind: "pending", href: "/contacts/kim-sandbox" },
];

const look: Record<string, string> = {
  call: "border border-sky/50 bg-gradient-to-br from-sky/25 to-brand/15 shadow-[0_0_20px_-8px_rgba(47,168,235,0.7)]",
  pending: "border border-[#a78bfa]/50 bg-[#a78bfa]/15",
  internal: "border border-dashed border-[#f59e0b]/60 bg-warn-bg",
};

export default function CalendarPage() {
  return (
    <main className="flex flex-wrap items-start gap-4 px-7 pb-10 pt-7">
      <section className="card min-w-0 flex-[3_1_640px] p-5">
        <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button size="sm" icon="chevronLeft" label="Previous week"><span className="sr-only">Previous</span></Button>
            <Button size="sm" icon="chevronRight" label="Next week"><span className="sr-only">Next</span></Button>
            <h1 className="ml-2 text-[26px] font-semibold tracking-[-0.035em]">9–15 November</h1>
            <span className="ml-1 font-mono text-[11px] text-muted">WEEK 46</span>
          </div>
          <Segmented options={["DAY", "WEEK", "MONTH"]} active="WEEK" mono />
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[840px]">
            <div className="grid grid-cols-[58px_repeat(7,minmax(108px,1fr))] pb-2.5">
              <span />
              {days.map((d, i) => (
                <div key={d.n} className="text-center">
                  <div className="eyebrow">{d.n}</div>
                  {i === 1 ? (
                    <div className="btn-primary mx-auto mt-0.5 flex h-[34px] w-[34px] items-center justify-center rounded-full text-[17px] font-semibold">{d.d}</div>
                  ) : (
                    <div className="mt-1 text-xl font-semibold tracking-[-0.03em]">{d.d}</div>
                  )}
                </div>
              ))}
            </div>
            <div
              className="grid grid-cols-[58px_repeat(7,minmax(108px,1fr))] grid-rows-[repeat(9,66px)]"
              style={{ backgroundImage: "repeating-linear-gradient(to bottom,#e1e9f3 0,#e1e9f3 1px,transparent 1px,transparent 66px)" }}
            >
              {hours.map((h, i) => (
                <span key={h} className="pr-2.5 pt-1 text-right font-mono text-[10.5px] text-muted" style={{ gridColumn: 1, gridRow: i + 1 }}>{h}</span>
              ))}
              {days.map((d, i) => (
                <span key={d.n} className={`border-l border-line ${i === 1 ? "bg-sky/5" : ""}`} style={{ gridColumn: i + 2, gridRow: "1 / span 9" }} />
              ))}
              {events.map((e) => {
                const style = { gridColumn: e.day + 2, gridRow: `${e.hour + 1} / span ${e.span}` };
                const body = (
                  <>
                    <strong className="font-semibold">{e.title}</strong>
                    <div className="font-mono text-[10.5px] text-muted">{e.meta}</div>
                  </>
                );
                const cls = `m-[3px] overflow-hidden rounded-[11px] px-2.5 py-2 text-xs leading-snug ${look[e.kind]}`;
                return e.href ? (
                  <Link key={e.title} href={e.href} className={cls} style={style}>{body}</Link>
                ) : (
                  <div key={e.title} className={cls} style={style}>{body}</div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="flex min-w-0 flex-[1_1_290px] flex-col gap-4">
        <section className="card relative flex flex-col gap-3 overflow-hidden p-[18px]">
          <div className="eyebrow">Booking page</div>
          <h2 className="text-[17px] font-semibold tracking-[-0.02em]">Sales call</h2>
          <ul className="flex flex-col gap-2 text-[13px]">
            <li className="flex items-center gap-2.5"><Tile icon="clock" size={26} />45 min · Google Meet</li>
            <li className="flex items-center gap-2.5"><Tile icon="users" tone="violet" size={26} />Round robin · George</li>
            <li className="flex items-center gap-2.5"><Tile icon="shield" tone="green" size={26} />24 hours&apos; minimum notice</li>
          </ul>
          <div className="flex items-center gap-2 rounded-[11px] border border-line-strong bg-surface py-2 pl-3 pr-2">
            <span className="min-w-0 flex-1 truncate font-mono text-xs">scalency.us/book</span>
            <Button size="sm">Copy</Button>
          </div>
        </section>
        <section className="card flex flex-col gap-3 p-[18px]">
          <div className="eyebrow">Synced calendars</div>
          {[["George · Google", "#2fa8eb"], ["Tolu · Google", "#a78bfa"]].map(([name, colour]) => (
            <div key={name} className="flex items-center gap-2.5 text-[13px]">
              <span className="h-2 w-2 rounded-full" style={{ background: colour, boxShadow: `0 0 8px ${colour}` }} />
              <span className="flex-1">{name}</span>
              <span className="font-mono text-[10.5px] text-ok">SYNCED</span>
            </div>
          ))}
          <Button icon="plus" className="justify-center">Connect calendar</Button>
          <p className="flex items-center gap-1.5 text-xs text-muted"><Icon name="clock" size={13} />Bookings still run through GoHighLevel for now.</p>
        </section>
      </div>
    </main>
  );
}
