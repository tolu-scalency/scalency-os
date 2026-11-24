"use client";

// Setting up an AI setter: the clinic's details, when it may message and follow up,
// the GHL connection (key, calendar, pipeline, webhooks), a test chat that uses a
// pretend calendar and sends nothing, and the conversations it has had.

import { ask } from "@/components/confirm";
import { TimeSelect } from "@/components/time-select";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
import { notify } from "@/components/toast";
import { Pill } from "@/components/ui";
import { createClient } from "@/lib/supabase/browser";
import { BUSINESS_TYPES, DAY_NAMES, THREAD_LOOK, TIMEZONES, businessTypeOf, type SetterBusiness, type SetterRules, type SetterStatus, type ThreadState } from "@/lib/setter";
import { deleteSetter, newWebhookAddresses, saveGhlChoices, saveSetter, setSetterStatus, setThread } from "../actions";

export type ThreadView = {
  id: string;
  contactId: string;
  name: string;
  state: ThreadState;
  channel: string;
  touches: number;
  nextAt: string | null;
  nextIsOpener: boolean;
  contacted: boolean;
  origin: "lead" | "reply" | "reactivation";
  appointmentAt: string | null;
  note: string | null;
  updatedAt: string;
  turns: { role: "lead" | "ai" | "event"; body: string; at: string }[];
};

type Ghl = { locationId: string; locationName: string; calendarId: string; calendarName: string; pipelineId: string; stages: Record<string, string>; checkedAt: string | null; error: string | null };
type Setter = { id: string; name: string; status: SetterStatus; business: SetterBusiness; rules: SetterRules; ghl: Ghl };
type Tab = "clinic" | "rules" | "ghl" | "test" | "reactivate" | "conversations";
type Options = { calendars: { id: string; name: string }[]; pipelines: { id: string; name: string; stages: { id: string; name: string }[] }[] };

const field = "field h-10 w-full text-[13.5px]";
const area = "field w-full py-2.5 text-[13.5px] leading-relaxed";
const label = "flex flex-col gap-1.5 text-[12.5px] font-semibold text-navy";
const hint = "text-[11.5px] font-normal text-muted";

async function callSetter(body: Record<string, unknown>) {
  const { data, error } = await createClient().functions.invoke("ai-setter", { body });
  if (error) {
    let msg = "We couldn't reach the AI setter. Check it's deployed in Supabase (Edge Functions, ai-setter).";
    try {
      const ctx = (error as { context?: Response }).context;
      const j = ctx ? await ctx.json() : null;
      if (j?.error) msg = j.error;
    } catch {}
    return { error: msg } as Record<string, unknown> & { error: string };
  }
  return data as Record<string, unknown>;
}

const NO_STATS = { queued: 0, messaged: 0, replied: 0, booked: 0 };

