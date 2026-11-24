"use client";

import { Toaster } from "@/components/toast";
import { ConfirmHost } from "@/components/confirm";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { acceptInvite, createWorkspace, switchWorkspace } from "@/app/(app)/workspace-actions";
import { CommandBar } from "./command";
import { NavList } from "./nav-list";
import { NAV, SETTINGS_NAV, navFor, permForPath } from "@/lib/nav";
import { createClient } from "@/lib/supabase/browser";

type Alert = { id: string; priority: string; reason: string; created_at: string; setter_threads: { contact_name: string | null } | null };

/** Leads waiting for a person (the setter console's queue), for the bell. Checks every minute. */
function useAlerts(enabled: boolean, workspaceId: string) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const load = async () => {
      const { data } = await createClient().from("setter_handoffs").select("id, priority, reason, created_at, setter_threads(contact_name)").eq("account_id", workspaceId).neq("status", "done").order("created_at", { ascending: false }).limit(8);
      if (live && data) setAlerts(data as unknown as Alert[]);
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [enabled, workspaceId]);
  return alerts;
}

export type ShellUser = {
  name: string;
  email: string;
  initials: string;
  workspace: string;
  workspaceId: string;
  role: string;
  leadsThisWeek: number;
  workspaces: { id: string; name: string; role: string }[];
  invites: { id: string; workspace: string; role: string }[];
  canCreateWorkspace: boolean;
  /** What this person may use here; the menu only shows those parts. */
  permissions: string[];
};

const allHrefs = [...NAV, SETTINGS_NAV].flatMap((g) => [g.href, ...(g.links ?? []).map((l) => l.href)]);
function activeHref(pathname: string) {
  return allHrefs.filter((h) => pathname === h || pathname.startsWith(h + "/")).sort((a, b) => b.length - a.length)[0];
}

const STORAGE_KEY = "scalency.sidebar";

/** Builders (a form, a workflow, later pages and funnels) open full screen, like GHL. */
const BUILDER = /^\/(forms|workflows|sites|funnels|websites)\/[^/]+(?!.*\/overview$)/;

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  // Ctrl+K or Cmd+K opens the command bar from anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const focus = BUILDER.test(pathname);
  const page = (() => {
    const need = permForPath(pathname);
    return need && !user.permissions.includes(need) ? <NoAccess /> : children;
  })();

  if (focus)
    return (
      <div className="min-h-screen bg-canvas" style={{ ["--chrome-h" as string]: "0px" }}>
        <Toaster />
        <ConfirmHost />
        <CommandBar open={commandOpen} onClose={() => setCommandOpen(false)} permissions={user.permissions} />
        <div key={pathname} className="page-in">
          {page}
        </div>
      </div>
    );

  return (
    <div className="flex min-h-screen bg-canvas" style={{ ["--chrome-h" as string]: "64px" }}>
      <Toaster />
        <ConfirmHost />
      <aside className={`sticky top-0 z-40 hidden h-screen flex-none transition-[width] duration-200 ease-out lg:block ${collapsed ? "w-[76px]" : "w-[256px]"}`}>
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
        <TopBar user={user} onMenu={() => setMobileOpen(true)} onCommand={() => setCommandOpen(true)} />
        <CommandBar open={commandOpen} onClose={() => setCommandOpen(false)} permissions={user.permissions} />
        <div className="app-grid flex-1 pb-[var(--nav-h)]">
          <div key={pathname} className="page-in">
            {page}
          </div>
        </div>
      </div>
      <MobileTabBar pathname={pathname} onMore={() => setMobileOpen(true)} />
    </div>
  );
}

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/contacts", label: "Contacts", icon: "users" },
  { href: "/pipeline", label: "Pipeline", icon: "pipeline" },
  { href: "/inbox", label: "Inbox", icon: "inbox" },
];

