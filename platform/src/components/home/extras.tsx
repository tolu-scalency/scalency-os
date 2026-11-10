import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";

// Extra homepage sections: the full product map, how a lead flows, and workspaces for agencies.

const modules: { group: string; items: { name: string; text: string; icon: IconName; live: boolean }[] }[] = [
  {
    group: "Sell",
    items: [
      { name: "Contacts", text: "Every lead, with notes and history", icon: "users", live: true },
      { name: "Pipeline", text: "Drag deals through your stages", icon: "pipeline", live: true },
      { name: "Tasks", text: "Follow-ups that never slip", icon: "tasks", live: true },
      { name: "Proposals", text: "Send, sign and get paid", icon: "card", live: false },
    ],
  },
  {
    group: "Talk",
    items: [
      { name: "Inbox", text: "Email and texts in one thread", icon: "inbox", live: true },
      { name: "Team chat", text: "Channels with live lead alerts", icon: "hash", live: true },
      { name: "Calendar", text: "Booking links and reminders", icon: "calendar", live: false },
      { name: "Campaigns", text: "Email and SMS broadcasts", icon: "megaphone", live: false },
    ],
  },
  {
    group: "Automate",
    items: [
      { name: "Workflows", text: "Triggers, waits, texts and emails", icon: "zap", live: true },
      { name: "Scalency AI", text: "Ask anything about your pipeline", icon: "spark", live: true },
      { name: "AI agents", text: "Reply and book while you sleep", icon: "user", live: false },
      { name: "AI builder", text: "Describe it, we build the workflow", icon: "activity", live: false },
    ],
  },
  {
    group: "Grow",
    items: [
      { name: "Funnels", text: "Pages that turn clicks into calls", icon: "funnel", live: false },
      { name: "Forms", text: "Qualify leads as they answer", icon: "form", live: false },
      { name: "Client onboarding", text: "A checklist for every new client", icon: "onboarding", live: false },
      { name: "Ads insights", text: "Cost per booked call, not per click", icon: "chart", live: false },
    ],
  },
];

const flow: { title: string; text: string; icon: IconName; at: string }[] = [
  { title: "Enquiry lands", text: "From your form, ads or a call.", icon: "user", at: "0s" },
  { title: "Instant reply", text: "A text and email go out on their own.", icon: "send", at: "+30s" },
  { title: "Team alerted", text: "#leads lights up with their details.", icon: "hash", at: "+31s" },
  { title: "Call booked", text: "A task for the closer, stage moves.", icon: "calendar", at: "+2h" },
  { title: "Won", text: "Value lands in your pipeline report.", icon: "pound", at: "Day 3" },
];

