"use client";

// The AI setter's growth tabs: the Knowledge bank (with website scan), the follow-up Journey,
// Reviews and rebooking (with missed-call text-back, revenue and the guarantee), and Voice AI.

import { useState, useTransition } from "react";
import { ask } from "@/components/confirm";
import { Icon, type IconName } from "@/components/icon";
import { notify } from "@/components/toast";
import { callSetter } from "@/lib/call-setter";
import { JOURNEY_ACTIONS, type JourneyAction, type JourneyStep, type RebookItem, type SetterBusiness, type SetterRules } from "@/lib/setter";
import { addKnowledge, deleteKnowledge, updateKnowledge } from "../actions";

export type KnowledgeItem = { id: string; question: string; answer: string; source: string; approved: boolean };

const field = "field h-10 w-full text-[13.5px]";
const area = "field w-full py-2.5 text-[13.5px] leading-relaxed";
const label = "flex flex-col gap-1.5 text-[12.5px] font-semibold text-navy";
const hint = "text-[11.5px] font-normal text-muted";

function Block({ eyebrow, title, text, children, aside }: { eyebrow?: string; title: string; text?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="card flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-[640px]">
          {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
          <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>
          {text && <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{text}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Toggle({ on, onChange, disabled, title, text }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; title: string; text?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-surface p-3.5">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={`relative mt-0.5 h-6 w-11 flex-none rounded-full transition-colors ${on ? "bg-brand" : "bg-line-strong"} disabled:opacity-50`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
      <span className="text-[13.5px]">
        <span className="font-semibold text-navy">{title}</span>
        {text && <span className="block text-[12.5px] text-muted">{text}</span>}
      </span>
    </label>
  );
}

// ---------------------------------------------------------------- Knowledge

type Scan = { pages: string[]; business: Partial<SetterBusiness>; knowledge: { question: string; answer: string }[] };
const SCAN_FIELDS: [keyof SetterBusiness, string][] = [
  ["clinicName", "Business name"],
  ["location", "Where"],
  ["phone", "Phone"],
  ["services", "Services and prices"],
  ["offer", "Current offer"],
  ["consultName", "First appointment"],
  ["consultPrice", "First appointment price"],
  ["whoTreats", "Who does the work"],
  ["policies", "Policies"],
  ["financing", "Payment options"],
  ["proof", "Proof"],
];

/** "Q: … A: …" pairs pasted from a document. */
export function parseQa(text: string) {
  const out: { question: string; answer: string }[] = [];
  let q = "";
  let a = "";
  const push = () => {
    if (q.trim() && a.trim()) out.push({ question: q.trim(), answer: a.trim() });
    q = "";
    a = "";
  };
  let into: "q" | "a" | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const qm = line.match(/^(q|question)\s*[:.)-]\s*(.*)$/i);
    const am = line.match(/^(a|answer)\s*[:.)-]\s*(.*)$/i);
    if (qm) {
      push();
      q = qm[2];
      into = "q";
    } else if (am) {
      a = am[2];
      into = "a";
    } else if (line && into === "q") q += ` ${line}`;
    else if (line && into === "a") a += ` ${line}`;
  }
  push();
  return out.slice(0, 50);
}

