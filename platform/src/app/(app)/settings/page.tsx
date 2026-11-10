import type { Metadata } from "next";
import { Icon, type IconName } from "@/components/icon";
import { Pill, Tile, type PillTone, type Tone } from "@/components/ui";

export const metadata: Metadata = { title: "Settings" };


// Honest status for each service. Only Supabase is connected so far.
const integrations: { name: string; what: string; icon: IconName; tone: Tone; status: string; statusTone: PillTone; when: string }[] = [
  { name: "Supabase", what: "Database, logins and the workflow clock.", icon: "database", tone: "green", status: "Connected", statusTone: "green", when: "Now" },
  { name: "Resend", what: "Emails sent from send.scalency.us.", icon: "mail", tone: "blue", status: "Not connected", statusTone: "neutral", when: "Step 4" },
  { name: "Twilio", what: "Texts to and from leads on a UK number.", icon: "inbox", tone: "red", status: "Not connected", statusTone: "neutral", when: "Step 4" },
  { name: "Claude AI", what: "Powers the AI builder, summaries and scoring.", icon: "spark", tone: "pink", status: "Not connected", statusTone: "neutral", when: "Step 6" },
  { name: "Google Calendar", what: "Busy times and bookings for each closer.", icon: "calendar", tone: "violet", status: "Not connected", statusTone: "neutral", when: "Later" },
  { name: "Meta Lead Ads", what: "Instant-form leads and ad spend, straight in.", icon: "megaphone", tone: "blue", status: "Not connected", statusTone: "neutral", when: "Later" },
  { name: "WhatsApp Business", what: "Two-way WhatsApp in the same inbox.", icon: "inbox", tone: "green", status: "Not connected", statusTone: "neutral", when: "Later" },
  { name: "Stripe", what: "Mark deals as won when a client pays.", icon: "card", tone: "grey", status: "Not connected", statusTone: "neutral", when: "Later" },
  { name: "Webhooks", what: "Send or receive events from any other tool.", icon: "link", tone: "orange", status: "Not connected", statusTone: "neutral", when: "Later" },
];

const sections: { label: string; icon: IconName; on?: boolean }[] = [
  { label: "Business profile", icon: "building" },
  { label: "Team and roles", icon: "users" },
  { label: "Integrations", icon: "link", on: true },
  { label: "Phone numbers", icon: "inbox" },
  { label: "Email sending", icon: "mail" },
  { label: "Custom values", icon: "type" },
  { label: "Pipelines", icon: "pipeline" },
  { label: "AI settings", icon: "spark" },
  { label: "Billing", icon: "card" },
];

export default function SettingsPage() {
  return (
    <main className="flex flex-wrap items-start gap-[26px] px-7 pb-10 pt-7">
      <nav aria-label="Settings" className="flex flex-[1_1_210px] flex-col gap-0.5">
        <div className="eyebrow px-3 pb-2.5">Settings</div>
        {sections.map((s) => (
          <span
            key={s.label}
            aria-current={s.on ? "page" : undefined}
            className={`flex min-h-10 items-center gap-2.5 rounded-[10px] px-3 text-[13.5px] ${s.on ? "bg-chip font-semibold text-brand" : "text-muted"}`}
          >
            <Icon name={s.icon} size={15} />
            {s.label}
          </span>
        ))}
      </nav>

      <div className="flex min-w-0 flex-[4_1_560px] flex-col gap-[18px]">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.035em]">Integrations</h1>
          <p className="mt-1.5 text-sm text-muted">Connect the services Scalency OS uses to send, book, track and think.</p>
        </div>

        <section className="dots flex flex-wrap items-center gap-4 rounded-[18px] border border-[#d99600]/35 bg-warn-bg p-5">
          <Tile icon="shield" tone="orange" size={44} />
          <div className="min-w-0 flex-[1_1_260px]">
            <h2 className="text-base font-semibold">Test mode is on</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">Every email goes to the test inbox and every text to the test phone. Only the owner can switch this off.</p>
          </div>
          <span className="font-mono text-[11px] text-warn">OWNER ONLY</span>
          <span role="img" aria-label="Test mode on" className="relative h-[26px] w-[46px] flex-none rounded-full bg-gradient-to-b from-[#f59e0b] to-[#d97706]">
            <span className="absolute right-[3px] top-[3px] h-5 w-5 rounded-full bg-white" />
          </span>
        </section>

        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
          {integrations.map((a) => (
            <section key={a.name} className="card flex flex-col gap-4 p-[18px]">
              <div className="flex items-start gap-3">
                <Tile icon={a.icon} tone={a.tone} size={44} />
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] font-semibold">{a.name}</h2>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{a.what}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-line pt-3.5">
                <Pill tone={a.statusTone}>{a.status}</Pill>
                <span className="font-mono text-[10.5px] text-muted">{a.when === "Now" ? "ACTIVE" : a.when.toUpperCase()}</span>
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
