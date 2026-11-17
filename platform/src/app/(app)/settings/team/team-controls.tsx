"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { inviteLink, setMemberAccess, setMemberPermissions } from "../actions";
import { AccessPreview, type RoleOption } from "./access-preview";


type Option = RoleOption;

/** Changes someone's access as soon as a new option is picked. */
export function AccessSelect({ userId, value, options, name, own }: { userId: string; value: string; options: Option[]; name: string; own: string[] | null }) {
  const [current, setCurrent] = useState(value);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const [show, setShow] = useState(false);
  const [mine, setMine] = useState<string[] | null>(own);
  const [saving, startSave] = useTransition();
  const role = options.find((o) => o.value === current);
  return (
    <span className="inline-flex items-center gap-2">
      {show && role && (
        <AccessPreview
          role={role}
          value={mine ?? undefined}
          title={`${name}'s access`}
          saving={saving}
          onClose={() => setShow(false)}
          onSave={(p) =>
            startSave(async () => {
              const same = [...p].sort().join() === [...role.permissions].sort().join();
              if (same && !mine) return setShow(false);
              const res = same
                ? await (() => {
                    const fd = new FormData();
                    fd.set("user_id", userId);
                    fd.set("access", role.value);
                    return setMemberAccess({}, fd);
                  })()
                : await setMemberPermissions(userId, role.value === "admin" ? null : role.value, p);
              if (res.error) setMsg(res.error);
              else {
                setMine(same ? null : p);
                setMsg("Saved");
                setShow(false);
              }
            })
          }
        />
      )}
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
            } else {
              setMine(null);
              setMsg("Saved");
              setShow(true);
            }
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
      <button type="button" onClick={() => setShow(true)} aria-label={`What ${role?.label ?? "this role"} can do`} title="What can they do?" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-brand">
        <Icon name="shield" size={15} />
      </button>
      {mine && <span className="rounded-full bg-chip px-2 py-0.5 text-[11px] font-semibold text-brand">Custom</span>}
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
