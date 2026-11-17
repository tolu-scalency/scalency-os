import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, ConfirmSubmit, IconSubmit, SubmitButton } from "@/components/action-form";
import { can, getPipeline, getWorkspace, listPipelines } from "@/lib/data";
import { addStage, deletePipeline, renamePipeline } from "../../pipeline/actions";
import { NewPipelineForm } from "./new-pipeline";
import { deleteStage, renameStage, reorderStage } from "../actions";
import { CopyId } from "@/components/copy-id";

export const metadata: Metadata = { title: "Pipeline settings" };

export default async function PipelineSettingsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const ws = await getWorkspace();
  const [pipeline, pipelines] = await Promise.all([getPipeline(ws.account.id, p), listPipelines(ws.account.id)]);
  const manager = can(ws, "pipeline.manage");

  if (!pipeline) {
    return (
      <section className="card flex flex-wrap items-center justify-between gap-3 p-6">
        <div>
          <h2 className="text-[16px] font-semibold">No pipeline yet</h2>
          <p className="text-[13.5px] text-muted">Pick a template to get started.</p>
        </div>
        <Link href="/pipeline" className="btn-primary inline-flex min-h-10 items-center rounded-xl px-4 text-[13.5px] font-semibold">Set up pipeline</Link>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
    <section className="card p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-semibold">Pipelines</h2>
          <p className="text-[13.5px] text-muted">Use a pipeline for each process, e.g. Sales, Projects or Recruitment.</p>
        </div>
      </div>
      <ul className="flex flex-wrap gap-2">
        {pipelines.map((x) => (
          <li key={x.id}>
            <Link
              href={`/settings/pipeline?p=${x.id}`}
              className={`inline-flex min-h-10 items-center rounded-xl border px-4 text-[13.5px] font-semibold transition-colors ${x.id === pipeline.id ? "border-brand bg-chip text-brand" : "border-line bg-white text-navy hover:border-sky"}`}
            >
              {x.name}
            </Link>
          </li>
        ))}
      </ul>
      {manager && (
        <div className="mt-4 grid gap-3 border-t border-line pt-4 lg:grid-cols-2">
          <ActionForm action={renamePipeline} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={pipeline.id} />
            <label className="flex min-w-0 flex-[1_1_200px] flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-muted">Rename {pipeline.name}</span>
              <input name="name" defaultValue={pipeline.name} required maxLength={60} className="field" />
            </label>
            <SubmitButton variant="ghost" pendingText="Saving…">Save</SubmitButton>
          </ActionForm>
          <ActionForm action={deletePipeline} className="flex items-end justify-end">
            <input type="hidden" name="id" value={pipeline.id} />
            <ConfirmSubmit message={`Delete the ${pipeline.name} pipeline? Only possible when it has no deals.`} className="text-[13px] font-semibold text-bad hover:underline">
              Delete this pipeline
            </ConfirmSubmit>
          </ActionForm>
        </div>
      )}
      {manager && <NewPipelineForm />}
    </section>
    <section className="card p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="text-[16px] font-semibold">Stages in {pipeline.name}</h2>
        <p className="text-[13.5px] text-muted">Rename, reorder or remove the stages of your {pipeline.name.toLowerCase()} pipeline.</p>
        <CopyId label="Pipeline ID" id={pipeline.id} className="mt-2" />
      </div>
      <ol className="flex flex-col gap-2">
        {pipeline.stages.map((s, i) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-2 pl-3">
            <span className="w-6 text-[13px] font-semibold tabular-nums text-faint">{i + 1}</span>
            <ActionForm action={renameStage} className="flex min-w-0 flex-[1_1_200px] items-center gap-2">
              <input type="hidden" name="id" value={s.id} />
              <input name="name" defaultValue={s.name} required aria-label={`Stage ${i + 1} name`} className="field h-10 min-h-0" />
              <SubmitButton variant="ghost" pendingText="…" className="min-h-10 px-3">Save</SubmitButton>
            </ActionForm>
            <CopyId label="Stage ID" id={s.id} className="hidden xl:inline-flex" />
            <div className="flex items-center">
              <ActionForm action={reorderStage}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="dir" value="up" />
                <input type="hidden" name="pipeline_id" value={pipeline.id} />
                <IconSubmit icon="arrowUp" label="Move up" className={`text-muted hover:bg-surface hover:text-navy ${i === 0 ? "invisible" : ""}`} />
              </ActionForm>
              <ActionForm action={reorderStage}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="dir" value="down" />
                <input type="hidden" name="pipeline_id" value={pipeline.id} />
                <IconSubmit icon="arrowDown" label="Move down" className={`text-muted hover:bg-surface hover:text-navy ${i === pipeline.stages.length - 1 ? "invisible" : ""}`} />
              </ActionForm>
              <ActionForm action={deleteStage} className="flex items-center gap-2">
                <input type="hidden" name="id" value={s.id} />
                <IconSubmit icon="trash" label="Delete stage" className="text-faint hover:bg-bad-bg hover:text-bad" />
              </ActionForm>
            </div>
          </li>
        ))}
      </ol>
      <ActionForm action={addStage} resetOnOk className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
        <input type="hidden" name="pipeline_id" value={pipeline.id} />
        <input name="name" required placeholder="New stage name" className="field min-w-0 flex-[1_1_220px]" />
        <SubmitButton icon="plus" pendingText="Adding…">Add stage</SubmitButton>
      </ActionForm>
    </section>
    </div>
  );
}