export function KnowledgeTab({ setterId, items, b, setBiz, ro }: { setterId: string; items: KnowledgeItem[]; b: SetterBusiness; setBiz: (p: Partial<SetterBusiness>) => void; ro: boolean }) {
  const [url, setUrl] = useState(b.website);
  const [scan, setScan] = useState<Scan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [pick, setPick] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [paste, setPaste] = useState("");
  const [pending, start] = useTransition();
  const waiting = items.filter((k) => !k.approved);
  const approved = items.filter((k) => k.approved);

  const runScan = async () => {
    setScanning(true);
    const res = await callSetter({ agent_id: setterId, action: "scan_website", url });
    setScanning(false);
    if ("error" in res && res.error) return void notify(String(res.error), "bad");
    const s = res as unknown as Scan;
    setScan(s);
    // Tick the fields that are empty now, so nothing typed in is replaced unless chosen.
    setPick(Object.fromEntries(SCAN_FIELDS.filter(([k]) => s.business[k]).map(([k]) => [k, !String(b[k] ?? "").trim()])));
  };
  const useScan = () =>
    start(async () => {
      if (!scan) return;
      const patch: Partial<SetterBusiness> = { website: url };
      for (const [k] of SCAN_FIELDS) if (pick[k] && scan.business[k]) (patch as Record<string, unknown>)[k] = scan.business[k];
      setBiz(patch);
      if (scan.knowledge.length) {
        const r = await addKnowledge(setterId, scan.knowledge, "website");
        if (r.error) return void notify(r.error, "bad");
      }
      notify(`Filled in ${Object.keys(patch).length - 1} details. Check the answers below, then click Save at the top.`, "ok");
      setScan(null);
    });

  return (
    <div className="flex flex-col gap-4">
      <Block eyebrow="Step 1" title="Scan the clinic's website" text="Paste the website address. The AI reads the home page and the treatment, price, FAQ and about pages, then suggests the business details and answers. You check everything before the AI uses it.">
        <div className="flex flex-wrap gap-2">
          <input value={url} disabled={ro} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.yourclinic.co.uk" className={`${field} min-w-0 flex-[1_1_280px]`} />
          <button type="button" disabled={ro || scanning || !url.trim()} onClick={runScan} className="btn-primary inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-50">
            <Icon name="globe" size={14} /> {scanning ? "Reading the site…" : "Scan website"}
          </button>
        </div>
        {scanning && <p className="text-[12.5px] text-muted">This takes up to a minute.</p>}
        {scan && (
          <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
            <div className="text-[12.5px] text-muted">
              Read {scan.pages.length} page{scan.pages.length === 1 ? "" : "s"}. Tick what to use: ticked details replace what&apos;s in the Business tab.
            </div>
            {SCAN_FIELDS.filter(([k]) => scan.business[k]).map(([k, l]) => (
              <label key={k} className="flex items-start gap-3 rounded-xl bg-white p-3 ring-1 ring-line">
                <input type="checkbox" checked={Boolean(pick[k])} onChange={(e) => setPick((p) => ({ ...p, [k]: e.target.checked }))} className="mt-1 h-4 w-4 accent-[var(--color-brand)]" />
                <span className="min-w-0 text-[13px]">
                  <span className="font-semibold text-navy">{l}</span>
                  <span className="block whitespace-pre-line text-muted">{String(scan.business[k])}</span>
                </span>
              </label>
            ))}
            {scan.knowledge.length > 0 && <div className="text-[12.5px] text-muted">Plus {scan.knowledge.length} questions and answers, added below for you to check.</div>}
            <div className="flex gap-2">
              <button type="button" disabled={pending} onClick={useScan} className="btn-primary inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold">
                <Icon name="check" size={14} /> Use these
              </button>
              <button type="button" onClick={() => setScan(null)} className="btn-ghost min-h-10 rounded-xl px-4 text-[13px] font-semibold">
                Discard
              </button>
            </div>
          </div>
        )}
      </Block>

      {waiting.length > 0 && (
        <Block eyebrow="Step 2" title={`Check ${waiting.length} suggested answer${waiting.length === 1 ? "" : "s"}`} text="The AI only uses answers once someone approves them. Edit anything that isn't quite right.">
          <div className="flex flex-col gap-2.5">
            {waiting.map((k) => (
              <QaRow key={k.id} item={k} ro={ro} />
            ))}
          </div>
          {!ro && (
            <button type="button" disabled={pending} onClick={() => start(async () => void (await Promise.all(waiting.map((k) => updateKnowledge(k.id, { approved: true })))))} className="btn-ghost inline-flex min-h-10 w-fit items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold">
              <Icon name="checkCircle" size={14} /> Approve all {waiting.length}
            </button>
          )}
        </Block>
      )}

      <Block
        eyebrow="Knowledge bank"
        title="Approved answers"
        text="The AI uses these word for word when a lead asks. Keep them short and true: prices, aftercare, downtime, who treats, parking, deposits."
        aside={<span className="rounded-full bg-chip px-3 py-1 font-mono text-[12px] font-semibold text-brand">{approved.length} live</span>}
      >
        {approved.length === 0 ? (
          <p className="rounded-2xl bg-surface p-4 text-[13px] text-muted">No approved answers yet. Scan the website or add one below.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {approved.map((k) => (
              <QaRow key={k.id} item={k} ro={ro} />
            ))}
          </div>
        )}
        {!ro && (
          <div className="grid gap-3 rounded-2xl bg-surface p-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
            <label className={label}>
              Question
              <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={300} placeholder="Is there any downtime after lip filler?" className={field} />
            </label>
            <label className={label}>
              Answer
              <input value={a} onChange={(e) => setA(e.target.value)} maxLength={1500} placeholder="Some swelling for 1 to 2 days is normal; most people go back to work the next day." className={field} />
            </label>
            <button
              type="button"
              disabled={pending || !q.trim() || !a.trim()}
              onClick={() =>
                start(async () => {
                  const r = await addKnowledge(setterId, [{ question: q, answer: a }], "manual");
                  notify(r.error ?? r.ok ?? "Added", r.error ? "bad" : "ok");
                  if (!r.error) {
                    setQ("");
                    setA("");
                  }
                })
              }
              className="btn-primary inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-50"
            >
              <Icon name="plus" size={14} /> Add
            </button>
          </div>
        )}
      </Block>

      {!ro && (
        <Block eyebrow="From a document" title="Paste questions and answers" text={'Copy from a price list, aftercare sheet or FAQ document. Write each pair as "Q: …" and "A: …". They\'re added for you to check.'}>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={5} placeholder={"Q: How long does lip filler last?\nA: Usually 6 to 12 months.\nQ: Do you take deposits?\nA: Yes, £50, which comes off the treatment price."} className={area} />
          <button
            type="button"
            disabled={pending || !parseQa(paste).length}
            onClick={() =>
              start(async () => {
                const r = await addKnowledge(setterId, parseQa(paste), "document");
                notify(r.error ?? r.ok ?? "Added", r.error ? "bad" : "ok");
                if (!r.error) setPaste("");
              })
            }
            className="btn-ghost inline-flex min-h-10 w-fit items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-50"
          >
            <Icon name="upload" size={14} /> Add {parseQa(paste).length || ""} {parseQa(paste).length === 1 ? "answer" : "answers"}
          </button>
        </Block>
      )}
    </div>
  );
}

