import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Page, PageHeader } from "@/components/ui";
import { EmptyState, Loading } from "@/components/states";
import { TaskList } from "@/components/task-list";
import { contactOptions, getWorkspace, listTasks } from "@/lib/data";
import { addTask } from "./actions";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage(props: PageProps<"/tasks">) {
  return (
    <Page>
      <Suspense fallback={<Loading rows={5} />}>
        <Tasks searchParams={props.searchParams} />
      </Suspense>
    </Page>
  );
}

async function Tasks({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const show = (await searchParams).show === "done" ? "done" : "open";
  const ws = await getWorkspace();
  const [tasks, contacts] = await Promise.all([listTasks(ws.account.id, show), contactOptions(ws.account.id)]);

  return (
    <>
      <PageHeader title="Tasks" subtitle="Follow-ups and to-dos for you and your team." />

      <ActionForm action={addTask} resetOnOk className="card flex flex-wrap items-end gap-3 p-4">
        <label className="flex min-w-0 flex-[2_1_240px] flex-col gap-1.5">
          <span className="text-[13px] font-medium">New task</span>
          <input name="title" required placeholder="Call Sam about the proposal" className="field" />
        </label>
        <label className="flex flex-[1_1_150px] flex-col gap-1.5">
          <span className="text-[13px] font-medium">Due</span>
          <input name="due_on" type="date" className="field" />
        </label>
        <label className="flex flex-[1_1_180px] flex-col gap-1.5">
          <span className="text-[13px] font-medium">Contact</span>
          <select name="contact_id" defaultValue="" className="field">
            <option value="">None</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <SubmitButton icon="plus" pendingText="Adding…">Add task</SubmitButton>
      </ActionForm>

      <div className="flex gap-1 rounded-xl bg-[#eaeff6] p-1 text-[13.5px] font-medium sm:w-fit">
        {(["open", "done"] as const).map((s) => (
          <Link
            key={s}
            href={s === "open" ? "/tasks" : "/tasks?show=done"}
            className={`flex-1 whitespace-nowrap rounded-lg px-4 py-1.5 text-center transition-colors ${show === s ? "bg-white text-navy shadow-sm" : "text-muted hover:text-navy"}`}
          >
            {s === "open" ? "To do" : "Done"}
          </Link>
        ))}
      </div>

      {tasks.length === 0 ? (
        <EmptyState icon="tasks" title={show === "open" ? "Nothing to do" : "No finished tasks yet"}>
          {show === "open" ? "Add a task above. Link it to a contact to see it on their record too." : "Tick a task off and it moves here."}
        </EmptyState>
      ) : (
        <div className="card px-5 py-2">
          <TaskList tasks={tasks} />
        </div>
      )}
    </>
  );
}
