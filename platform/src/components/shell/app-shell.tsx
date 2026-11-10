"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { Logo } from "@/components/logo";

export type ShellUser = { name: string; email: string; initials: string; workspace: string; role: string; leadsThisWeek: number };

type Item = { href: string; label: string; icon: IconName; soon?: boolean };
type Section = { title?: string; items: Item[] };

// The whole product, grouped. Items marked "soon" open a preview of what's coming.
const sections: Section[] = [
  {
    items: [
      { href: "/dashboard", label: "Home", icon: "home" },
      { href: "/inbox", label: "Inbox", icon: "inbox", soon: true },
      { href: "/tasks", label: "Tasks", icon: "tasks" },
      { href: "/calendar", label: "Calendar", icon: "calendar", soon: true },
    ],
  },
  {
    title: "Records",
    items: [
      { href: "/contacts", label: "Contacts", icon: "users" },
      { href: "/pipeline", label: "Pipeline", icon: "pipeline" },
      { href: "/notes", label: "Notes", icon: "edit" },
      { href: "/companies", label: "Companies", icon: "building", soon: true },
    ],
  },
  {
    title: "Growth",
    items: [
      { href: "/funnels", label: "Funnels and pages", icon: "funnel", soon: true },
      { href: "/forms", label: "Forms and surveys", icon: "form", soon: true },
      { href: "/contracts", label: "Proposals", icon: "card", soon: true },
      { href: "/onboarding", label: "Client onboarding", icon: "onboarding", soon: true },
    ],
  },
  {
    title: "Marketing",
    items: [
      { href: "/campaigns", label: "Campaigns", icon: "megaphone", soon: true },
      { href: "/ads", label: "Ads insights", icon: "chart", soon: true },
      { href: "/reports", label: "Reports", icon: "activity", soon: true },
    ],
  },
  {
    title: "Automation",
    items: [
      { href: "/workflows", label: "Workflows", icon: "zap", soon: true },
      { href: "/ai-builder", label: "AI builder", icon: "spark", soon: true },
      { href: "/agents", label: "AI agents", icon: "user", soon: true },
    ],
  },
  {
    title: "Team",
    items: [
      { href: "/chat", label: "Team chat", icon: "hash", soon: true },
      { href: "/settings/team", label: "Members", icon: "team" },
      { href: "/settings", label: "Settings", icon: "settings" },
    ],
  },
];

const allHrefs = sections.flatMap((s) => s.items.map((i) => i.href));
function activeHref(pathname: string) {
  return allHrefs.filter((h) => pathname === h || pathname.startsWith(h + "/")).sort((a, b) => b.length - a.length)[0];
}

const STORAGE_KEY = "scalency.sidebar";

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Remember the sidebar choice in this browser.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(STORAGE_KEY) === "collapsed") setCollapsed(true);
    } catch {}
  }, []);
  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(STORAGE_KEY, c ? "open" : "collapsed");
      } catch {}
      return !c;
    });
  }

  // Close the phone menu after moving to another page.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className={`sticky top-0 hidden h-screen flex-none transition-[width] duration-200 ease-out lg:block ${collapsed ? "w-[76px]" : "w-[256px]"}`}>
        <Sidebar pathname={pathname} user={user} collapsed={collapsed} onToggle={toggle} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" />
          <div className="rise absolute inset-y-0 left-0 w-[280px] shadow-2xl">
            <Sidebar pathname={pathname} user={user} collapsed={false} onToggle={() => setMobileOpen(false)} mobile />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={user} onMenu={() => setMobileOpen(true)} />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

