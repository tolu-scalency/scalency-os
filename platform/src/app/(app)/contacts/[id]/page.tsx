import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Icon, type IconName } from "@/components/icon";
import { Pill, Tile, type Tone } from "@/components/ui";
import { Loading } from "@/components/states";
import { formatPence, getContactDetail, timeAgo } from "@/lib/data";
import { addNote, moveStage } from "./actions";

export const metadata: Metadata = { title: "Contact" };

// How each kind of timeline entry looks.
const kinds: Record<string, { icon: IconName; tone: Tone }> = {
  "contact.created": { icon: "user", tone: "blue" },
  "stage.changed": { icon: "pipeline", tone: "violet" },
  note: { icon: "edit", tone: "orange" },
  "form.started": { icon: "form", tone: "pink" },
  "form.completed": { icon: "checkCircle", tone: "green" },
  "message.sent": { icon: "inbox", tone: "blue" },
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-t border-line py-2.5 text-[13px] first:border-t-0">
      <span className="text-muted">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function labelFor(key: string) {
  return key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export default function ContactPage(props: PageProps<"/contacts/[id]">) {
  return (
    <main className="flex flex-col gap-4 px-7 pb-10 pt-6">
      <Link href="/contacts" className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted hover:text-brand">
        <Icon name="arrowLeft" size={13} /> ALL CONTACTS
      </Link>
      <Suspense fallback={<Loading rows={5} />}>
        <ContactRecord params={props.params} />
      </Suspense>
    </main>
  );
}

async function ContactRecord({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Contact ids are UUIDs. Anything else can't exist, so skip the database call.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const c = await getContactDetail(id);
  if (!c) notFound();

  const currentIndex = c.opportunity ? c.stages.findIndex((s) => s.id === c.opportunity!.stageId) : -1;
  const answers = Object.entries(c.answers).filter(([, v]) => v !== null && v !== "" && typeof v !== "object");

  return (
    <>
      <section className="card relative overflow-hidden">
        <div className="dots pointer-events-none absolute inset-0 [mask-image:linear-gradient(90deg,transparent,#000_60%)]" />
        <div className="relative flex flex-wrap items-center gap-5 p-6">
          <span className="tile h-[72px] w-[72px] rounded-[22px] text-2xl font-semibold">{c.initials}</span>
          <div className="min-w-0 flex-[1_1_260px]">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[28px] font-semibold tracking-[-0.035em]">{c.name}</h1>
              {currentIndex >= 0 && <Pill>{c.stages[currentIndex].name}</Pill>}
              {c.isTest && <Pill tone="neutral" mono>TEST CONTACT</Pill>}
            </div>
            <div className="mt-1.5 text-[13.5px] text-muted">Added {timeAgo(c.createdAt).toLowerCase()} · source: {c.source ?? "unknown"}</div>
          </div>
          <div className="flex gap-2">
            {c.phone && (
              <a href={`tel:${c.phone}`} className="inline-flex min-h-10 items-center gap-2 rounded-[11px] border border-line-strong bg-surface px-4 text-[13.5px] font-medium hover:border-brand hover:text-brand">
                <Icon name="phone" size={15} />Call
              </a>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`} className="btn-primary inline-flex min-h-10 items-center gap-2 rounded-[11px] px-4 text-[13.5px] font-medium">
                <Icon name="mail" size={15} />Email
              </a>
            )}
          </div>
        </div>

        {c.stages.length > 0 && (
          <div className="relative border-t border-line px-6 pb-5 pt-[18px]">
            <ol className="flex overflow-x-auto">
              {c.stages.map((s, i) => (
                <li key={s.id} className={`relative flex min-w-20 flex-1 flex-col items-center gap-2 text-center text-xs ${i === currentIndex ? "font-semibold text-navy" : "text-muted"}`}>
                  {i > 0 && <span className={`absolute right-1/2 top-[6px] h-0.5 w-full ${i <= currentIndex ? "bg-sky" : "bg-line-strong"}`} />}
                  <span
                    className={`relative z-[1] h-3.5 w-3.5 rounded-full border-2 ${
                      i < currentIndex ? "border-sky bg-sky" : i === currentIndex ? "border-brand bg-brand shadow-[0_0_0_5px_rgba(4,101,199,0.15)]" : "border-line-strong bg-white"
                    }`}
                  />
                  {s.name}
                </li>
              ))}
            </ol>
            <form action={moveStage} className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <input type="hidden" name="contact_id" value={c.id} />
              <label className="flex items-center gap-2 text-[13px] text-muted">
                Move to
                <select name="stage_id" defaultValue={c.opportunity?.stageId} className="min-h-9 rounded-[10px] border border-line-strong bg-white px-2.5 text-[13px] text-navy">
                  {c.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <button type="submit" className="min-h-9 rounded-[10px] border border-line-strong bg-surface px-3 text-[13px] font-medium hover:border-brand hover:text-brand">Update stage</button>
            </form>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[1_1_270px] flex-col gap-4">
          <section className="card p-[18px]">
            <div className="eyebrow mb-2">Contact</div>
            <Row label="Email">{c.email ?? "—"}</Row>
            <Row label="Phone"><span className="font-mono">{c.phone ?? "—"}</span></Row>
            <Row label="Time zone"><span className="font-mono">{c.timezone.toUpperCase()}</span></Row>
            <Row label="Consent">{c.consent}</Row>
            <Row label="Source">{c.source ?? "—"}</Row>
          </section>
          <section className="card p-[18px]">
            <div className="eyebrow mb-2">Application answers</div>
            {answers.length ? (
              answers.map(([k, v]) => <Row key={k} label={labelFor(k)}>{String(v)}</Row>)
            ) : (
              <p className="text-[13px] text-muted">No answers yet. They appear when this person fills in an application form.</p>
            )}
          </section>
        </div>

        <section className="card min-w-0 flex-[2_1_440px] p-[22px]">
          <div className="eyebrow mb-3">Activity</div>
          <form action={addNote} className="mb-5 flex flex-col gap-2">
            <input type="hidden" name="contact_id" value={c.id} />
            <label>
              <span className="sr-only">Add a note</span>
              <textarea name="note" rows={2} required placeholder="Add a note for the team…" className="w-full resize-none rounded-[12px] border border-line-strong px-3 py-2.5 text-[13.5px] outline-none focus:border-brand" />
            </label>
            <button type="submit" className="btn-primary min-h-9 self-end rounded-[10px] px-3.5 text-[13px] font-medium">Add note</button>
          </form>
          {c.activity.length === 0 ? (
            <p className="text-[13px] text-muted">Nothing has happened yet.</p>
          ) : (
            <ol>
              {c.activity.map((e, i) => {
                const k = kinds[e.type] ?? { icon: "activity" as const, tone: "grey" as const };
                return (
                  <li key={e.id} className="relative flex gap-3.5 pb-5">
                    {i < c.activity.length - 1 && <span className="absolute bottom-0 left-4 top-9 w-px bg-line-strong" />}
                    <Tile icon={k.icon} tone={k.tone} size={34} />
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex justify-between gap-3 text-[13.5px]">
                        <span className="whitespace-pre-wrap">{e.summary}</span>
                        <span className="whitespace-nowrap font-mono text-[11px] text-muted">{timeAgo(e.createdAt)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <div className="flex min-w-0 flex-[1_1_270px] flex-col gap-4">
          <section className="card p-[18px]">
            <div className="eyebrow">Opportunity</div>
            {c.opportunity ? (
              <>
                <div className="mt-2 text-[30px] font-semibold tracking-[-0.04em]">{formatPence(c.opportunity.valuePence)}<span className="text-sm font-normal text-muted"> / mo</span></div>
                <div className="mt-2.5">
                  <Row label="Status"><span className="capitalize">{c.opportunity.status}</span></Row>
                  <Row label="Stage">{currentIndex >= 0 ? c.stages[currentIndex].name : "—"}</Row>
                </div>
              </>
            ) : (
              <p className="mt-2 text-[13px] text-muted">Not in a pipeline yet.</p>
            )}
          </section>
          <section className="card p-[18px]">
            <div className="eyebrow mb-3">Tags</div>
            {c.tags.length ? (
              <div className="flex flex-wrap gap-1.5">{c.tags.map((t) => <Pill key={t}>{t}</Pill>)}</div>
            ) : (
              <p className="text-[13px] text-muted">No tags yet.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
