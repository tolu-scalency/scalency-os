"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { notify } from "@/components/toast";
import { LOCATIONS, minutesLabel, slugify, type CalendarSettings, type Question } from "@/lib/calendar/types";
import { archiveCalendar, saveCalendar } from "../../actions";
import { CopyLink } from "../copy-link";

type TeamMember = { id: string; name: string; on: boolean; priority: number; connected: string[] };

const field = "field h-10 w-full text-[13.5px]";
const label = "flex flex-col gap-1.5 text-[12.5px] font-semibold text-navy";
const hint = "text-[11.5px] font-normal text-muted";

function Section({ title, text, children, icon }: { title: string; text?: string; children: React.ReactNode; icon: React.ComponentProps<typeof Icon>["name"] }) {
  return (
    <section className="card p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eef6fd] text-brand"><Icon name={icon} size={17} /></span>
        <div>
          <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>
          {text && <p className="mt-0.5 text-[13px] text-muted">{text}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

const NOTICE = [
  [0, "No notice"],
  [60, "1 hour"],
  [240, "4 hours"],
  [720, "12 hours"],
  [1440, "24 hours"],
  [2880, "48 hours"],
  [4320, "3 days"],
] as const;

export function BookingPageEditor({ id, initial, base, team: teamIn, stages }: { id: string; initial: CalendarSettings; base: string; team: TeamMember[]; stages: { id: string; name: string }[] }) {
  const [s, setS] = useState(initial);
  const [team, setTeam] = useState(teamIn);
  const [pending, start] = useTransition();
  const router = useRouter();
  const [tagText, setTagText] = useState(initial.tags.join(", "));
  const set = (p: Partial<CalendarSettings>) => setS((x) => ({ ...x, ...p }));
  const num = (k: keyof CalendarSettings) => ({ value: String(s[k] ?? ""), onChange: (e: { target: { value: string } }) => set({ [k]: Number(e.target.value) } as Partial<CalendarSettings>) });
  const link = base + s.slug;
  const embed = `<iframe src="${link}?embed=1" style="width:100%;min-height:760px;border:0" title="${s.name}"></iframe>`;
  const onTeam = team.filter((m) => m.on);
  const needs = s.locationType === "google_meet" ? "google" : s.locationType === "teams" ? "microsoft" : null;
  const missing = needs ? onTeam.filter((m) => !m.connected.includes(needs)) : [];

  const save = () =>
    start(async () => {
      const r = await saveCalendar(
        id,
        { ...s, tags: tagText.split(",").map((t) => t.trim()).filter(Boolean) },
        team.filter((m) => m.on).map((m) => ({ userId: m.id, priority: m.priority })),
      );
      if (r.error) notify(r.error, "bad");
      else notify(r.ok ?? "Saved");
    });

  const setQ = (i: number, p: Partial<Question>) => set({ questions: s.questions.map((q, j) => (j === i ? { ...q, ...p } : q)) });

  return (
    <div className="flex flex-col gap-5">
      <div className="card relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full" style={{ background: `radial-gradient(circle, ${s.color}33, transparent 70%)` }} />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center rounded-full bg-chip px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-brand">Booking page</div>
            <input value={s.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} aria-label="Name" className="w-full bg-transparent text-[26px] font-semibold tracking-[-0.03em] outline-none" />
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted">
              <span className="truncate">{base}</span>
              <input value={s.slug} onChange={(e) => set({ slug: slugify(e.target.value) })} aria-label="Link name" className="field h-8 w-48 font-mono text-[12.5px]" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={s.status} onChange={(e) => set({ status: e.target.value as "active" })} className="field h-10 w-auto text-[13px]" aria-label="Status">
              <option value="active">Taking bookings</option>
              <option value="paused">Paused</option>
            </select>
            <CopyLink link={link} />
            <a href={link} target="_blank" rel="noreferrer" className="btn-ghost inline-flex h-10 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold"><Icon name="eye" size={14} /> Preview</a>
            <button type="button" disabled={pending} onClick={save} className="btn-primary inline-flex h-10 items-center gap-1.5 rounded-xl px-5 text-[13.5px] font-semibold"><Icon name="check" size={14} /> Save</button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5">
          <Section title="The call" text="What people see on the booking page." icon="calendar">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className={label}>
                Length
                <select value={s.durationMin} onChange={(e) => set({ durationMin: Number(e.target.value) })} className={field}>
                  {[10, 15, 20, 30, 45, 60, 75, 90, 120].map((m) => <option key={m} value={m}>{minutesLabel(m)}</option>)}
                </select>
              </label>
              <label className={label}>
                Start times every
                <select value={s.slotStepMin} onChange={(e) => set({ slotStepMin: Number(e.target.value) })} className={field}>
                  {[10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{minutesLabel(m)}</option>)}
                </select>
              </label>
              <label className={label}>
                Colour
                <input type="color" value={s.color} onChange={(e) => set({ color: e.target.value })} className="field h-10 w-full cursor-pointer p-1" />
              </label>
              <label className={`${label} sm:col-span-3`}>
                Description
                <textarea value={s.description} onChange={(e) => set({ description: e.target.value })} rows={3} maxLength={1000} placeholder="What the call is for and what you'll cover." className="field w-full py-2.5 text-[13.5px] font-normal" />
              </label>
            </div>
          </Section>

          <Section title="Where it happens" icon="video">
            <div className="grid gap-2 sm:grid-cols-3">
              {LOCATIONS.map((l) => (
                <button key={l.id} type="button" onClick={() => set({ locationType: l.id })} className={`rounded-xl border p-3 text-left transition ${s.locationType === l.id ? "border-brand bg-[#eef6fd] shadow-[0_0_0_3px_rgba(4,101,199,0.12)]" : "border-line hover:border-brand/40"}`}>
                  <div className="text-[13.5px] font-semibold">{l.label}</div>
                  <div className="mt-0.5 text-[11.5px] leading-snug text-muted">{l.hint}</div>
                </button>
              ))}
            </div>
            {(s.locationType === "in_person" || s.locationType === "link") && (
              <label className={`${label} mt-4`}>
                {s.locationType === "link" ? "Meeting link" : "Address"}
                <input value={s.locationValue} onChange={(e) => set({ locationValue: e.target.value })} maxLength={300} placeholder={s.locationType === "link" ? "https://zoom.us/j/…" : "128 City Road, London"} className={field} />
              </label>
            )}
            {missing.length > 0 && (
              <p className="mt-3 rounded-xl bg-[#fff8e6] px-3 py-2 text-[12.5px] text-[#8a5a00]">
                {missing.map((m) => m.name).join(", ")} {missing.length === 1 ? "hasn't" : "haven't"} connected {needs === "google" ? "Google Calendar" : "Outlook"} yet, so their bookings won&apos;t get a {needs === "google" ? "Meet" : "Teams"} link. They can connect it in Calendar, Connections.
              </p>
            )}
          </Section>

          <Section title="Who takes these bookings" text="Bookings go into each person's own calendar, with a meeting link." icon="users">
            <div className="mb-4 inline-flex rounded-[11px] border border-line bg-surface p-[3px]">
              {(["one", "round_robin"] as const).map((k) => (
                <button key={k} type="button" onClick={() => set({ kind: k })} className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold ${s.kind === k ? "bg-white text-navy shadow-sm" : "text-muted"}`}>
                  {k === "one" ? "One person" : "Round robin"}
                </button>
              ))}
            </div>
            <p className="mb-3 text-[12.5px] text-muted">
              {s.kind === "one" ? "Every booking goes to the first person ticked." : "Each booking goes to whoever is free and was booked least recently. Higher priority wins a tie."}
            </p>
            <div className="divide-y divide-line rounded-xl border border-line">
              {team.map((m, i) => (
                <div key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <label className="flex min-w-0 flex-1 items-center gap-3">
                    <input type="checkbox" checked={m.on} onChange={(e) => setTeam(team.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} className="h-4 w-4 accent-[#0465C7]" />
                    <span className="truncate text-[14px] font-medium">{m.name}</span>
                  </label>
                  <div className="flex gap-1">
                    {m.connected.map((c) => (
                      <span key={c} className="rounded-md bg-surface px-1.5 py-0.5 text-[10.5px] font-semibold uppercase text-muted">{c === "microsoft" ? "Outlook" : c}</span>
                    ))}
                  </div>
                  {s.kind === "round_robin" && m.on && (
                    <select value={m.priority} onChange={(e) => setTeam(team.map((x, j) => (j === i ? { ...x, priority: Number(e.target.value) } : x)))} className="field h-8 w-auto text-[12px]" aria-label="Priority">
                      {[1, 2, 3, 4, 5].map((p) => <option key={p} value={p}>Priority {p}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </Section>

          <Section title="When people can book" text="Working hours come from each person's Availability. These rules sit on top." icon="clock">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className={label}>
                Minimum notice
                <select value={s.minNoticeMin} onChange={(e) => set({ minNoticeMin: Number(e.target.value) })} className={field}>
                  {NOTICE.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
                </select>
              </label>
              <label className={label}>
                Book up to (days ahead)
                <input type="number" min={1} max={365} {...num("maxDaysAhead")} className={field} />
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
          </Section>

          <Section title="Questions" text="Name, email and mobile are always asked. Add anything else you need before the call." icon="form">
            <div className="flex flex-col gap-3">
              {s.questions.map((q, i) => (
                <div key={q.id} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[minmax(0,1fr)_150px_auto_auto]">
                  <input value={q.label} onChange={(e) => setQ(i, { label: e.target.value })} maxLength={160} placeholder="e.g. What's your monthly revenue?" className={field} aria-label="Question" />
                  <select value={q.type} onChange={(e) => setQ(i, { type: e.target.value as Question["type"], options: e.target.value === "select" && !q.options.length ? ["Option 1", "Option 2"] : q.options })} className={field} aria-label="Answer type">
                    <option value="text">Short answer</option>
                    <option value="textarea">Long answer</option>
                    <option value="select">Choose one</option>
                  </select>
                  <label className="flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={q.required} onChange={(e) => setQ(i, { required: e.target.checked })} className="h-4 w-4 accent-[#0465C7]" /> Required</label>
                  <button type="button" onClick={() => set({ questions: s.questions.filter((_, j) => j !== i) })} aria-label="Remove question" className="inline-grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-[#fff1f1] hover:text-bad"><Icon name="trash" size={15} /></button>
                  {q.type === "select" && (
                    <input value={q.options.join(", ")} onChange={(e) => setQ(i, { options: e.target.value.split(",").map((o) => o.trim()) })} placeholder="Options, separated by commas" className={`${field} sm:col-span-4`} aria-label="Options" />
                  )}
                </div>
              ))}
              {s.questions.length < 12 && (
                <button type="button" onClick={() => set({ questions: [...s.questions, { id: Math.random().toString(36).slice(2, 10), label: "", type: "text", required: false, options: [] }] })} className="btn-ghost inline-flex h-10 w-fit items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold">
                  <Icon name="plus" size={14} /> Add a question
                </button>
              )}
            </div>
          </Section>

          <Section title="After someone books" text="The contact is created or updated and your “Appointment booked” workflows start." icon="zap">
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
              <label className="flex items-center gap-2.5 text-[13.5px]"><input type="checkbox" checked={s.confirmEmail} onChange={(e) => set({ confirmEmail: e.target.checked })} className="h-4 w-4 accent-[#0465C7]" /> Email them a confirmation</label>
              <label className="flex items-center gap-2.5 text-[13.5px]"><input type="checkbox" checked={s.notifyTeam} onChange={(e) => set({ notifyTeam: e.target.checked })} className="h-4 w-4 accent-[#0465C7]" /> Post it in team chat</label>
              <label className={`${label} sm:col-span-2`}>
                Thank-you message
                <textarea value={s.thankYou} onChange={(e) => set({ thankYou: e.target.value })} rows={2} maxLength={1000} placeholder="You're booked. We've sent the details to your email." className="field w-full py-2.5 text-[13.5px] font-normal" />
              </label>
              <label className={`${label} sm:col-span-2`}>
                Or send them to a page
                <input value={s.redirectUrl} onChange={(e) => set({ redirectUrl: e.target.value.trim() })} placeholder="https://scalency.us/ai-growth/booked" className={field} />
                <span className={hint}>For example your own thank-you page. Leave blank to show the message above.</span>
              </label>
            </div>
          </Section>
        </div>

        <aside className="flex flex-col gap-5">
          <div className="card sticky top-6 overflow-hidden p-0">
            <div className="border-b border-line px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">Share it</div>
            <div className="flex flex-col gap-4 p-5">
              <div>
                <div className="mb-1.5 text-[12.5px] font-semibold">Link</div>
                <div className="break-all rounded-xl bg-surface px-3 py-2 font-mono text-[12px]">{link}</div>
              </div>
              <div>
                <div className="mb-1.5 text-[12.5px] font-semibold">Embed on a website</div>
                <textarea readOnly value={embed} rows={4} className="field w-full py-2 font-mono text-[11.5px]" onFocus={(e) => e.currentTarget.select()} />
                <div className="mt-2"><CopyLink link={embed} label="Copy embed code" /></div>
              </div>
              <div className="rounded-xl bg-[linear-gradient(135deg,#eef6fd,#f5fdff)] p-4 text-[12.5px] leading-relaxed text-muted">
                <div className="mb-1 font-semibold text-navy">What happens on a booking</div>
                Contact created or updated · tags added · deal moved · event in their calendar with a {s.locationType === "teams" ? "Teams" : "Meet"} link · confirmation email · team alert · your workflows start.
              </div>
              <button type="button" onClick={() => start(async () => { const r = await archiveCalendar(id); if (r.error) notify(r.error, "bad"); else { notify("Archived"); router.push("/calendar/booking-pages"); } })} className="inline-flex h-9 w-fit items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold text-bad hover:bg-[#fff1f1]">
                <Icon name="trash" size={14} /> Archive this booking page
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
