import type { Metadata } from "next";
import { fullId } from "@/lib/short-id";
import { FieldInput } from "@/components/field-input";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Page, Tile, type Tone } from "@/components/ui";
import { TaskList } from "@/components/task-list";
import { addTask } from "@/app/(app)/tasks/actions";
import { can, formatPence, getContactDetail, getWorkspace, listCustomFields, listTags, listWorkflows, memberNames, timeAgo } from "@/lib/data";
import { enrollContact } from "@/app/(app)/workflows/actions";
import { addNote, saveCustomFields, setDealStatus, setOwner, setStage, setValue } from "./actions";
import { ContactEditor } from "./contact-editor";
import { TagEditor } from "./tag-editor";
import { CopyId } from "@/components/copy-id";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Contact" };

const kinds: Record<string, { icon: IconName; tone: Tone }> = {
  "contact.created": { icon: "user", tone: "blue" },
  "stage.changed": { icon: "pipeline", tone: "violet" },
  note: { icon: "edit", tone: "orange" },
  "form.completed": { icon: "checkCircle", tone: "green" },
  "tag.added": { icon: "tag", tone: "blue" },
  "tag.removed": { icon: "tag", tone: "grey" },
  "deal.status": { icon: "thumbsUp", tone: "green" },
  "message.email": { icon: "mail", tone: "blue" },
  "message.sms": { icon: "phone", tone: "green" },
  "message.received": { icon: "inbox", tone: "orange" },
};

export default function ContactPage(props: PageProps<"/contacts/[id]">) {
  return (
    <Page>
      <Link href="/contacts" className="-mb-3 inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted hover:text-brand">
        <Icon name="arrowLeft" size={15} /> Contacts
      </Link>
      <ContactRecord params={props.params} searchParams={props.searchParams} />
    </Page>
  );
}

