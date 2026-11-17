"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { ALL_PERMISSIONS, PERMISSIONS } from "@/lib/permissions";

export type RoleOption = { value: string; label: string; description?: string | null; permissions: string[] };

const GROUPS = Array.from(new Set(PERMISSIONS.map((p) => p.group)));

/** A pop-up listing exactly what a role can and can't do, area by area. */
export function AccessPreview({ role, onClose }: { role: RoleOption; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const count = role.permissions.length;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={`What ${role.label} can do`}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" />
      <div className="rise relative flex max-h-[88vh] w-full max-w-[560px] flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-start gap-3 border-b border-line p-5">
          <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-chip text-brand">
            <Icon name="shield" size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold">{role.label}</h2>
            <p className="text-[13px] text-muted">{role.description || `Can do ${count} of ${ALL_PERMISSIONS.length} things.`}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="grid flex-1 gap-3 overflow-y-auto p-5 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <div key={g} className="rounded-xl border border-line p-3">
              <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted">{g}</div>
              <ul className="flex flex-col gap-1.5">
                {PERMISSIONS.filter((p) => p.group === g).map((p) => {
                  const yes = role.permissions.includes(p.key);
                  return (
                    <li key={p.key} className={`flex items-start gap-2 text-[13px] ${yes ? "text-navy" : "text-faint"}`}>
                      <span className={`mt-0.5 inline-flex h-4 w-4 flex-none items-center justify-center rounded-full ${yes ? "bg-ok-bg text-ok" : "bg-surface text-faint"}`}>
                        <Icon name={yes ? "check" : "x"} size={10} />
                      </span>
                      <span>
                        {p.label}
                        {"soon" in p && p.soon && <span className="ml-1 text-[10.5px] text-muted">(soon)</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line p-4">
          <Link href="/settings/roles" className="text-[13px] font-semibold text-brand hover:underline">
            Change what roles can do
          </Link>
          <button type="button" onClick={onClose} className="btn-primary inline-flex min-h-10 items-center rounded-xl px-5 text-[13.5px] font-semibold">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/** The access dropdown in the invite form. Picking a role shows what it can do. */
export function InviteAccessPicker({ options, defaultValue }: { options: RoleOption[]; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const [show, setShow] = useState(false);
  const role = options.find((o) => o.value === value) ?? options[0];
  return (
    <>
      <select
        name="access"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setShow(true);
        }}
        aria-label="Access"
        className="field w-auto flex-[0_1_200px]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => setShow(true)} className="btn-ghost inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold">
        <Icon name="shield" size={14} /> What can they do?
      </button>
      {show && role && <AccessPreview role={role} onClose={() => setShow(false)} />}
    </>
  );
}
