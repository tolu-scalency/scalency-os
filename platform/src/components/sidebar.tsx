"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Icon, type IconName } from "./icon";

type Item = { href: string; label: string; icon: IconName; badge?: string; isNew?: boolean };

const sections: { title: string; items: Item[] }[] = [
  {
    title: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/inbox", label: "Conversations", icon: "inbox" },
      { href: "/contacts", label: "Contacts", icon: "users" },
      { href: "/pipeline", label: "Pipeline", icon: "pipeline" },
      { href: "/calendar", label: "Calendar", icon: "calendar" },
    ],
  },
  {
    title: "Growth",
    items: [
      { href: "/funnels", label: "Funnels & forms", icon: "funnel", isNew: true },
      { href: "/onboarding", label: "Client onboarding", icon: "onboarding", isNew: true },
      { href: "/reports", label: "Reports & ads", icon: "chart", isNew: true },
    ],
  },
  {
    title: "Automation",
    items: [
      { href: "/workflows", label: "Workflows", icon: "zap" },
      { href: "/workflows/builder", label: "AI builder", icon: "spark" },
    ],
  },
  {
    title: "Team",
    items: [
      { href: "/chat", label: "Team chat", icon: "hash" },
      { href: "/settings", label: "Settings", icon: "settings" },
    ],
  },
];

// The most specific matching item wins, so /workflows/builder highlights "AI builder" and not "Workflows".
function activeHref(pathname: string) {
  const all = sections.flatMap((s) => s.items.map((i) => i.href));
  return all.filter((h) => pathname === h || pathname.startsWith(h + "/")).sort((a, b) => b.length - a.length)[0];
}

export function Sidebar() {
  const pathname = usePathname();
  const current = activeHref(pathname);
  const [email, setEmail] = useState<string | null>(null);

  // Show who is signed in. The page itself is already protected on the server.
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);
  const initials = (email ?? "?").slice(0, 2).toUpperCase();

  return (
    <nav aria-label="Main" className="sidebar-blue relative flex h-full min-h-screen flex-col gap-0.5 overflow-hidden px-3.5 py-5 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.10)_1px,transparent_1px)] bg-[length:18px_18px]" />
      <div className="pointer-events-none absolute -right-28 -top-36 h-72 w-80 bg-[radial-gradient(closest-side,rgba(100,231,239,0.35),transparent)]" />

      <Link href="/dashboard" className="relative flex items-center gap-2.5 px-2 pb-[18px] pt-1">
        <span className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-white text-brand shadow-[0_6px_18px_rgba(2,40,90,0.35)]">
          <Icon name="logoArrow" size={17} strokeWidth={2.4} />
        </span>
        <span className="text-[17px] font-bold tracking-[-0.03em]">
          Scalency
          <span className="ml-1.5 rounded-md bg-white/20 px-1.5 py-0.5 align-[2px] font-mono text-[10.5px] font-semibold tracking-wider">OS</span>
        </span>
      </Link>

      <div className="relative mb-3 flex items-center gap-2.5 rounded-xl border border-white/20 bg-white/10 p-2.5">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white text-xs font-bold text-brand">S</span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold">Scalency</div>
          <div className="flex items-center gap-1.5 font-mono text-[10.5px] text-white/85">
            <span className="h-1.5 w-1.5 rounded-full bg-[#fcd34d] shadow-[0_0_8px_#fcd34d]" />
            TEST MODE
          </div>
        </div>
        <Icon name="chevronsUpDown" size={15} className="text-white/80" />
      </div>

      {sections.map((section) => (
        <div key={section.title} className="relative">
          <div className="px-2.5 pb-1.5 pt-3.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-white/75">{section.title}</div>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const on = item.href === current;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={on ? "page" : undefined}
                    className={`flex min-h-[38px] items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px] transition-colors ${
                      on
                        ? "bg-white font-semibold text-brand shadow-[0_8px_20px_-6px_rgba(2,40,90,0.45)]"
                        : "font-medium text-white/90 hover:bg-white/10"
                    }`}
                  >
                    <Icon name={item.icon} size={17} strokeWidth={on ? 1.9 : 1.7} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className={`rounded-md px-1.5 py-px font-mono text-[10.5px] font-semibold ${on ? "bg-brand text-white" : "bg-white/20 text-white"}`}>
                        {item.badge}
                      </span>
                    )}
                    {item.isNew && !on && (
                      <span className="rounded-[5px] bg-[#a8f3f7] px-1.5 py-px font-mono text-[9.5px] font-semibold tracking-wider text-brand">NEW</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="relative mt-auto flex flex-col gap-2.5 pt-4">
        <div className="rounded-[14px] border border-white/20 bg-white/10 p-3.5">
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <Icon name="shield" size={15} />
            Test mode is on
          </div>
          <p className="mt-1.5 text-[11.5px] leading-snug text-white/85">Messages only reach the test inbox and phone until the owner switches this off.</p>
        </div>
        <div className="flex items-center gap-2.5 p-2">
          <span className="inline-flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-white text-xs font-bold text-brand">{initials}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">{email ?? "Signed in"}</div>
            <form action="/auth/signout" method="post">
              <button type="submit" className="text-[11.5px] text-white/85 underline-offset-2 hover:underline">Sign out</button>
            </form>
          </div>
        </div>
      </div>
    </nav>
  );
}