/** Phone navigation: the main pages one tap away, with "More" opening the full menu. */
function MobileTabBar({ pathname, onMore }: { pathname: string; onMore: () => void }) {
  const current = activeHref(pathname);
  const onTab = TABS.some((t) => t.href === current);
  return (
    <nav
      aria-label="Quick"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="grid h-16 grid-cols-5">
        {TABS.map((t) => {
          const on = current === t.href;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${on ? "text-brand" : "text-muted"}`}
              >
                <span className={`inline-flex h-7 w-12 items-center justify-center rounded-full transition-colors ${on ? "bg-chip" : ""}`}>
                  <Icon name={t.icon} size={19} />
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={onMore}
            className={`flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${!onTab && current ? "text-brand" : "text-muted"}`}
          >
            <span className={`inline-flex h-7 w-12 items-center justify-center rounded-full ${!onTab && current ? "bg-chip" : ""}`}>
              <Icon name="menu" size={19} />
            </span>
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}

function Sidebar({ pathname, user, collapsed, onToggle, mobile = false }: { pathname: string; user: ShellUser; collapsed: boolean; onToggle: () => void; mobile?: boolean }) {
  return (
    <nav aria-label="Main" className="sidebar-blue relative isolate flex h-full flex-col overflow-hidden text-white">
      <SidebarGlow />
      <div className={`flex flex-none items-center px-4 pb-4 pt-4 ${collapsed ? "flex-col gap-3" : "justify-between"}`}>
        <Link href="/dashboard" className={`flex min-w-0 items-center ${collapsed ? "" : "flex-1 pr-2"}`} aria-label={`${user.workspace} home`} title={user.workspace}>
          {collapsed ? (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-[15px] font-bold">{user.workspace.charAt(0).toUpperCase()}</span>
          ) : (
            <span className="truncate text-[17px] font-bold tracking-tight">{user.workspace}</span>
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
        <WorkspaceSwitcher user={user} collapsed={collapsed} />

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

      <NavList pathname={pathname} collapsed={collapsed} mobile={mobile} groups={navFor(user.permissions).nav} />

      <div className="flex-none border-t border-white/10 px-3 py-3">
        {(() => {
          const settings = navFor(user.permissions).settings;
          return settings ? <NavList pathname={pathname} collapsed={collapsed} mobile={mobile} groups={[settings]} flat /> : null;
        })()}
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

function TopBar({ user, onMenu, onCommand }: { user: ShellUser; onMenu: () => void; onCommand: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<"account" | "alerts" | null>(null);
  const alerts = useAlerts(user.permissions.includes("inbox.send") || user.permissions.includes("ai.manage"), user.workspaceId);
  const urgent = alerts.some((a) => a.priority === "urgent");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-white/85 px-3 backdrop-blur-md sm:gap-3 sm:px-6">
      <button type="button" onClick={onMenu} aria-label="Open menu" className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-navy hover:bg-surface lg:hidden">
        <Icon name="menu" size={20} />
      </button>

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/contacts${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
        }}
        className="hidden h-10 min-w-0 max-w-[420px] flex-1 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 transition-colors focus-within:border-sky focus-within:bg-white sm:flex"
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

      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        <button
          type="button"
          onClick={onCommand}
          aria-label="Search"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface hover:text-navy sm:hidden"
        >
          <Icon name="search" size={18} />
        </button>
        <button
          type="button"
          onClick={onCommand}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#eef2ff,#e7f1fe)] px-3 text-[13.5px] font-semibold text-[#3b3fd8] ring-1 ring-[#c7d2fe] transition hover:ring-[#a5b4fc]"
        >
          <Icon name="spark" size={16} />
          <span className="hidden sm:inline">Ask AI</span>
          <kbd className="hidden rounded border border-[#c7d2fe] bg-white px-1 font-mono text-[10.5px] text-[#6366f1] md:inline">Ctrl K</kbd>
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(open === "alerts" ? null : "alerts")}
            aria-expanded={open === "alerts"}
            aria-label="Notifications"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface hover:text-navy"
          >
            <Icon name="bell" size={18} />
            {alerts.length > 0 && (
              <span className={`absolute right-1.5 top-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 font-mono text-[10px] font-semibold text-white ring-2 ring-white ${urgent ? "animate-pulse bg-bad" : "bg-brand"}`}>{alerts.length}</span>
            )}
          </button>
          {open === "alerts" && (
            <Popover onClose={() => setOpen(null)} width="w-[340px]">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <span className="tile h-11 w-11 rounded-xl"><Icon name="bell" size={18} /></span>
                  <div className="text-[14px] font-semibold">You&apos;re all caught up</div>
                  <p className="text-[12.5px] text-muted">Leads the AI passes to your team show here.</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  <div className="flex items-center justify-between px-3 pb-1.5 pt-2">
                    <span className="text-[13.5px] font-semibold">Needs a person</span>
                    <Link href="/setter-console" onClick={() => setOpen(null)} className="text-[12px] font-semibold text-brand hover:underline">
                      Open the queue
                    </Link>
                  </div>
                  {alerts.map((a) => (
                    <Link key={a.id} href="/setter-console" onClick={() => setOpen(null)} className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 hover:bg-surface">
                      <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${a.priority === "urgent" ? "bg-bad" : a.priority === "high" ? "bg-warn" : "bg-brand"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-navy">{a.setter_threads?.contact_name || "A lead"}</span>
                        <span className="block truncate text-[12px] text-muted">{a.reason}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
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
      <div className={`rise absolute right-0 top-12 z-50 ${width} max-w-[calc(100vw-24px)] rounded-2xl border border-line bg-white p-1.5 shadow-[var(--shadow-pop)]`}>{children}</div>
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

function WorkspaceSwitcher({ user, collapsed }: { user: ShellUser; collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={user.workspace}
        className={`flex w-full items-center gap-2.5 rounded-xl bg-white/[0.09] text-left ring-1 ring-white/15 transition-colors hover:bg-white/[0.14] ${collapsed ? "justify-center p-1.5" : "p-2"}`}
      >
        <span className="relative inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-white text-[13px] font-bold text-brand">
          {user.workspace.charAt(0).toUpperCase()}
          {user.invites.length > 0 && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#0a47b8] bg-turquoise" />}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{user.workspace}</span>
              <span className="block text-[11px] capitalize text-white/70">{user.role}</span>
            </span>
            <Icon name="chevronDown" size={15} className="text-white/70" />
          </>
        )}
      </button>

      {open && (
        <>
          <button type="button" aria-label="Close" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className={`rise z-50 rounded-2xl border border-line bg-white p-1.5 text-navy shadow-[var(--shadow-pop)] ${collapsed ? "fixed left-[84px] top-[64px] w-[268px]" : "absolute inset-x-0 top-[calc(100%+6px)]"}`}>
            <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium text-faint">Your workspaces</div>
            <ul className="max-h-64 overflow-y-auto">
              {user.workspaces.map((w) => (
                <li key={w.id}>
                  <form action={switchWorkspace}>
                    <input type="hidden" name="id" value={w.id} />
                    <button type="submit" className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px] hover:bg-surface ${w.id === user.workspaceId ? "bg-chip" : ""}`}>
                      <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-[linear-gradient(135deg,#55e3ec,#0a5fe3)] text-[12px] font-bold text-white">{w.name.charAt(0).toUpperCase()}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{w.name}</span>
                        <span className="block text-[11.5px] capitalize text-muted">{w.role}</span>
                      </span>
                      {w.id === user.workspaceId && <Icon name="check" size={15} className="text-brand" />}
                    </button>
                  </form>
                </li>
              ))}
            </ul>

            {user.invites.length > 0 && (
              <>
                <div className="my-1 h-px bg-line" />
                <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium text-faint">Invitations</div>
                {user.invites.map((i) => (
                  <form key={i.id} action={acceptInvite} className="flex items-center gap-2 rounded-xl px-2.5 py-2">
                    <input type="hidden" name="id" value={i.id} />
                    <span className="min-w-0 flex-1 truncate text-[13px]">Join <strong>{i.workspace}</strong></span>
                    <button type="submit" className="btn-primary rounded-lg px-2.5 py-1 text-[12px] font-semibold">Join</button>
                  </form>
                ))}
              </>
            )}

            <div className="my-1 h-px bg-line" />
            <a href="/workspaces" className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13.5px] text-navy hover:bg-surface">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-muted"><Icon name="grip" size={14} /></span>
              All workspaces
            </a>
            {!user.canCreateWorkspace ? null : creating ? (
              <ActionForm action={createWorkspace} className="flex flex-col gap-2 p-1.5">
                <input name="name" required autoFocus placeholder="Workspace name, e.g. a client" className="field h-10 min-h-0" />
                <div className="flex justify-end gap-1.5">
                  <button type="button" onClick={() => setCreating(false)} className="rounded-lg px-3 text-[12.5px] font-medium text-muted hover:text-navy">Cancel</button>
                  <SubmitButton pendingText="Creating…" className="min-h-9 px-3">Create</SubmitButton>
                </div>
              </ActionForm>
            ) : (
              <button type="button" onClick={() => setCreating(true)} className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13.5px] font-medium text-brand hover:bg-surface">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-dashed border-sky/60"><Icon name="plus" size={14} /></span>
                New workspace
              </button>
            )}
            <a href="/settings/team" className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13.5px] text-navy hover:bg-surface">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-muted"><Icon name="team" size={14} /></span>
              Invite people
            </a>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * A soft light that follows the pointer around the sidebar, easing behind it,
 * and drifts slowly when the pointer is elsewhere. Off for people who prefer less motion.
 */
