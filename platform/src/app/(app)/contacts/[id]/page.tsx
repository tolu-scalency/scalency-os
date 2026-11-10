import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Icon, type IconName } from "@/components/icon";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Page, Tile, type Tone } from "@/components/ui";
import { Loading } from "@/components/states";
import { TaskList } from "@/components/task-list";
import { addTask } from "@/app/(app)/tasks/actions";
import { formatPence, getContactDetail, getWorkspace, timeAgo } from "@/lib/data";
import { addNote, setStage, setValue } from "./actions";
import { ContactEditor } from "./contact-editor";

export const metadata: Metadata = { title: "Contact" };

const kinds: Record<string, { icon: IconName; tone: Tone }> = {
  "contact.created": { icon: "user", tone: "blue" },
  "stage.changed": { icon: "pipeline", tone: "violet" },
  note: { icon: "edit", tone: "orange" },
  "form.completed": { icon: "checkCircle", tone: "green" },
};

export default function ContactPage(props: PageProps<"/contacts/[id]">) {
  return (
    <Page>
      <Link href="/contacts" className="-mb-2 inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted hover:text-brand">
        <Icon name="arrowLeft" size={15} /> Contacts
      </Link>
      <Suspense fallback={<Loading rows={5} />}>
        <ContactRecord params={props.params} />
      </Suspense>
    </Page>
  );
}

