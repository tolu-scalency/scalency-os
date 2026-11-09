import type { Metadata } from "next";
import { Icon } from "@/components/icon";
import { Button, PageHeader, Pill, Tile } from "@/components/ui";

export const metadata: Metadata = { title: "Funnels & forms" };

const funnels = [
  { name: "Book-a-call: clinics", url: "SCALENCY.US/CLINICS", rate: "3.9%", live: true, tone: "violet" as const },
  { name: "Book-a-call: solar", url: "SCALENCY.US/SOLAR", rate: "2.1%", live: true, tone: "orange" as const },
  { name: "Webinar registration", url: "SCALENCY.US/MASTERCLASS", rate: "—", live: false, tone: "pink" as const },
];

const pages = [
  { name: "Landing page", stat: "1,240 VISITS" },
  { name: "Application", stat: "186 STARTED · 15%" },
  { name: "Book a call", stat: "48 BOOKED · 26%" },
  { name: "Thank you", stat: "3 STEPS TO CONFIRM" },
];

function Thumb({ index }: { index: number }) {
  // Simple wireframe sketches of each page in the funnel.
  return (
    <div className="flex h-[150px] flex-col gap-1.5 overflow-hidden rounded-xl border border-line-strong bg-surface p-2.5" aria-hidden>
      {index === 0 && (
        <>
          <i className="block h-1.5 w-2/5 rounded bg-sky" />
          <i className="mt-2 block h-3 w-[90%] rounded bg-line-strong" />
          <i className="block h-3 w-[70%] rounded bg-line-strong" />
          <i className="mt-1.5 block h-1 w-4/5 rounded bg-line" />
          <i className="block h-1 w-3/5 rounded bg-line" />
          <i className="btn-primary mt-2 block h-[18px] w-1/2 rounded-md" />
        </>
      )}
      {index === 1 && (
        <>
          <i className="block h-1 w-full overflow-hidden rounded bg-line-strong"><b className="block h-full w-[45%] bg-turquoise" /></i>
          <i className="mt-2.5 block h-2.5 w-4/5 rounded bg-line-strong" />
          <i className="block h-5 w-full rounded-md border border-line-strong" />
          <i className="block h-5 w-full rounded-md border border-sky bg-sky/20" />
          <i className="block h-5 w-full rounded-md border border-line-strong" />
        </>
      )}
      {index === 2 && (
        <>
          <i className="block h-2.5 w-3/5 rounded bg-line-strong" />
          <span className="mt-1.5 grid grid-cols-5 gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <i key={i} className={`block h-3.5 rounded ${i === 2 ? "bg-sky" : "bg-line-strong"}`} />
            ))}
          </span>
          <i className="mt-1 block h-3.5 w-full rounded bg-line" />
          <i className="block h-3.5 w-full rounded bg-line" />
        </>
      )}
      {index === 3 && (
        <div className="flex h-full flex-col items-center justify-center gap-1.5">
          <span className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full bg-ok-bg text-ok"><Icon name="check" size={15} /></span>
          <i className="block h-2.5 w-[70%] rounded bg-line-strong" />
          <i className="block h-1.5 w-1/2 rounded bg-line" />
        </div>
      )}
    </div>
  );
}

