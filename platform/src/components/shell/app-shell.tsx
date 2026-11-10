"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { Logo } from "@/components/logo";

export type ShellUser = { name: string; email: string; initials: string; workspace: string; role: string };

type Item = { href: string; label: string; icon: IconName };

const main: Item[] = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/contacts", label: "Contacts", icon: "users" },
  { href: "/pipeline", label: "Pipeline", icon: "pipeline" },
  { href: "/tasks", label: "Tasks", icon: "tasks" },
];
const workspace: Item[] = [
  { href: "/settings/team", label: "Team", icon: "team" },
  { href: "/settings", label: "Settings", icon: "settings" },
];
// Shown so people know what's coming, but not clickable until they work.
const soon: { label: string; icon: IconName }[] = [
  { label: "Inbox", icon: "inbox" },
  { label: "Workflows", icon: "zap" },
  { label: "AI builder", icon: "spark" },
  { label: "Team chat", icon: "hash" },
];

const all = [...main, ...workspace];
function activeHref(pathname: string) {
  return all
    .map((i) => i.href)
    .filter((h) => pathname === h || pathname.startsWith(h + "/"))
    .sort((a, b) => b.length - a.length)[0];
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
      {/* Desktop sidebar */}
      <aside
        className={`sticky top-0 hidden h-screen flex-none transition-[width] duration-200 ease-out lg:block ${collapsed ? "w-[76px]" : "w-[248px]"}`}
      >
        <Sidebar pathname={pathname} user={user} collapsed={collapsed} onToggle={toggle} />
      </aside>

      {/* Phone and tablet drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" />
          <div className="rise absolute inset-y-0 left-0 w-[272px] shadow-2xl">
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

function Sidebar({
  pathname,
  user,
  collapsed,
  onToggle,
  mobile = false,
}: {
  pathname: string;
  user: ShellUser;
  collapsed: boolean;
  onToggle: () => void;
  mobile?: boolean;
}) {
  const current = activeHref(pathname);

  return (
    <nav aria-label="Main" className="sidebar-blue relative flex h-full flex-col overflow-hidden px-3 pb-4 pt-4 text-white">
      <div className={`flex items-center ${collapsed ? "flex-col gap-3" : "justify-between"} px-1.5 pb-5`}>
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

      <div className={`mb-4 flex items-center gap-2.5 rounded-xl bg-white/[0.09] ring-1 ring-white/15 ${collapsed ? "justify-center p-1.5" : "p-2"}`} title={user.workspace}>
        <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-white text-[13px] font-bold text-brand">
          {user.workspace.charAt(0).toUpperCase()}
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold">{user.workspace}</div>
            <div className="text-[11px] capitalize text-white/70">{user.role}</div>
          </div>
        )}
      </div>

      <NavGroup items={main} current={current} collapsed={collapsed} />
      <div className={`mt-5 ${collapsed ? "mx-auto h-px w-8 bg-white/15" : "px-2.5 pb-1.5 text-[11px] font-medium text-white/55"}`}>{collapsed ? null : "Workspace"}</div>
      <NavGroup items={workspace} current={current} collapsed={collapsed} />

      {!collapsed && (
        <>
          <div className="mt-5 px-2.5 pb-1.5 text-[11px] font-medium text-white/55">Coming soon</div>
          <ul className="flex flex-col gap-0.5">
            {soon.map((s) => (
              <li key={s.label} className="flex h-9 items-center gap-3 rounded-[10px] px-2.5 text-[13.5px] text-white/45">
                <Icon name={s.icon} size={17} />
                <span className="flex-1">{s.label}</span>
                <span className="rounded-md bg-white/10 px-1.5 py-px text-[10px] font-medium text-white/60">Soon</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-auto pt-4">
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

function NavGroup({ items, current, collapsed }: { items: Item[]; current?: string; collapsed: boolean }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const on = item.href === current;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              title={collapsed ? item.label : undefined}
              aria-current={on ? "page" : undefined}
              className={`group relative flex h-10 items-center gap-3 rounded-[11px] px-2.5 text-[14px] transition-all duration-150 ${
                collapsed ? "justify-center" : ""
              } ${on ? "bg-white text-brand shadow-[0_6px_18px_-8px_rgba(2,30,80,0.55)]" : "text-white/85 hover:bg-white/10 hover:text-white"}`}
            >
              <Icon name={item.icon} size={18} strokeWidth={on ? 2 : 1.7} />
              {!collapsed && <span className={on ? "font-semibold" : "font-medium"}>{item.label}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function TopBar({ user, onMenu }: { user: ShellUser; onMenu: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);

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

      <div className="ml-auto flex items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-expanded={menu}
            aria-label="Your account"
            className="inline-flex h-10 items-center gap-2 rounded-xl px-1.5 transition-colors hover:bg-surface"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#55e3ec,#0a5fe3)] text-[12px] font-semibold text-white">{user.initials}</span>
            <Icon name="chevronDown" size={15} className="hidden text-faint sm:block" />
          </button>
          {menu && (
            <>
              <button type="button" aria-label="Close" className="fixed inset-0 z-40 cursor-default" onClick={() => setMenu(false)} />
              <div className="rise absolute right-0 top-12 z-50 w-64 rounded-2xl border border-line bg-white p-1.5 shadow-[var(--shadow-pop)]">
                <div className="px-3 py-2.5">
                  <div className="truncate text-[14px] font-semibold">{user.name}</div>
                  <div className="truncate text-[12.5px] text-muted">{user.email}</div>
                </div>
                <div className="my-1 h-px bg-line" />
                <MenuLink href="/settings" icon="user" onClick={() => setMenu(false)}>Profile and settings</MenuLink>
                <MenuLink href="/settings/team" icon="team" onClick={() => setMenu(false)}>Team</MenuLink>
                <form action="/auth/signout" method="post">
                  <button type="submit" className="flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-[13.5px] text-navy hover:bg-surface">
                    <Icon name="logout" size={16} className="text-muted" />
                    Sign out
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
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