function labelFor(key: string) {
  return key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

async function ContactRecord({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ws = await getWorkspace();
  const c = await getContactDetail(id, ws.account.id);
  if (!c) notFound();

  const stages = c.pipeline?.stages ?? [];
  const currentIndex = c.opportunity ? stages.findIndex((s) => s.id === c.opportunity!.stageId) : -1;
  const answers = Object.entries(c.answers).filter(([, v]) => v !== null && v !== "" && typeof v !== "object");

  return (
    <>
      <section className="card p-5 sm:p-6">
        <ContactEditor contact={{ id: c.id, firstName: c.firstName, lastName: c.lastName, email: c.email ?? "", phone: c.phone ?? "" }}>
          <div className="flex flex-wrap items-center gap-4">
            <span className="tile h-16 w-16 rounded-[20px] text-[22px] font-semibold">{c.initials}</span>
            <div className="min-w-0 flex-[1_1_220px]">
              <h1 className="truncate text-[26px] font-semibold tracking-[-0.03em]">{c.name}</h1>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-muted">
                {c.email && <span className="inline-flex items-center gap-1.5"><Icon name="mail" size={14} />{c.email}</span>}
                {c.phone && <span className="inline-flex items-center gap-1.5 tabular-nums"><Icon name="phone" size={14} />{c.phone}</span>}
                <span>Added {timeAgo(c.createdAt).toLowerCase()}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {c.phone && (
                <a href={`tel:${c.phone}`} className="btn-ghost inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-[13.5px] font-semibold">
                  <Icon name="phone" size={15} /> Call
                </a>
              )}
              {c.email && (
                <a href={`mailto:${c.email}`} className="btn-primary inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-[13.5px] font-semibold">
                  <Icon name="mail" size={15} /> Email
                </a>
              )}
            </div>
          </div>
        </ContactEditor>
      </section>

      <section className="card p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[16px] font-semibold">Pipeline</h2>
          {c.opportunity && (
            <ActionForm action={setValue} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="opportunity_id" value={c.opportunity.id} />
              <label className="flex items-center gap-2 text-[13px] text-muted">
                Deal value
                <span className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-faint">£</span>
                  <input
                    name="value"
                    inputMode="decimal"
                    defaultValue={c.opportunity.valuePence != null ? String(c.opportunity.valuePence / 100) : ""}
                    placeholder="0"
                    className="field w-32 pl-7"
                  />
                </span>
              </label>
              <SubmitButton variant="ghost" pendingText="Saving…">Save</SubmitButton>
            </ActionForm>
          )}
        </div>
        {stages.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface p-4">
            <p className="text-[14px] text-muted">Set up your pipeline to track where this deal is.</p>
            <Link href="/pipeline" className="btn-primary inline-flex min-h-9 items-center rounded-xl px-3.5 text-[13px] font-semibold">Set up pipeline</Link>
          </div>
        ) : (
          <>
            <ol className="flex gap-1.5 overflow-x-auto pb-1">
              {stages.map((s, i) => {
                const on = i === currentIndex;
                const past = currentIndex >= 0 && i < currentIndex;
                return (
                  <li key={s.id} className="min-w-[120px] flex-1">
                    <ActionForm action={setStage}>
                      <input type="hidden" name="contact_id" value={c.id} />
                      <input type="hidden" name="stage_id" value={s.id} />
                      <button
                        type="submit"
                        title={on ? "Current stage" : `Move to ${s.name}`}
                        className={`w-full rounded-xl px-3 py-2.5 text-left text-[13px] transition-all ${
                          on
                            ? "bg-[linear-gradient(135deg,#29b0f8,#0a5fe3)] font-semibold text-white shadow-[0_8px_20px_-10px_rgba(10,95,227,0.8)]"
                            : past
                              ? "bg-chip text-brand hover:bg-tint"
                              : "bg-surface text-muted hover:bg-chip hover:text-brand"
                        }`}
                      >
                        <span className="block truncate">{s.name}</span>
                      </button>
                    </ActionForm>
                  </li>
                );
              })}
            </ol>
            {currentIndex < 0 && <p className="mt-3 text-[13px] text-muted">Not in the pipeline yet. Click a stage to add them.</p>}
            {c.opportunity && <p className="mt-3 text-[13px] text-muted">Value: <strong className="text-navy">{formatPence(c.opportunity.valuePence)}</strong></p>}
          </>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="card p-5 sm:p-6">
          <h2 className="mb-3 text-[16px] font-semibold">Notes and activity</h2>
          <ActionForm action={addNote} resetOnOk className="mb-5 flex flex-col gap-2">
            <input type="hidden" name="contact_id" value={c.id} />
            <label>
              <span className="sr-only">Add a note</span>
              <textarea name="note" rows={3} required placeholder="Write a note…" className="field min-h-[84px] resize-y py-2.5" />
            </label>
            <div className="flex justify-end">
              <SubmitButton pendingText="Adding…">Add note</SubmitButton>
            </div>
          </ActionForm>
          {c.activity.length === 0 ? (
            <p className="text-[14px] text-muted">Nothing yet.</p>
          ) : (
            <ol>
              {c.activity.map((e, i) => {
                const k = kinds[e.type] ?? { icon: "activity" as const, tone: "grey" as const };
                return (
                  <li key={e.id} className="relative flex gap-3.5 pb-5">
                    {i < c.activity.length - 1 && <span className="absolute bottom-0 left-[15px] top-9 w-px bg-line" />}
                    <Tile icon={k.icon} tone={k.tone} size={30} />
                    <div className="min-w-0 flex-1 pt-1">
                      <p className={`whitespace-pre-wrap text-[14px] ${e.type === "note" ? "rounded-xl bg-surface px-3 py-2" : ""}`}>{e.summary}</p>
                      <span className="mt-1 block text-[12px] text-faint">{timeAgo(e.createdAt)}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <div className="flex flex-col gap-4">
          <section className="card p-5">
            <h2 className="mb-2 text-[16px] font-semibold">Tasks</h2>
            <ActionForm action={addTask} resetOnOk className="mb-2 flex flex-wrap gap-2">
              <input type="hidden" name="contact_id" value={c.id} />
              <input name="title" required placeholder="Follow up…" className="field min-w-0 basis-full" />
              <input name="due_on" type="date" aria-label="Due date" className="field min-w-0 flex-1" />
              <SubmitButton icon="plus" pendingText="Adding…">Add</SubmitButton>
            </ActionForm>
            {c.tasks.length === 0 ? <p className="py-2 text-[13.5px] text-muted">No tasks for this contact.</p> : <TaskList tasks={c.tasks} showContact={false} />}
          </section>

          <section className="card p-5">
            <h2 className="mb-2 text-[16px] font-semibold">Details</h2>
            <dl className="divide-y divide-line text-[13.5px]">
              <Row label="Email">{c.email ?? "—"}</Row>
              <Row label="Phone">{c.phone ?? "—"}</Row>
              <Row label="Source"><span className="capitalize">{c.source ?? "—"}</span></Row>
              <Row label="Added">{new Date(c.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</Row>
              {answers.map(([k, v]) => (
                <Row key={k} label={labelFor(k)}>{String(v)}</Row>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  );
}
