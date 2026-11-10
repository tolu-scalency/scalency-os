"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icon";

// Page names shown in the breadcrumb, keyed by the first part of the address.
const names: Record<string, string> = {
  dashboard: "Dashboard",
  inbox: "Conversations",
  contacts: "Contacts",
  pipeline: "Pipeline",
  calendar: "Calendar",
  funnels: "Funnels & forms",
  onboarding: "Client onboarding",
  reports: "Reports & ads",
  workflows: "Workflows",
  chat: "Team chat",
  settings: "Settings",
};

export function Topbar() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const section = names[parts[0]] ?? "Scalency OS";
  const sub = parts[0] === "workflows" && parts[1] === "builder" ? "AI builder" : parts[1] && parts[0] === "contacts" ? "Contact" : null;

  return (
    <header className="flex min-h-[68px] flex-wrap items-center gap-3.5 border-b border-line bg-white px-7 py-3">
      <nav aria-label="Breadcrumb" className="mr-1.5 flex items-center gap-2 text-[13px] text-muted">
        <span>Scalency</span>
        <Icon name="chevronRight" size={14} />
        {sub ? (
          <>
            <Link href={`/${parts[0]}`} className="hover:text-brand">
              {section}
            </Link>
            <Icon name="chevronRight" size={14} />
            <span className="text-sm font-semibold text-navy">{sub}</span>
          </>
        ) : (
          <span className="text-sm font-semibold text-navy">{section}</span>
        )}
      </nav>

      <label className="flex h-10 max-w-[440px] flex-[1_1_260px] items-center gap-2.5 rounded-[11px] border border-line bg-surface px-3">
        <Icon name="search" size={16} className="text-muted" />
        <span className="sr-only">Search or ask AI</span>
        <input type="search" placeholder="Search or ask AI anything…" className="min-w-0 flex-1 bg-transparent text-[13.5px] text-navy outline-none placeholder:text-muted" />
        <kbd className="rounded-md border border-line-strong px-1.5 py-0.5 font-mono text-[10.5px] text-muted">⌘K</kbd>
      </label>

      <div className="ml-auto flex items-center gap-2">
        <span className="inline-flex h-[30px] items-center gap-1.5 rounded-full border border-[#d99600]/35 bg-warn-bg px-3 font-mono text-[10.5px] font-semibold tracking-wider text-warn">
          <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b] shadow-[0_0_8px_#f59e0b]" />
          TEST MODE
        </span>
        <Link href="/workflows/builder" className="btn-primary inline-flex h-[38px] items-center gap-2 rounded-[11px] px-3.5 text-[13px] font-semibold">
          <Icon name="spark" size={15} />
          Ask AI
        </Link>
        <button type="button" aria-label="Notifications" className="relative inline-flex h-10 w-10 items-center justify-center rounded-[11px] border border-line bg-surface">
          <Icon name="bell" size={17} />
        </button>
        <button type="button" aria-label="Help" className="inline-flex h-10 w-10 items-center justify-center rounded-[11px] border border-line bg-surface">
          <Icon name="help" size={17} />
        </button>
      </div>
    </header>
  );
}
