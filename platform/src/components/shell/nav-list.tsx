"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { activeGroup, activeLink, NAV, type NavGroup } from "@/lib/nav";

/**
 * The sidebar list. On a computer, resting the pointer on an item opens a
 * panel beside the sidebar with all of that area's pages. On a phone, the
 * arrow next to an item opens its pages underneath.
 */
export function NavList({
  pathname,
  collapsed,
  mobile,
  groups = NAV,
  flat = false,
}: {
  pathname: string;
  collapsed: boolean;
  mobile: boolean;
  groups?: NavGroup[];
  flat?: boolean;
}) {
  const current = activeGroup(pathname);
  const [hover, setHover] = useState<{ key: string; top: number; left: number } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(current ?? null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHover(null);
  }, [pathname]);

  function open(key: string, el: HTMLElement) {
    if (mobile) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const r = el.getBoundingClientRect();
    const aside = el.closest("aside")?.getBoundingClientRect();
    setHover({ key, top: Math.max(8, Math.min(r.top - 8, window.innerHeight - 420)), left: (aside?.right ?? r.right) + 6 });
  }
  function closeSoon() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHover(null), 160);
  }
  function keepOpen() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }

  const panelGroup = hover ? groups.find((g) => g.key === hover.key) : null;

  return (
    <div className={flat ? "" : "mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-3 [scrollbar-color:rgba(255,255,255,0.25)_transparent] [scrollbar-width:thin]"}>
      <ul className="flex flex-col gap-0.5">
        {groups.map((g, i) => {
          const on = g.key === current;
          const hasLinks = Boolean(g.links?.length);
          const isOpen = mobile && expanded === g.key;
          return (
            <li key={g.key} className={g.section && !flat && i > 0 ? "mt-3" : ""}>
              {g.section && !flat && i > 0 && (collapsed ? <div className="mx-auto mb-2 h-px w-8 bg-white/15" /> : <div className="px-2.5 pb-1.5 text-[11px] font-medium text-white/55">{g.section}</div>)}
              <div
                className="flex items-center"
                onMouseEnter={(e) => hasLinks && open(g.key, e.currentTarget)}
                onMouseLeave={() => hasLinks && closeSoon()}
              >
                <Link
                  href={g.href}
                  title={collapsed ? g.label : undefined}
                  aria-current={on ? "page" : undefined}
                  onFocus={(e) => hasLinks && open(g.key, e.currentTarget.parentElement as HTMLElement)}
                  className={`nav-item flex h-9 min-w-0 flex-1 items-center gap-3 rounded-[10px] px-2.5 text-[13.5px] ${collapsed ? "justify-center" : ""} ${
                    on
                      ? "bg-white font-semibold text-brand shadow-[0_6px_18px_-8px_rgba(2,30,80,0.55)]"
                      : g.soon
                        ? "text-white/65 hover:bg-white/10 hover:text-white"
                        : "font-medium text-white/90 hover:bg-white/10 hover:text-white"
                  } ${hover?.key === g.key && !on ? "bg-white/10 text-white" : ""}`}
                >
                  <Icon name={g.icon} size={17} strokeWidth={on ? 2 : 1.7} />
                  {!collapsed && <span className="min-w-0 flex-1 truncate">{g.label}</span>}
                  {!collapsed && g.soon && !hasLinks && (
                    <span className={`rounded-md px-1.5 py-px text-[10px] font-medium ${on ? "bg-chip text-brand" : "bg-white/10 text-white/70"}`}>Soon</span>
                  )}
                  {!collapsed && hasLinks && !mobile && <Icon name="next" size={14} className={on ? "text-brand/60" : "text-white/45"} />}
                </Link>
                {mobile && hasLinks && (
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : g.key)}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? "Hide" : "Show"} ${g.label} pages`}
                    className="ml-1 inline-flex h-9 w-9 flex-none items-center justify-center rounded-[10px] text-white/70 hover:bg-white/10"
                  >
                    <Icon name="down" size={15} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                )}
              </div>
              {isOpen && g.links && (
                <ul className="rise mb-1 ml-5 mt-0.5 flex flex-col gap-0.5 border-l border-white/15 pl-3">
                  {g.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className={`flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] ${pathname === l.href ? "bg-white/15 font-semibold text-white" : "text-white/80 hover:bg-white/10"}`}
                      >
                        <span className="min-w-0 flex-1 truncate">{l.label}</span>
                        {l.soon && <span className="rounded-md bg-white/10 px-1.5 py-px text-[10px] text-white/70">Soon</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {panelGroup && hover && panelGroup.links && (
        <div
          role="menu"
          aria-label={`${panelGroup.label} pages`}
          onMouseEnter={keepOpen}
          onMouseLeave={closeSoon}
          style={{ top: hover.top, left: hover.left }}
          className="flyout fixed z-[60] w-[260px] rounded-2xl border border-line bg-white p-2 text-navy shadow-[0_20px_50px_-12px_rgba(11,27,58,0.35)]"
        >
          <div className="flex items-center gap-2 px-2.5 pb-2 pt-1.5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-chip text-brand">
              <Icon name={panelGroup.icon} size={15} />
            </span>
            <span className="text-[14px] font-semibold">{panelGroup.label}</span>
          </div>
          <ul className="flex max-h-[360px] flex-col gap-0.5 overflow-y-auto">
            {panelGroup.links.map((l) => {
              const on = activeLink(pathname, panelGroup.links!) === l.href;
              return (
                <li key={l.href}>
                  <Link
                    role="menuitem"
                    href={l.href}
                    onClick={() => setHover(null)}
                    className={`flex h-9 items-center gap-2 rounded-lg px-2.5 text-[13.5px] transition-colors ${on ? "bg-chip font-semibold text-brand" : "text-navy hover:bg-surface"}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{l.label}</span>
                    {l.soon && <span className="rounded-md bg-surface px-1.5 py-px text-[10px] font-medium text-muted">Soon</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
