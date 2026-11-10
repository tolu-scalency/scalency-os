import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Avatar, PageHeader, Pill, Tile } from "@/components/ui";
import { EmptyState, Loading, NoAccount } from "@/components/states";
import { countRecent, formatPence, getWorkspace, listContacts, timeAgo } from "@/lib/data";
import { AddContact } from "./add-contact";

export const metadata: Metadata = { title: "Contacts" };

const grid = "grid grid-cols-[minmax(220px,2.2fr)_minmax(150px,1.2fr)_minmax(160px,1.4fr)_110px_110px_100px] items-center gap-3.5 px-[18px] py-[13px]";

export default function ContactsPage() {
  return (
    <main className="flex flex-col gap-[18px] px-7 pb-10 pt-7">
      <PageHeader eyebrow="CRM" title="Contacts" actions={<AddContact />} />
      <Suspense fallback={<Loading rows={6} />}>
        <ContactsTable />
      </Suspense>
    </main>
  );
}

async function ContactsTable() {
  const ws = await getWorkspace();
  if (!ws.account) return <NoAccount email={ws.userEmail} />;
  const contacts = await listContacts(ws.account.id);

  if (contacts.length === 0) {
    return (
      <EmptyState icon="users" title="No contacts yet">
        Contacts appear here when someone fills in an application form, or when you add one with <strong className="text-navy">Add contact</strong>.
      </EmptyState>
    );
  }

  const stats = [
    { label: "Total", value: contacts.length, icon: "users" as const, tone: "blue" as const },
    { label: "Added this week", value: countRecent(contacts, 7), icon: "plus" as const, tone: "green" as const },
    { label: "In the pipeline", value: contacts.filter((c) => c.stage).length, icon: "pipeline" as const, tone: "violet" as const },
    { label: "Test contacts", value: contacts.filter((c) => c.isTest).length, icon: "shield" as const, tone: "orange" as const },
  ];

  return (
    <>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        {stats.map((s) => (
          <div key={s.label} className="card flex items-center gap-3 px-4 py-3.5">
            <Tile icon={s.icon} tone={s.tone} size={34} />
            <div>
              <div className="eyebrow">{s.label}</div>
              <div className="text-xl font-semibold tracking-[-0.03em]">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <div className="min-w-[900px]">
          <div className={`${grid} eyebrow rounded-t-[18px] border-b border-line bg-surface`}>
            <span>Name</span><span>Stage</span><span>Phone</span><span>Value</span><span>Source</span><span>Added</span>
          </div>
          {contacts.map((c) => (
            <Link key={c.id} href={`/contacts/${c.id}`} className={`${grid} border-t border-line first:border-t-0 hover:bg-surface`}>
              <span className="flex min-w-0 items-center gap-3">
                <Avatar initials={c.initials} />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-[13.5px] font-semibold">
                    {c.name}
                    {c.isTest && <Pill tone="neutral" mono>TEST</Pill>}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-muted">{c.email ?? "No email"}</span>
                </span>
              </span>
              <span>{c.stage ? <Pill>{c.stage}</Pill> : <span className="text-[12.5px] text-muted">Not in a pipeline</span>}</span>
              <span className="font-mono text-[12.5px]">{c.phone ?? "—"}</span>
              <span className="font-mono text-[12.5px]">{formatPence(c.valuePence)}</span>
              <span className="text-[12.5px] capitalize text-muted">{c.source ?? "—"}</span>
              <span className="font-mono text-[11.5px] text-muted">{timeAgo(c.createdAt)}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
