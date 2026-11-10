import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Page, PageHeader } from "@/components/ui";
import { formatPence, getPipelineBoard, getWorkspace } from "@/lib/data";
import { addStage } from "./actions";
import { Board } from "./board";
import { PipelineSetup } from "./setup";

export const metadata: Metadata = { title: "Pipeline" };

export default function PipelinePage() {
  return (
    <Page wide>
        <PipelineView />
    </Page>
  );
}

async function PipelineView() {
  const ws = await getWorkspace();
  const board = await getPipelineBoard(ws.account.id);

  if (!board) return <PipelineSetup />;

  return (
    <>
      <PageHeader
        title={board.pipeline.name}
        subtitle={`${board.openCount} open ${board.openCount === 1 ? "deal" : "deals"} · ${formatPence(board.totalPence)} in play`}
        actions={
          <>
            <Link href="/settings/pipeline" className="btn-ghost inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-[13.5px] font-semibold">
              <Icon name="settings" size={15} /> Edit stages
            </Link>
            <Link href="/contacts?new=1" className="btn-primary inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-[13.5px] font-semibold">
              <Icon name="plus" size={15} /> New contact
            </Link>
          </>
        }
      />
      <Board key={board.columns.map((c) => c.id + c.name).join("|")} columns={board.columns}>
        <ActionForm action={addStage} resetOnOk className="flex w-[280px] flex-none flex-col gap-2 rounded-2xl border border-dashed border-line-strong p-3">
          <input name="name" placeholder="New stage name" required className="field bg-white" />
          <SubmitButton variant="ghost" icon="plus" pendingText="Adding…">Add stage</SubmitButton>
        </ActionForm>
      </Board>
    </>
  );
}
