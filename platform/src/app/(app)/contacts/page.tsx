import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Avatar, Page, PageHeader, Pill } from "@/components/ui";
import { EmptyState } from "@/components/states";
import { formatPence, getPipeline, getWorkspace, listContacts, timeAgo } from "@/lib/data";
import { AddContact } from "./add-contact";

export const metadata: Metadata = { title: "Contacts" };

export default function ContactsPage(props: PageProps<"/contacts">) {
  return (
    <Page>
        <Contacts searchParams={props.searchParams} />
    </Page>
  );
}

async function Contacts({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const openNew = params.new === "1";
  const ws = await getWorkspace();
  const [contacts, pipeline] = await Promise.all([listContacts(ws.account.id, q), getPipeline(ws.account.id)]);

  return (
    <>
      <PageHeader
        title="Contacts"
        subtitle={q ? `${contacts.length} result${contacts.length === 1 ? "" : "s"} for “${q}”` : `${contacts.length} ${contacts.length === 1 ? "person" : "people"}`}
        actions={<AddContact stages={pipeline?.stages ?? []} defaultOpen={openNew} />}
      />

      <form className="flex max-w-md items-center gap-2" role="search">
        <label className="flex h-11 flex-1 items-center gap-2.5 rounded-xl border border-line-strong bg-white px-3 focus-within:border-sky">
          <Icon name="search" size={16} className="text-faint" />
          <span className="sr-only">Search contacts</span>
          <input name="q" defaultValue={q} placeholder="Search by name, email or phone" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint" />
        </label>
        {q && (
          <Link href="/contacts" className="text-[13px] font-medium text-muted hover:text-navy">
            Clear
          </Link>
        )}
      </form>

      {contacts.length === 0 ? (
        q ? (
          <EmptyState icon="search" title="No matches">Try a different name, email or phone number.</EmptyState>
        ) : (
          <EmptyState icon="users" title="No contacts yet">Add your first contact to start tracking deals and tasks.</EmptyState>
        )
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden grid-cols-[minmax(240px,2fr)_minmax(140px,1fr)_minmax(150px,1.1fr)_110px_100px] gap-4 border-b border-line bg-surface px-5 py-3 text-[12px] font-medium text-muted md:grid">
            <span>Name</span>
            <span>Phone</span>
            <span>Stage</span>
            <span>Value</span>
            <span className="text-right">Added</span>
          </div>
          <ul className="divide-y divide-line">
            {contacts.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/contacts/${c.id}`}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface md:grid-cols-[minmax(240px,2fr)_minmax(140px,1fr)_minmax(150px,1.1fr)_110px_100px]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar initials={c.initials} size={36} />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold">{c.name}</span>
                      <span className="block truncate text-[12.5px] text-muted">{c.email ?? c.phone ?? "No email"}</span>
                    </span>
                  </span>
                  <span className="hidden text-[13.5px] tabular-nums text-muted md:block">{c.phone ?? "—"}</span>
                  <span>{c.stage ? <Pill>{c.stage}</Pill> : <span className="hidden text-[13px] text-faint md:inline">Not in pipeline</span>}</span>
                  <span className="hidden text-[13.5px] font-medium tabular-nums md:block">{formatPence(c.valuePence)}</span>
                  <span className="hidden text-right text-[12.5px] text-faint md:block">{timeAgo(c.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
