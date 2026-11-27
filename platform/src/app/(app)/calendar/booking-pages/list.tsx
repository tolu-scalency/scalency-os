"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { notify } from "@/components/toast";
import { ask } from "@/components/confirm";
import { shortId } from "@/lib/short-id-shared";
import { minutesLabel } from "@/lib/calendar/types";
import { archiveCalendar, createCalendar, deleteGroup, saveGroup, setCalendarGroup, setCalendarStatus } from "../actions";

export type CalendarItem = {
  id: string;
  name: string;
  link: string;
  kind: "one" | "round_robin";
  durationMin: number;
  color: string;
  status: "active" | "paused";
  groupId: string | null;
  updatedAt: string | null;
  people: string[];
  upcoming: number;
};
type Group = { id: string; name: string };

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

// GHL-style calendars list: groups on the left, a searchable table on the right.
export function CalendarsList({ items, groups, manage }: { items: CalendarItem[]; groups: Group[]; manage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [group, setGroup] = useState<string>("all"); // "all", "none" or a group id
  const [status, setStatus] = useState<"all" | "active" | "paused">("all");
  const [type, setType] = useState<"all" | "one" | "round_robin">("all");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      items.filter(
        (c) =>
          (group === "all" || (group === "none" ? !c.groupId : c.groupId === group)) &&
          (status === "all" || c.status === status) &&
          (type === "all" || c.kind === type) &&
          (!q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase())),
      ),
    [items, group, status, type, q],
  );
  const groupName = (id: string | null) => groups.find((g) => g.id === id)?.name ?? "";
  const count = (id: string) => items.filter((c) => (id === "none" ? !c.groupId : c.groupId === id)).length;

  const run = (fn: () => Promise<{ error?: string; ok?: string }>) =>
    start(async () => {
      const r = await fn();
      notify(r.error ?? r.ok ?? "Done", r.error ? "bad" : "ok");
      if (!r.error) router.refresh();
    });

  const newGroup = () => {
    const name = window.prompt("Group name");
    if (name?.trim()) run(() => saveGroup({ name }));
  };

  const copy = (link: string) =>
    navigator.clipboard?.writeText(link).then(
      () => notify("Link copied"),
      () => notify("Couldn't copy the link.", "bad"),
    );

  const pick = "h-9 rounded-lg border border-line bg-white px-2.5 text-[13px] text-navy outline-none focus:border-brand";

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* Groups */}
      <aside className="flex shrink-0 flex-col gap-1 lg:w-56">
        <button type="button" onClick={() => setGroup("all")} className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-medium ${group === "all" ? "bg-[#eaf2fc] text-brand" : "text-navy hover:bg-white"}`}>
          All calendars <span className="text-[12px] text-muted">{items.length}</span>
        </button>
        <div className="mt-3 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Groups</div>
        <button type="button" onClick={() => setGroup("none")} className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] ${group === "none" ? "bg-[#eaf2fc] font-medium text-brand" : "text-muted hover:bg-white"}`}>
          Not grouped <span className="text-[12px]">{count("none")}</span>
        </button>
        {groups.map((g) => (
          <div key={g.id} className={`group flex items-center rounded-lg ${group === g.id ? "bg-[#eaf2fc]" : "hover:bg-white"}`}>
            <button type="button" onClick={() => setGroup(g.id)} className={`flex min-w-0 flex-1 items-center justify-between px-3 py-2 text-left text-[13px] ${group === g.id ? "font-medium text-brand" : "text-muted"}`}>
              <span className="truncate">{g.name}</span> <span className="text-[12px]">{count(g.id)}</span>
            </button>
            {manage && (
              <span className="hidden pr-1 group-hover:flex">
                <button type="button" aria-label={`Rename ${g.name}`} onClick={() => { const name = window.prompt("Rename group", g.name); if (name?.trim()) run(() => saveGroup({ id: g.id, name })); }} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:text-brand"><Icon name="edit" size={13} /></button>
                <button type="button" aria-label={`Delete ${g.name}`} onClick={async () => { if (await ask({ title: `Delete the group “${g.name}”?`, text: "Its calendars stay, they just won't be grouped." })) { if (group === g.id) setGroup("all"); run(() => deleteGroup(g.id)); } }} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:text-bad"><Icon name="trash" size={13} /></button>
              </span>
            )}
          </div>
        ))}
        {manage && (
          <button type="button" onClick={newGroup} className="mt-1 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-brand hover:bg-white">
            <Icon name="plus" size={13} /> New group
          </button>
        )}
      </aside>

      {/* Table */}
      <section className="min-w-0 flex-1 overflow-hidden rounded-xl border border-line bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={pick} aria-label="Status">
            <option value="all">Status: All</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={pick} aria-label="Type">
            <option value="all">Type: All</option>
            <option value="one">Personal</option>
            <option value="round_robin">Round robin</option>
          </select>
          <div className="relative ml-auto">
            <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search calendars" className={`${pick} w-52 pl-8`} aria-label="Search calendars" />
          </div>
          {manage &&
            (adding ? (
              <form action={createCalendar} className="flex gap-2">
                <input name="name" autoFocus required placeholder="Calendar name" maxLength={80} className={`${pick} w-48`} aria-label="Calendar name" />
                <button className="btn-primary inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-semibold">Create</button>
                <button type="button" onClick={() => setAdding(false)} className="h-9 rounded-lg px-2 text-[13px] text-muted hover:text-navy">Cancel</button>
              </form>
            ) : (
              <button type="button" onClick={() => setAdding(true)} className="btn-primary inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold">
                <Icon name="plus" size={14} /> New calendar
              </button>
            ))}
        </div>

        {rows.length === 0 ? (
          <div className="px-6 py-14 text-center text-[13.5px] text-muted">
            {items.length ? "No calendars match." : "No calendars yet. Click New calendar to make your first booking page."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead className="bg-[#f8fafc] text-[12px] text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Calendar name</th>
                  <th className="px-3 py-2.5 font-medium">Group</th>
                  <th className="px-3 py-2.5 font-medium">Duration</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">Upcoming</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Updated</th>
                  <th className="px-3 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-[#fafcff]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                        <div className="min-w-0">
                          <Link href={`/calendar/booking-pages/${shortId(c.id)}`} className="block truncate font-medium text-navy hover:text-brand">{c.name}</Link>
                          <div className="truncate text-[11.5px] text-faint">{c.people.length ? c.people.join(", ") : "Nobody takes bookings yet"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted">{groupName(c.groupId) || "–"}</td>
                    <td className="px-3 py-3 text-muted">{minutesLabel(c.durationMin)}</td>
                    <td className="px-3 py-3 text-muted">{c.kind === "round_robin" ? "Round robin" : "Personal"}</td>
                    <td className="px-3 py-3 text-muted">{c.upcoming}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-medium ${c.status === "active" ? "bg-ok-bg text-ok" : "bg-bad-bg text-bad"}`}>{c.status === "active" ? "Active" : "Inactive"}</span>
                    </td>
                    <td className="px-3 py-3 text-muted">{c.updatedAt ? dateFmt.format(new Date(c.updatedAt)) : "–"}</td>
                    <td className="px-3 py-3">
                      <div className="relative flex items-center justify-end gap-0.5">
                        {manage && (
                          <Link href={`/calendar/booking-pages/${shortId(c.id)}`} aria-label="Edit" title="Edit" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-brand"><Icon name="edit" size={15} /></Link>
                        )}
                        <button type="button" onClick={() => copy(c.link)} aria-label="Copy link" title="Copy link" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-brand"><Icon name="share" size={15} /></button>
                        <a href={c.link} target="_blank" rel="noreferrer" aria-label="Open booking page" title="Open booking page" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-brand"><Icon name="eye" size={15} /></a>
                        {manage && (
                          <button type="button" onClick={() => setMenu(menu === c.id ? null : c.id)} aria-label="More" title="More" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-navy"><Icon name="more" size={15} /></button>
                        )}
                        {menu === c.id && (
                          <div className="absolute right-0 top-9 z-20 w-56 rounded-lg border border-line bg-white p-1 text-[13px] shadow-lg" onMouseLeave={() => setMenu(null)}>
                            <button type="button" disabled={pending} onClick={() => { setMenu(null); run(() => setCalendarStatus(c.id, c.status === "active" ? "paused" : "active")); }} className="block w-full rounded-md px-3 py-2 text-left hover:bg-surface">
                              {c.status === "active" ? "Make inactive" : "Make active"}
                            </button>
                            <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Move to group</div>
                            <button type="button" onClick={() => { setMenu(null); run(() => setCalendarGroup(c.id, null)); }} className={`block w-full rounded-md px-3 py-1.5 text-left hover:bg-surface ${!c.groupId ? "font-medium text-brand" : ""}`}>Not grouped</button>
                            {groups.map((g) => (
                              <button key={g.id} type="button" onClick={() => { setMenu(null); run(() => setCalendarGroup(c.id, g.id)); }} className={`block w-full truncate rounded-md px-3 py-1.5 text-left hover:bg-surface ${c.groupId === g.id ? "font-medium text-brand" : ""}`}>{g.name}</button>
                            ))}
                            <div className="my-1 border-t border-line" />
                            <button type="button" onClick={async () => { setMenu(null); if (await ask({ title: `Archive “${c.name}”?`, text: "Its link stops taking bookings. Existing bookings stay.", confirm: "Archive" })) run(() => archiveCalendar(c.id)); }} className="block w-full rounded-md px-3 py-2 text-left text-bad hover:bg-[#fff1f1]">Archive</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
