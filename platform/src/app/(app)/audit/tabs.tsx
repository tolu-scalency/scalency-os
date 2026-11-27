import Link from "next/link";

export function AuditTabs({ tab }: { tab: "report" | "calculator" }) {
  return (
    <div className="flex gap-1 self-start rounded-xl bg-white p-1 ring-1 ring-line print:hidden">
      {(
        [
          ["report", "AI audit report"],
          ["calculator", "Quick calculator"],
        ] as const
      ).map(([k, l]) => (
        <Link key={k} href={k === "report" ? "/audit" : "/audit?tab=calculator"} className={`min-h-9 rounded-xl px-4 py-2 text-[13px] font-semibold ${tab === k ? "bg-navy text-white" : "text-muted hover:text-navy"}`}>
          {l}
        </Link>
      ))}
    </div>
  );
}