export default function FunnelsPage() {
  return (
    <main className="flex flex-col gap-[18px] px-7 pb-10 pt-7">
      <PageHeader
        eyebrow="Growth · 3 funnels · 2 live forms"
        title="Funnels & forms"
        subtitle="Landing page, application, booking and thank-you page in Scalency's standard format."
        actions={<Button icon="plus">Blank funnel</Button>}
      />

      <section className="rounded-[20px] bg-[linear-gradient(120deg,rgba(100,231,239,0.8),rgba(47,168,235,0.25)_40%,rgba(140,175,225,0.15)_70%,rgba(167,139,250,0.7))] p-px">
        <div className="dots relative flex flex-wrap gap-[22px] overflow-hidden rounded-[19px] bg-white p-[22px]">
          <div className="min-w-0 flex-[1_1_260px]">
            <div className="flex items-center gap-2.5">
              <Tile icon="spark" size={36} />
              <div>
                <h2 className="text-[17px] font-semibold tracking-[-0.02em]">AI funnel builder</h2>
                <div className="font-mono text-[10.5px] text-muted">4 INPUTS → FULL FUNNEL</div>
              </div>
            </div>
            <p className="mt-3.5 text-[13.5px] leading-relaxed text-muted">
              Give it the offer, who it&apos;s for, the qualifying questions and the calendar. It builds every page, the application form and the follow-up workflows, ready for review.
            </p>
          </div>
          <form className="grid min-w-0 flex-[2_1_460px] gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
            {[
              ["Offer", "Booked appointments, £2,500/mo"],
              ["Who it's for", "UK solar installers, £10k+/mo"],
              ["Qualifying questions", "Revenue · Team size · Role"],
              ["Calendar", "Sales call · George"],
            ].map(([label, value]) => (
              <label key={label} className="flex flex-col gap-1.5">
                <span className="eyebrow">{label}</span>
                <input defaultValue={value} className="min-h-10 rounded-[11px] border border-line-strong bg-surface px-3 text-[13.5px] outline-none focus:border-brand" />
              </label>
            ))}
            <Button variant="primary" icon="spark" className="col-span-full min-h-[46px] justify-center">Generate funnel</Button>
          </form>
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Tile icon="funnel" tone="violet" size={36} />
            <div>
              <h2 className="text-[15.5px] font-semibold">Book-a-call: clinics</h2>
              <div className="font-mono text-[10.5px] text-muted">SCALENCY.US/CLINICS · EDITED 2H AGO</div>
            </div>
          </div>
          <div className="flex items-center gap-2"><Pill tone="green">Live</Pill><Button size="sm">Edit</Button></div>
        </div>
        <div className="flex flex-wrap items-start gap-1.5">
          {pages.map((p, i) => (
            <div key={p.name} className="flex flex-[1_1_150px] items-start gap-1.5">
              <div className="flex min-w-[140px] flex-1 flex-col gap-2.5">
                <Thumb index={i} />
                <div className="text-[13px] font-semibold">{p.name}</div>
                <div className="font-mono text-[10.5px] text-muted">{p.stat}</div>
              </div>
              {i < pages.length - 1 && <Icon name="arrowRight" size={18} className="mt-[66px] text-muted" />}
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-4">
        <section className="card min-w-0 flex-[1_1_420px] p-5">
          <div className="eyebrow mb-3">All funnels</div>
          {funnels.map((f) => (
            <div key={f.name} className="flex items-center gap-3 border-t border-line py-3">
              <Tile icon="funnel" tone={f.tone} size={32} />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold">{f.name}</div>
                <div className="font-mono text-[10.5px] text-muted">{f.url}</div>
              </div>
              <span className="font-mono text-xs">{f.rate}</span>
              <Pill tone={f.live ? "green" : "neutral"}>{f.live ? "Live" : "Draft"}</Pill>
            </div>
          ))}
        </section>

        <section className="card flex min-w-0 flex-[1_1_300px] flex-wrap items-center gap-[18px] p-5">
          <div className="min-w-0 flex-[1_1_160px]">
            <div className="eyebrow">Form preview</div>
            <div className="mt-2 text-[15px] font-semibold">One question per screen</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">Step 1 is saved the moment it&apos;s sent, so drop-offs still get followed up.</p>
          </div>
          <div className="flex h-[300px] w-[170px] flex-col gap-2.5 rounded-[28px] border border-line-strong bg-surface px-3 py-3.5 shadow-[0_30px_60px_-30px_rgba(11,36,71,0.5),0_0_0_6px_#fff]" aria-hidden>
            <div className="h-[5px] w-[50px] self-center rounded-full bg-line-strong" />
            <div className="h-1 overflow-hidden rounded-full bg-line-strong"><div className="h-full w-2/5 bg-gradient-to-r from-sky to-turquoise" /></div>
            <div className="font-mono text-[9px] text-muted">QUESTION 4 OF 10</div>
            <div className="text-[12.5px] font-semibold leading-snug">Who usually answers new enquiries?</div>
            <div className="rounded-[9px] border border-line-strong px-2.5 py-2 text-[11px]">Me</div>
            <div className="rounded-[9px] border border-sky bg-sky/15 px-2.5 py-2 text-[11px]">A receptionist</div>
            <div className="rounded-[9px] border border-line-strong px-2.5 py-2 text-[11px]">My team</div>
            <div className="btn-primary mt-auto rounded-[9px] py-2 text-center text-[11px] font-semibold">Next →</div>
          </div>
        </section>
      </div>
    </main>
  );
}
