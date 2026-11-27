"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { notify } from "@/components/toast";
import { ask } from "@/components/confirm";
import { LOCATIONS, minutesLabel, slugify, type CalendarSettings, type LocationType, type Question } from "@/lib/calendar/types";
import { archiveCalendar, saveCalendar } from "../../actions";

type TeamMember = { id: string; name: string; on: boolean; priority: number; connected: string[]; locationType: string; locationValue: string };
export type OpenCheck = { next: string[]; total?: number; reasons: string[]; tz: string };
type Group = { id: string; name: string };

const AHEAD = [
  [7, "1 week"],
  [14, "2 weeks"],
  [30, "1 month"],
  [60, "2 months"],
  [90, "3 months"],
  [180, "6 months"],
  [365, "1 year"],
] as const;

const NOTICE = [
  [0, "No notice"],
  [60, "1 hour"],
  [240, "4 hours"],
  [720, "12 hours"],
  [1440, "24 hours"],
  [2880, "48 hours"],
  [4320, "3 days"],
] as const;

/** Booking tools people paste by mistake: these are booking pages, not a room to meet in. */
const BOOKING_LINK = /calendar\.app\.google|calendar\.google\.com\/calendar\/appointments|calendly\.com|cal\.com\/|youcanbook\.me|acuityscheduling/i;

const SECTIONS = [
  ["basic", "Basic details"],
  ["staff", "Team & where"],
  ["rules", "Booking rules"],
  ["questions", "Questions"],
  ["after", "After booking"],
  ["share", "Share"],
] as const;
type SectionKey = (typeof SECTIONS)[number][0];

const box = "h-9 rounded-lg border border-line bg-white px-3 text-[13px] text-navy outline-none focus:border-brand";
const field = `${box} w-full`;
const label = "flex flex-col gap-1 text-[12.5px] font-medium text-navy";
const hint = "text-[11.5px] font-normal text-muted";

