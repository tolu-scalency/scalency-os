import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Avatar, Button, PageHeader, Pill, Segmented, Tile } from "@/components/ui";
import { contacts } from "@/lib/sample-data";

export const metadata: Metadata = { title: "Contacts" };

const grid = "grid grid-cols-[28px_minmax(220px,2.2fr)_minmax(150px,1.2fr)_minmax(130px,1fr)_minmax(150px,1.3fr)_110px_100px] items-center gap-3.5 px-[18px] py-[13px]";

export default function ContactsPage() {
  return (
    <main className="flex flex-col gap-[18px] px-7 pb-10 pt-7">
      <PageHeader
        eyebrow="CRM · 248 records"
        title="Contacts"
        actions={
          <>
            <Button icon="upload">Import</Button>
            <Button icon="download">Export</Button>
            <Button variant="primary" icon="plus">Add contact</Button>
          </>
        }
      />

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        {[
          { label: "Total", value: "248", icon: "users" as const, tone: "blue" as const },
          { label: "Qualified", value: "87", icon: "check" as const, tone: "green" as const },
          { label: "Hot (score 70+)", value: "19", icon: "spark" as const, tone: "violet" as const },
          { label: "No reply 48h+", value: "11", icon: "clock" as const, tone: "orange" as const },
        ].map((s) => (
          <div key={s.label} className="card flex items-center gap-3 px-4 py-3.5">
            <Tile icon={s.icon} tone={s.tone} size={34} />
            <div>
              <div className="eyebrow">{s.label}</div>
              <div className="text-xl font-semibold tracking-[-0.03em]">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented options={["All", "Hot leads", "Booked", "Unqualified", "Test contacts", "+ Smart list"]} active="All" />
        <div className="flex gap-2">
          <Button size="sm" icon="filter">Filter</Button>
          <Button size="sm" icon="sort">Sort: Score</Button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="min-w-[1000px]">
          <div className={`${grid} eyebrow rounded-t-[18px] border-b border-line bg-surface`}>
            <span className="h-4 w-4 rounded-[5px] border-[1.5px] border-line-strong" />
            <span>Name</span>
            <span>Stage</span>
            <span>AI lead score</span>
            <span>Business</span>
            <span>Source</span>
            <span>Last active</span>
          </div>
          {contacts.map((c) => (
            <Link key={c.id} href={`/contacts/${c.id}`} className={`${grid} border-t border-line first:border-t-0 hover:bg-surface`}>
              <span className="h-4 w-4 rounded-[5px] border-[1.5px] border-line-strong" />
              <span className="flex min-w-0 items-center gap-3">
                <Avatar initials={c.initials} tone={c.tone} />
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold">{c.name}</span>
                  <span className="block truncate font-mono text-[11px] text-muted">{c.email}</span>
                </span>
              </span>
              <span><Pill tone={c.stageTone}>{c.stage}</Pill></span>
              <span className="flex items-center gap-2.5">
                <span className="w-[22px] font-mono text-[13px] font-semibold">{c.score}</span>
                <span className="h-[5px] w-[70px] overflow-hidden rounded-full bg-surface">
                  <span className="block h-full rounded-full bg-gradient-to-r from-brand to-turquoise" style={{ width: `${c.score}%` }} />
                </span>
              </span>
              <span className="text-[13px]">{c.business}</span>
              <span className="text-[12.5px] text-muted">{c.source}</span>
              <span className="font-mono text-[11.5px] text-muted">{c.lastActive}</span>
            </Link>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-[18px] py-3.5">
            <span className="font-mono text-[11px] text-muted">SHOWING 1–10 OF 248 · SAMPLE DATA</span>
            <div className="flex gap-1.5">
              <Button size="sm">Previous</Button>
              <Button size="sm">Next</Button>
            </div>
          </div>
        </div>
      </div>

      <p className="flex items-center gap-2 text-xs text-muted">
        <Icon name="shield" size={14} /> Sample contacts only. Real contacts arrive once the application form is connected (Step 3).
      </p>
    </main>
  );
}