function Sidebar({ pathname, user, collapsed, onToggle, mobile = false }: { pathname: string; user: ShellUser; collapsed: boolean; onToggle: () => void; mobile?: boolean }) {
  const current = activeHref(pathname);

  return (
    <nav aria-label="Main" className="sidebar-blue relative flex h-full flex-col text-white">
      <div className={`flex flex-none items-center px-4 pb-4 pt-4 ${collapsed ? "flex-col gap-3" : "justify-between"}`}>
        <Link href="/dashboard" className="flex items-center" aria-label="Scalency OS home">
          {collapsed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/brand/mark.png" alt="" width={28} height={28} className="h-7 w-7 brightness-0 invert" />
          ) : (
            <Logo variant="white" height={22} />
          )}
        </Link>
        <button
          type="button"
          onClick={onToggle}
          aria-label={mobile ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/75 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Icon name={mobile ? "x" : "panel"} size={17} />
        </button>
      </div>

      <div className="flex-none px-3">
        <div className={`flex items-center gap-2.5 rounded-xl bg-white/[0.09] ring-1 ring-white/15 ${collapsed ? "justify-center p-1.5" : "p-2"}`} title={user.workspace}>
          <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-white text-[13px] font-bold text-brand">{user.workspace.charAt(0).toUpperCase()}</span>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold">{user.workspace}</div>
              <div className="text-[11px] capitalize text-white/70">{user.role}</div>
            </div>
          )}
        </div>

        {/* Live counter of new leads this week */}
        <Link
          href="/contacts"
          title="New leads in the last 7 days"
          className={`mt-2.5 flex items-center gap-3 overflow-hidden rounded-xl bg-[#071d4f]/55 ring-1 ring-white/10 transition-colors hover:bg-[#071d4f]/75 ${collapsed ? "justify-center p-2" : "p-2.5"}`}
        >
          <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg bg-white/10 px-2 font-mono text-[17px] font-semibold tabular-nums">{user.leadsThisWeek}</span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block text-[12.5px] font-semibold">New leads</span>
              <span className="block text-[11px] text-white/65">This week</span>
            </span>
          )}
          {!collapsed && (
            <span aria-hidden className="ml-auto grid grid-cols-6 gap-[3px] opacity-70">
              {Array.from({ length: 18 }).map((_, i) => (
                <span key={i} className="h-[3px] w-[3px] rounded-full" style={{ background: (i * 7) % 5 < 2 ? "#55e3ec" : "rgba(255,255,255,0.25)" }} />
              ))}
            </span>
          )}
        </Link>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-3 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.25)_transparent]">
        {sections.map((section, si) => (
          <div key={si} className={si === 0 ? "" : "mt-4"}>
            {section.title &&
              (collapsed ? <div className="mx-auto mb-2 h-px w-8 bg-white/15" /> : <div className="px-2.5 pb-1.5 text-[11px] font-medium text-white/55">{section.title}</div>)}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const on = item.href === current;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      aria-current={on ? "page" : undefined}
                      className={`flex h-9 items-center gap-3 rounded-[10px] px-2.5 text-[13.5px] transition-all duration-150 ${collapsed ? "justify-center" : ""} ${
                        on
                          ? "bg-white font-semibold text-brand shadow-[0_6px_18px_-8px_rgba(2,30,80,0.55)]"
                          : item.soon
                            ? "text-white/60 hover:bg-white/10 hover:text-white"
                            : "font-medium text-white/90 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <Icon name={item.icon} size={17} strokeWidth={on ? 2 : 1.7} />
                      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                      {!collapsed && item.soon && (
                        <span className={`rounded-md px-1.5 py-px text-[10px] font-medium ${on ? "bg-chip text-brand" : "bg-white/10 text-white/70"}`}>Soon</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex-none border-t border-white/10 px-3 py-3">
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            title="Sign out"
            className={`flex h-9 w-full items-center gap-3 rounded-[10px] px-2.5 text-[13.5px] text-white/75 transition-colors hover:bg-white/10 hover:text-white ${collapsed ? "justify-center" : ""}`}
          >
            <Icon name="logout" size={17} />
            {!collapsed && "Sign out"}
          </button>
        </form>
      </div>
    </nav>
  );
}

function TopBar({ user, onMenu }: { user: ShellUser; onMenu: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<"account" | "alerts" | null>(null);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white/85 px-4 backdrop-blur-md sm:px-6">
      <button type="button" onClick={onMenu} aria-label="Open menu" className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-navy hover:bg-surface lg:hidden">
        <Icon name="menu" size={20} />
      </button>

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/contacts${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
        }}
        className="flex h-10 max-w-[420px] flex-1 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 transition-colors focus-within:border-sky focus-within:bg-white"
      >
        <Icon name="search" size={16} className="text-faint" />
        <label className="sr-only" htmlFor="global-search">Search contacts</label>
        <input
          id="global-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search contacts"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-navy outline-none placeholder:text-faint"
        />
      </form>

      <div className="ml-auto flex items-center gap-1.5">
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(open === "alerts" ? null : "alerts")}
            aria-expanded={open === "alerts"}
            aria-label="Notifications"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface hover:text-navy"
          >
            <Icon name="bell" size={18} />
          </button>
          {open === "alerts" && (
            <Popover onClose={() => setOpen(null)} width="w-80">
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <span className="tile h-11 w-11 rounded-xl"><Icon name="bell" size={18} /></span>
                <div className="text-[14px] font-semibold">You&apos;re all caught up</div>
                <p className="text-[12.5px] text-muted">New lead alerts and mentions will show here.</p>
              </div>
            </Popover>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(open === "account" ? null : "account")}
            aria-expanded={open === "account"}
            aria-label="Your account"
            className="inline-flex h-10 items-center gap-2 rounded-xl px-1.5 transition-colors hover:bg-surface"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#55e3ec,#0a5fe3)] text-[12px] font-semibold text-white">{user.initials}</span>
            <Icon name="chevronDown" size={15} className="hidden text-faint sm:block" />
          </button>
          {open === "account" && (
            <Popover onClose={() => setOpen(null)} width="w-64">
              <div className="px-3 py-2.5">
                <div className="truncate text-[14px] font-semibold">{user.name}</div>
                <div className="truncate text-[12.5px] text-muted">{user.email}</div>
              </div>
              <div className="my-1 h-px bg-line" />
              <MenuLink href="/settings" icon="user" onClick={() => setOpen(null)}>Profile and settings</MenuLink>
              <MenuLink href="/settings/team" icon="team" onClick={() => setOpen(null)}>Members</MenuLink>
              <form action="/auth/signout" method="post">
                <button type="submit" className="flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-[13.5px] text-navy hover:bg-surface">
                  <Icon name="logout" size={16} className="text-muted" />
                  Sign out
                </button>
              </form>
            </Popover>
          )}
        </div>
      </div>
    </header>
  );
}

function Popover({ children, onClose, width }: { children: React.ReactNode; onClose: () => void; width: string }) {
  return (
    <>
      <button type="button" aria-label="Close" className="fixed inset-0 z-40 cursor-default" onClick={onClose} />
      <div className={`rise absolute right-0 top-12 z-50 ${width} rounded-2xl border border-line bg-white p-1.5 shadow-[var(--shadow-pop)]`}>{children}</div>
    </>
  );
}

function MenuLink({ href, icon, children, onClick }: { href: string; icon: IconName; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="flex h-10 items-center gap-2.5 rounded-xl px-3 text-[13.5px] text-navy hover:bg-surface">
      <Icon name={icon} size={16} className="text-muted" />
      {children}
    </Link>
  );
}
