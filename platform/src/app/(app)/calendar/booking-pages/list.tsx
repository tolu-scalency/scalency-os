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


// Calendars: group chips across the top, then a card per calendar with its link, people and status.
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

  const pick = "h-9 rounded-full border border-line bg-white px-3 text-[13px] text-navy outline-none focus:border-brand";

  const chip = (on: boolean) => `inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12.5px] font-medium transition-colors ${on ? "bg-navy text-white" : "bg-white text-muted ring-1 ring-line hover:text-navy"}`;
  const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col gap-4">
      {/* Title row */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.02em]">Calendars</h1>
          <p className="text-[13px] text-muted">Booking links people use to pick a time. {items.length} in this workspace.</p>
        </div>
        {manage && (
          <div className="ml-auto flex items-center gap-2">
            {adding ? (
              <form action={createCalendar} className="flex gap-2">
                <input name="name" autoFocus required placeholder="Calendar name" maxLength={80} className={`${pick} w-52 rounded-lg`} aria-label="Calendar name" />
                <button className="btn-primary inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-semibold">Create</button>
                <button type="button" onClick={() => setAdding(false)} className="h-9 px-2 text-[13px] text-muted hover:text-navy">Cancel</button>
              </form>
            ) : (
              <>
                <button type="button" onClick={newGroup} className="btn-ghost inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium"><Icon name="folder" size={14} /> New group</button>
                <button type="button" onClick={() => setAdding(true)} className="btn-primary inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold"><Icon name="plus" size={14} /> New calendar</button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Groups and filters */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setGroup("all")} className={chip(group === "all")}>All <span className="opacity-70">{items.length}</span></button>
        <button type="button" onClick={() => setGroup("none")} className={chip(group === "none")}>Not grouped <span className="opacity-70">{count("none")}</span></button>
        {groups.map((g) => (
          <span key={g.id} className="group relative inline-flex">
            <button type="button" onClick={() => setGroup(g.id)} className={chip(group === g.id)}>
              <Icon name="folder" size={12} /> {g.name} <span className="opacity-70">{count(g.id)}</span>
            </button>
            {manage && group === g.id && (
              <span className="ml-1 inline-flex items-center">
                <button type="button" aria-label={`Rename ${g.name}`} onClick={() => { const name = window.prompt("Rename group", g.name); if (name?.trim()) run(() => saveGroup({ id: g.id, name })); }} className="grid h-8 w-7 place-items-center text-muted hover:text-brand"><Icon name="edit" size={13} /></button>
                <button type="button" aria-label={`Delete ${g.name}`} onClick={async () => { if (await ask({ title: `Delete the group “${g.name}”?`, text: "Its calendars stay, they just won't be grouped." })) { setGroup("all"); run(() => deleteGroup(g.id)); } }} className="grid h-8 w-7 place-items-center text-muted hover:text-bad"><Icon name="trash" size={13} /></button>
              </span>
            )}
          </span>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={pick} aria-label="Status">
            <option value="all">Any status</option>
            <option value="active">Taking bookings</option>
            <option value="paused">Paused</option>
          </select>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={pick} aria-label="Type">
            <option value="all">Any type</option>
            <option value="one">One person</option>
            <option value="round_robin">Round robin</option>
          </select>
          <div className="relative">
            <Icon name="search" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className={`${pick} w-44 pl-8`} aria-label="Search calendars" />
          </div>
        </div>
      </div>

      {/* Cards */}
      {rows.length === 0 ? (
        <div className="card px-6 py-12 text-center text-[13.5px] text-muted">
          {items.length ? "No calendars match." : "No calendars yet. Click New calendar to make your first booking link."}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {rows.map((c) => (
            <div key={c.id} className="card relative flex flex-col gap-3 overflow-visible p-4 pl-5">
              <span className="absolute inset-y-3 left-0 w-1 rounded-r-full" style={{ background: c.color }} />
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/calendar/booking-pages/${shortId(c.id)}`} className="block truncate text-[14.5px] font-semibold text-navy hover:text-brand">{c.name}</Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
                    <span>{minutesLabel(c.durationMin)}</span>·<span>{c.kind === "round_robin" ? "Round robin" : "One person"}</span>
                    {c.groupId && (<>·<span className="inline-flex items-center gap-1"><Icon name="folder" size={11} />{groupName(c.groupId)}</span></>)}
                  </div>
                </div>
                {manage ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={c.status === "active"}
                    aria-label={c.status === "active" ? "Taking bookings: click to pause" : "Paused: click to take bookings"}
                    disabled={pending}
                    onClick={() => run(() => setCalendarStatus(c.id, c.status === "active" ? "paused" : "active"))}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${c.status === "active" ? "bg-brand" : "bg-line-strong"}`}
                  >
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${c.status === "active" ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                ) : (
                  <span className={`text-[11.5px] font-medium ${c.status === "active" ? "text-ok" : "text-muted"}`}>{c.status === "active" ? "Taking bookings" : "Paused"}</span>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center">
                  {c.people.slice(0, 4).map((p, i) => (
                    <span key={p + i} title={p} className="-ml-1.5 grid h-7 w-7 place-items-center rounded-full bg-[#eaf2fc] text-[10.5px] font-semibold text-brand ring-2 ring-white first:ml-0">{initials(p)}</span>
                  ))}
                  {c.people.length > 4 && <span className="ml-1 text-[11.5px] text-muted">+{c.people.length - 4}</span>}
                  {!c.people.length && <span className="text-[12px] text-warn">Nobody takes bookings yet</span>}
                </div>
                <span className="rounded-full bg-surface px-2 py-0.5 text-[11.5px] text-muted">{c.upcoming} upcoming</span>
              </div>

              <div className="flex items-center gap-1 border-t border-line pt-2.5">
                <button type="button" onClick={() => copy(c.link)} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-brand hover:bg-[#eaf2fc]"><Icon name="copy" size={13} /> Copy link</button>
                <a href={c.link} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-muted hover:bg-surface hover:text-navy"><Icon name="eye" size={13} /> Open</a>
                {manage && <Link href={`/calendar/booking-pages/${shortId(c.id)}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-muted hover:bg-surface hover:text-navy"><Icon name="edit" size={13} /> Edit</Link>}
                {manage && (
                  <div className="relative ml-auto">
                    <button type="button" onClick={() => setMenu(menu === c.id ? null : c.id)} aria-label="More" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-navy"><Icon name="more" size={15} /></button>
                    {menu === c.id && (
                      <div className="absolute bottom-9 right-0 z-20 w-52 rounded-lg border border-line bg-white p-1 text-[13px] shadow-lg" onMouseLeave={() => setMenu(null)}>
                        <div className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Move to group</div>
                        <button type="button" onClick={() => { setMenu(null); run(() => setCalendarGroup(c.id, null)); }} className={`block w-full rounded-md px-3 py-1.5 text-left hover:bg-surface ${!c.groupId ? "font-medium text-brand" : ""}`}>Not grouped</button>
                        {groups.map((g) => (
                          <button key={g.id} type="button" onClick={() => { setMenu(null); run(() => setCalendarGroup(c.id, g.id)); }} className={`block w-full truncate rounded-md px-3 py-1.5 text-left hover:bg-surface ${c.groupId === g.id ? "font-medium text-brand" : ""}`}>{g.name}</button>
                        ))}
                        <div className="my-1 border-t border-line" />
                        <button type="button" onClick={async () => { setMenu(null); if (await ask({ title: `Archive “${c.name}”?`, text: "Its link stops taking bookings. Existing bookings stay.", confirm: "Archive" })) run(() => archiveCalendar(c.id)); }} className="block w-full rounded-md px-3 py-2 text-left text-bad hover:bg-[#fff1f1]">Archive</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
