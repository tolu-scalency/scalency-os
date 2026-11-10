import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icon";
import { Logo } from "@/components/logo";

// The two-panel layout shared by the log in and sign up pages.

const points: { icon: IconName; title: string; text: string }[] = [
  { icon: "zap", title: "Follow-ups run themselves", text: "Texts, emails and reminders go out on time, every time." },
  { icon: "hash", title: "The team sees every lead", text: "New leads and booked calls post straight to team chat." },
  { icon: "shield", title: "Safe by default", text: "Test mode is on until the owner switches it off." },
];

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-wrap">
      <div className="flex min-w-0 flex-[1_1_480px] flex-col px-6 py-8 sm:px-12 sm:py-10">
        <Link href="/" className="inline-flex w-fit">
          <Logo height={28} />
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="flex w-full max-w-[400px] flex-col gap-6">
            <div>
              <h1 className="text-[32px] font-semibold tracking-[-0.035em]">{title}</h1>
              <p className="mt-2 text-[15px] text-muted">{subtitle}</p>
            </div>
            {children}
          </div>
        </div>
        <div className="text-xs text-muted">© 2026 Scalency LTD</div>
      </div>

      <div className="sidebar-blue relative hidden min-w-0 flex-[1_1_480px] flex-col justify-center gap-8 overflow-hidden p-14 text-white md:flex">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:40px_40px]" />
        <div className="relative max-w-[460px]">
          <div className="font-mono text-xs font-semibold tracking-[0.12em] text-[#a8f3f7]">SCALENCY OS</div>
          <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.03em]">Every enquiry answered, followed up and booked.</h2>
        </div>
        <ul className="relative flex max-w-[460px] flex-col gap-3">
          {points.map((r) => (
            <li key={r.title} className="flex items-center gap-3.5 rounded-[14px] border border-white/15 bg-white/10 p-4">
              <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-white text-brand"><Icon name={r.icon} size={18} /></span>
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

export const inputClass =
  "min-h-[50px] w-full rounded-xl border border-line-strong bg-white px-3.5 text-[15px] outline-none focus:border-brand";

export function Notice({ tone = "warn", children }: { tone?: "warn" | "bad" | "ok"; children: ReactNode }) {
  const tones = {
    warn: "border-[#d99600]/35 bg-warn-bg text-warn",
    bad: "border-bad/30 bg-bad-bg text-bad",
    ok: "border-ok/30 bg-ok-bg text-ok",
  };
  return <p role="alert" className={`rounded-xl border px-3.5 py-3 text-[13px] ${tones[tone]}`}>{children}</p>;
}
