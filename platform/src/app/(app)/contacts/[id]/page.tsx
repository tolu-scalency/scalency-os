import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
import { Button, Pill, Tile, type Tone } from "@/components/ui";
import { contacts, findContact } from "@/lib/sample-data";

// Every sample contact gets its own page at build time.
export function generateStaticParams() {
  return contacts.map((c) => ({ id: c.id }));
}

export async function generateMetadata(props: PageProps<"/contacts/[id]">) {
  const { id } = await props.params;
  return { title: findContact(id)?.name ?? "Contact" };
}

const stages = ["Started", "Qualified", "Call booked", "Confirmed", "Showed up", "Follow-up", "Closed"];

const timeline: { icon: IconName; tone: Tone; title: string; when: string; text: string }[] = [
  { icon: "inbox", tone: "green", title: "Replied YES by text", when: "14:49", text: "Call marked confirmed. George told in #booked-calls." },
  { icon: "mail", tone: "blue", title: "Email: Your call on Tuesday", when: "14:50", text: "Opened at 14:52. Sent to the test inbox (test mode)." },
  { icon: "inbox", tone: "blue", title: "Text: booking confirmation", when: "14:41", text: "From L4 Booked Call. Delivered to the test phone." },
  { icon: "calendar", tone: "violet", title: "Call booked with George", when: "14:40", text: "Tue 10 November, 10:00 to 10:45, Google Meet." },
  { icon: "zap", tone: "orange", title: "Moved to Qualified", when: "14:31", text: "Application finished. All answers qualify." },
  { icon: "form", tone: "pink", title: "Application started", when: "14:28", text: "Step 1 from the book-a-call page. UTM meta / clinics-a." },
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-t border-line py-2.5 text-[13px] first:border-t-0">
      <span className="text-muted">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

export default async function ContactPage(props: PageProps<"/contacts/[id]">) {
  const { id } = await props.params;
  const c = findContact(id);
  if (!c) notFound();

  const currentStage = 3; // "Confirmed" in the sample data

  return (
    <main className="flex flex-col gap-4 px-7 pb-10 pt-6">
      <Link href="/contacts" className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted hover:text-brand">
        <Icon name="arrowLeft" size={13} /> ALL CONTACTS
      </Link>

      <section className="card relative overflow-hidden">
        <div className="dots pointer-events-none absolute inset-0 [mask-image:linear-gradient(90deg,transparent,#000_60%)]" />
        <div className="relative flex flex-wrap items-center gap-5 p-6">
          <span className="tile h-[72px] w-[72px] rounded-[22px] text-2xl font-semibold">{c.initials}</span>
          <div className="min-w-0 flex-[1_1_260px]">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[28px] font-semibold tracking-[-0.035em]">{c.name}</h1>
              <Pill tone={c.stageTone}>{c.stage}</Pill>
              <Pill tone="neutral" mono>TEST CONTACT</Pill>
            </div>
            <div className="mt-1.5 text-[13.5px] text-muted">{c.business} · {c.source}</div>
          </div>
          <div className="flex items-center gap-3.5 rounded-2xl border border-line bg-surface py-2.5 pl-2.5 pr-4">
            <svg viewBox="0 0 44 44" width={52} height={52} aria-hidden>
              <circle cx={22} cy={22} r={18} fill="none" stroke="#cfdcea" strokeWidth={4} />
              <circle cx={22} cy={22} r={18} fill="none" stroke="#0465c7" strokeWidth={4} strokeLinecap="round" strokeDasharray={`${(c.score / 100) * 113} 113`} transform="rotate(-90 22 22)" />
            </svg>
            <div>
              <div className="eyebrow">AI lead score</div>
              <div className="text-[22px] font-semibold tracking-[-0.03em]">{c.score}<span className="text-[13px] text-muted"> / 100</span></div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button icon="phone" label="Call">Call</Button>
            <Button href="/inbox" icon="inbox">Text</Button>
            <Button href="/inbox" variant="primary" icon="mail">Email</Button>
          </div>
        </div>
        <ol className="relative flex overflow-x-auto border-t border-line px-6 pb-5 pt-[18px]">
          {stages.map((s, i) => (
            <li key={s} className={`relative flex min-w-20 flex-1 flex-col items-center gap-2 text-xs ${i === currentStage ? "font-semibold text-navy" : "text-muted"}`}>
              {i > 0 && <span className={`absolute right-1/2 top-[6px] h-0.5 w-full ${i <= currentStage ? "bg-sky" : "bg-line-strong"}`} />}
              <span
                className={`relative z-[1] h-3.5 w-3.5 rounded-full border-2 ${
                  i < currentStage ? "border-sky bg-sky" : i === currentStage ? "border-brand bg-brand shadow-[0_0_0_5px_rgba(4,101,199,0.15)]" : "border-line-strong bg-white"
                }`}
              />
              {s}
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[1_1_270px] flex-col gap-4">
          <section className="card p-[18px]">
            <div className="eyebrow mb-2">Contact</div>
            <Row label="Email">{c.email}</Row>
            <Row label="Phone"><span className="font-mono">{c.phone}</span></Row>
            <Row label="Time zone"><span className="font-mono">EUROPE/LONDON</span></Row>
            <Row label="Consent">Email, SMS</Row>
            <Row label="Source">{c.source}</Row>
          </section>
          <section className="card p-[18px]">
            <div className="eyebrow mb-2">Application answers</div>
            <Row label="Business type">{c.business}</Row>
            <Row label="Sites"><span className="font-mono">3–6</span></Row>
            <Row label="Answers enquiries">Receptionist</Row>
            <Row label="Monthly revenue"><span className="font-mono">£25–50K</span></Row>
            <Row label="Role">Owner</Row>
          </section>
        </div>

        <section className="card min-w-0 flex-[2_1_440px] px-[22px] pb-2.5 pt-1">
          <div className="mb-[18px] flex flex-wrap border-b border-line">
            {["Activity", "Messages", "Notes", "Tasks", "Files"].map((t, i) => (
              <span key={t} className={`mr-5 border-b-2 px-0.5 py-2.5 text-[13px] ${i === 0 ? "border-brand text-navy" : "border-transparent text-muted"}`}>{t}</span>
            ))}
          </div>
          <div className="mb-[18px] rounded-[14px] border border-brand/20 bg-gradient-to-br from-chip to-transparent p-3.5">
            <div className="flex items-center gap-2 text-[13px] font-semibold"><Icon name="spark" size={15} className="text-brand" />AI summary</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              Booked within 12 minutes of applying and confirmed by text. Runs 3+ clinics with a front desk, which matches the multi-site profile. Suggested next step: prepare the Tier 2 pitch for Tuesday.
            </p>
          </div>
          <ol>
            {timeline.map((e, i) => (
              <li key={e.title} className="relative flex gap-3.5 pb-5">
                {i < timeline.length - 1 && <span className="absolute bottom-0 left-4 top-9 w-px bg-line-strong" />}
                <Tile icon={e.icon} tone={e.tone} size={34} />
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex justify-between gap-3 text-[13.5px]">
                    <strong className="font-semibold">{e.title}</strong>
                    <span className="whitespace-nowrap font-mono text-[11px] text-muted">{e.when}</span>
                  </div>
                  <div className="mt-1 text-[12.5px] leading-snug text-muted">{e.text}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="flex min-w-0 flex-[1_1_270px] flex-col gap-4">
          <section className="card p-[18px]">
            <div className="eyebrow">Opportunity</div>
            <div className="mt-2 text-[30px] font-semibold tracking-[-0.04em]">£5,000<span className="text-sm font-normal text-muted"> / mo</span></div>
            <div className="mt-2.5">
              <Row label="Pipeline">Lead gen</Row>
              <Row label="Closer">George</Row>
              <Row label="Call"><span className="font-mono">TUE 10 NOV · 10:00</span></Row>
            </div>
          </section>
          <section className="card p-[18px]">
            <div className="eyebrow mb-3">Workflows</div>
            <div className="mb-2.5 flex items-center gap-2.5 text-[13px]"><span className="h-[7px] w-[7px] rounded-full bg-sky shadow-[0_0_8px_#2fa8eb]" /><span className="flex-1">L4 Booked Call</span><span className="font-mono text-[10.5px] text-muted">RUNNING</span></div>
            <div className="flex items-center gap-2.5 text-[13px]"><span className="h-[7px] w-[7px] rounded-full bg-line-strong" /><span className="flex-1">L1 Application Started</span><span className="font-mono text-[10.5px] text-muted">EXITED</span></div>
          </section>
          <section className="card p-[18px]">
            <div className="eyebrow mb-3">Tasks</div>
            <div className="flex items-start gap-2.5 text-[13px]">
              <span className="mt-px h-4 w-4 flex-none rounded-[5px] border-[1.5px] border-line-strong" />
              <div><div>Prepare Tier 2 pitch</div><div className="mt-0.5 font-mono text-[10.5px] text-muted">GEORGE · DUE MON</div></div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
