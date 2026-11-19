import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Avatar, Page, PageHeader, Pill } from "@/components/ui";
import { EmptyState } from "@/components/states";
import { can, contactSources, formatPence, getPipeline, getWorkspace, listContacts, listTags, memberNames, timeAgo } from "@/lib/data";
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
  const one = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");
  const filters = { tag: one("tag"), owner: one("owner"), source: one("source"), from: one("from"), to: one("to"), has: one("has") };
  const active = Object.entries(filters).filter(([, v]) => v);
  const [contacts, pipeline, tags, names, sources] = await Promise.all([
    listContacts(ws.account.id, q, 500, filters),
    getPipeline(ws.account.id),
    listTags(ws.account.id),
    memberNames(ws.account.id),
    contactSources(ws.account.id),
  ]);
  const without = (k: string) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    for (const [key, v] of active) if (key !== k) sp.set(key, v);
    return `/contacts${sp.size ? `?${sp}` : ""}`;
  };
  const labelFor = (k: string, v: string) =>
    k === "owner" ? (v === "none" ? "No owner" : (names[v] ?? "Someone")) : k === "has" ? ({ email: "Has email", phone: "Has phone", no_email: "No email", no_phone: "No phone" }[v] ?? v) : v;

  return (
    <>
      <PageHeader
        title="Contacts"
        subtitle={q || active.length ? `${contacts.length} match${contacts.length === 1 ? "" : "es"}` : `${contacts.length} ${contacts.length === 1 ? "person" : "people"}`}
        actions={can(ws, "contacts.edit") ? <AddContact stages={pipeline?.stages ?? []} defaultOpen={openNew} /> : undefined}
      />

      <form className="flex flex-wrap items-center gap-2" role="search">
        {active.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <label className="flex h-11 min-w-0 max-w-md flex-[1_1_260px] items-center gap-2.5 rounded-xl border border-line-strong bg-white px-3 focus-within:border-sky">
          <Icon name="search" size={16} className="text-faint" />
          <span className="sr-only">Search contacts</span>
          <input name="q" defaultValue={q} placeholder="Search by name, email or phone" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint" />
        </label>
        {(q || active.length > 0) && (
          <Link href="/contacts" className="text-[13px] font-medium text-muted hover:text-navy">
            Clear all
          </Link>
        )}
      </form>

      <details className="group card p-0" open={active.length > 0 ? undefined : false}>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[13.5px] font-semibold">
          <Icon name="filter" size={15} /> Filters{active.length ? ` (${active.length})` : ""}
          <Icon name="down" size={14} className="ml-auto text-muted transition-transform group-open:rotate-180" />
        </summary>
        <form className="grid gap-3 border-t border-line p-4 sm:grid-cols-2 lg:grid-cols-3">
          {q && <input type="hidden" name="q" value={q} />}
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-muted">Tag</span>
            <select name="tag" defaultValue={filters.tag} className="field">
              <option value="">Any tag</option>
              {tags.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-muted">Owner</span>
            <select name="owner" defaultValue={filters.owner} className="field">
              <option value="">Anyone</option>
              <option value="none">No owner</option>
              {Object.entries(names).map(([id, n]) => (
                <option key={id} value={id}>{n}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-muted">Source</span>
            <select name="source" defaultValue={filters.source} className="field">
              <option value="">Any source</option>
              {sources.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-muted">Contact details</span>
            <select name="has" defaultValue={filters.has} className="field">
              <option value="">Any</option>
              <option value="email">Has an email</option>
              <option value="phone">Has a phone number</option>
              <option value="no_email">No email</option>
              <option value="no_phone">No phone number</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-muted">Added from</span>
            <input type="date" name="from" defaultValue={filters.from} className="field" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-muted">Added to</span>
            <input type="date" name="to" defaultValue={filters.to} className="field" />
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3">
            <Link href={q ? `/contacts?q=${encodeURIComponent(q)}` : "/contacts"} className="btn-ghost inline-flex min-h-10 items-center rounded-xl px-4 text-[13px] font-semibold">Clear filters</Link>
            <button type="submit" className="btn-primary min-h-10 rounded-xl px-5 text-[13px] font-semibold">Apply filters</button>
          </div>
        </form>
      </details>

      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
          <span className="text-muted">Filtered by</span>
          {active.map(([k, v]) => (
            <Link key={k} href={without(k)} className="inline-flex items-center gap-1 rounded-full bg-chip px-2.5 py-1 font-medium text-brand hover:bg-white">
              {labelFor(k, v)} <Icon name="x" size={11} />
            </Link>
          ))}
        </div>
      )}

      {contacts.length === 0 ? (
        q || active.length ? (
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
