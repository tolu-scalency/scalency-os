"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { inviteLink, setMemberAccess } from "../actions";

type Option = { value: string; label: string };

/** Changes someone's access as soon as a new option is picked. */
export function AccessSelect({ userId, value, options, name }: { userId: string; value: string; options: Option[]; name: string }) {
  const [current, setCurrent] = useState(value);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <select
        value={current}
        disabled={pending}
        aria-label={`Access for ${name}`}
        onChange={(e) => {
          const next = e.target.value;
          const before = current;
          setCurrent(next);
          setMsg("");
          start(async () => {
            const fd = new FormData();
            fd.set("user_id", userId);
            fd.set("access", next);
            const res = await setMemberAccess({}, fd);
            if (res.error) {
              setCurrent(before);
              setMsg(res.error);
            } else setMsg("Saved");
          });
        }}
        className="field h-9 w-auto min-w-[150px] py-0 text-[13px]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {msg && <span className={`text-[12px] ${msg === "Saved" ? "text-ok" : "text-bad"}`}>{msg}</span>}
    </span>
  );
}

/** Copies the invite link so it can be sent on WhatsApp or anywhere else. */
export function CopyInviteLink({ id }: { id: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await inviteLink(id);
          if (!res.url) return setState("error");
          try {
            await navigator.clipboard.writeText(res.url);
            setState("copied");
          } catch {
            window.prompt("Copy this invite link:", res.url);
          }
          setTimeout(() => setState("idle"), 2500);
        })
      }
      className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold"
    >
      <Icon name={state === "copied" ? "check" : "link"} size={13} />
      {state === "copied" ? "Copied" : state === "error" ? "Try again" : "Copy link"}
    </button>
  );
}
