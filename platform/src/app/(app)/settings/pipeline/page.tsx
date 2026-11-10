import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, IconSubmit, SubmitButton } from "@/components/action-form";
import { getPipeline, getWorkspace } from "@/lib/data";
import { addStage } from "../../pipeline/actions";
import { deleteStage, renameStage, reorderStage } from "../actions";

export const metadata: Metadata = { title: "Pipeline settings" };

export default function PipelineSettingsPage() {
  return (
      <Stages />
  );
}

async function Stages() {
  const ws = await getWorkspace();
  const pipeline = await getPipeline(ws.account.id);

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
    <section className="card p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="text-[16px] font-semibold">Stages</h2>
        <p className="text-[13.5px] text-muted">Rename, reorder or remove the stages of your {pipeline.name.toLowerCase()} pipeline.</p>
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
            <div className="flex items-center">
              <ActionForm action={reorderStage}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="dir" value="up" />
                <IconSubmit icon="arrowUp" label="Move up" className={`text-muted hover:bg-surface hover:text-navy ${i === 0 ? "invisible" : ""}`} />
              </ActionForm>
              <ActionForm action={reorderStage}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="dir" value="down" />
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
        <input name="name" required placeholder="New stage name" className="field min-w-0 flex-[1_1_220px]" />
        <SubmitButton icon="plus" pendingText="Adding…">Add stage</SubmitButton>
      </ActionForm>
    </section>
  );
}