function Panel({ title, text, children }: { title: string; text?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {text && <p className="mt-0.5 text-[12.5px] text-muted">{text}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

// The calendar editor: a summary card, section tabs, the settings, and an "at a glance" panel.
export function BookingPageEditor({ id, initial, base, team: teamIn, stages, check, groups = [] }: { id: string; initial: CalendarSettings; base: string; team: TeamMember[]; stages: { id: string; name: string }[]; check?: OpenCheck; groups?: Group[] }) {
  const [s, setS] = useState(initial);
  const [team, setTeam] = useState(teamIn);
  const [tab, setTab] = useState<SectionKey>("basic");
  const [pending, start] = useTransition();
  const router = useRouter();
  const [tagText, setTagText] = useState(initial.tags.join(", "));
  const set = (p: Partial<CalendarSettings>) => setS((x) => ({ ...x, ...p }));
  const num = (k: keyof CalendarSettings) => ({ value: String(s[k] ?? ""), onChange: (e: { target: { value: string } }) => set({ [k]: Number(e.target.value) } as Partial<CalendarSettings>) });
  const link = base + s.slug;
  const embed = `<iframe src="${link}?embed=1" style="width:100%;min-height:760px;border:0" title="${s.name}"></iframe>`;
  const onTeam = team.filter((m) => m.on);
  const placeOf = (m: TeamMember): LocationType => (LOCATIONS.some((l) => l.id === m.locationType) ? (m.locationType as LocationType) : s.locationType);
  const valueOf = (m: TeamMember) => (m.locationType ? m.locationValue : s.locationValue);
  const setMember = (id: string, p: Partial<TeamMember>) => setTeam((t) => t.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const save = () =>
    start(async () => {
      const chosen = team.filter((m) => m.on);
      // The calendar's own place follows the first person, so older screens still show something sensible.
      const first = chosen[0];
      const r = await saveCalendar(
        id,
        { ...s, ...(first ? { locationType: placeOf(first), locationValue: valueOf(first) } : {}), tags: tagText.split(",").map((t) => t.trim()).filter(Boolean) },
        chosen.map((m) => ({ userId: m.id, priority: m.priority, locationType: placeOf(m), locationValue: valueOf(m) })),
      );
      if (r.error) notify(r.error, "bad");
      else {
        notify(r.ok ?? "Saved");
        router.refresh();
      }
    });

  const setQ = (i: number, p: Partial<Question>) => set({ questions: s.questions.map((q, j) => (j === i ? { ...q, ...p } : q)) });
  const copy = (text: string, what: string) =>
    navigator.clipboard?.writeText(text).then(
      () => notify(`${what} copied`),
      () => notify("Couldn't copy.", "bad"),
    );

  const people = onTeam.map((m) => ({ name: m.name, place: LOCATIONS.find((l) => l.id === placeOf(m))?.label ?? "" }));
  const icons: Record<SectionKey, React.ComponentProps<typeof Icon>["name"]> = { basic: "calendar", staff: "users", rules: "clock", questions: "form", after: "zap", share: "link" };

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 pb-10 pt-4 sm:px-6 sm:pt-5">
      <Link href="/calendar/booking-pages" className="inline-flex w-fit items-center gap-1.5 text-[13px] text-muted hover:text-brand">
        <Icon name="arrowLeft" size={14} /> Calendars
      </Link>

      {/* Summary */}
      <div className="card flex flex-wrap items-center gap-4 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: s.color }}><Icon name="calendar" size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-semibold tracking-[-0.01em]">{s.name || "Calendar"}</div>
          <button type="button" onClick={() => copy(link, "Link")} className="mt-0.5 inline-flex max-w-full items-center gap-1.5 truncate text-[12px] text-muted hover:text-brand" title="Copy link">
            <Icon name="link" size={12} /> <span className="truncate">{link}</span>
          </button>
        </div>
        <label className="flex items-center gap-2 text-[12.5px] font-medium text-navy">
          <button type="button" role="switch" aria-checked={s.status === "active"} onClick={() => set({ status: s.status === "active" ? "paused" : "active" })} className={`relative h-5 w-9 rounded-full transition-colors ${s.status === "active" ? "bg-brand" : "bg-line-strong"}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${s.status === "active" ? "left-[18px]" : "left-0.5"}`} />
          </button>
          {s.status === "active" ? "Taking bookings" : "Paused"}
        </label>
        <a href={link} target="_blank" rel="noreferrer" className="btn-ghost inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium"><Icon name="eye" size={14} /> Preview</a>
        <button type="button" disabled={pending} onClick={save} className="btn-primary inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold"><Icon name="check" size={14} /> {pending ? "Saving…" : "Save"}</button>
      </div>

      {/* Sections */}
      <nav className="flex gap-5 overflow-x-auto border-b border-line text-[13.5px] font-medium" aria-label="Calendar settings">
        {SECTIONS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-0.5 pb-2.5 pt-1 ${tab === k ? "border-brand text-brand" : "border-transparent text-muted hover:text-navy"}`}>
            <Icon name={icons[k]} size={14} /> {l}
          </button>
        ))}
      </nav>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          {check && !check.next.length && (
            <div className="card border-[#f3c9c4] p-4 text-[13px]">
              <div className="font-semibold text-bad">People can&apos;t book yet: there are no open times</div>
              <ul className="ml-5 mt-1.5 list-disc text-navy">{check.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
          )}

          {tab === "basic" && (
            <Panel title="Basic details" text="What people see on the booking page.">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={`${label} sm:col-span-2`}>
                  Calendar name
                  <input value={s.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} className={field} />
                </label>
                <label className={`${label} sm:col-span-2`}>
                  Description
                  <textarea value={s.description} onChange={(e) => set({ description: e.target.value })} rows={3} maxLength={1000} placeholder="What the call is for and what you'll cover." className={`${field} h-auto py-2`} />
                </label>
                <label className={label}>
                  Duration
                  <select value={s.durationMin} onChange={(e) => set({ durationMin: Number(e.target.value) })} className={field}>
                    {[10, 15, 20, 30, 45, 60, 75, 90, 120].map((m) => <option key={m} value={m}>{minutesLabel(m)}</option>)}
                  </select>
                </label>
                <label className={label}>
                  Group
                  <select value={s.groupId ?? ""} onChange={(e) => set({ groupId: e.target.value || null })} className={field}>
                    <option value="">Not grouped</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </label>
                <label className={`${label} sm:col-span-2`}>
                  Link
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[12px] text-muted">{base}</span>
                    <input value={s.slug} onChange={(e) => set({ slug: slugify(e.target.value) })} aria-label="Link name" className={`${box} w-48 font-mono text-[12px]`} />
                  </div>
                </label>
                <label className={label}>
                  Colour
                  <input type="color" value={s.color} onChange={(e) => set({ color: e.target.value })} className={`${field} cursor-pointer p-1`} />
                </label>
              </div>
            </Panel>
          )}

          {tab === "staff" && (
            <Panel title="Who takes bookings, and where" text="Choose who takes these bookings and where each person meets. Bookings go into each person's own calendar.">
              <div className="mb-4 inline-flex rounded-lg border border-line bg-surface p-0.5">
                {(["one", "round_robin"] as const).map((k) => (
                  <button key={k} type="button" onClick={() => set({ kind: k })} className={`rounded-md px-3 py-1.5 text-[12.5px] font-medium ${s.kind === k ? "bg-white text-navy shadow-sm" : "text-muted"}`}>
                    {k === "one" ? "One person" : "Round robin"}
                  </button>
                ))}
              </div>
              <p className="mb-3 text-[12px] text-muted">{s.kind === "one" ? "Every booking goes to the first person on the list." : "Each booking goes to whoever is free and was booked least recently. Higher priority wins a tie."}</p>

              <label className={`${label} mb-4`}>
                Add someone
                <select value="" onChange={(e) => e.target.value && setMember(e.target.value, { on: true })} className={field}>
                  <option value="">Choose a team member</option>
                  {team.filter((m) => !m.on).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>

              {!onTeam.length && <p className="rounded-lg bg-warn-bg px-3 py-2 text-[12.5px] text-warn">Add at least one person, or nobody can book.</p>}
              <div className="flex flex-col divide-y divide-line">
                {onTeam.map((m) => {
                  const place = placeOf(m);
                  const meta = LOCATIONS.find((l) => l.id === place);
                  const needs = place === "google_meet" ? "google" : place === "teams" ? "microsoft" : null;
                  const value = valueOf(m);
                  return (
                    <div key={m.id} className="grid gap-2 py-3 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-start">
                      <div className="flex items-center gap-2 pt-1.5">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#eaf2fc] text-[11px] font-semibold text-brand">{m.name.slice(0, 2).toUpperCase()}</span>
                        <span className="truncate text-[13px] font-medium">{m.name}</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        <select value={place} onChange={(e) => setMember(m.id, { locationType: e.target.value, locationValue: "" })} className={field} aria-label={`Meeting location for ${m.name}`}>
                          {LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                        </select>
                        {meta?.needs && (
                          <input value={value} onChange={(e) => setMember(m.id, { locationType: place, locationValue: e.target.value })} maxLength={300} placeholder={meta.needs === "address" ? "128 City Road, London EC1V 2NX" : place === "zoom" ? "https://zoom.us/j/1234567890" : "https://…"} className={field} aria-label="Address or link" />
                        )}
                        {meta?.hint && <span className={hint}>{meta.hint}</span>}
                        {needs && !m.connected.includes(needs) && (
                          <span className="text-[11.5px] text-warn">
                            {m.name} hasn&apos;t connected {needs === "google" ? "Google Calendar" : "Outlook"} yet, so there&apos;s no {needs === "google" ? "Meet" : "Teams"} link. Connect it in Calendar, Connections.
                          </span>
                        )}
                        {meta?.needs === "link" && BOOKING_LINK.test(value) && <span className="text-[11.5px] text-warn">That&apos;s a booking page link, not a meeting room. Paste the link people join the call with.</span>}
                      </div>
                      <div className="flex items-center gap-1 sm:pt-0.5">
                        {s.kind === "round_robin" && (
                          <select value={m.priority} onChange={(e) => setMember(m.id, { priority: Number(e.target.value) })} className={`${box} w-auto`} aria-label="Priority">
                            {[1, 2, 3, 4, 5].map((p) => <option key={p} value={p}>Priority {p}</option>)}
                          </select>
                        )}
                        <button type="button" onClick={() => setMember(m.id, { on: false })} aria-label={`Remove ${m.name}`} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-[#fff1f1] hover:text-bad"><Icon name="trash" size={14} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}

          {tab === "rules" && (
            <Panel title="Booking rules" text="Working hours come from each person's Availability. These rules sit on top.">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={label}>
                  Start times every
                  <select value={s.slotStepMin} onChange={(e) => set({ slotStepMin: Number(e.target.value) })} className={field}>
                    {[10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{minutesLabel(m)}</option>)}
                  </select>
                </label>
                <label className={label}>
                  Minimum notice
                  <select value={s.minNoticeMin} onChange={(e) => set({ minNoticeMin: Number(e.target.value) })} className={field}>
                    {NOTICE.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
                  </select>
                </label>
                <label className={label}>
                  How far ahead people can book
                  <select value={s.maxDaysAhead} onChange={(e) => set({ maxDaysAhead: Number(e.target.value) })} className={field}>
                    {!AHEAD.some(([d]) => d === s.maxDaysAhead) && <option value={s.maxDaysAhead}>{s.maxDaysAhead} days</option>}
                    {AHEAD.map(([d, l]) => <option key={d} value={d}>{l}</option>)}
                  </select>
                </label>
                <label className={label}>
                  Most bookings a day, per person
                  <input type="number" min={0} max={100} {...num("dailyLimit")} className={field} />
                  <span className={hint}>0 means no limit.</span>
                </label>
                <label className={label}>
                  Gap before (minutes)
                  <input type="number" min={0} max={240} {...num("bufferBeforeMin")} className={field} />
                </label>
                <label className={label}>
                  Gap after (minutes)
                  <input type="number" min={0} max={240} {...num("bufferAfterMin")} className={field} />
                </label>
              </div>
              {check && check.next.length > 0 && (
                <p className="mt-4 text-[12px] text-muted">
                  Next free: {check.next.join(" · ")} ({check.tz.replace(/_/g, " ")} time). Save to check again after a change.
                </p>
              )}
            </Panel>
          )}

          {tab === "questions" && (
            <Panel title="Questions" text="Name, email and mobile are always asked. Add anything else you need before the call.">
              <div className="flex flex-col gap-2.5">
                {s.questions.map((q, i) => (
                  <div key={q.id} className="grid gap-2 rounded-lg border border-line p-2.5 sm:grid-cols-[minmax(0,1fr)_140px_auto_auto]">
                    <input value={q.label} onChange={(e) => setQ(i, { label: e.target.value })} maxLength={160} placeholder="e.g. What's your monthly revenue?" className={field} aria-label="Question" />
                    <select value={q.type} onChange={(e) => setQ(i, { type: e.target.value as Question["type"], options: e.target.value === "select" && !q.options.length ? ["Option 1", "Option 2"] : q.options })} className={field} aria-label="Answer type">
                      <option value="text">Short answer</option>
                      <option value="textarea">Long answer</option>
                      <option value="select">Choose one</option>
                    </select>
                    <label className="flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={q.required} onChange={(e) => setQ(i, { required: e.target.checked })} className="h-4 w-4 accent-[#0465C7]" /> Required</label>
                    <button type="button" onClick={() => set({ questions: s.questions.filter((_, j) => j !== i) })} aria-label="Remove question" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-[#fff1f1] hover:text-bad"><Icon name="trash" size={14} /></button>
                    {q.type === "select" && (
                      <input value={q.options.join(", ")} onChange={(e) => setQ(i, { options: e.target.value.split(",").map((o) => o.trim()) })} placeholder="Options, separated by commas" className={`${field} sm:col-span-4`} aria-label="Options" />
                    )}
                  </div>
                ))}
                {s.questions.length < 12 && (
                  <button type="button" onClick={() => set({ questions: [...s.questions, { id: Math.random().toString(36).slice(2, 10), label: "", type: "text", required: false, options: [] }] })} className="inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium text-brand hover:bg-surface">
                    <Icon name="plus" size={13} /> Add a question
                  </button>
                )}
              </div>
            </Panel>
          )}

          {tab === "after" && (
            <Panel title="After booking" text="The contact is created or updated and your “Appointment booked” workflows start.">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={label}>
                  Move their deal to
                  <select value={s.stageId ?? ""} onChange={(e) => set({ stageId: e.target.value || null })} className={field}>
                    <option value="">Don&apos;t change the pipeline</option>
                    {stages.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                  </select>
                </label>
                <label className={label}>
                  Tags to add
                  <input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="Booked call, Website" className={field} />
                </label>
                <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={s.confirmEmail} onChange={(e) => set({ confirmEmail: e.target.checked })} className="h-4 w-4 accent-[#0465C7]" /> Email them a confirmation</label>
                <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={s.notifyTeam} onChange={(e) => set({ notifyTeam: e.target.checked })} className="h-4 w-4 accent-[#0465C7]" /> Post it in team chat</label>
                <label className={`${label} sm:col-span-2`}>
                  Thank-you message
                  <textarea value={s.thankYou} onChange={(e) => set({ thankYou: e.target.value })} rows={2} maxLength={1000} placeholder="You're booked. We've sent the details to your email." className={`${field} h-auto py-2`} />
                </label>
                <label className={`${label} sm:col-span-2`}>
                  Or send them to a page
                  <input value={s.redirectUrl} onChange={(e) => set({ redirectUrl: e.target.value.trim() })} placeholder="https://scalency.us/ai-growth/booked" className={field} />
                  <span className={hint}>Leave blank to show the message above.</span>
                </label>
              </div>
            </Panel>
          )}

          {tab === "share" && (
            <Panel title="Share & embed" text="Send the link, or put the calendar on any website.">
              <div className="flex flex-col gap-4">
                <div>
                  <div className="mb-1 text-[12.5px] font-medium">Link</div>
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1 truncate rounded-lg bg-surface px-3 py-2 font-mono text-[12px]">{link}</div>
                    <button type="button" onClick={() => copy(link, "Link")} className="btn-primary h-9 rounded-lg px-3 text-[12.5px] font-semibold">Copy</button>
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[12.5px] font-medium">Embed code</div>
                  <textarea readOnly value={embed} rows={3} className={`${field} h-auto py-2 font-mono text-[11.5px]`} onFocus={(e) => e.currentTarget.select()} />
                  <button type="button" onClick={() => copy(embed, "Embed code")} className="mt-2 h-9 rounded-lg border border-line px-3 text-[12.5px] font-medium text-brand hover:bg-surface">Copy embed code</button>
                </div>
                <div className="border-t border-line pt-4">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!(await ask({ title: `Archive “${s.name}”?`, text: "Its link stops taking bookings. Existing bookings stay.", confirm: "Archive" }))) return;
                      start(async () => {
                        const r = await archiveCalendar(id);
                        if (r.error) notify(r.error, "bad");
                        else {
                          notify("Archived");
                          router.push("/calendar/booking-pages");
                        }
                      });
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium text-bad hover:bg-[#fff1f1]"
                  >
                    <Icon name="trash" size={14} /> Archive this calendar
                  </button>
                </div>
              </div>
            </Panel>
          )}
        </div>

        {/* At a glance */}
        <aside className="flex flex-col gap-3">
          <div className="card p-4 lg:sticky lg:top-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">At a glance</div>
            <div className="mt-3 flex flex-col gap-2.5 text-[13px]">
              <div className="flex items-center gap-2 text-navy"><Icon name="clock" size={14} className="text-muted" /> {minutesLabel(s.durationMin)} · {s.kind === "round_robin" ? "Round robin" : "One person"}</div>
              <div className="flex items-start gap-2 text-navy">
                <Icon name="users" size={14} className="mt-0.5 text-muted" />
                <div className="flex min-w-0 flex-col gap-1">
                  {people.length ? people.map((p) => <span key={p.name} className="truncate">{p.name} <span className="text-muted">· {p.place}</span></span>) : <span className="text-warn">Nobody added yet</span>}
                </div>
              </div>
              <div className="flex items-start gap-2 text-navy">
                <Icon name="calendar" size={14} className="mt-0.5 text-muted" />
                {check?.next.length ? <span>Next free: {check.next.slice(0, 3).join(", ")}</span> : <span className="text-bad">No open times yet</span>}
              </div>
            </div>
            <div className="mt-4 flex gap-2 border-t border-line pt-3">
              <button type="button" onClick={() => copy(link, "Link")} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-brand hover:bg-[#eaf2fc]"><Icon name="copy" size={13} /> Copy link</button>
              <button type="button" onClick={() => setTab("share")} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-muted hover:bg-surface hover:text-navy"><Icon name="code" size={13} /> Embed</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
