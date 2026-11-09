import type { Metadata } from "next";
import { Icon, type IconName } from "@/components/icon";
import { Button, Tile, type Tone } from "@/components/ui";

export const metadata: Metadata = { title: "AI builder" };

type Step = { kind: string; title: string; icon: IconName; tone: Tone; badge?: string; selected?: boolean };

// The sample L1 workflow, as the AI builder would draft it. Wording and timings are Tolu's call.
const steps: Step[] = [
  { kind: "Trigger", title: "Application step 1 sent", icon: "form", tone: "pink", badge: "41 RUNS" },
  { kind: "Team chat", title: "Post to #new-leads", icon: "hash", tone: "green" },
  { kind: "Wait", title: "10 minutes", icon: "clock", tone: "grey" },
  { kind: "Send text", title: "L1 SMS 1", icon: "inbox", tone: "blue", selected: true },
  { kind: "Wait", title: "1 hour", icon: "clock", tone: "grey" },
  { kind: "Send email", title: "L1 Email 1", icon: "mail", tone: "violet" },
  { kind: "Condition", title: "Email opened in 12h?", icon: "branch", tone: "orange" },
];

function Node({ step, width = "w-[300px]" }: { step: Step; width?: string }) {
  return (
    <div
      className={`${width} flex max-w-full items-center gap-3 rounded-2xl border bg-white px-3.5 py-3 shadow-[0_18px_36px_-20px_rgba(11,36,71,0.35)] ${
        step.selected ? "border-sky shadow-[0_0_0_4px_rgba(47,168,235,0.14),0_0_40px_-8px_rgba(47,168,235,0.55)]" : "border-line-strong"
      }`}
    >
      <Tile icon={step.icon} tone={step.tone} size={36} />
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted">{step.kind}</div>
        <div className="text-sm font-semibold tracking-[-0.01em]">{step.title}</div>
      </div>
      {step.badge && <span className="rounded-[5px] bg-ok-bg px-1.5 py-0.5 font-mono text-[9.5px] text-ok">{step.badge}</span>}
      {step.selected && <span className="font-mono text-[9.5px] text-brand">EDITING</span>}
    </div>
  );
}

function Switch({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between gap-2.5 text-[13px]">
      {label}
      <span className="btn-primary relative h-5 w-9 flex-none rounded-full" role="img" aria-label="On">
        <span className="absolute right-[3px] top-[3px] h-3.5 w-3.5 rounded-full bg-white" />
      </span>
    </div>
  );
}