function SidebarGlow() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const nav = el?.parentElement;
    if (!el || !nav || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let x = 0.3, y = 0.15, tx = 0.3, ty = 0.15, inside = false, frame = 0, t0 = performance.now();
    const move = (e: PointerEvent) => {
      const r = nav.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width;
      ty = (e.clientY - r.top) / r.height;
      inside = true;
    };
    const leave = () => (inside = false);
    const tick = (now: number) => {
      if (!inside) {
        // Idle drift: a slow loop around the upper half.
        const t = (now - t0) / 1000;
        tx = 0.5 + Math.sin(t / 3.2) * 0.35;
        ty = 0.3 + Math.cos(t / 4.1) * 0.22;
      }
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      el.style.setProperty("--gx", `${(x * 100).toFixed(2)}%`);
      el.style.setProperty("--gy", `${(y * 100).toFixed(2)}%`);
      frame = requestAnimationFrame(tick);
    };
    nav.addEventListener("pointermove", move);
    nav.addEventListener("pointerleave", leave);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      nav.removeEventListener("pointermove", move);
      nav.removeEventListener("pointerleave", leave);
      t0 = 0;
    };
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        background:
          "radial-gradient(340px circle at var(--gx, 30%) var(--gy, 15%), rgba(85, 227, 236, 0.38), transparent 65%), radial-gradient(420px circle at calc(100% - var(--gx, 30%)) calc(100% - var(--gy, 15%)), rgba(124, 92, 255, 0.22), transparent 70%)",
      }}
    />
  );
}

/** Shown instead of a page this person isn't allowed to use. */
function NoAccess() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-[520px] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-chip text-brand">
        <Icon name="lock" size={24} />
      </span>
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">You don&apos;t have access to this</h1>
      <p className="text-[14.5px] text-muted">Ask the workspace owner to give you access in Settings, Members.</p>
      <Link href="/dashboard" className="btn-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-[14px] font-semibold">
        <Icon name="home" size={15} /> Go to Home
      </Link>
    </main>
  );
}
