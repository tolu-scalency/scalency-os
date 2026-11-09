import type { Metadata } from "next";
import { Icon, type IconName } from "@/components/icon";
import { Button, PageHeader, Pill, SampleNote, Tile, type PillTone, type Tone } from "@/components/ui";

export const metadata: Metadata = { title: "Client onboarding" };

const clients: { initials: string; tone: Tone; name: string; done: number; next: string; status: string; statusTone: PillTone }[] = [
  { initials: "LD", tone: "blue", name: "Lee Dummy · Sample Aesthetics", done: 2, next: "Waiting on: Meta ad account access", status: "In progress", statusTone: "blue" },
  { initials: "MC", tone: "violet", name: "Mo Clinic · Sample Physio", done: 4, next: "Waiting on: kickoff call booking", status: "Almost ready", statusTone: "blue" },
  { initials: "HS", tone: "green", name: "Hal Solar · Sample Energy", done: 5, next: "Kickoff booked Thu 12 Nov", status: "Ready", statusTone: "green" },
  { initials: "BH", tone: "orange", name: "Bea Heat · Sample Heating", done: 1, next: "No activity for 3 days. Reminder sent.", status: "Stuck", statusTone: "amber" },
];

const steps: { icon: IconName; tone: Tone; title: string; text: string }[] = [
  { icon: "play", tone: "pink", title: "Welcome", text: "Short video and what happens next" },
  { icon: "form", tone: "blue", title: "Questionnaire", text: "Business, offer, audience, branches" },
  { icon: "lock", tone: "orange", title: "Grant access", text: "Meta ads, Google, website" },
  { icon: "edit", tone: "violet", title: "Sign agreement", text: "E-signature in the browser" },
  { icon: "calendar", tone: "green", title: "Book kickoff", text: "Picks a time with the team" },
];

export default function OnboardingPage() {
  return (
    <main className="flex flex-col gap-[18px] px-7 pb-10 pt-7">
      <PageHeader
        eyebrow="Growth · 4 clients onboarding"
        title="Client onboarding"
        subtitle="One link for each new client. Everything is collected before kickoff."
        actions={<Button variant="primary" icon="link">New onboarding link</Button>}
      />

      <div className="flex flex-wrap items-start gap-4">
        <section className="card min-w-0 flex-[1.3_1_460px] p-5">
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Clients in progress</h2>
            <SampleNote />
          </div>
          {clients.map((c) => (
            <div key={c.name} className="flex items-center gap-3.5 border-t border-line py-3.5">
              <span className={`tile ${c.tone === "blue" ? "" : `tile-${c.tone}`} h-9 w-9 rounded-[11px] text-[13px] font-semibold`}>{c.initials}</span>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2.5">
                  <strong className="text-sm font-semibold">{c.name}</strong>
                  <span className="font-mono text-[10.5px] text-muted">{c.done}/5 STEPS</span>
                </div>
                <div className="my-2 h-1.5 overflow-hidden rounded-full bg-surface">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand via-sky to-turquoise" style={{ width: `${(c.done / 5) * 100}%` }} />
                </div>
                <div className="text-xs text-muted">{c.next}</div>
              </div>
              <Pill tone={c.statusTone}>{c.status}</Pill>
            </div>
          ))}
        </section>

        <section className="card min-w-0 flex-[1_1_340px] p-5">
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Flow template</h2>
            <span className="font-mono text-[10.5px] text-muted">DRAG TO REORDER</span>
          </div>
          <ol className="flex flex-col gap-2">
            {steps.map((s, i) => (
              <li key={s.title} className="flex items-center gap-3 rounded-[14px] border border-line bg-surface p-3">
                <span className="w-5 font-mono text-[10.5px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                <Tile icon={s.icon} tone={s.tone} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold">{s.title}</div>
                  <div className="text-xs text-muted">{s.text}</div>
                </div>
                <Icon name="grip" size={15} className="text-muted/60" />
              </li>
            ))}
          </ol>
          <button type="button" className="mt-2 min-h-10 w-full rounded-xl border border-dashed border-line-strong text-[13px] text-muted hover:border-brand hover:text-brand">+ Add step</button>
        </section>

        <section className="dots relative flex min-w-0 flex-[1_1_300px] flex-col items-center gap-3.5 overflow-hidden rounded-[18px] border border-line bg-surface p-[22px]">
          <div className="eyebrow self-start">What the client sees</div>
          <div className="w-full max-w-[280px] -rotate-2 rounded-[18px] border border-line-strong bg-white p-[18px] shadow-[0_30px_60px_-30px_rgba(11,36,71,0.5)]">
            <div className="flex items-center gap-2"><span className="tile h-[22px] w-[22px] rounded-[7px]" /><span className="text-[13px] font-semibold">Welcome, Lee</span></div>
            <p className="mt-2 text-xs leading-snug text-muted">5 quick steps and we&apos;re ready to launch.</p>
            <ul className="mt-3.5 flex flex-col gap-2 text-xs">
              {["Welcome video", "Business questionnaire"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-ok-bg text-ok"><Icon name="check" size={10} /></span>{t}
                </li>
              ))}
              <li className="flex items-center gap-2 font-semibold"><span className="h-4 w-4 rounded-full border-2 border-brand shadow-[0_0_8px_#2fa8eb]" />Grant ad account access</li>
              {["Sign agreement", "Book kickoff call"].map((t) => (
                <li key={t} className="flex items-center gap-2 text-muted"><span className="h-4 w-4 rounded-full border-[1.5px] border-line-strong" />{t}</li>
              ))}
            </ul>
            <div className="btn-primary mt-4 rounded-[10px] py-2.5 text-center text-xs font-semibold">Continue →</div>
          </div>
          <div className="mt-2 flex w-full items-center gap-2 rounded-[11px] border border-line-strong bg-white py-2 pl-3 pr-2">
            <span className="min-w-0 flex-1 truncate font-mono text-[11.5px]">os.scalency.us/start/lee-dummy</span>
            <Button size="sm">Copy</Button>
          </div>
        </section>
      </div>
    </main>
  );
}
