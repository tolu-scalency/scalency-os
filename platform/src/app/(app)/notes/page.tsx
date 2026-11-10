import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Avatar, Page, PageHeader } from "@/components/ui";
import { EmptyState } from "@/components/states";
import { getWorkspace, initialsOf, listNotes, timeAgo } from "@/lib/data";

export const metadata: Metadata = { title: "Notes" };

export default async function NotesPage(props: PageProps<"/notes">) {
  const params = await props.searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const ws = await getWorkspace();
  const notes = await listNotes(ws.account.id, q);

  return (
    <Page>
      <PageHeader title="Notes" subtitle="Everything your team has written about your contacts." />
      <form className="flex max-w-md" role="search">
        <label className="flex h-11 flex-1 items-center gap-2.5 rounded-xl border border-line-strong bg-white px-3 focus-within:border-sky">
          <Icon name="search" size={16} className="text-faint" />
          <span className="sr-only">Search notes</span>
          <input name="q" defaultValue={q} placeholder="Search notes" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint" />
        </label>
      </form>
      {notes.length === 0 ? (
        <EmptyState icon="edit" tone="orange" title={q ? "No matching notes" : "No notes yet"}>
          {q ? "Try another word." : "Open a contact and write a note. It will show up here too."}
        </EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {notes.map((n) => (
            <article key={n.id} className="card flex flex-col gap-3 p-5">
              <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed">{n.text}</p>
              <div className="mt-auto flex items-center gap-2.5 border-t border-line pt-3 text-[12.5px] text-muted">
                {n.contactName && n.contactId ? (
                  <Link href={`/contacts/${n.contactId}`} className="flex min-w-0 items-center gap-2 font-medium text-navy hover:text-brand">
                    <Avatar initials={initialsOf(n.contactName)} size={24} />
                    <span className="truncate">{n.contactName}</span>
                  </Link>
                ) : null}
                <span className="ml-auto whitespace-nowrap">
                  {n.author ? `${n.author} · ` : ""}
                  {timeAgo(n.createdAt)}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </Page>
  );
}