function QaRow({ item, ro }: { item: KnowledgeItem; ro: boolean }) {
  const [edit, setEdit] = useState(false);
  const [q, setQ] = useState(item.question);
  const [a, setA] = useState(item.answer);
  const [pending, start] = useTransition();
  const save = (patch: Parameters<typeof updateKnowledge>[1]) =>
    start(async () => {
      const r = await updateKnowledge(item.id, patch);
      if (r.error) notify(r.error, "bad");
      else setEdit(false);
    });
  return (
    <div className={`rounded-2xl bg-white p-3.5 ring-1 ${item.approved ? "ring-line" : "ring-warn/40"}`}>
      {edit ? (
        <div className="flex flex-col gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={300} className={field} />
          <textarea value={a} onChange={(e) => setA(e.target.value)} rows={3} maxLength={1500} className={area} />
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={() => save({ question: q, answer: a })} className="btn-primary min-h-9 rounded-xl px-3 text-[12.5px] font-semibold">
              Save
            </button>
            <button type="button" onClick={() => setEdit(false)} className="btn-ghost min-h-9 rounded-xl px-3 text-[12.5px] font-semibold">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold text-navy">{item.question}</div>
            <div className="mt-0.5 text-[13px] leading-relaxed text-muted">{item.answer}</div>
            <div className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">{item.source === "website" ? "From the website" : item.source === "document" ? "From a document" : "Typed in"}</div>
          </div>
          {!ro && (
            <div className="flex flex-none items-center gap-1">
              {!item.approved && (
                <button type="button" disabled={pending} onClick={() => save({ approved: true })} className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-ok-bg px-2.5 text-[12px] font-semibold text-ok">
                  <Icon name="check" size={13} /> Approve
                </button>
              )}
              <button type="button" onClick={() => setEdit(true)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-navy" aria-label="Edit">
                <Icon name="edit" size={14} />
              </button>
              <button
                type="button"
                onClick={async () => (await ask({ title: "Delete this answer?", text: "The AI stops using it straight away." })) && start(async () => void (await deleteKnowledge(item.id)))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-bad-bg hover:text-bad"
                aria-label="Delete"
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Journey

const PRESETS: { name: string; text: string; steps: JourneyStep[] }[] = [
  {
    name: "Tolu's spec",
    text: "5 min, 30 min, 4 hours, next morning, then days 2, 3, 5, 7, 10, 14, 21.",
    steps: [
      { day: 0, minutes: 5, action: "message" },
      { day: 0, minutes: 30, action: "message" },
      { day: 0, minutes: 240, action: "message" },
      { day: 1, action: "message" },
      { day: 2, action: "message" },
      { day: 3, action: "call_task" },
      { day: 5, action: "message" },
      { day: 7, action: "setter" },
      { day: 10, action: "email" },
      { day: 14, action: "message" },
      { day: 21, action: "message" },
    ],
  },
  { name: "AI only", text: "Six AI messages over 16 days.", steps: [1, 3, 5, 8, 12, 16].map((day) => ({ day, action: "message" as JourneyAction })) },
  {
    name: "Speed to lead",
    text: "AI first, a call task on day 1, a setter on day 3, then AI.",
    steps: [
      { day: 1, action: "call_task" },
      { day: 1, action: "message" },
      { day: 3, action: "setter" },
      { day: 5, action: "message" },
      { day: 8, action: "email" },
      { day: 12, action: "message" },
    ],
  },
  {
    name: "Gentle",
    text: "Fewer, spaced-out messages for high-value treatments.",
    steps: [
      { day: 2, action: "message" },
      { day: 6, action: "email" },
      { day: 14, action: "message" },
    ],
  },
];
const ACTION_ICON: Record<JourneyAction, IconName> = { message: "spark", sms: "phone", email: "mail", whatsapp: "inbox", call_task: "phone", setter: "users", ai_call: "mic" };
const MINUTES = [5, 15, 30, 60, 120, 240, 480];
const when = (s: JourneyStep) => (s.day === 0 ? ((s.minutes ?? 5) < 60 ? `${s.minutes ?? 5} min` : `${(s.minutes ?? 60) / 60} h`) : `Day ${s.day}`);

export function JourneyTab({ r, set, ro }: { r: SetterRules; set: (p: Partial<SetterRules>) => void; ro: boolean }) {
  const steps: JourneyStep[] = r.journey.length ? r.journey : r.followUpDays.map((day) => ({ day, action: "message" as JourneyAction }));
  const put = (next: JourneyStep[]) => {
    const sorted = [...next]
      .filter((s) => (s.day === 0 && (s.minutes ?? 0) > 0) || (s.day > 0 && s.day <= 60))
      .sort((a, b) => a.day - b.day || (a.minutes ?? 0) - (b.minutes ?? 0))
      .slice(0, 20);
    const days = [...new Set(sorted.filter((s) => s.day > 0).map((s) => s.day))];
    set({ journey: sorted, followUpDays: days.length ? days : [1] });
  };
  return (
    <div className="flex flex-col gap-4">
      <Block eyebrow="Journey" title="What happens until they book" text="The AI messages every new lead straight away. If they go quiet, these steps run in order (within your hours), and stop the moment they reply or book.">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.name} type="button" disabled={ro} onClick={() => put(p.steps)} className="rounded-2xl bg-surface px-3.5 py-2.5 text-left ring-1 ring-line hover:ring-sky disabled:opacity-50">
              <div className="text-[13px] font-semibold text-navy">{p.name}</div>
              <div className="text-[11.5px] text-muted">{p.text}</div>
            </button>
          ))}
        </div>
        <ol className="flex flex-col gap-0">
          <li className="flex items-center gap-3 pb-3">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--gradient)] font-mono text-[12px] font-semibold text-white" style={{ background: "var(--gradient)" }}>
              0
            </span>
            <div className="flex-1 rounded-2xl bg-chip px-4 py-3">
              <div className="text-[13.5px] font-semibold text-navy">Lead comes in</div>
              <div className="text-[12px] text-muted">AI first message within a minute{r.teamTasks ? ", and a task for the team to call twice" : ""}.</div>
            </div>
          </li>
          {steps.map((s, i) => (
            <li key={i} className="relative flex items-center gap-3 pb-3">
              <span className="absolute left-[17px] top-[-12px] h-3 w-px bg-line-strong" />
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white font-mono text-[12px] font-semibold text-brand ring-1 ring-line-strong">{i + 1}</span>
              <div className="flex flex-1 flex-wrap items-center gap-2 rounded-2xl bg-white px-3 py-2.5 ring-1 ring-line">
                <select
                  value={s.day === 0 ? `m${s.minutes ?? 5}` : `d${s.day}`}
                  disabled={ro}
                  onChange={(e) => {
                    const v = e.target.value;
                    put(steps.map((x, j) => (j === i ? (v.startsWith("m") ? { day: 0, minutes: Number(v.slice(1)), action: x.action } : { day: Number(v.slice(1)), action: x.action }) : x)));
                  }}
                  className="field h-9 w-[150px] font-mono text-[13px]"
                  aria-label="When"
                >
                  {MINUTES.map((m) => (
                    <option key={m} value={`m${m}`}>
                      {when({ day: 0, minutes: m, action: "message" })} after
                    </option>
                  ))}
                  {Array.from({ length: 60 }, (_, d) => d + 1).map((d) => (
                    <option key={d} value={`d${d}`}>
                      Day {d}
                    </option>
                  ))}
                </select>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-brand">
                  <Icon name={ACTION_ICON[s.action]} size={14} />
                </span>
                <select value={s.action} disabled={ro} onChange={(e) => put(steps.map((x, j) => (j === i ? { ...x, action: e.target.value as JourneyAction } : x)))} className="field h-9 min-w-0 flex-[1_1_160px] text-[13px]">
                  {JOURNEY_ACTIONS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}: {a.hint}
                    </option>
                  ))}
                </select>
                {!ro && (
                  <button type="button" onClick={() => put(steps.filter((_, j) => j !== i))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-bad-bg hover:text-bad" aria-label="Remove step">
                    <Icon name="x" size={14} />
                  </button>
                )}
              </div>
            </li>
          ))}
          <li className="flex items-center gap-3">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-surface text-muted ring-1 ring-line">
              <Icon name="check" size={14} />
            </span>
            <div className="flex-1 text-[12.5px] text-muted">After the last step the conversation is marked &quot;No reply after follow-ups&quot;. Old leads can come back through Reactivation.</div>
          </li>
        </ol>
        {!ro && steps.length < 20 && (
          <button type="button" onClick={() => put([...steps, { day: Math.min(60, (steps.at(-1)?.day ?? 0) + 3), action: "message" }])} className="btn-ghost inline-flex min-h-10 w-fit items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold">
            <Icon name="plus" size={14} /> Add a step
          </button>
        )}
        <p className={hint}>AI steps change style each time (helpful detail, proof, an honest question, &quot;we&apos;re all busy&quot;, a last check-in). Click Save at the top when you&apos;re done.</p>
      </Block>
    </div>
  );
}

