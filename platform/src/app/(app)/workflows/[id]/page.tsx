import { shortId } from "@/lib/short-id-shared";
import { createClient } from "@/lib/supabase/server";
import { fullId } from "@/lib/short-id";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Icon } from "@/components/icon";
import { Page, Pill } from "@/components/ui";
import { headers } from "next/headers";
import { getWorkflow, getWorkspace, listCustomFields, listCustomValues, listTags, listWorkflows, memberNames, timeAgo, listAllStages, listPipelines } from "@/lib/data";
import { runDueNow, setWorkflowStatus } from "../actions";
import { actionLabel } from "../labels";
import { WorkflowEditor } from "./editor";
import { CopyId } from "@/components/copy-id";

export const metadata: Metadata = { title: "Workflow" };

const outcomeTone = { done: "green", skipped: "amber", failed: "red", waiting: "blue" } as const;

function runText(detail: Record<string, unknown>) {
  if (typeof detail.reason === "string") return detail.reason;
  if (typeof detail.branch === "string") return `Went down “${detail.branch}”`;
  if (detail.result === "yes") return "Condition met";
  if (detail.result === "no") return "Condition not met";
  if (typeof detail.until === "string") return `Until ${new Date(detail.until).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
  if (typeof detail.to === "string") return `To ${detail.to}${detail.test_mode ? " (test mode)" : ""}`;
  return "";
}

export default async function WorkflowPage(props: PageProps<"/workflows/[id]">) {
  const { id: raw } = await props.params;
  const id = await fullId("workflows", raw);
  const ws = await getWorkspace();
  const [wf, pipeline, names, flows, tags, h, customFields, customValues, pipes, { data: formRows }, { data: calRows }] = await Promise.all([
    getWorkflow(id, ws.account.id),
    listAllStages(ws.account.id),
    memberNames(ws.account.id),
    listWorkflows(ws.account.id),
    listTags(ws.account.id),
    headers(),
    listCustomFields(ws.account.id),
    listCustomValues(ws.account.id),
    listPipelines(ws.account.id),
    (await createClient()).from("forms").select("id, name").eq("account_id", ws.account.id).neq("status", "archived").order("name"),
    (await createClient()).from("calendars").select("id, name").eq("account_id", ws.account.id).neq("status", "archived").order("name"),
  ]);
  if (!wf) notFound();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "os.scalency.us";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return (
    <Page wide>
      <Link href="/workflows" className="-mb-2 inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted hover:text-brand">
        <Icon name="arrowLeft" size={15} /> Workflows
      </Link>

      <WorkflowEditor
        key={wf.id}
        workflow={{ id: wf.id, name: wf.name, description: wf.description, trigger: wf.trigger, steps: wf.steps, graph: wf.graph, stopOnReply: wf.stopOnReply }}
        stages={pipeline.map((s, i) => ({ id: s.id, name: s.name, position: i + 1, pipelineId: s.pipelineId }))}
        pipelines={pipes.map((p) => ({ id: p.id, name: p.name }))}
        forms={(formRows ?? []).map((f) => ({ id: f.id as string, name: f.name as string }))}
        calendars={(calRows ?? []).map((c) => ({ id: c.id as string, name: c.name as string }))}
        members={Object.entries(names).map(([mid, name]) => ({ id: mid, name }))}
        workflows={flows.map((f) => ({ id: f.id, name: f.name }))}
        tags={tags}
        hookBase={`${proto}://${host}`}
        customFields={customFields}
        customValues={customValues}
        locked={wf.status === "active"}
        statusBar={
          <div className="flex items-center gap-2">
            <Pill tone={wf.status === "active" ? "green" : wf.status === "paused" ? "amber" : "neutral"}>{wf.status === "active" ? "On" : wf.status === "paused" ? "Paused" : "Draft"}</Pill>
            {wf.status !== "active" ? (
              <ActionForm action={setWorkflowStatus} className="flex items-center gap-1">
                <input type="hidden" name="id" value={wf.id} />
                <input type="hidden" name="status" value="active" />
                <SubmitButton icon="check" pendingText="Turning on…" className="min-h-9 px-3 text-[13px]">
                  Approve and turn on
                </SubmitButton>
              </ActionForm>
            ) : (
              <ActionForm action={setWorkflowStatus}>
                <input type="hidden" name="id" value={wf.id} />
                <input type="hidden" name="status" value="paused" />
                <SubmitButton variant="ghost" pendingText="Pausing…" className="min-h-9 px-3 text-[13px]">
                  Pause
                </SubmitButton>
              </ActionForm>
            )}
          </div>
        }
        settingsExtra={
          <>
            <p className="text-[12.5px] text-muted">{wf.status === "active" && wf.approvedBy ? `Approved by ${wf.approvedBy}.` : "Nothing runs until you approve and turn it on."}</p>
            <CopyId label="Workflow ID" id={wf.id} />
            <ActionForm action={setWorkflowStatus}>
              <input type="hidden" name="id" value={wf.id} />
              <input type="hidden" name="status" value="archived" />
              <SubmitButton variant="ghost" pendingText="Archiving…">
                Archive this workflow
              </SubmitButton>
            </ActionForm>
          </>
        }
      />

      <section className="card p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[16px] font-semibold">Run history</h2>
            <p className="text-[13px] text-muted">Everyone who went through this workflow, and every step it ran.</p>
          </div>
          <form action={runDueNow}>
            <button type="submit" className="btn-ghost inline-flex min-h-9 items-center gap-2 rounded-xl px-3 text-[13px] font-semibold">
              <Icon name="refresh" size={14} /> Run due steps now
            </button>
          </form>
        </div>
        {wf.enrollments.length === 0 ? (
          <p className="py-6 text-center text-[14px] text-muted">Nobody yet. Once it&apos;s on, people who match the trigger appear here.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {wf.enrollments.map((e) => (
              <li key={e.id} className="rounded-xl border border-line p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/contacts/${shortId(e.contactId)}`} className="text-[14px] font-semibold hover:text-brand">{e.contactName}</Link>
                  <Pill tone={e.status === "completed" ? "green" : e.status === "waiting" ? "blue" : e.status === "active" ? "blue" : "neutral"}>
                    <span className="capitalize">{e.status}</span>
                  </Pill>
                  <span className="text-[12px] text-faint">Started {timeAgo(e.enteredAt).toLowerCase()}</span>
                  {e.status === "waiting" && e.nextRunAt && (
                    <span className="text-[12px] text-muted">· next step {new Date(e.nextRunAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  )}
                  {e.exitReason && <span className="text-[12px] text-muted">· {e.exitReason}</span>}
                </div>
                {e.runs.length > 0 && (
                  <ol className="mt-2.5 flex flex-wrap gap-1.5">
                    {e.runs.map((r, i) => (
                      <li key={i} title={runText(r.detail)}>
                        <Pill tone={outcomeTone[r.outcome as keyof typeof outcomeTone] ?? "neutral"}>
                          {wf.steps[Number(r.step_key)]?.label || (actionLabel[r.action] ?? r.action)}
                          {r.outcome !== "done" ? ` · ${r.outcome}` : ""}
                        </Pill>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}