export function SetterEditor({
  setter,
  threads,
  canEdit,
  reactivation = NO_STATS,
}: {
  setter: Setter;
  threads: ThreadView[];
  accountId: string;
  canEdit: boolean;
  reactivation?: { queued: number; messaged: number; replied: number; booked: number };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(setter.ghl.checkedAt ? "test" : "clinic");
  const [name, setName] = useState(setter.name);
  const [b, setB] = useState<SetterBusiness>(setter.business);
  const [r, setR] = useState<SetterRules>(setter.rules);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const ro = !canEdit;

  const setBiz = (patch: Partial<SetterBusiness>) => {
    setB((x) => ({ ...x, ...patch }));
    setDirty(true);
  };
  const setRules = (patch: Partial<SetterRules>) => {
    setR((x) => ({ ...x, ...patch }));
    setDirty(true);
  };
  const save = () =>
    start(async () => {
      const res = await saveSetter(setter.id, { name, business: b, rules: r }).catch(() => ({ error: "We couldn't reach the server." }) as { error?: string; ok?: string });
      notify(res.error ?? "Saved", res.error ? "bad" : "ok");
      if (!res.error) setDirty(false);
    });
  const setStatus = (s: SetterStatus) =>
    start(async () => {
      if (dirty) {
        const res = await saveSetter(setter.id, { name, business: b, rules: r });
        if (res.error) return void notify(res.error, "bad");
        setDirty(false);
      }
      const res = await setSetterStatus(setter.id, s).catch(() => ({ error: "We couldn't reach the server." }) as { error?: string; ok?: string });
      notify(res.error ?? res.ok ?? "Done", res.error ? "bad" : "ok");
      if (!res.error) router.refresh();
    });

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const tabs: [Tab, string, string][] = [
    ["clinic", "Business", "building"],
    ["rules", "Hours and follow-up", "clock"],
    ["ghl", "Connect GHL", "link"],
    ["test", "Test chat", "mail"],
    ["reactivate", "Reactivation", "refresh"],
    ["conversations", `Conversations ${threads.length ? `(${threads.length})` : ""}`, "inbox"],
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5 px-4 py-5 sm:px-7 sm:py-7">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/agents" className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-white" aria-label="Back to AI setters">
          <Icon name="arrowLeft" size={17} />
        </Link>
        <input
          value={name}
          disabled={ro}
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
          }}
          maxLength={120}
          aria-label="Name"
          className="min-w-0 flex-[1_1_220px] rounded-lg bg-transparent px-2 py-1 text-[22px] font-semibold tracking-[-0.02em] outline-none hover:bg-white focus:bg-white focus:ring-2 focus:ring-sky/40"
        />
        <div className="flex rounded-xl bg-white p-1 ring-1 ring-line" role="radiogroup" aria-label="Status">
          {(["off", "test", "live"] as SetterStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={setter.status === s}
              disabled={ro || pending}
              onClick={() => s !== setter.status && setStatus(s)}
              className={`min-h-9 rounded-lg px-3 text-[13px] font-semibold ${setter.status === s ? (s === "live" ? "bg-ok text-white" : s === "test" ? "bg-warn text-white" : "bg-navy text-white") : "text-muted hover:text-navy"}`}
            >
              {s === "off" ? "Off" : s === "test" ? "Test mode" : "Live"}
            </button>
          ))}
        </div>
        {canEdit && (
          <button type="button" disabled={pending || !dirty} onClick={save} className="btn-primary inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-50">
            <Icon name="check" size={14} /> {dirty ? "Save" : "Saved"}
          </button>
        )}
      </div>
      {setter.status === "test" && (
        <p className="rounded-xl bg-warn-bg px-4 py-2.5 text-[13px] text-warn">
          Test mode: the AI only talks to contacts tagged <strong>ai-test</strong> in GHL. Add that tag to yourself, then text the business&apos;s number or send yourself in as a new lead.
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 border-b border-line pb-3">
        {tabs.map(([k, l, icon]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold ${tab === k ? "bg-navy text-white" : "text-muted hover:bg-white hover:text-navy"}`}>
            <Icon name={icon as IconName} size={14} /> {l}
          </button>
        ))}
      </div>

      {tab === "clinic" && <ClinicTab b={b} set={setBiz} ro={ro} />}
      {tab === "rules" && <RulesTab r={r} set={setRules} ro={ro} />}
      {tab === "ghl" && <GhlTab setter={setter} ro={ro} />}
      {tab === "test" && <TestTab setterId={setter.id} b={b} r={r} />}
      {tab === "reactivate" && <ReactivateTab setterId={setter.id} b={b} set={setBiz} ro={ro} connected={Boolean(setter.ghl.locationId)} live={setter.status !== "off"} stats={reactivation} />}
      {tab === "conversations" && <ConversationsTab threads={threads} ro={ro} timezone={b.timezone} />}

      {canEdit && tab === "clinic" && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={async () => (await ask({ title: "Delete this AI setter?", text: "Its conversation history goes too, and it stops straight away. This can't be undone." })) && start(() => deleteSetter(setter.id))}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-bad"
          >
            <Icon name="trash" size={14} /> Delete this AI setter
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- clinic

function Section({ title, text, children }: { title: string; text?: string; children: React.ReactNode }) {
  return (
    <section className="card flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {text && <p className="text-[12.5px] text-muted">{text}</p>}
      </div>
      {children}
    </section>
  );
}

function ClinicTab({ b, set, ro }: { b: SetterBusiness; set: (p: Partial<SetterBusiness>) => void; ro: boolean }) {
  const t = (k: keyof SetterBusiness) => ({ value: String(b[k] ?? ""), disabled: ro, onChange: (e: { target: { value: string } }) => set({ [k]: e.target.value } as Partial<SetterBusiness>) });
  const kind = businessTypeOf(b);
  const fillExample = () =>
    void ask({
      title: `Fill in the ${kind.label.toLowerCase()} example?`,
      text: "This replaces the business name, first step, services, offer, proof and tone with example wording you can edit. Your assistant's name, location, time zone and instructions stay as they are.",
      confirm: "Fill in example",
      danger: false,
    }).then((ok) => ok && set({ ...kind.example }));
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl bg-chip px-4 py-3 text-[13px] text-brand">
        The AI only states facts from here. Anything missing, it says it&apos;ll check with the team. Start with the example for your kind of business, then change it to the real details.
      </p>
      <Section title="Kind of business" text="This sets how the AI talks, the questions it expects and its safety rules. Works for any business, not just clinics.">
        <div className="flex flex-wrap items-end gap-3">
          <label className={`${label} min-w-[240px] flex-1`}>
            Business type
            <select value={b.businessType} disabled={ro} onChange={(e) => set({ businessType: e.target.value as SetterBusiness["businessType"] })} className={field}>
              {BUSINESS_TYPES.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          {!ro && (
            <button type="button" onClick={fillExample} className="btn-ghost inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold">
              <Icon name="spark" size={14} /> Fill in example details
            </button>
          )}
        </div>
      </Section>
      <Section title="Who's messaging" text="The AI introduces itself by this name as the business's coordinator. It never claims to be a person.">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={label}>
            Assistant&apos;s name
            <input {...t("assistantName")} maxLength={40} className={field} />
          </label>
          <label className={label}>
            Business name
            <input {...t("clinicName")} maxLength={120} className={field} />
          </label>
          <label className={label}>
            Spelling
            <select value={b.spelling} disabled={ro} onChange={(e) => set({ spelling: e.target.value === "UK" ? "UK" : "US" })} className={field}>
              <option value="US">US</option>
              <option value="UK">UK</option>
            </select>
          </label>
        </div>
      </Section>
      <Section title="Where and when">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>
            Location
            <input {...t("location")} maxLength={200} placeholder="London" className={field} />
          </label>
          <label className={label}>
            Time zone
            <select value={b.timezone} disabled={ro} onChange={(e) => set({ timezone: e.target.value })} className={field}>
              {[...new Set([b.timezone, ...TIMEZONES])].map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Phone
            <input {...t("phone")} maxLength={40} className={field} />
          </label>
          <label className={label}>
            Website
            <input {...t("website")} maxLength={200} className={field} />
          </label>
        </div>
      </Section>
      <Section title="The first step it books" text="A consultation, discovery call, quote visit, valuation or trial. The AI books this; it doesn't sell the service itself.">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={label}>
            Called
            <input {...t("consultName")} maxLength={80} placeholder="free consultation" className={field} />
          </label>
          <label className={label}>
            How long
            <input {...t("consultLength")} maxLength={40} className={field} />
          </label>
          <label className={label}>
            Price
            <input {...t("consultPrice")} maxLength={120} className={field} />
          </label>
        </div>
        <label className={label}>
          Booking link (optional)
          <input {...t("bookingLink")} maxLength={500} placeholder="https://" className={field} />
          <span className={hint}>Your GHL or other booking page. Choose below when the AI sends it.</span>
        </label>
        <fieldset className="flex flex-col gap-2" disabled={ro}>
          <legend className="mb-1.5 text-[12.5px] font-semibold text-navy">How the AI gets them booked</legend>
          {(
            [
              ["times", "Offer 2 times and book it", "The AI checks the GHL calendar, offers two times and books the one they pick. The link is only sent if they ask."],
              ["link", "Send the booking link", "They pick a time themselves. If they'd rather, the AI can still offer times."],
              ["both", "Offer 2 times and the link", "Two times, plus the link in case neither suits."],
            ] as const
          ).map(([v, title, text]) => (
            <label key={v} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-[13.5px] ${b.bookingMode === v ? "border-brand bg-chip" : "border-line"}`}>
              <input type="radio" name="booking-mode" checked={b.bookingMode === v} onChange={() => set({ bookingMode: v })} className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]" />
              <span>
                <span className="font-semibold">{title}</span>
                <span className="block text-[12px] text-muted">{text}</span>
              </span>
            </label>
          ))}
          {b.bookingMode !== "times" && !b.bookingLink && <span className="text-[12px] font-medium text-warn">Add the booking link above, or the AI will offer times instead.</span>}
        </fieldset>
      </Section>
      <Section title="Services, prices and offer">
        <label className={label}>
          Services and starting prices
          <textarea {...t("services")} rows={7} className={area} />
          <span className={hint}>One per line. The AI gives these starting prices and says the {kind.expert} confirms the exact price.</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>
            Current offer
            <textarea {...t("offer")} rows={3} className={area} />
          </label>
          <label className={label}>
            Offer for old leads coming back (optional)
            <textarea {...t("reactivationOffer")} rows={2} placeholder="20% off your first treatment if you book this month" className={area} />
            <span className={hint}>Used by Reactivation. Blank: it uses the current offer.</span>
          </label>
          <label className={label}>
            Payment options
            <textarea {...t("financing")} rows={3} className={area} />
          </label>
        </div>
      </Section>
      <Section title="Trust and rules">
        <label className={label}>
          Who does the work
          <textarea {...t("whoTreats")} rows={2} className={area} />
        </label>
        <label className={label}>
          Policies (deposits, cancellations, age, offer rules)
          <textarea {...t("policies")} rows={4} className={area} />
        </label>
        <label className={label}>
          Proof: results and reviews the AI may mention
          <textarea {...t("proof")} rows={3} className={area} />
          <span className={hint}>Only real ones. The AI uses these in its &quot;proof&quot; follow-up.</span>
        </label>
        <label className={label}>
          Other answers (parking, hours, anything people ask)
          <textarea {...t("faqs")} rows={3} className={area} />
        </label>
        <label className={label}>
          Tone notes
          <textarea {...t("tone")} rows={2} className={area} />
        </label>
      </Section>
      <Section title="Example replies (your scripts)" text="Paste a few real replies or your setter scripts. The AI copies the tone, length and style, never word for word, and only states facts from the details above.">
        <label className={label}>
          Scripts and example replies
          <textarea
            {...t("scripts")}
            rows={8}
            maxLength={6000}
            placeholder={"Lead: How much is Botox?\nUs: Great question! Botox is £9 a unit and most people need 20 to 40. Is it your forehead or around the eyes you'd like to soften?\n\nLead: I'm a bit nervous\nUs: Totally normal, most of our clients said the same! It's a quick pinch and you're in and out in 20 minutes."}
            className={area}
          />
        </label>
      </Section>
      <Section title="Your instructions" text="Anything else the AI should always or never do, in plain words. It follows these on top of its standard rules (its safety rules always come first).">
        <label className={label}>
          Instructions
          <textarea
            {...t("instructions")}
            rows={6}
            maxLength={3000}
            placeholder={"Always ask what area they live in before offering times.\nNever offer appointments on Saturdays.\nIf they mention a wedding, ask the date."}
            className={area}
          />
          <span className={hint}>One rule per line works best. Try them straight away in the Test chat.</span>
        </label>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------- rules

