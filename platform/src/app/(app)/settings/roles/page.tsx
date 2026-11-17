import type { Metadata } from "next";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/action-form";
import { Icon } from "@/components/icon";
import { Pill } from "@/components/ui";
import { can, getWorkspace, listRoles, type AccessRole } from "@/lib/data";
import { PERMISSIONS } from "@/lib/permissions";
import { deleteRole, saveRole } from "../actions";

export const metadata: Metadata = { title: "Roles and access" };

const GROUPS = Array.from(new Set(PERMISSIONS.map((p) => p.group)));

function PermissionBoxes({ role, disabled }: { role?: AccessRole; disabled: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {GROUPS.map((g) => (
        <fieldset key={g} className="rounded-xl border border-line p-3">
          <legend className="px-1 text-[12px] font-semibold uppercase tracking-wide text-muted">{g}</legend>
          <div className="flex flex-col gap-2">
            {PERMISSIONS.filter((p) => p.group === g).map((p) => (
              <label key={p.key} className="flex cursor-pointer items-start gap-2.5 text-[13.5px]">
                <input type="checkbox" name="permissions" value={p.key} defaultChecked={role?.permissions.includes(p.key)} disabled={disabled} className="mt-0.5 h-4 w-4 flex-none" />
                <span>
                  <span className="font-medium">{p.label}</span>
                  {p.hint && <span className="block text-[12px] text-muted">{p.hint}</span>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export default async function RolesPage() {
  const ws = await getWorkspace();
  const roles = await listRoles(ws.account.id);
  const manager = can(ws, "team.manage");

  return (
    <div className="flex flex-col gap-4">
      <section className="card p-5 sm:p-6">
        <h2 className="text-[16px] font-semibold">Roles and access</h2>
        <p className="mt-1 text-[13.5px] text-muted">
          A role is a set of things someone can do. Pick a role when you invite someone, or change it any time in Members. The <strong>Owner</strong> and <strong>Admins</strong> can always do
          everything. The database enforces these rules, not just the screens.
        </p>
        {!manager && <p className="mt-3 rounded-xl bg-surface p-3 text-[13px] text-muted">You can see the roles, but only people who manage the team can change them.</p>}
      </section>

      {roles.map((r) => (
        <details key={r.id} className="card group p-5 sm:p-6">
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
            <Icon name="shield" size={18} className="text-brand" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">{r.name}</span>
              {r.description && <span className="block text-[12.5px] text-muted">{r.description}</span>}
            </span>
            <Pill tone="neutral">
              {r.permissions.length} of {PERMISSIONS.length} permissions
            </Pill>
            <Icon name="down" size={16} className="text-muted transition-transform group-open:rotate-180" />
          </summary>
          <ActionForm action={saveRole} className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
            <input type="hidden" name="id" value={r.id} />
            <div className="grid gap-2 sm:grid-cols-[220px_1fr]">
              <input name="name" defaultValue={r.name} required maxLength={40} aria-label="Role name" disabled={!manager} className="field" />
              <input name="description" defaultValue={r.description ?? ""} maxLength={200} placeholder="What this role is for" aria-label="Description" disabled={!manager} className="field" />
            </div>
            <PermissionBoxes role={r} disabled={!manager} />
            {manager && (
              <div className="flex justify-end">
                <SubmitButton pendingText="Saving…">Save role</SubmitButton>
              </div>
            )}
          </ActionForm>
          {manager && (
            <ActionForm action={deleteRole} className="mt-2 flex justify-end">
              <input type="hidden" name="id" value={r.id} />
              <ConfirmSubmit message={`Delete the ${r.name} role?`} className="text-[13px] font-semibold text-bad hover:underline">
                Delete role
              </ConfirmSubmit>
            </ActionForm>
          )}
        </details>
      ))}

      {manager && (
        <section className="card p-5 sm:p-6">
          <h2 className="text-[16px] font-semibold">Add a role</h2>
          <ActionForm action={saveRole} resetOnOk className="mt-3 flex flex-col gap-3">
            <div className="grid gap-2 sm:grid-cols-[220px_1fr]">
              <input name="name" required maxLength={40} placeholder="e.g. Account manager" aria-label="Role name" className="field" />
              <input name="description" maxLength={200} placeholder="What this role is for" aria-label="Description" className="field" />
            </div>
            <PermissionBoxes disabled={false} />
            <div className="flex justify-end">
              <SubmitButton icon="plus" pendingText="Adding…">
                Add role
              </SubmitButton>
            </div>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
