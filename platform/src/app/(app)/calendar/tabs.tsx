"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";

const tabs: { href: string; label: string; icon: IconName }[] = [
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/calendar/booking-pages", label: "Booking pages", icon: "link" },
  { href: "/calendar/availability", label: "Availability", icon: "clock" },
  { href: "/calendar/connections", label: "Connections", icon: "globe" },
];

export function CalendarTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Calendar" className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-[#eaeff6] p-1 text-[13.5px] font-medium sm:w-fit">
      {tabs.map((t) => {
        const on = t.href === "/calendar" ? pathname === "/calendar" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-1.5 transition-colors ${on ? "bg-white text-navy shadow-sm" : "text-muted hover:text-navy"}`}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
