import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";

export const metadata: Metadata = { title: "Log in" };

const recent: { icon: IconName; title: string; text: string }[] = [
  { icon: "inbox", title: "Text sent to a new lead", text: "L1 Application Started · 1 min after they dropped off" },
  { icon: "calendar", title: "Call booked with George", text: "Confirmation and reminders scheduled" },
  { icon: "hash", title: "Team alerted in #new-leads", text: "George replied: “On it”" },
];

// The login screen. Sign-in itself is connected in Step 2 (Supabase, invite only).
export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-wrap">
      <div className="flex min-w-0 flex-[1_1_480px] flex-col px-12 py-10">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <span className="tile h-[34px] w-[34px] rounded-[10px]"><Icon name="logoArrow" size={17} strokeWidth={2.4} /></span>
          <span className="text-lg font-bold tracking-[-0.035em]">Scalency <span className="text-brand">OS</span></span>
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <form className="flex w-full max-w-[400px] flex-col gap-[18px]">
            <div>
              <h1 className="text-[32px] font-semibold tracking-[-0.035em]">Welcome back</h1>
              <p className="mt-2 text-[15px] text-muted">Log in to your team&apos;s workspace.</p>
            </div>
            <button type="button" className="flex min-h-[50px] items-center justify-center gap-2.5 rounded-xl border border-line-strong text-[15px] font-semibold hover:border-brand">
              <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-brand text-xs font-extrabold text-brand">G</span>
              Continue with Google
            </button>
            <div className="flex items-center gap-3 text-xs font-semibold text-muted"><span className="h-px flex-1 bg-line-strong" />or<span className="h-px flex-1 bg-line-strong" /></div>
            <label className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold">Work email</span>
              <input type="email" placeholder="you@scalency.co.uk" className="min-h-[50px] rounded-xl border border-line-strong px-3.5 text-[15px] outline-none focus:border-brand" />
            </label>
            <Link href="/dashboard" className="btn-primary flex min-h-[50px] items-center justify-center gap-2 rounded-xl text-[15px] font-semibold">
              Email me a login link <Icon name="arrowRight" size={16} />
            </Link>
            <p className="text-[13px] leading-relaxed text-muted">Invite only. Ask your workspace owner to add you if you don&apos;t have access.</p>
          </form>
        </div>
        <div className="text-xs text-muted">© 2026 Scalency LTD</div>
      </div>

      <div className="sidebar-blue relative flex min-w-0 flex-[1_1_480px] flex-col justify-center gap-8 overflow-hidden p-14 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:40px_40px]" />
        <div className="relative max-w-[460px]">
          <div className="font-mono text-xs font-semibold tracking-[0.12em] text-[#a8f3f7]">WHILE YOU WERE AWAY</div>
          <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.03em]">Every enquiry was answered and followed up.</h2>
        </div>
        <ul className="relative flex max-w-[460px] flex-col gap-3">
          {recent.map((r) => (
            <li key={r.title} className="flex items-center gap-3.5 rounded-[14px] border border-white/15 bg-white/10 p-4">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] bg-white text-brand"><Icon name={r.icon} size={18} /></span>
              <div>
                <div className="text-sm font-semibold">{r.title}</div>
                <div className="text-xs text-white/80">{r.text}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