/** Tags typed as "a, b, c". Kept as text while typing, so commas and spaces aren't eaten. */
function TagListInput({ value, onChange, disabled, placeholder }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean; placeholder?: string }) {
  const [text, setText] = useState(value.join(", "));
  return (
    <input
      value={text}
      disabled={disabled}
      placeholder={placeholder}
      maxLength={600}
      onChange={(e) => {
        setText(e.target.value);
        onChange([...new Set(e.target.value.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20));
      }}
      className={field}
    />
  );
}

function RulesTab({ r, set, ro }: { r: SetterRules; set: (p: Partial<SetterRules>) => void; ro: boolean }) {
  const [days, setDays] = useState(r.followUpDays.join(", "));
  return (
    <div className="flex flex-col gap-4">
      <Section title="When it may message first" text="Follow-ups and reactivation wait for these hours. Replies to people who message in always go out straight away.">
        <label className="flex items-start gap-2 rounded-xl bg-chip px-3 py-2.5 text-[13.5px]">
          <input type="checkbox" checked={r.instantFirstMessage} disabled={ro} onChange={(e) => set({ instantFirstMessage: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]" />
          <span>
            <span className="font-semibold">Message new leads straight away, any time (recommended)</span>
            <span className="block text-[12px] text-muted">Speed to lead: someone who fills in a form at 10pm hears back in a minute, not tomorrow morning. Untick to make new leads wait for the hours below too.</span>
          </span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>
            From
            <TimeSelect value={r.start} disabled={ro} onChange={(v) => set({ start: v })} className={field} />
          </label>
          <label className={label}>
            Until
            <TimeSelect value={r.end} disabled={ro} onChange={(v) => set({ end: v })} className={field} />
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days">
          {DAY_NAMES.map((d, i) => {
            const on = r.days.includes(i);
            return (
              <button
                key={d}
                type="button"
                disabled={ro}
                aria-pressed={on}
                onClick={() => set({ days: on ? r.days.filter((x) => x !== i) : [...r.days, i].sort() })}
                className={`min-h-9 min-w-12 rounded-xl px-3 text-[13px] font-semibold ring-1 ${on ? "bg-navy text-white ring-navy" : "bg-white text-muted ring-line"}`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </Section>
      <Section title="Follow-up when they go quiet" text="From the setter SOP: every few days, a different style each time, value first. It stops the moment they reply, book or say no.">
        <label className={label}>
          Days after the last message
          <input
            value={days}
            disabled={ro}
            onChange={(e) => {
              setDays(e.target.value);
              set({ followUpDays: e.target.value.split(/[\s,]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 60) });
            }}
            className={field}
          />
          <span className={hint}>
            {r.followUpDays.length} follow-ups: value text, proof, straight talk, &quot;we&apos;re all busy&quot;, value text, then a last friendly check-in.
          </span>
        </label>
        <label className="flex items-start gap-2 text-[13.5px]">
          <input type="checkbox" checked={r.teamTasks} disabled={ro} onChange={(e) => set({ teamTasks: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]" />
          <span>
            Create tasks in GHL for what a person does
            <span className="block text-[12px] text-muted">Call twice when a lead comes in, Instagram DM on day 1, selfie video on day 3, &quot;we&apos;re all busy&quot; video on day 8.</span>
          </span>
        </label>
      </Section>
      <Section title="When the AI joins" text="Which conversations the AI takes part in. Your 3 GHL workflows decide what it hears about; these decide what it does with it.">
        <label className="flex items-start gap-2 text-[13.5px]">
          <input type="checkbox" checked={r.joinNewLeads} disabled={ro} onChange={(e) => set({ joinNewLeads: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]" />
          <span>
            Message new leads first
            <span className="block text-[12px] text-muted">When the &quot;new lead&quot; workflow fires, the AI sends the first message within your hours.</span>
          </span>
        </label>
        <label className={label}>
          Who it answers when they message in
          <select value={r.joinReplies} disabled={ro} onChange={(e) => set({ joinReplies: e.target.value === "own" ? "own" : "all" })} className={field}>
            <option value="all">Anyone who messages the business</option>
            <option value="own">Only people the AI has already messaged</option>
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>
            Only contacts with these tags (optional)
            <TagListInput value={r.onlyTags} disabled={ro} onChange={(v) => set({ onlyTags: v })} placeholder="new lead, facebook" />
            <span className={hint}>Leave empty for everyone. Separate tags with commas.</span>
          </label>
          <label className={label}>
            Never contacts with these tags
            <TagListInput value={r.skipTags} disabled={ro} onChange={(v) => set({ skipTags: v })} placeholder="customer, do not contact" />
            <span className={hint}>For example existing customers, or people your team is handling.</span>
          </label>
        </div>
        <label className={label}>
          If a team member replies, the AI steps back
          <select value={String(r.teamPauseHours)} disabled={ro} onChange={(e) => set({ teamPauseHours: Number(e.target.value) })} className={field}>
            <option value="0">Until someone hands the lead back</option>
            <option value="4">For 4 hours</option>
            <option value="24">For 1 day</option>
            <option value="72">For 3 days</option>
            <option value="168">For a week</option>
          </select>
          <span className={hint}>After that, if the lead messages again and nobody from the team has replied, the AI answers.</span>
        </label>
      </Section>
      <Section title="Contacts">
        <label className="flex items-start gap-2 text-[13.5px]">
          <input type="checkbox" checked={r.syncContacts} disabled={ro} onChange={(e) => set({ syncContacts: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]" />
          <span>
            Copy each new GHL lead into Scalency&apos;s contacts
            <span className="block text-[12px] text-muted">One way only. Copied contacts aren&apos;t messaged by Scalency and don&apos;t start Scalency workflows.</span>
          </span>
        </label>
      </Section>
      <Section title="Booking and replies">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>
            Minimum notice (hours)
            <input type="number" min={0} max={72} value={r.minNoticeHours} disabled={ro} onChange={(e) => set({ minNoticeHours: Number(e.target.value) })} className={field} />
          </label>
          <label className={label}>
            Wait before replying (seconds)
            <input type="number" min={10} max={60} value={r.replyDelaySeconds} disabled={ro} onChange={(e) => set({ replyDelaySeconds: Number(e.target.value) })} className={field} />
            <span className={hint}>So several texts in a row get one answer, and it doesn&apos;t feel instant and robotic.</span>
          </label>
        </div>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------- GHL

const SCOPES = [
  "View and edit contacts (contacts.readonly, contacts.write)",
  "View and edit conversations (conversations.readonly, conversations.write)",
  "View and send messages (conversations/message.readonly, conversations/message.write)",
  "View calendars (calendars.readonly)",
  "View and edit calendar events (calendars/events.readonly, calendars/events.write)",
  "View and edit opportunities (opportunities.readonly, opportunities.write)",
  "View locations (locations.readonly)",
];

function CopyBox({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-1 rounded-xl bg-surface py-1 pl-3 pr-1">
      <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-navy">{text}</code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
          } catch {
            window.prompt("Copy this:", text);
          }
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }}
        className="inline-flex h-8 flex-none items-center gap-1 rounded-lg px-2.5 text-[12px] font-semibold text-brand hover:bg-white"
      >
        <Icon name={done ? "check" : "copy"} size={13} /> {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function GhlTab({ setter, ro }: { setter: Setter; ro: boolean }) {
  const router = useRouter();
  const g = setter.ghl;
  const [location, setLocation] = useState(g.locationId);
  const [token, setToken] = useState("");
  const [opts, setOpts] = useState<Options | null>(null);
  const [cal, setCal] = useState(g.calendarId);
  const [pipe, setPipe] = useState(g.pipelineId);
  const [stages, setStages] = useState<Record<string, string>>(g.stages);
  const [hooks, setHooks] = useState<Record<string, string> | null>(null);
  const [pending, start] = useTransition();
  const connected = Boolean(g.checkedAt && !g.error);

  const connect = (withToken: boolean) =>
    start(async () => {
      const res = await callSetter({ action: "connect", agent_id: setter.id, location_id: location.trim(), ...(withToken ? { token: token.trim() } : {}) });
      if ("error" in res && res.error) return void notify(String(res.error), "bad");
      setToken("");
      setOpts({ calendars: (res.calendars as Options["calendars"]) ?? [], pipelines: (res.pipelines as Options["pipelines"]) ?? [] });
      notify(`Connected to ${(res.location as { name?: string })?.name || "GHL"}`, "ok");
      router.refresh();
    });
  useEffect(() => {
    // Load the calendar and pipeline lists once, if it's already connected.
    if (connected && !opts && !ro) connect(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pipeline = opts?.pipelines.find((p) => p.id === pipe);
  const saveChoices = () =>
    start(async () => {
      const res = await saveGhlChoices(setter.id, { calendarId: cal, calendarName: opts?.calendars.find((c) => c.id === cal)?.name ?? g.calendarName, pipelineId: pipe, stages });
      notify(res.error ?? "Saved", res.error ? "bad" : "ok");
    });
  const showHooks = () =>
    start(async () => {
      const res = await callSetter({ action: "webhooks", agent_id: setter.id });
      if ("error" in res && res.error) return void notify(String(res.error), "bad");
      setHooks(res as Record<string, string>);
    });
  const renewHooks = () =>
    void ask({
      title: "Make new webhook addresses?",
      text: "The current addresses stop working straight away. Until you paste the new ones into your 3 GHL workflows, the AI won't hear about new leads, replies or bookings.",
      confirm: "Make new addresses",
    }).then(
      (ok) =>
        ok &&
        start(async () => {
          const r = await newWebhookAddresses(setter.id);
          if (r.error) return void notify(r.error, "bad");
          const res = await callSetter({ action: "webhooks", agent_id: setter.id });
          if (!("error" in res && res.error)) setHooks(res as Record<string, string>);
          notify(r.ok ?? "Done", "ok");
        }),
    );

  return (
    <div className="flex flex-col gap-4">
      <Section title="1. Connect the GHL sub-account" text="The AI uses this sub-account's calendar, phone number and inbox.">
        <ol className="list-decimal space-y-1 pl-5 text-[13px] text-navy">
          <li>
            In the sub-account, open <strong>Settings</strong>, then <strong>Private Integrations</strong>, then <strong>Create new integration</strong>. Name it &quot;Scalency AI setter&quot;.
          </li>
          <li>Tick these permissions, then create it and copy the key (it starts with pit-):</li>
        </ol>
        <ul className="grid gap-1 pl-5 text-[12.5px] text-muted sm:grid-cols-2">
          {SCOPES.map((s) => (
            <li key={s} className="flex items-start gap-1.5">
              <Icon name="check" size={13} /> {s}
            </li>
          ))}
        </ul>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>
            Location ID
            <input value={location} disabled={ro} onChange={(e) => setLocation(e.target.value)} placeholder="From Settings, Business Profile" className={`${field} font-mono`} />
            <span className={hint}>Also in the address bar: app.gohighlevel.com/v2/location/<strong>this part</strong>/...</span>
          </label>
          <label className={label}>
            Private Integration key
            <input
              type="password"
              autoComplete="off"
              value={token}
              disabled={ro}
              onChange={(e) => setToken(e.target.value)}
              placeholder={connected ? "Saved. Paste a new one to replace it" : "pit-..."}
              className={`${field} font-mono`}
            />
            <span className={hint}>Stored encrypted. Nobody can read it back, including you.</span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!ro && (
            <button type="button" disabled={pending || !location.trim() || (!token.trim() && !connected)} onClick={() => connect(Boolean(token.trim()))} className="btn-primary inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-50">
              <Icon name="link" size={14} /> {pending ? "Checking…" : connected && !token ? "Check again" : "Connect"}
            </button>
          )}
          {connected ? <Pill tone="green">Connected{g.locationName ? `: ${g.locationName}` : ""}</Pill> : g.error ? <Pill tone="red">Not connected</Pill> : <Pill tone="neutral">Not connected yet</Pill>}
        </div>
        {g.error && <p className="rounded-xl bg-bad-bg px-3 py-2 text-[12.5px] text-bad">{g.error}</p>}
      </Section>

      <Section title="2. Calendar and pipeline" text="The calendar the AI books into, and where it moves the deal.">
        {!opts ? (
          <p className="text-[13px] text-muted">{connected ? "Loading your calendars and pipelines…" : "Connect first to choose these."}</p>
        ) : (
          <>
            <label className={label}>
              Calendar to book into
              <select value={cal} disabled={ro} onChange={(e) => setCal(e.target.value)} className={field}>
                <option value="">Choose a calendar</option>
                {opts.calendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span className={hint}>The AI only offers this calendar&apos;s free times, so set its availability, length and notice in GHL.</span>
            </label>
            <label className={label}>
              Pipeline (optional)
              <select value={pipe} disabled={ro} onChange={(e) => setPipe(e.target.value)} className={field}>
                <option value="">Don&apos;t move deals</option>
                {opts.pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {pipeline && (
              <div className="grid gap-4 sm:grid-cols-3">
                {(
                  [
                    ["contacted", "After the first text"],
                    ["booked", "When it books"],
                    ["not_interested", "When they say no"],
                  ] as const
                ).map(([k, l]) => (
                  <label key={k} className={label}>
                    {l}
                    <select value={stages[k] ?? ""} disabled={ro} onChange={(e) => setStages({ ...stages, [k]: e.target.value })} className={field}>
                      <option value="">Don&apos;t move</option>
                      {pipeline.stages.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}
            {!ro && (
              <div>
                <button type="button" disabled={pending || !cal} onClick={saveChoices} className="btn-primary inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-50">
                  <Icon name="check" size={14} /> Save calendar and pipeline
                </button>
              </div>
            )}
          </>
        )}
      </Section>

      <Section title="3. Three small GHL workflows" text="They tell the AI when something happens. Each is a trigger and one Webhook action (POST) with the address below.">
        {!hooks ? (
          <div>
            <button type="button" disabled={pending} onClick={showHooks} className="btn-ghost inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold">
              <Icon name="eye" size={14} /> Show the webhook addresses
            </button>
            <p className={`${hint} mt-2`}>Keep them private: anyone with an address could trigger the AI for a contact in this sub-account.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {(
              [
                ["new_lead", "AI setter: new lead", "Trigger: Facebook Lead Form Submitted (or Form Submitted, or Contact Created). The AI sends the first text within a minute, or when you open."],
                ["inbound", "AI setter: lead replied", "Trigger: Customer Replied (all channels). The AI answers."],
                ["booked", "AI setter: booked", "Trigger: Customer Booked Appointment. Stops follow-ups if they booked another way."],
              ] as const
            ).map(([k, title, how]) => (
              <div key={k} className="flex flex-col gap-1.5">
                <div className="text-[13.5px] font-semibold">{title}</div>
                <p className="text-[12.5px] text-muted">{how}</p>
                <CopyBox text={hooks[k] ?? ""} />
              </div>
            ))}
            {!ro && (
              <div className="border-t border-line pt-3">
                <button type="button" disabled={pending} onClick={renewHooks} className="btn-ghost inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold">
                  <Icon name="refresh" size={14} /> New addresses
                </button>
                <p className={`${hint} mt-2`}>Use this if an address has been shared by mistake. The old ones stop working.</p>
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="4. Try it on yourself">
        <ol className="list-decimal space-y-1 pl-5 text-[13px] text-navy">
          <li>
            Switch the AI setter to <strong>Test mode</strong> (top right).
          </li>
          <li>
            In GHL, add the tag <strong>ai-test</strong> to a contact with your own phone number.
          </li>
          <li>Submit the lead form as yourself, or text the sub-account&apos;s number. The AI replies within a minute.</li>
          <li>
            When you&apos;re happy, switch to <strong>Live</strong>.
          </li>
        </ol>
      </Section>
      <GhlContactsImport setterId={setter.id} connected={connected} ro={ro} />
    </div>
  );
}

/** Copies every contact in the GHL sub-account into Scalency, 500 at a time, without duplicates. */
function GhlContactsImport({ setterId, connected, ro }: { setterId: string; connected: boolean; ro: boolean }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ added: number; linked: number; seen: number; total: number | null } | null>(null);
  const run = async () => {
    const ok = await ask({
      title: "Copy all GHL contacts into Scalency?",
      text: "Names, emails, phone numbers and tags are copied. Anyone already in Scalency with the same email or phone is linked, not duplicated, and nothing they have is overwritten. Copied contacts aren't emailed or texted by Scalency and don't start Scalency workflows: GHL stays in charge of them.",
      confirm: "Copy contacts",
      danger: false,
    });
    if (!ok) return;
    setBusy(true);
    const sum = { added: 0, linked: 0, seen: 0, total: null as number | null };
    let after: unknown = null;
    let page = 1;
    try {
      for (let round = 0; round < 60; round++) {
        const res = await callSetter({ action: "import_contacts", agent_id: setterId, after, page });
        if ("error" in res && res.error) {
          notify(String(res.error), "bad");
          break;
        }
        sum.added += Number(res.added) || 0;
        sum.linked += Number(res.linked) || 0;
        sum.seen += Number(res.seen) || 0;
        sum.total = (res.total as number | null) ?? sum.total;
        setProgress({ ...sum });
        if (res.done) {
          notify(`Done: ${sum.added} added, ${sum.linked} already in Scalency and linked.`, "ok");
          break;
        }
        after = res.after;
        page = (Number(res.page) || page) + 1;
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title="GHL contacts in Scalency" text="Keeps a copy of the sub-account's contacts in Scalency, so the business can move over to Scalency later with everything in place. It only copies from GHL into Scalency, never back.">
      <ul className="list-disc pl-5 text-[13px] text-muted">
        <li>New leads that reach the AI setter are copied in automatically (switch this off in Hours and follow-up).</li>
        <li>Use the button once to bring in everyone already in GHL. You can run it again any time: it won&apos;t make duplicates.</li>
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={ro || !connected || busy}
          onClick={() => void run()}
          className="btn-primary inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-50"
        >
          <Icon name="users" size={14} /> {busy ? "Copying…" : "Copy all GHL contacts into Scalency"}
        </button>
        {!connected && <span className={hint}>Connect GHL first.</span>}
        {progress && (
          <span className="text-[13px] text-muted" aria-live="polite">
            {progress.seen}
            {progress.total ? ` of ${progress.total}` : ""} checked · {progress.added} added · {progress.linked} linked
          </span>
        )}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------- reactivation

/** Lead reactivation: message old GHL leads (by tag) to bring them back, spread out over the hours. */
function ReactivateTab({
  setterId,
  b,
  set,
  ro,
  connected,
  live,
  stats,
}: {
  setterId: string;
  b: SetterBusiness;
  set: (p: Partial<SetterBusiness>) => void;
  ro: boolean;
  connected: boolean;
  live: boolean;
  stats: { queued: number; messaged: number; replied: number; booked: number };
}) {
  const [tag, setTag] = useState("");
  const [perHour, setPerHour] = useState(20);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ found: number; queued: number; skipped: { no_way_to_reach: number; already_in_a_conversation: number } } | null>(null);
  const run = async (action: "reactivate_preview" | "reactivate_start" | "reactivate_stop") => {
    setBusy(true);
    try {
      const res = await callSetter({ action, agent_id: setterId, tag, per_hour: perHour });
      if ("error" in res && res.error) return void notify(String(res.error), "bad");
      if (action === "reactivate_stop") return void notify(`Stopped. ${Number(res.stopped) || 0} leads won't be messaged.`, "ok");
      setPreview(res as never);
      if (action === "reactivate_start") notify(res.started ? `Started: ${res.queued} leads, about ${perHour} an hour within your hours.` : "Nobody to message with that tag.", res.started ? "ok" : "bad");
    } finally {
      setBusy(false);
    }
  };
  const start = () =>
    void ask({
      title: `Message ${preview?.queued ?? "these"} old leads?`,
      text: `Each gets one friendly message from ${b.assistantName || "the AI"}, then up to 2 follow-ups if they don't reply. About ${perHour} go out an hour, only within your hours. Anyone who replies gets answered and booked like a new lead. You can stop it any time.`,
      confirm: "Start reactivation",
      danger: false,
    }).then((ok) => ok && run("reactivate_start"));

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl bg-chip px-4 py-3 text-[13px] text-brand">
        Bring back leads who asked about the business but never booked. Tag them in GHL (for example <strong>reactivate-nov</strong>), then start here. Leads booked, stopped, with the team or messaged in the last 14 days are left alone.
      </p>
      <Section title="The offer" text="Give old leads a reason to come back now.">
        <label className={label}>
          Offer for old leads (optional)
          <textarea value={b.reactivationOffer} disabled={ro} onChange={(e) => set({ reactivationOffer: e.target.value })} rows={2} placeholder="20% off your first treatment if you book this month" className={area} />
          <span className={hint}>Blank: it uses the current offer. Click Save at the top after changing it.</span>
        </label>
      </Section>
      <Section title="Who to message">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>
            GHL tag
            <input
              value={tag}
              disabled={ro}
              onChange={(e) => {
                setTag(e.target.value);
                setPreview(null);
              }}
              placeholder="reactivate-nov"
              maxLength={60}
              className={field}
            />
          </label>
          <label className={label}>
            How many an hour
            <select value={perHour} disabled={ro} onChange={(e) => setPerHour(Number(e.target.value))} className={field}>
              {[10, 20, 30, 50].map((n) => (
                <option key={n} value={n}>
                  {n} an hour
                </option>
              ))}
            </select>
            <span className={hint}>Slower is safer for your number and easier for the team to keep up with replies.</span>
          </label>
        </div>
        {!connected && <p className="text-[12.5px] font-medium text-warn">Connect GHL first.</p>}
        {!live && <p className="text-[12.5px] font-medium text-warn">Switch the AI setter to Test mode or Live first. In Test mode only contacts tagged ai-test are messaged.</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={ro || busy || !tag.trim() || !connected} onClick={() => void run("reactivate_preview")} className="btn-ghost inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-50">
            <Icon name="search" size={14} /> {busy && !preview ? "Checking…" : "Check who it would message"}
          </button>
          <button type="button" disabled={ro || busy || !preview?.queued || !live} onClick={start} className="btn-primary inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-50">
            <Icon name="send" size={14} /> Start reactivation
          </button>
        </div>
        {preview && (
          <p className="text-[13px] text-muted" aria-live="polite">
            <strong className="text-navy">{preview.queued}</strong> to message out of {preview.found} with that tag
            {preview.skipped.already_in_a_conversation ? ` · ${preview.skipped.already_in_a_conversation} left alone (booked, with the team or recent)` : ""}
            {preview.skipped.no_way_to_reach ? ` · ${preview.skipped.no_way_to_reach} with no phone or email, or Do Not Disturb on` : ""}
          </p>
        )}
      </Section>
      <Section title="How it's going">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["Waiting to send", stats.queued],
              ["Messaged", stats.messaged],
              ["Replied", stats.replied],
              ["Booked", stats.booked],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-surface p-3">
              <div className="text-[22px] font-bold tracking-tight">{v}</div>
              <div className="text-[12px] text-muted">{k}</div>
            </div>
          ))}
        </div>
        {stats.queued > 0 && !ro && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void ask({ title: "Stop reactivation?", text: `The ${stats.queued} leads still waiting won't be messaged. Conversations already started carry on.`, confirm: "Stop" }).then((ok) => ok && run("reactivate_stop"))}
            className="btn-ghost inline-flex min-h-9 items-center gap-1.5 self-start rounded-xl px-3 text-[13px] font-semibold text-bad"
          >
            <Icon name="x" size={13} /> Stop sending to the rest
          </button>
        )}
        <span className={hint}>Numbers update when you reload the page. Every conversation is in Conversations and the Inbox.</span>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------- test chat

type ChatTurn = { who: "lead" | "ai" | "event"; text: string; at: string };

function TestTab({ setterId, b, r }: { setterId: string; b: SetterBusiness; r: SetterRules }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [text, setText] = useState("");
  const [first, setFirst] = useState("Jess");
  const [form, setForm] = useState("Treatment: Botox/Fillers. Had it before: No, first time. When: within 2 weeks. Best time: evening.");
  const [touch, setTouch] = useState(0);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns, pending]);

  const ask = (mode: "opener" | "reply" | "followup", history: ChatTurn[]) =>
    start(async () => {
      const res = await callSetter({
        action: "test",
        agent_id: setterId,
        mode,
        touch,
        first_name: first,
        lead_details: `Form answers: ${form}`,
        business: b,
        rules: r,
        turns: history.filter((t) => t.who !== "event").map((t) => ({ who: t.who, text: t.text, at: t.at })),
      });
      if ("error" in res && res.error) return void notify(String(res.error), "bad");
      const now = new Date().toISOString();
      const add: ChatTurn[] = [];
      // The test chat books into a pretend calendar: say so, so nobody thinks it's real.
      for (const e of (res.events as string[]) ?? []) add.push({ who: "event", text: /^booked/i.test(e) ? `Test booking only (pretend calendar, nothing was booked): ${e.replace(/^booked:?\s*/i, "")}` : e, at: now });
      if (res.message) add.push({ who: "ai", text: String(res.message), at: now });
      else add.push({ who: "event", text: "Nothing sent.", at: now });
      setTurns([...history, ...add]);
      if (mode === "followup") setTouch((x) => x + 1);
    });
  // Like the real thing: it waits before answering, so several messages in a row get one reply.
  const delay = Math.min(60, Math.max(10, r.replyDelaySeconds || 20));
  const [waitLeft, setWaitLeft] = useState(0);
  const waiting = useRef<{ timer: ReturnType<typeof setInterval> | null; history: ChatTurn[] }>({ timer: null, history: [] });
  useEffect(() => () => {
    if (waiting.current.timer) clearInterval(waiting.current.timer);
  }, []);
  const answerNow = () => {
    if (waiting.current.timer) clearInterval(waiting.current.timer);
    waiting.current.timer = null;
    setWaitLeft(0);
    ask("reply", waiting.current.history);
  };
  const send = () => {
    const t = text.trim();
    if (!t || pending) return;
    const history = [...turns, { who: "lead" as const, text: t, at: new Date().toISOString() }];
    setTurns(history);
    setText("");
    waiting.current.history = history;
    if (waiting.current.timer) clearInterval(waiting.current.timer);
    setWaitLeft(delay);
    let left = delay;
    waiting.current.timer = setInterval(() => {
      left -= 1;
      setWaitLeft(left);
      if (left <= 0) answerNow();
    }, 1000);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <section className="card flex min-h-[520px] flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Icon name="mail" size={16} />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">Test chat</div>
            <div className="text-[12px] text-muted">You&apos;re the lead. Bookings here go into a pretend calendar and nothing is sent. Unsaved changes are used too.</div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (waiting.current.timer) clearInterval(waiting.current.timer);
              waiting.current.timer = null;
              setWaitLeft(0);
              setTurns([]);
              setTouch(0);
            }}
            className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold"
          >
            <Icon name="refresh" size={13} /> Start again
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto bg-surface/60 p-4">
          {!turns.length && (
            <div className="m-auto max-w-sm text-center text-[13px] text-muted">
              Click <strong>New lead comes in</strong> to see the first text, then reply as the lead. Try price questions, &quot;does it hurt?&quot;, a medical question, &quot;are you a bot?&quot;, booking a time, or &quot;not interested&quot;.
            </div>
          )}
          {turns.map((t, i) =>
            t.who === "event" ? (
              <div key={i} className="self-center rounded-full bg-white px-3 py-1 text-[11.5px] font-semibold text-muted ring-1 ring-line">
                {t.text}
              </div>
            ) : (
              <div key={i} className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${t.who === "ai" ? "self-start bg-white text-navy ring-1 ring-line" : "self-end bg-brand text-white"}`}>
                {t.text}
              </div>
            ),
          )}
          {waitLeft > 0 && !pending && (
            <div className="flex items-center gap-2 self-start rounded-2xl bg-white px-3.5 py-2 text-[12.5px] text-muted ring-1 ring-line">
              Replies in {waitLeft}s, like it will for real (your reply wait).
              <button type="button" onClick={answerNow} className="font-semibold text-brand hover:underline">
                Answer now
              </button>
            </div>
          )}
          {pending && <div className="self-start rounded-2xl bg-white px-3.5 py-2.5 text-[13px] text-muted ring-1 ring-line">{b.assistantName || "The AI"} is typing…</div>}
          <div ref={end} />
        </div>
        <form
          className="flex gap-2 border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply as the lead…" className="field h-11 min-w-0 flex-1 text-[14px]" disabled={pending} />
          <button type="submit" disabled={pending || !text.trim()} className="btn-primary inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-[13.5px] font-semibold disabled:opacity-50">
            <Icon name="send" size={14} /> Send
          </button>
        </form>
      </section>
      <aside className="flex flex-col gap-3">
        <div className="card flex flex-col gap-3 p-4">
          <div className="text-[13.5px] font-semibold">The lead</div>
          <label className={label}>
            First name
            <input value={first} onChange={(e) => setFirst(e.target.value)} maxLength={40} className={field} />
          </label>
          <label className={label}>
            Their form answers
            <textarea value={form} onChange={(e) => setForm(e.target.value)} rows={4} className={area} />
          </label>
          <button type="button" disabled={pending} onClick={() => ask("opener", [])} className="btn-primary inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold">
            <Icon name="zap" size={14} /> New lead comes in
          </button>
        </div>
        <div className="card flex flex-col gap-2 p-4">
          <div className="text-[13.5px] font-semibold">They go quiet</div>
          <p className="text-[12px] text-muted">See follow-up {touch + 1} of {r.followUpDays.length || 6}, as it would go out on day {r.followUpDays[touch] ?? "?"}.</p>
          <button type="button" disabled={pending || !turns.length || touch >= (r.followUpDays.length || 6)} onClick={() => ask("followup", turns)} className="btn-ghost inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-50">
            <Icon name="clock" size={14} /> Send follow-up {touch + 1}
          </button>
        </div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------- conversations

function ConversationsTab({ threads, ro, timezone }: { threads: ThreadView[]; ro: boolean; timezone: string }) {
  const [open, setOpen] = useState<string | null>(threads[0]?.id ?? null);
  const [pending, start] = useTransition();
  const fmt = useMemo(() => {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
    return (iso: string) => f.format(new Date(iso));
  }, [timezone]);
  const counts = threads.reduce<Record<string, number>>((m, t) => ((m[t.state] = (m[t.state] ?? 0) + 1), m), {});
  if (!threads.length)
    return (
      <div className="card p-10 text-center text-[14px] text-muted">
        No conversations yet. Once the GHL workflows are set up and the AI setter is in Test mode or Live, every lead it works shows here.
      </div>
    );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(THREAD_LOOK) as ThreadState[])
          .filter((s) => counts[s])
          .map((s) => (
            <Pill key={s} tone={THREAD_LOOK[s].tone}>
              {THREAD_LOOK[s].label}: {counts[s]}
            </Pill>
          ))}
      </div>
      <div className="card divide-y divide-line overflow-hidden">
        {threads.map((t) => {
          const look = THREAD_LOOK[t.state];
          const isOpen = open === t.id;
          return (
            <div key={t.id}>
              <button type="button" onClick={() => setOpen(isOpen ? null : t.id)} className="flex w-full flex-wrap items-center gap-3 px-5 py-3.5 text-left hover:bg-surface">
                <div className="min-w-0 flex-[1_1_200px]">
                  <div className="truncate text-[14.5px] font-semibold">{t.name}</div>
                  <div className="truncate text-[12px] text-muted">
                    {t.origin === "reactivation" ? "Reactivation · " : t.origin === "reply" ? "Messaged in · " : ""}
                    {t.channel} · {t.touches} follow-up{t.touches === 1 ? "" : "s"} · updated {fmt(t.updatedAt)}
                    {t.appointmentAt ? ` · consult ${fmt(t.appointmentAt)}` : ""}
                    {t.state === "active" && t.nextAt ? ` · ${t.nextIsOpener ? "first message" : "next follow-up"} ${fmt(t.nextAt)}` : ""}
                    {t.state === "active" && !t.contacted && !t.nextAt ? " · first message not sent" : ""}
                  </div>
                </div>
                <Pill tone={look.tone}>{look.label}</Pill>
                <Icon name={isOpen ? "up" : "down"} size={15} />
              </button>
              {isOpen && (
                <div className="flex flex-col gap-2 bg-surface/60 px-5 py-4">
                  {t.turns.map((x, i) =>
                    x.role === "event" ? (
                      <div key={i} className="self-center rounded-full bg-white px-3 py-1 text-[11.5px] font-semibold text-muted ring-1 ring-line">
                        {x.body} · {fmt(x.at)}
                      </div>
                    ) : (
                      <div key={i} className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[13.5px] ${x.role === "ai" ? "self-start bg-white ring-1 ring-line" : "self-end bg-brand text-white"}`}>
                        {x.body}
                        <div className={`mt-1 text-[10.5px] ${x.role === "ai" ? "text-faint" : "text-white/70"}`}>{fmt(x.at)}</div>
                      </div>
                    ),
                  )}
                  {t.note && <p className="text-[12px] text-muted">Note: {t.note}</p>}
                  {!ro && (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {(t.state === "paused" || t.state === "handed_over" || t.state === "finished") && (
                        <button type="button" disabled={pending} onClick={() => start(async () => void notifyResult(await setThread(t.id, "active")))} className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold">
                          <Icon name="refresh" size={13} /> Hand back to the AI
                        </button>
                      )}
                      {t.state === "active" && !t.contacted && (
                        <button type="button" disabled={pending} onClick={() => start(async () => void notifyResult(await setThread(t.id, "opener")))} className="btn-primary inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold">
                          <Icon name="send" size={13} /> Send first message now
                        </button>
                      )}
                      {t.state === "active" && (
                        <button type="button" disabled={pending} onClick={() => start(async () => void notifyResult(await setThread(t.id, "stopped")))} className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold text-bad">
                          <Icon name="x" size={13} /> Stop the AI for this lead
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function notifyResult(r: { error?: string; ok?: string }) {
  notify(r.error ?? r.ok ?? "Done", r.error ? "bad" : "ok");
}
