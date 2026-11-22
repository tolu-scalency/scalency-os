"use client";

import { useTransition } from "react";
import { Icon } from "@/components/icon";
import { notify } from "@/components/toast";
import { ask } from "@/components/confirm";
import type { ThreadState } from "@/lib/setter";
import { setThread } from "../agents/actions";

/** Hand a lead back to the AI, or stop the AI messaging them. */
export function SetterThreadButtons({ id, state }: { id: string; state: ThreadState }) {
  const [pending, start] = useTransition();
  const run = (to: "active" | "stopped") =>
    start(async () => {
      const r = await setThread(id, to);
      notify(r.error ?? r.ok ?? "Done", r.error ? "bad" : "ok");
    });
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {(state === "paused" || state === "handed_over" || state === "finished") && (
        <button type="button" disabled={pending} onClick={() => run("active")} className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold">
          <Icon name="refresh" size={13} /> Hand back to the AI
        </button>
      )}
      {state === "active" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => void ask({ title: "Stop the AI for this lead?", text: "It won't message them again. You can hand them back later.", confirm: "Stop" }).then((ok) => ok && run("stopped"))}
          className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-semibold text-bad"
        >
          <Icon name="x" size={13} /> Stop the AI for this lead
        </button>
      )}
    </div>
  );
}
