import type { Metadata } from "next";
import { Suspense } from "react";
import { Icon, type IconName } from "@/components/icon";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

const points: { icon: IconName; title: string; text: string }[] = [
  { icon: "zap", title: "Follow-ups run themselves", text: "Texts, emails and reminders go out on time, every time." },
  { icon: "hash", title: "The team sees every lead", text: "New leads and booked calls post straight to team chat." },
  { icon: "shield", title: "Safe by default", text: "Test mode is on until the owner switches it off." },
];

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-wrap">
      <div className="flex min-w-0 flex-[1_1_480px] flex-col px-12 py-10">
        <div className="inline-flex items-center gap-2.5">
          <span className="tile h-[34px] w-[34px] rounded-[10px]"><Icon name="logoArrow" size={17} strokeWidth={2.4} /></span>
          <span className="text-lg font-bold tracking-[-0.035em]">Scalency <span className="text-brand">OS</span></span>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="flex w-full max-w-[400px] flex-col gap-6">
            <div>
              <h1 className="text-[32px] font-semibold tracking-[-0.035em]">Welcome back</h1>
              <p className="mt-2 text-[15px] text-muted">Log in to your team&apos;s workspace.</p>
            </div>
            <Suspense fallback={<div className="h-[220px]" />}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
        <div className="text-xs text-muted">© 2026 Scalency LTD</div>
      </div>

      <div className="sidebar-blue relative flex min-w-0 flex-[1_1_480px] flex-col justify-center gap-8 overflow-hidden p-14 text-white">
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