export default function BuilderPage() {
  return (
    <main className="flex min-h-full flex-col">
      <div className="flex min-h-[64px] flex-wrap items-center gap-3 border-b border-line bg-white px-[22px] py-3">
        <div className="min-w-0 flex-[1_1_200px]">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted">L1</span>
            <h1 className="text-base font-semibold tracking-[-0.02em]">Application Started</h1>
          </div>
          <div className="mt-0.5 font-mono text-[10.5px] text-muted">DRAFT · AUTOSAVED 14:52 · NOT APPROVED</div>
        </div>
        <Button href="/contacts/sam-test" icon="play">Run test</Button>
        <Button href="/chat" variant="primary" icon="send">Send for approval</Button>
      </div>

      <div className="flex flex-1 flex-wrap">
        {/* AI chat */}
        <section aria-label="AI assistant" className="flex min-w-0 flex-[1_1_300px] flex-col border-r border-line bg-white">
          <div className="flex items-center gap-2.5 border-b border-line px-[18px] py-4">
            <Tile icon="spark" size={32} />
            <div>
              <div className="text-sm font-semibold">Scalency AI</div>
              <div className="font-mono text-[10.5px] text-muted">WORKFLOW ARCHITECT</div>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-3.5 p-[18px] text-[13px] leading-relaxed">
            <div className="btn-primary max-w-[90%] self-end rounded-[16px_16px_4px_16px] px-3.5 py-2.5">
              When someone starts the application but doesn&apos;t finish, alert the team, text them after 10 minutes and email after an hour. Stop as soon as they finish.
            </div>
            <div className="max-w-[95%] self-start rounded-[16px_16px_16px_4px] border border-line-strong bg-surface px-3.5 py-3">
              <div className="mb-1.5 font-mono text-[10px] text-brand">✦ BUILT 7 STEPS</div>
              Things I set up for you:
              <ul className="mt-2 list-disc space-y-1 pl-4 text-muted">
                <li>Texts after 8 pm wait until 8 am</li>
                <li>Exits if they finish the form or book</li>
                <li>Wording uses your approved templates</li>
              </ul>
            </div>
            <div className="btn-primary max-w-[90%] self-end rounded-[16px_16px_4px_16px] px-3.5 py-2.5">If they don&apos;t open the email, text again next morning.</div>
            <div className="max-w-[95%] self-start rounded-[16px_16px_16px_4px] border border-line-strong bg-surface px-3.5 py-3">
              Added an <strong className="font-semibold">&quot;Email opened?&quot;</strong> check with a 9 am text on the No branch.
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["Make it shorter", "Add WhatsApp", "Explain this flow"].map((c) => (
                <span key={c} className="rounded-full border border-line-strong bg-surface px-2.5 py-1.5 text-xs">{c}</span>
              ))}
            </div>
          </div>
          <form className="mx-3.5 mb-3.5 flex gap-2 rounded-[14px] border border-sky/40 bg-surface py-1.5 pl-3 pr-1.5 shadow-[0_0_24px_-10px_rgba(47,168,235,0.5)]">
            <label className="flex-1">
              <span className="sr-only">Describe a change</span>
              <input type="text" placeholder="Describe a change…" className="min-h-10 w-full bg-transparent text-[13px] outline-none placeholder:text-muted" />
            </label>
            <Button variant="primary" icon="arrowRight" label="Send"><span className="sr-only">Send</span></Button>
          </form>
        </section>

        {/* Canvas */}
        <section aria-label="Workflow canvas" className="dots relative flex min-w-0 flex-[2_1_460px] flex-col items-center overflow-hidden px-5 pb-8 pt-7">
          <div className="absolute right-3.5 top-3.5 flex gap-1.5 font-mono text-[10.5px] text-muted">
            <span className="rounded-lg border border-line-strong bg-white px-2 py-1.5">100%</span>
            <span className="rounded-lg border border-line-strong bg-white px-2 py-1.5">FIT</span>
          </div>
          {steps.map((s, i) => (
            <div key={s.title} className="flex flex-col items-center">
              {i > 0 && <span className="connector" />}
              <Node step={s} />
            </div>
          ))}
          <div className="h-[26px] w-[360px] max-w-full rounded-t-[14px] border-2 border-b-0 border-sky/60" />
          <div className="flex w-full flex-wrap justify-center gap-9">
            <div className="flex flex-col items-center gap-2">
              <span className="rounded-full bg-ok-bg px-2.5 py-0.5 font-mono text-[10px] text-ok">YES</span>
              <Node step={{ kind: "End", title: "Leave workflow", icon: "stop", tone: "grey" }} width="w-[220px]" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="rounded-full bg-warn-bg px-2.5 py-0.5 font-mono text-[10px] text-warn">NO</span>
              <Node step={{ kind: "Send text", title: "L1 SMS 2 · 9 am", icon: "inbox", tone: "blue" }} width="w-[220px]" />
            </div>
          </div>
          <Button icon="plus" className="mt-[22px] border-dashed">Add step</Button>
        </section>

        {/* Step settings */}
        <aside aria-label="Step settings" className="flex min-w-0 flex-[1_1_280px] flex-col gap-4 border-l border-line bg-white p-[18px]">
          <div className="flex items-center gap-2.5">
            <Tile icon="inbox" size={36} />
            <div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted">Send text</div>
              <div className="text-base font-semibold tracking-[-0.02em]">L1 SMS 1</div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="eyebrow">Template</span>
            <div className="flex min-h-10 items-center justify-between rounded-[11px] border border-line-strong bg-surface px-3 text-[13.5px]">L1 SMS 1 <Icon name="chevronDown" size={15} /></div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="eyebrow">From</span>
            <div className="flex min-h-10 items-center justify-between rounded-[11px] border border-line-strong bg-surface px-3 font-mono text-[12.5px]">+44 UK · SCALENCY <Icon name="chevronDown" size={15} /></div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="eyebrow">Preview</span>
            <div className="rounded-[22px] border border-line-strong bg-surface p-3.5">
              <div className="rounded-[14px_14px_14px_4px] border border-line bg-white px-3 py-2.5 text-[13px] leading-relaxed">
                Hi <code className="rounded-[5px] bg-chip px-1 font-mono text-[11.5px] text-brand">first_name</code>, [wording for Tolu to approve]{" "}
                <code className="rounded-[5px] bg-chip px-1 font-mono text-[11.5px] text-brand">form_link</code>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-[14px] border border-line-strong bg-surface p-3.5">
            <Switch label="Quiet hours 08:00–20:00" />
            <Switch label="Skip if unsubscribed" />
            <Switch label="Retry if it fails" />
          </div>
          <div className="mt-auto rounded-[14px] border border-ok/30 bg-ok-bg p-3.5">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-ok"><Icon name="check" size={15} />Last test passed</div>
            <div className="mt-1.5 font-mono text-[10.5px] text-muted">7/7 STEPS · SAM TEST · 14:51</div>
          </div>
        </aside>
      </div>
    </main>
  );
}
