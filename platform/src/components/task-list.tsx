import Link from "next/link";
import { ActionForm, IconSubmit } from "@/components/action-form";
import { Pill } from "@/components/ui";
import { deleteTask, toggleTask } from "@/app/(app)/tasks/actions";
import { dueLabel, type TaskRow } from "@/lib/data";

/** A list of tasks with a tick box to complete each one. */
export function TaskList({ tasks, compact = false, showContact = true }: { tasks: TaskRow[]; compact?: boolean; showContact?: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {tasks.map((t) => {
        const due = dueLabel(t.dueOn);
        const done = Boolean(t.doneAt);
        return (
          <li key={t.id} className="group flex items-center gap-3 py-2.5">
            <ActionForm action={toggleTask}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="done" value={done ? "0" : "1"} />
              <button
                type="submit"
                aria-label={done ? "Mark as not done" : "Mark as done"}
                className={`inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 transition-colors ${
                  done ? "border-ok bg-ok text-white" : "border-line-strong text-transparent hover:border-sky hover:text-sky"
                }`}
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </button>
            </ActionForm>
            <div className="min-w-0 flex-1">
              <div className={`truncate text-[14px] ${done ? "text-faint line-through" : "font-medium"}`}>{t.title}</div>
              {showContact && t.contactId && t.contactName && (
                <Link href={`/contacts/${t.contactId}`} className="text-[12.5px] text-muted hover:text-brand">
                  {t.contactName}
                </Link>
              )}
            </div>
            {due && !done && <Pill tone={due.tone}>{due.text}</Pill>}
            {!compact && (
              <ActionForm action={deleteTask}>
                <input type="hidden" name="id" value={t.id} />
                <IconSubmit icon="trash" label="Delete task" className="text-faint opacity-0 hover:bg-bad-bg hover:text-bad group-hover:opacity-100 focus:opacity-100" />
              </ActionForm>
            )}
          </li>
        );
      })}
    </ul>
  );
}
