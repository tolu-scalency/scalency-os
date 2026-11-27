"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";

const tabs: { href: string; label: string; icon: IconName }[] = [
  { href: "/calendar", label: "Schedule", icon: "calendar" },
  { href: "/calendar/booking-pages", label: "Calendars", icon: "link" },
  { href: "/calendar/availability", label: "Availability", icon: "clock" },
  { href: "/calendar/connections", label: "Connections", icon: "globe" },
];

export function CalendarTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Calendar" className="-mt-1 flex max-w-full gap-5 overflow-x-auto border-b border-line text-[13.5px] font-medium">
      {tabs.map((t) => {
        const on = t.href === "/calendar" ? pathname === "/calendar" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-0.5 pb-2.5 pt-1 transition-colors ${on ? "border-brand text-brand" : "border-transparent text-muted hover:text-navy"}`}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
