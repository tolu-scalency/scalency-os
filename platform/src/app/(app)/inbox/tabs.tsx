import Link from "next/link";

/** Switches the Inbox between your own contacts' messages and the AI setter's conversations. */
export function InboxTabs({ view }: { view: "contacts" | "ai" }) {
  const tab = (on: boolean) => `flex-1 rounded-lg px-3 py-1.5 text-center text-[12.5px] font-semibold transition-colors ${on ? "bg-white text-navy shadow-sm" : "text-muted hover:text-navy"}`;
  return (
    <nav aria-label="Inbox view" className="mt-2 flex gap-1 rounded-xl bg-surface p-1">
      <Link href="/inbox" aria-current={view === "contacts" ? "page" : undefined} className={tab(view === "contacts")}>
        Emails and texts
      </Link>
      <Link href="/inbox?view=ai" aria-current={view === "ai" ? "page" : undefined} className={tab(view === "ai")}>
        AI setter
      </Link>
    </nav>
  );
}
