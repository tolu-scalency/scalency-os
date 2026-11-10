"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/settings", label: "General" },
  { href: "/settings/pipeline", label: "Pipeline" },
  { href: "/settings/team", label: "Members" },
  { href: "/settings/notifications", label: "Notifications", soon: true },
  { href: "/settings/integrations", label: "Integrations", soon: true },
  { href: "/settings/billing", label: "Billing", soon: true },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings" className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-[#eaeff6] p-1 text-[13.5px] font-medium sm:w-fit">
      {tabs.map((t) => {
        const on = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-4 py-1.5 transition-colors ${on ? "bg-white text-navy shadow-sm" : "text-muted hover:text-navy"}`}
          >
            {t.label}
            {"soon" in t && <span className="ml-1.5 rounded bg-chip px-1 py-px text-[9.5px] font-semibold uppercase text-brand">Soon</span>}
          </Link>
        );
      })}
    </nav>
  );
}