function labelFor(key: string) {
  return key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

type Tab = "activity" | "answers" | "tasks";

async function ContactRecord({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: raw } = await params;
  const sp = await searchParams;
  const id = await fullId("contacts", raw);
  const ws = await getWorkspace();
  const [c, workflows, names, allTags, customFields, submissions, appts] = await Promise.all([
    getContactDetail(id, ws.account.id),
    listWorkflows(ws.account.id),
    memberNames(ws.account.id),
    listTags(ws.account.id),
    listCustomFields(ws.account.id),
    formAnswers(id, ws.account.id),
    appointmentsFor(id, ws.account.id),
  ]);
  if (!c) notFound();
  const liveWorkflows = workflows.filter((w) => w.status === "active");
  const tab: Tab = sp.tab === "answers" || sp.tab === "tasks" ? sp.tab : "activity";
  const href = (t: Tab) => `/contacts/${c.id}${t === "activity" ? "" : `?tab=${t}`}`;

  const stages = c.pipeline?.stages ?? [];
  const currentIndex = c.opportunity ? stages.findIndex((s) => s.id === c.opportunity!.stageId) : -1;
  const answers = Object.entries(c.answers).filter(([, v]) => v !== null && v !== "" && typeof v !== "object");
  const openTasks = c.tasks.filter((t) => !t.doneAt).length;
  // Name, email and phone already show on the left, so the answers tab leaves them out.
  const known = new Set([c.firstName, c.lastName, c.name, c.email ?? "", c.phone ?? ""].map((v) => v.trim().toLowerCase()).filter(Boolean));

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)] [&>*]:min-w-0">
      {/* Left: who they are */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
        <section className="card overflow-hidden">
          <div className="h-16 bg-[linear-gradient(120deg,#55e3ec,#29b0f8_50%,#0a5fe3)]" />
          <div className="-mt-9 px-5 pb-5">
            <ContactEditor canDelete={can(ws, "contacts.delete")} contact={{ id: c.id, firstName: c.firstName, lastName: c.lastName, email: c.email ?? "", phone: c.phone ?? "" }}>
              <span className="tile h-[72px] w-[72px] rounded-[22px] text-[22px] font-semibold ring-4 ring-white">{c.initials}</span>
              <h1 className="mt-3 break-words text-[22px] font-semibold leading-tight tracking-[-0.02em]">{c.name}</h1>
              <p className="mt-0.5 text-[13px] text-muted">Added {timeAgo(c.createdAt).toLowerCase()}{c.source ? ` · ${c.source}` : ""}</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <QuickAction href={`/inbox?c=${c.id}`} icon="send" label="Message" />
                <QuickAction href={c.phone ? `tel:${c.phone}` : undefined} icon="phone" label="Call" />
                <QuickAction href={c.email ? `mailto:${c.email}` : undefined} icon="mail" label="Email" />
              </div>
              <dl className="mt-4 flex flex-col gap-2.5 text-[13.5px]">
                <InfoLine icon="mail" value={c.email} copy />
                <InfoLine icon="phone" value={c.phone} copy />
              </dl>
              <CopyId label="Contact ID" id={c.id} className="mt-3" />
            </ContactEditor>
          </div>
        </section>

        {appts.length > 0 && (
          <section className="card p-5">
            <h2 className="mb-2 text-[14px] font-semibold">Appointments</h2>
            <ul className="flex flex-col gap-2">
              {appts.map((a) => (
                <li key={a.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13.5px] font-semibold">{a.when}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${APPT_LOOK[a.status] ?? "bg-surface text-muted"}`}>{APPT_LABEL[a.status] ?? a.status}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[12.5px] text-muted">{a.title}</p>
                  {a.meetingUrl && a.upcoming && (
                    <a href={a.meetingUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand hover:underline">
                      <Icon name="link" size={13} /> Join link
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card p-5">
          <h2 className="mb-2 text-[14px] font-semibold">Tags</h2>
          <TagEditor contactId={c.id} tags={c.tags} allTags={allTags} />
          <h2 className="mb-2 mt-5 text-[14px] font-semibold">Owner</h2>
          <ActionForm action={setOwner} className="flex gap-2">
            <input type="hidden" name="contact_id" value={c.id} />
            <select name="owner_id" defaultValue={c.ownerId ?? ""} aria-label="Owner" className="field min-w-0 flex-1">
              <option value="">Nobody yet</option>
              {Object.entries(names).map(([uid, n]) => (
                <option key={uid} value={uid}>{uid === ws.userId ? `${n} (you)` : n}</option>
              ))}
            </select>
            <SubmitButton variant="ghost" pendingText="Saving…">Save</SubmitButton>
          </ActionForm>
          <h2 className="mb-1 mt-5 text-[14px] font-semibold">Workflows</h2>
          {!can(ws, "workflows.manage") ? (
            <p className="text-[13px] text-muted">Ask the workspace owner to add this contact to a workflow.</p>
          ) : liveWorkflows.length === 0 ? (
            <p className="text-[13px] text-muted">
              No workflows are on yet. <Link href="/workflows" className="font-medium text-brand hover:underline">Create one</Link>
            </p>
          ) : (
            <ActionForm action={enrollContact} className="mt-1 flex gap-2">
              <input type="hidden" name="contact_id" value={c.id} />
              <select name="workflow_id" aria-label="Workflow" className="field min-w-0 flex-1">
                {liveWorkflows.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              <SubmitButton icon="zap" pendingText="Adding…">Add</SubmitButton>
            </ActionForm>
          )}
        </section>

        {(customFields.length > 0 || answers.length > 0 || c.smsUnsubscribed || c.emailUnsubscribed) && (
          <details className="card group p-5" open={customFields.length <= 6}>
            <summary className="flex cursor-pointer list-none items-center justify-between text-[14px] font-semibold">
              More details
              <Icon name="chevronDown" size={16} className="text-muted transition group-open:rotate-180" />
            </summary>
            {(c.smsUnsubscribed || c.emailUnsubscribed || answers.length > 0) && (
              <dl className="mt-3 divide-y divide-line text-[13px]">
                {(c.smsUnsubscribed || c.emailUnsubscribed) && (
                  <Row label="Unsubscribed">{[c.smsUnsubscribed && "Texts", c.emailUnsubscribed && "Emails"].filter(Boolean).join(" and ")}</Row>
                )}
                {answers.map(([k, v]) => (
                  <Row key={k} label={labelFor(k)}>{String(v)}</Row>
                ))}
              </dl>
            )}
            {customFields.length > 0 && (
              <fieldset disabled={!can(ws, "contacts.edit")} className="contents">
                <ActionForm action={saveCustomFields} className="mt-3 flex flex-col gap-2.5">
                  <input type="hidden" name="contact_id" value={c.id} />
                  {customFields.map((f) => (
                    <div key={f.key} className="flex flex-col gap-1">
                      <span className="text-[12px] font-medium text-muted">{f.label}</span>
                      <FieldInput field={f} value={c.custom[f.key]} />
                    </div>
                  ))}
                  {can(ws, "contacts.edit") && (
                    <div className="flex justify-end">
                      <SubmitButton variant="ghost" pendingText="Saving…">Save fields</SubmitButton>
                    </div>
                  )}
                </ActionForm>
              </fieldset>
            )}
          </details>
        )}
      </aside>

      {/* Right: where they are and what's happened */}
      <div className="flex flex-col gap-4">
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-[15px] font-semibold">{c.pipeline?.name ?? "Pipeline"}</h2>
              {c.opportunity && c.opportunity.status !== "open" && (
                <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${c.opportunity.status === "won" ? "bg-ok-bg text-ok" : "bg-bad-bg text-bad"}`}>Deal {c.opportunity.status}</span>
              )}
            </div>
            {c.opportunity && (
              <div className="flex flex-wrap items-center gap-2">
                {can(ws, "deals.edit") && (
                  <ActionForm action={setValue} className="flex items-center gap-1.5">
                    <input type="hidden" name="opportunity_id" value={c.opportunity.id} />
                    <span className="relative">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-faint">£</span>
                      <input
                        name="value"
                        inputMode="decimal"
                        aria-label="Deal value"
                        defaultValue={c.opportunity.valuePence != null ? String(c.opportunity.valuePence / 100) : ""}
                        placeholder="Deal value"
                        className="field h-9 w-32 pl-6 text-[13px]"
                      />
                    </span>
                    <SubmitButton variant="ghost" pendingText="…">Save</SubmitButton>
                  </ActionForm>
                )}
                {(c.opportunity.status === "open" ? (["won", "lost"] as const) : (["open"] as const)).map((st) => (
                  <ActionForm key={st} action={setDealStatus}>
                    <input type="hidden" name="opportunity_id" value={c.opportunity!.id} />
                    <input type="hidden" name="status" value={st} />
                    <SubmitButton variant="ghost" icon={st === "won" ? "thumbsUp" : st === "lost" ? "x" : "refresh"} pendingText="…">
                      {st === "won" ? "Won" : st === "lost" ? "Lost" : "Reopen"}
                    </SubmitButton>
                  </ActionForm>
                ))}
              </div>
            )}
          </div>
          {stages.length === 0 ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface p-3.5">
              <p className="text-[13.5px] text-muted">Set up your pipeline to track where this deal is.</p>
              <Link href="/pipeline" className="btn-primary inline-flex min-h-9 items-center rounded-xl px-3.5 text-[13px] font-semibold">Set up pipeline</Link>
            </div>
          ) : (
            <>
              <ol className="mt-3 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
                {stages.map((s, i) => {
                  const on = i === currentIndex;
                  const past = currentIndex >= 0 && i < currentIndex;
                  return (
                    <li key={s.id} className="min-w-[104px] flex-1">
                      <ActionForm action={setStage}>
                        <input type="hidden" name="contact_id" value={c.id} />
                        <input type="hidden" name="stage_id" value={s.id} />
                        <button
                          type="submit"
                          title={on ? "Current stage" : `Move to ${s.name}`}
                          className={`group flex w-full flex-col gap-1.5 rounded-lg px-1 pb-1 pt-0.5 text-left transition ${on ? "" : "hover:bg-surface"}`}
                        >
                          <span className={`h-1.5 w-full rounded-full ${on ? "bg-[linear-gradient(90deg,#29b0f8,#0a5fe3)]" : past ? "bg-[#9cc4f5]" : "bg-line group-hover:bg-[#c9dcf6]"}`} />
                          <span className={`truncate px-0.5 text-[12.5px] ${on ? "font-semibold text-brand" : past ? "text-navy" : "text-muted"}`}>{s.name}</span>
                        </button>
                      </ActionForm>
                    </li>
                  );
                })}
              </ol>
              {currentIndex < 0 && <p className="mt-1 text-[12.5px] text-muted">Not in the pipeline yet. Click a stage to add them.</p>}
              {c.opportunity && c.opportunity.valuePence != null && (
                <p className="mt-1 text-[12.5px] text-muted">Deal value <strong className="text-navy">{formatPence(c.opportunity.valuePence)}</strong></p>
              )}
            </>
          )}
        </section>

        <section className="card overflow-hidden">
          <nav className="flex gap-1 border-b border-line px-3 pt-2" aria-label="Contact sections">
            <TabLink href={href("activity")} on={tab === "activity"} label="Activity" />
            <TabLink href={href("answers")} on={tab === "answers"} label="Form answers" count={submissions.length} />
            <TabLink href={href("tasks")} on={tab === "tasks"} label="Tasks" count={openTasks} />
          </nav>

          <div className="p-5">
            {tab === "activity" && (
              <>
                <ActionForm action={addNote} resetOnOk className="mb-5 flex flex-col gap-2 rounded-xl border border-line bg-surface/60 p-2.5">
                  <input type="hidden" name="contact_id" value={c.id} />
                  <label>
                    <span className="sr-only">Add a note</span>
                    <textarea name="note" rows={2} required placeholder="Write a note about this contact…" className="w-full resize-y border-0 bg-transparent px-1.5 py-1 text-[14px] outline-none placeholder:text-faint" />
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
                        <li key={e.id} className="relative flex gap-3 pb-4">
                          {i < c.activity.length - 1 && <span className="absolute bottom-0 left-[13px] top-8 w-px bg-line" />}
                          <Tile icon={k.icon} tone={k.tone} size={27} />
                          <div className="min-w-0 flex-1 pt-0.5">
                            <p className={`whitespace-pre-wrap text-[13.5px] ${e.type === "note" ? "rounded-xl bg-[#fff8ec] px-3 py-2" : ""}`}>{e.summary}</p>
                            <span className="mt-0.5 block text-[11.5px] text-faint">{timeAgo(e.createdAt)}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </>
            )}

            {tab === "answers" &&
              (submissions.length === 0 ? (
                <p className="text-[14px] text-muted">They haven&apos;t filled in any forms yet.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {submissions.map((s) => (
                    <div key={s.id} className="rounded-xl border border-line">
                      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface/60 px-4 py-2.5 text-[13px]">
                        <Link href={`/forms/${s.formId}?tab=submissions`} className="font-semibold hover:text-brand">{s.formName}</Link>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.status === "started" ? "bg-warn-bg text-warn" : "bg-ok-bg text-ok"}`}>
                          {s.status === "started" ? "Didn't finish" : s.booked ? "Finished and booked" : "Finished"}
                        </span>
                        <span className="ml-auto text-[12px] text-muted">{timeAgo(s.at)}</span>
                      </div>
                      <dl className="grid gap-x-6 px-4 py-2 text-[13.5px] sm:grid-cols-2">
                        {s.fields.filter((f) => !known.has(f.value.trim().toLowerCase())).map((f) => (
                          <div key={f.id} className="flex flex-col py-1.5">
                            <dt className="text-[12px] text-muted">{f.label}</dt>
                            <dd className="break-words font-medium">{f.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              ))}

            {tab === "tasks" && (
              <>
                <ActionForm action={addTask} resetOnOk className="mb-3 flex flex-wrap gap-2">
                  <input type="hidden" name="contact_id" value={c.id} />
                  <input name="title" required placeholder="Follow up…" className="field min-w-0 flex-[2_1_220px]" />
                  <input name="due_on" type="date" aria-label="Due date" className="field min-w-0 flex-[1_1_140px]" />
                  <SubmitButton icon="plus" pendingText="Adding…">Add</SubmitButton>
                </ActionForm>
                {c.tasks.length === 0 ? <p className="py-2 text-[13.5px] text-muted">No tasks for this contact.</p> : <TaskList tasks={c.tasks} showContact={false} />}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

const APPT_LABEL: Record<string, string> = { booked: "Booked", confirmed: "Confirmed", showed: "Showed", no_show: "No-show", cancelled: "Cancelled" };
const APPT_LOOK: Record<string, string> = {
  booked: "bg-chip text-brand",
  confirmed: "bg-ok-bg text-ok",
  showed: "bg-ok-bg text-ok",
  no_show: "bg-warn-bg text-warn",
  cancelled: "bg-bad-bg text-bad",
};

/** Their appointments: upcoming first, then the most recent past ones. */
async function appointmentsFor(contactId: string, accountId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select("id, title, starts_at, status, meeting_url")
    .eq("account_id", accountId)
    .eq("contact_id", contactId)
    .order("starts_at", { ascending: false })
    .limit(4);
  const now = Date.now();
  return (data ?? [])
    .map((a) => {
      const start = Date.parse(a.starts_at as string);
      return {
        id: a.id as string,
        title: (a.title as string) ?? "Appointment",
        status: a.status as string,
        meetingUrl: (a.meeting_url as string | null) ?? null,
        upcoming: start > now,
        start,
        when: new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(start)),
      };
    })
    .sort((a, b) => (a.upcoming === b.upcoming ? (a.upcoming ? a.start - b.start : b.start - a.start) : a.upcoming ? -1 : 1));
}

function QuickAction({ href, icon, label }: { href?: string; icon: IconName; label: string }) {
  const cls = "flex flex-col items-center gap-1 rounded-xl border border-line py-2.5 text-[12px] font-semibold transition";
  if (!href) return <span className={`${cls} cursor-not-allowed text-faint opacity-60`} title={`No ${label === "Email" ? "email" : "phone"} yet`}><Icon name={icon} size={17} />{label}</span>;
  return (
    <a href={href} className={`${cls} text-navy hover:border-[#bcd6f8] hover:bg-tint hover:text-brand`}>
      <Icon name={icon} size={17} />
      {label}
    </a>
  );
}

function InfoLine({ icon, value }: { icon: IconName; value: string | null; copy?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-surface text-muted"><Icon name={icon} size={14} /></span>
      <span className={`min-w-0 truncate ${value ? "" : "text-faint"}`}>{value || "Not added"}</span>
    </div>
  );
}

function TabLink({ href, on, label, count }: { href: string; on: boolean; label: string; count?: number }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={on ? "page" : undefined}
      className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13.5px] font-semibold transition ${on ? "border-brand text-brand" : "border-transparent text-muted hover:text-navy"}`}
    >
      {label}
      {count ? <span className={`rounded-full px-1.5 text-[11px] ${on ? "bg-chip" : "bg-surface"}`}>{count}</span> : null}
    </Link>
  );
}

/** This contact's answers on forms, newest first (partial ones too). */
async function formAnswers(contactId: string, accountId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("form_submissions")
    .select("id, form_id, status, answers, started_at, completed_at, forms(name)")
    .eq("account_id", accountId)
    .eq("contact_id", contactId)
    .order("started_at", { ascending: false })
    .limit(5);
  return (data ?? []).map((r) => {
    const a = (r.answers ?? {}) as { fields?: { id: string; label: string; value: string }[]; booking?: unknown };
    const form = (Array.isArray(r.forms) ? r.forms[0] : r.forms) as { name?: string } | null;
    return {
      id: r.id as string,
      formId: r.form_id as string,
      formName: form?.name ?? "Form",
      status: r.status as string,
      booked: Boolean(a.booking),
      at: (r.completed_at ?? r.started_at) as string,
      fields: (a.fields ?? []).filter((f) => f && String(f.value ?? "").trim() !== "").slice(0, 30),
    };
  });
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  );
}