// ---------------------------------------------------------------- Reviews, rebooking, missed calls, revenue

const REBOOK_PRESETS: RebookItem[] = [
  { treatment: "Toxin treatment", days: 90 },
  { treatment: "Lip filler", days: 180 },
  { treatment: "Cheek filler", days: 270 },
  { treatment: "Skin booster", days: 30 },
  { treatment: "HydraFacial", days: 30 },
  { treatment: "Chemical peel", days: 28 },
];

export function RetentionTab({ r, set, b, setBiz, ro }: { r: SetterRules; set: (p: Partial<SetterRules>) => void; b: SetterBusiness; setBiz: (p: Partial<SetterBusiness>) => void; ro: boolean }) {
  const items = r.rebookItems;
  return (
    <div className="flex flex-col gap-4">
      <Block eyebrow="Never miss a lead" title="Missed-call text-back" text="If nobody answers a call, the AI texts them within a minute, any time of day. Needs the 'missed call' workflow from Connect GHL.">
        <Toggle on={r.missedCall} disabled={ro} onChange={(v) => set({ missedCall: v })} title="Text back missed calls" text="One short text: sorry we missed you, how can we help? Then it carries on like any conversation." />
      </Block>

      <Block eyebrow="Reputation" title="Review requests" text="After someone shows up for their appointment, the AI asks for a Google review. Needs the 'appointment status' workflow from Connect GHL.">
        <Toggle on={r.reviewOn} disabled={ro} onChange={(v) => set({ reviewOn: v })} title="Ask for a review after each visit" text="If they reply with a problem instead, the team is told." />
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <label className={label}>
            Google review link
            <input value={b.reviewLink} disabled={ro} onChange={(e) => setBiz({ reviewLink: e.target.value.trim() })} placeholder="https://g.page/r/…/review" className={field} />
            <span className={hint}>Google Business Profile: Ask for reviews, Copy link.</span>
          </label>
          <label className={label}>
            Send it
            <select value={r.reviewHours} disabled={ro} onChange={(e) => set({ reviewHours: Number(e.target.value) })} className={field}>
              {[1, 3, 6, 24, 48].map((h) => (
                <option key={h} value={h}>
                  {h < 24 ? `${h} hour${h === 1 ? "" : "s"} after` : `${h / 24} day${h === 24 ? "" : "s"} after`}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Block>

      <Block eyebrow="Retention" title="Rebooking reminders" text="When a client is due again, the AI messages them to book. Each treatment has its own timing; anything else uses the default.">
        <Toggle on={r.rebookOn} disabled={ro} onChange={(v) => set({ rebookOn: v })} title="Remind clients when they're due again" text="Starts a short conversation (up to 2 follow-ups). Booking goes into the GHL calendar as usual." />
        <div className="flex flex-col gap-2">
          {items.map((it, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-2xl bg-white px-3 py-2.5 ring-1 ring-line">
              <input value={it.treatment} disabled={ro} onChange={(e) => set({ rebookItems: items.map((x, j) => (j === i ? { ...x, treatment: e.target.value.slice(0, 60) } : x)) })} placeholder="Treatment" className="field h-9 min-w-0 flex-[1_1_200px] text-[13px]" />
              <span className="text-[12.5px] text-muted">due again after</span>
              <input type="number" min={7} max={730} value={it.days} disabled={ro} onChange={(e) => set({ rebookItems: items.map((x, j) => (j === i ? { ...x, days: Number(e.target.value) || 90 } : x)) })} className="field h-9 w-[80px] text-center font-mono text-[13px]" />
              <span className="text-[12.5px] text-muted">days</span>
              {!ro && (
                <button type="button" onClick={() => set({ rebookItems: items.filter((_, j) => j !== i) })} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-bad-bg hover:text-bad" aria-label="Remove">
                  <Icon name="x" size={14} />
                </button>
              )}
            </div>
          ))}
          {!ro && (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={items.length >= 20} onClick={() => set({ rebookItems: [...items, { treatment: "", days: 90 }] })} className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold">
                <Icon name="plus" size={13} /> Add a treatment
              </button>
              {items.length === 0 && (
                <button type="button" onClick={() => set({ rebookItems: REBOOK_PRESETS })} className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold">
                  <Icon name="spark" size={13} /> Use typical aesthetics timings
                </button>
              )}
            </div>
          )}
        </div>
        <label className={`${label} max-w-[260px]`}>
          Anything else is due after (days)
          <input type="number" min={7} max={730} value={r.rebookDays} disabled={ro} onChange={(e) => set({ rebookDays: Number(e.target.value) || 90 })} className={field} />
        </label>
        <p className={hint}>The treatment comes from the appointment status workflow (custom data treatment), or what the AI learnt in the conversation.</p>
      </Block>

      <Block eyebrow="Prove it" title="Revenue and guarantee" text="Used on Results and Revenue. GHL can send each appointment's value (custom data value); if it doesn't, this average is used.">
        <div className="grid gap-4 sm:grid-cols-4">
          <label className={label}>
            Average treatment value
            <input type="number" min={0} value={b.avgValue || ""} disabled={ro} onChange={(e) => setBiz({ avgValue: Number(e.target.value) || 0 })} placeholder="250" className={field} />
          </label>
          <label className={label}>
            Guarantee: bookings
            <input type="number" min={0} value={b.guaranteeTarget || ""} disabled={ro} onChange={(e) => setBiz({ guaranteeTarget: Number(e.target.value) || 0 })} placeholder="8" className={field} />
          </label>
          <label className={label}>
            Within (days)
            <input type="number" min={7} max={365} value={b.guaranteeDays} disabled={ro} onChange={(e) => setBiz({ guaranteeDays: Number(e.target.value) || 60 })} className={field} />
          </label>
          <label className={label}>
            Starting
            <input type="date" value={b.guaranteeStart} disabled={ro} onChange={(e) => setBiz({ guaranteeStart: e.target.value })} className={field} />
          </label>
        </div>
        <p className={hint}>For example &quot;8 extra consultations booked in 60 days&quot;. Leave bookings empty if there&apos;s no guarantee.</p>
      </Block>
    </div>
  );
}

// ---------------------------------------------------------------- Voice AI

export type CallItem = { id: string; direction: string; purpose: string | null; duration_seconds: number | null; summary: string | null; created_at: string; recording_url: string | null };

export function VoiceTab({ r, set, ro, setterId, calls = [] }: { r: SetterRules; set: (p: Partial<SetterRules>) => void; ro: boolean; setterId?: string; calls?: CallItem[] }) {
  const [status, setStatus] = useState<{ ready: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const check = async () => {
    if (!setterId) return;
    setChecking(true);
    const res = await callSetter({ agent_id: setterId, action: "voice_status" });
    setChecking(false);
    if ("error" in res && res.error) return void notify(String(res.error), "bad");
    setStatus({ ready: Boolean(res.ready) });
  };
  const modes: [SetterRules["voiceMode"], string, string][] = [
    ["off", "Off", "Calls ring the clinic as normal."],
    ["missed", "Missed calls only", "The AI answers when nobody picks up."],
    ["after_hours", "Out of hours", "The AI answers outside opening hours."],
    ["all_day", "All day", "The AI answers every call and transfers when needed."],
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className={`flex flex-wrap items-start gap-3 rounded-2xl px-4 py-3 text-[13px] ${status?.ready ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn"}`}>
        <Icon name={status?.ready ? "checkCircle" : "warning"} size={16} />
        <span className="min-w-0 flex-1">
          {status?.ready ? (
            <strong>Connected: the AI can make and take calls.</strong>
          ) : (
            <>
              <strong>Not live yet.</strong> Choose Vapi or Retell below and add its keys in Supabase (Edge Functions, Secrets). Vapi: VAPI_API_KEY, VAPI_PHONE_NUMBER_ID, VAPI_ASSISTANT_ID. Retell: RETELL_API_KEY, RETELL_AGENT_ID, RETELL_FROM_NUMBER. In the provider, set the webhook to the &quot;voice calls&quot; address from Connect GHL.
            </>
          )}
        </span>
        {setterId && (
          <button type="button" disabled={checking} onClick={check} className="btn-ghost min-h-8 rounded-lg bg-white px-3 text-[12px] font-semibold text-navy">
            {checking ? "Checking…" : "Check connection"}
          </button>
        )}
      </div>
      <Block eyebrow="Voice AI" title="Answering calls" text="The same AI brain as the setter, on the phone: it answers questions from the Knowledge bank, books into the GHL calendar, and passes the call to a person when it should.">
        <div className="grid gap-2 sm:grid-cols-2">
          {modes.map(([id, t, d]) => (
            <button key={id} type="button" disabled={ro} onClick={() => set({ voiceMode: id })} className={`rounded-2xl p-3.5 text-left ring-1 ${r.voiceMode === id ? "bg-chip ring-brand" : "bg-white ring-line hover:ring-sky"}`}>
              <div className="text-[13.5px] font-semibold text-navy">{t}</div>
              <div className="text-[12px] text-muted">{d}</div>
            </button>
          ))}
        </div>
      </Block>
      <Block eyebrow="Speed to lead" title="60-second lead caller" text="Calls every new lead within 60 seconds of the form, qualifies them and books the consultation. If they don't pick up, the text conversation carries on.">
        <Toggle on={r.voiceCallNewLeads} disabled={ro} onChange={(v) => set({ voiceCallNewLeads: v })} title="Call new leads straight away" text="Within your opening hours only." />
      </Block>
      <Block eyebrow="Live transfer" title="Passing the call to a person" text="For complications, complaints, hot leads or anyone who asks for a person, the AI transfers the call live instead of taking a message.">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>
            Transfer calls to
            <input value={r.voiceTransfer} disabled={ro} onChange={(e) => set({ voiceTransfer: e.target.value })} placeholder="+44 20 7946 0000" className={field} />
            <span className={hint}>The clinic or setter phone that should ring.</span>
          </label>
          <label className={label}>
            Voice provider
            <select value={r.voiceProvider} disabled={ro} onChange={(e) => set({ voiceProvider: e.target.value as SetterRules["voiceProvider"] })} className={field}>
              <option value="">Not chosen yet</option>
              <option value="retell">Retell</option>
              <option value="vapi">Vapi</option>
            </select>
          </label>
        </div>
        <p className={hint}>
          In the provider&apos;s assistant, use these variables in the prompt: {"{{clinic_name}}, {{assistant_name}}, {{lead_first_name}}, {{purpose}}, {{appointment}}, {{what_we_know}}, {{services}}, {{transfer_number}}"}. Use a British voice, say it&apos;s the clinic&apos;s AI assistant and that calls are recorded.
        </p>
      </Block>
      <Block eyebrow="Calls" title="Recent AI calls" text="Every call's summary also goes on the conversation and as a note in GHL.">
        {calls.length === 0 ? (
          <p className="rounded-2xl bg-surface p-4 text-[13px] text-muted">No calls yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-2xl ring-1 ring-line">
            {calls.map((c) => (
              <li key={c.id} className="flex flex-wrap items-start gap-3 px-4 py-3 text-[13px]">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-chip text-brand">
                  <Icon name="phone" size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-navy">
                    {c.direction === "inbound" ? "Answered a call" : "Called"} {c.purpose && c.purpose !== "inbound" && c.purpose !== "outbound" ? `(${c.purpose.replace("_", " ")})` : ""}
                  </span>
                  <span className="block text-muted">{c.summary || "No summary yet."}</span>
                </span>
                <span className="font-mono text-[12px] text-muted">{c.duration_seconds != null ? `${Math.floor(c.duration_seconds / 60)}m ${c.duration_seconds % 60}s` : "…"}</span>
                {c.recording_url && (
                  <a href={c.recording_url} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-brand hover:underline">
                    Recording
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Block>
    </div>
  );
}

// ---------------------------------------------------------------- Show-up and consent

const REMINDER_ROWS: [string, string][] = [
  ["3 days before", "A friendly heads-up, with anything they need to know (cancellation notice)."],
  ["48 hours before", "Asks them to reply YES to confirm. A YES marks it confirmed in Scalency and GHL."],
  ["24 hours before", "Only if they haven't confirmed. With Voice AI connected, the AI also calls them."],
  ["2 hours before", "See you soon, with where to come."],
];

export function ShowUpTab({ r, set, ro }: { r: SetterRules; set: (p: Partial<SetterRules>) => void; ro: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <Block eyebrow="Show-up" title="Appointment reminders" text="Every booking the AI makes (or GHL tells us about) gets these, in your opening hours. Replies go straight to the AI, so moving or cancelling is handled too.">
        <Toggle on={r.remindersOn} disabled={ro} onChange={(v) => set({ remindersOn: v })} title="Send reminders before each appointment" text="Turn off GHL's own reminder workflow for these calendars, so people don't get both." />
        <ol className="grid gap-2 sm:grid-cols-2">
          {REMINDER_ROWS.map(([t, d], i) => (
            <li key={t} className="flex items-start gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-line">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-chip font-mono text-[12px] font-semibold text-brand">{i + 1}</span>
              <span className="text-[13px]">
                <span className="font-semibold text-navy">{t}</span>
                <span className="block text-muted">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </Block>
      <Block eyebrow="No-shows" title="No-show recovery" text="When an appointment is marked No-show in GHL: a kind text 15 minutes after, then 2 more over 14 days. With Voice AI connected, the AI also calls after the first text.">
        <Toggle on={r.noShowOn} disabled={ro} onChange={(v) => set({ noShowOn: v })} title="Win back no-shows" text="The team is alerted too (Hours and alerts)." />
      </Block>
      <Block eyebrow="Waitlist" title="Fill cancellations" text="When none of the times suit, the AI offers to put them on the waitlist (GHL tag waitlist). When someone cancels, the slot is offered to up to 3 of them; first to reply gets it.">
        <Toggle on={r.waitlistOn} disabled={ro} onChange={(v) => set({ waitlistOn: v })} title="Offer cancelled slots to the waitlist" text="Only slots at least 2 hours away." />
      </Block>
      <Block eyebrow="Behaviour" title="Messages when leads show interest" text="A GHL workflow tells the AI when a lead does something (clicks a link, opens an email, visits the prices page). The AI sends a timely, helpful message, without ever saying it saw what they did.">
        <Toggle on={r.behaviourOn} disabled={ro} onChange={(v) => set({ behaviourOn: v })} title="Send behaviour-triggered messages" text="Only in opening hours, and never within 4 hours of another message." />
      </Block>
      <Block eyebrow="Guardrails" title="Marketing consent" text="UK GDPR and PECR: reactivation, rebooking, waitlist and behaviour messages are marketing. With this on they only go to contacts with your consent tag in GHL. Replies to people who enquired are always allowed.">
        <Toggle on={r.consentRequired} disabled={ro} onChange={(v) => set({ consentRequired: v })} title="Only send marketing messages to people who opted in" />
        <label className={`${label} max-w-[320px]`}>
          Consent tag in GHL
          <input value={r.consentTag} disabled={ro} onChange={(e) => set({ consentTag: e.target.value.toLowerCase().slice(0, 60) })} className={field} />
          <span className={hint}>Add this tag from your forms when someone ticks the marketing box.</span>
        </label>
      </Block>
    </div>
  );
}

// ---------------------------------------------------------------- Version history

export type VersionItem = { id: string; name: string | null; created_at: string; business: unknown; rules: unknown };

export function VersionsPanel({ versions, onRestore, ro }: { versions: VersionItem[]; onRestore: (v: VersionItem) => void; ro: boolean }) {
  const [open, setOpen] = useState(false);
  if (!versions.length) return null;
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  return (
    <Block eyebrow="Version history" title="Every save is kept" text="Changed something and the AI got worse? Restore an earlier version, check it in the Test chat, then Save." aside={<button type="button" onClick={() => setOpen(!open)} className="btn-ghost min-h-9 rounded-xl px-3 text-[12.5px] font-semibold">{open ? "Hide" : `Show ${versions.length}`}</button>}>
      {open && (
        <ul className="flex flex-col divide-y divide-line rounded-2xl ring-1 ring-line">
          {versions.map((v, i) => (
            <li key={v.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
              <span className="font-mono text-[12px] text-muted">{fmt(v.created_at)}</span>
              <span className="min-w-0 flex-1 truncate">{i === 0 ? "Current" : v.name || "AI setter"}</span>
              {!ro && i > 0 && (
                <button type="button" onClick={() => onRestore(v)} className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2.5 text-[12px] font-semibold text-brand hover:bg-chip">
                  <Icon name="undo" size={13} /> Restore
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}
