import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Icon } from "@/components/icon";
import { Page, PageHeader } from "@/components/ui";
import { can, dealFilterOptions, formatPence, getPipelineBoard, getWorkspace, listAllStages, listContacts, listPipelines, memberNames, type DealFilters } from "@/lib/data";
import { addStage } from "./actions";
import { PipelineView } from "./pipeline-view";
import { PipelineSetup } from "./setup";

export const metadata: Metadata = { title: "Opportunities" };

type Search = DealFilters & { p?: string; view?: string };

export default async function PipelinePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const ws = await getWorkspace();
  const board = await getPipelineBoard(ws.account.id, sp.p, sp);
  if (!board)
    return (
      <Page wide>
        <PipelineSetup />
      </Page>
    );

  const [pipelines, stages, names, options, contacts] = await Promise.all([
    listPipelines(ws.account.id),
    listAllStages(ws.account.id),
    memberNames(ws.account.id),
    dealFilterOptions(ws.account.id),
    listContacts(ws.account.id, "", 500),
  ]);
  const people = Object.entries(names).map(([id, name]) => ({ id, name }));
  const label = board.status === "open" ? "open" : board.status === "all" ? "" : board.status;

  return (
    <Page wide>
      <PageHeader
        eyebrow="Opportunities"
        title={board.pipeline.name}
        subtitle={`${board.openCount} ${label} ${board.openCount === 1 ? "deal" : "deals"} · ${formatPence(board.totalPence)}`.replace("  ", " ")}
        actions={
          <Link href={`/settings/pipeline?p=${board.pipeline.id}`} className="btn-ghost inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-[13.5px] font-semibold">
            <Icon name="settings" size={15} /> Pipelines and stages
          </Link>
        }
      />
      <Suspense>
        <PipelineView
          pipelines={pipelines}
          pipelineId={board.pipeline.id}
          columns={board.columns}
          cards={board.cards}
          view={sp.view === "list" ? "list" : "board"}
          stages={stages}
          people={people}
          sources={options.sources}
          tags={options.tags}
          contacts={contacts.map((c) => ({ id: c.id, name: c.email && c.name !== c.email ? `${c.name} (${c.email})` : c.name }))}
          canEdit={can(ws, "deals.edit")}
        >
          {can(ws, "pipeline.manage") && (
            <ActionForm action={addStage} resetOnOk className="flex w-[calc(100vw-64px)] max-w-[320px] flex-none snap-start flex-col gap-2 rounded-xl border border-dashed border-line-strong p-3 sm:w-[280px]">
              <input type="hidden" name="pipeline_id" value={board.pipeline.id} />
              <input name="name" placeholder="New stage name" required className="field bg-white" />
              <SubmitButton variant="ghost" icon="plus" pendingText="Adding…">
                Add stage
              </SubmitButton>
            </ActionForm>
          )}
        </PipelineView>
      </Suspense>
    </Page>
  );
}
