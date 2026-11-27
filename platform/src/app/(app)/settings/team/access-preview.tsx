"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { ALL_PERMISSIONS, PERMISSIONS } from "@/lib/permissions";

export type RoleOption = { value: string; label: string; description?: string | null; permissions: string[] };

const GROUPS = Array.from(new Set(PERMISSIONS.map((p) => p.group)));

/**
 * A pop-up showing what someone can do, area by area. With `onSave`, every
 * line is a tick box, so their access can be set exactly.
 */
export function AccessPreview({
  role,
  onClose,
  value,
  onSave,
  saving,
  title,
}: {
  role: RoleOption;
  onClose: () => void;
  value?: string[];
  onSave?: (permissions: string[]) => void;
  saving?: boolean;
  title?: string;
}) {
  const editable = Boolean(onSave) && role.value !== "admin";
  const [picked, setPicked] = useState<string[]>(value ?? role.permissions);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const changed = editable && [...picked].sort().join() !== [...role.permissions].sort().join();
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const toggleGroup = (g: string, on: boolean) => {
    const keys = PERMISSIONS.filter((p) => p.group === g).map((p) => p.key as string);
    setPicked((p) => (on ? Array.from(new Set([...p, ...keys])) : p.filter((x) => !keys.includes(x))));
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title ?? `What ${role.label} can do`}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" />
      <div className="rise relative flex max-h-[90vh] w-full max-w-[640px] flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-xl">
        <div className="flex items-start gap-3 border-b border-line p-5">
          <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-chip text-brand">
            <Icon name="shield" size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold">{title ?? role.label}</h2>
            <p className="text-[13px] text-muted">
              {editable
                ? `Starting from ${role.label}. Tick or untick anything to give this person exactly the access they need.`
                : role.description || `Can do ${role.permissions.length} of ${ALL_PERMISSIONS.length} things.`}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="grid flex-1 gap-3 overflow-y-auto p-5 sm:grid-cols-2">
          {GROUPS.map((g) => {
            const items = PERMISSIONS.filter((p) => p.group === g);
            const all = items.every((p) => picked.includes(p.key));
            return (
              <fieldset key={g} className="rounded-xl border border-line p-3">
                <legend className="flex w-full items-center justify-between px-1 text-[11.5px] font-semibold uppercase tracking-wide text-muted">
                  {g}
                </legend>
                {editable && (
                  <label className="mb-2 flex cursor-pointer items-center gap-2 border-b border-line pb-2 text-[12.5px] font-semibold text-navy">
                    <input type="checkbox" checked={all} onChange={(e) => toggleGroup(g, e.target.checked)} className="h-4 w-4 accent-[#0a5fe3]" />
                    All of {g.toLowerCase()}
                  </label>
                )}
                <ul className="flex flex-col gap-1.5">
                  {items.map((p) => {
                    const yes = (editable ? picked : role.permissions).includes(p.key);
                    const soon = "soon" in p && p.soon;
                    return (
                      <li key={p.key}>
                        {editable ? (
                          <label className="flex cursor-pointer items-start gap-2 text-[13px]">
                            <input type="checkbox" checked={yes} onChange={() => toggle(p.key)} className="mt-0.5 h-4 w-4 flex-none accent-[#0a5fe3]" />
                            <span>
                              {p.label}
                              {soon && <span className="ml-1 text-[10.5px] text-muted">(soon)</span>}
                            </span>
                          </label>
                        ) : (
                          <span className={`flex items-start gap-2 text-[13px] ${yes ? "text-navy" : "text-faint"}`}>
                            <span className={`mt-0.5 inline-flex h-4 w-4 flex-none items-center justify-center rounded-full ${yes ? "bg-ok-bg text-ok" : "bg-surface text-faint"}`}>
                              <Icon name={yes ? "check" : "x"} size={10} />
                            </span>
                            <span>
                              {p.label}
                              {soon && <span className="ml-1 text-[10.5px] text-muted">(soon)</span>}
                            </span>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line p-4">
          {editable && changed ? (
            <button type="button" onClick={() => setPicked(role.permissions)} className="text-[13px] font-semibold text-brand hover:underline">
              Reset to {role.label}
            </button>
          ) : (
            <Link href="/settings/roles" className="text-[13px] font-semibold text-brand hover:underline">
              Change what roles can do
            </Link>
          )}
          {editable ? (
            <button type="button" disabled={saving} onClick={() => onSave?.(picked)} className="btn-primary inline-flex min-h-10 items-center rounded-xl px-5 text-[13.5px] font-semibold disabled:opacity-70">
              {saving ? "Saving…" : changed ? "Use this access" : "Done"}
            </button>
          ) : (
            <button type="button" onClick={onClose} className="btn-primary inline-flex min-h-10 items-center rounded-xl px-5 text-[13.5px] font-semibold">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** The access dropdown in the invite form. Picking a role opens the tick boxes, so access can be fine-tuned. */
export function InviteAccessPicker({ options, defaultValue }: { options: RoleOption[]; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const [show, setShow] = useState(false);
  const [custom, setCustom] = useState<string[] | null>(null);
  const role = options.find((o) => o.value === value) ?? options[0];
  return (
    <>
      <select
        name="access"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setCustom(null);
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
      {custom && <input type="hidden" name="permissions" value={JSON.stringify(custom)} />}
      <button type="button" onClick={() => setShow(true)} className="btn-ghost inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold">
        <Icon name="shield" size={14} /> {custom ? "Custom access" : "Choose access"}
      </button>
      {show && role && (
        <AccessPreview
          role={role}
          value={custom ?? undefined}
          title={role.value === "admin" ? role.label : "Choose their access"}
          onClose={() => setShow(false)}
          onSave={(p) => {
            const same = [...p].sort().join() === [...role.permissions].sort().join();
            setCustom(same ? null : p);
            setShow(false);
          }}
        />
      )}
    </>
  );
}