export function HomeExtras() {
  return (
    <div className="bg-white font-sans text-navy">
      {/* The product map */}
      <section className="relative overflow-hidden py-24">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(85,227,236,0.18),transparent)]" />
        <div className="relative mx-auto max-w-[1200px] px-6 sm:px-8">
          <div className="mx-auto max-w-[680px] text-center">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">The whole platform</span>
            <h2 className="mt-3 text-[38px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-[48px]">
              One workspace. <span className="text-gradient">Every tool</span> your team needs.
            </h2>
            <p className="mt-4 text-[17px] text-muted">Replace the CRM, the automation tool, the chat app and the spreadsheets. Live today, with more arriving every week.</p>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {modules.map((m) => (
              <div key={m.group} className="rounded-3xl border border-line bg-[linear-gradient(180deg,#f7fafe,#ffffff)] p-4">
                <div className="mb-3 px-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{m.group}</div>
                <ul className="flex flex-col gap-2">
                  {m.items.map((it) => (
                    <li key={it.name} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-[0_1px_2px_rgba(11,36,71,0.04)] transition-transform hover:-translate-y-0.5">
                      <span className={`inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl text-white ${it.live ? "bg-[linear-gradient(135deg,#55e3ec,#0a5fe3)]" : "bg-[linear-gradient(135deg,#cbd5e1,#94a3b8)]"}`}>
                        <Icon name={it.icon} size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-[14.5px] font-semibold">
                          {it.name}
                          {it.live ? (
                            <span className="rounded-full bg-ok-bg px-1.5 py-px text-[10px] font-semibold text-ok">Live</span>
                          ) : (
                            <span className="rounded-full bg-surface px-1.5 py-px text-[10px] font-semibold text-muted">Soon</span>
                          )}
                        </span>
                        <span className="block truncate text-[12.5px] text-muted">{it.text}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How a lead flows */}
      <section className="relative overflow-hidden bg-[#061a3a] py-24 text-white">
        <div className="pointer-events-none absolute -left-40 top-10 h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(85,227,236,0.25),transparent)]" />
        <div className="pointer-events-none absolute -right-40 bottom-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(10,95,227,0.45),transparent)]" />
        <div className="relative mx-auto max-w-[1200px] px-6 sm:px-8">
          <div className="max-w-[640px]">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a8f3f7]">Speed to lead</span>
            <h2 className="mt-3 text-[38px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-[48px]">From enquiry to booked call, without lifting a finger.</h2>
          </div>
          <ol className="mt-14 grid gap-4 md:grid-cols-5">
            {flow.map((f, i) => (
              <li key={f.title} className="relative rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
                {i < flow.length - 1 && <span aria-hidden className="absolute -right-4 top-1/2 hidden h-px w-4 bg-gradient-to-r from-[#55e3ec] to-transparent md:block" />}
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#55e3ec,#0a5fe3)] shadow-[0_10px_30px_-10px_rgba(85,227,236,0.8)]">
                    <Icon name={f.icon} size={19} />
                  </span>
                  <span className="font-mono text-[12px] text-[#a8f3f7]">{f.at}</span>
                </div>
                <div className="mt-4 text-[16px] font-semibold">{f.title}</div>
                <p className="mt-1 text-[13.5px] text-white/70">{f.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Workspaces for agencies */}
      <section className="py-24">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-6 sm:px-8 lg:grid-cols-2">
          <div>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">For agencies</span>
            <h2 className="mt-3 text-[38px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-[46px]">One login. A workspace for every client.</h2>
            <p className="mt-4 max-w-[480px] text-[17px] text-muted">
              Spin up a separate workspace for each client in seconds. Their contacts, pipeline, workflows and team stay apart, and you switch between them from one menu.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/signup" className="btn-primary inline-flex min-h-12 items-center gap-2 rounded-xl px-6 text-[15px] font-semibold">
                Create your workspace <Icon name="arrowRight" size={16} />
              </Link>
              <Link href="/login" className="btn-ghost inline-flex min-h-12 items-center rounded-xl px-6 text-[15px] font-semibold">Log in</Link>
            </div>
          </div>
          <div aria-hidden className="relative mx-auto h-[360px] w-full max-w-[460px]">
            {[
              { name: "Bright Clinics", tone: "from-[#55e3ec] to-[#0a5fe3]", top: 0, left: 40, rot: -4 },
              { name: "Solar North", tone: "from-[#fdba74] to-[#ea580c]", top: 70, left: 0, rot: 2 },
              { name: "Your agency", tone: "from-[#a5b4fc] to-[#4f46e5]", top: 150, left: 60, rot: -1 },
            ].map((w) => (
              <div key={w.name} className="absolute w-[340px] rounded-2xl border border-line bg-white p-4 shadow-[var(--shadow-pop)]" style={{ top: w.top, left: w.left, transform: `rotate(${w.rot}deg)` }}>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-[15px] font-bold text-white ${w.tone}`}>{w.name[0]}</span>
                  <div className="flex-1">
                    <div className="text-[15px] font-semibold">{w.name}</div>
                    <div className="text-[12px] text-muted">Workspace</div>
                  </div>
                  <Icon name="chevronDown" size={16} className="text-faint" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {["Leads", "Booked", "Won"].map((k, i) => (
                    <div key={k} className="rounded-xl bg-surface p-2.5">
                      <div className="text-[11px] text-muted">{k}</div>
                      <div className="mt-0.5 h-2 rounded-full bg-[linear-gradient(90deg,#55e3ec,#0a5fe3)]" style={{ width: `${80 - i * 22}%` }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
