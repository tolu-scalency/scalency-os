import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, IconSubmit, SubmitButton } from "@/components/action-form";
import { Avatar, Pill } from "@/components/ui";
import { can, getTeam, getWorkspace, initialsOf, listRoles, timeAgo } from "@/lib/data";
import { cancelInvite, inviteMember, removeMember, resendInvite } from "../actions";
import { AccessSelect, CopyInviteLink } from "./team-controls";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const ws = await getWorkspace();
  const [team, roles] = await Promise.all([getTeam(ws.account.id, ws.userId), listRoles(ws.account.id)]);
  const manager = can(ws, "team.manage");
  const owner = ws.account.role === "owner";
  const options = [{ value: "admin", label: "Admin (full access)" }, ...roles.map((r) => ({ value: r.id, label: r.name }))];
  const defaultRole = roles.find((r) => r.name === "Team member")?.id ?? roles[0]?.id ?? "admin";

  return (
    <div className="flex flex-col gap-4">
      {manager && (
        <section className="card p-5 sm:p-6">
          <h2 className="text-[16px] font-semibold">Invite someone</h2>
          <p className="mt-1 text-[13.5px] text-muted">
            They get an email with a link. New people choose a password, people with a login just sign in, and both land straight in {ws.account.name}. Choose what they can do with{" "}
            <Link href="/settings/roles" className="font-semibold text-brand hover:underline">
              roles
            </Link>
            .
          </p>
          <ActionForm action={inviteMember} resetOnOk className="mt-4 flex flex-wrap gap-2">
            <input name="email" type="email" required placeholder="colleague@company.com" aria-label="Email" className="field min-w-0 flex-[2_1_240px]" />
            <select name="access" defaultValue={defaultRole} aria-label="Access" className="field w-auto flex-[0_1_200px]">
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <SubmitButton icon="plus" pendingText="Inviting…">
              Invite
            </SubmitButton>
          </ActionForm>
        </section>
      )}

      <section className="card p-5 sm:p-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[16px] font-semibold">Members</h2>
          <Link href="/settings/roles" className="text-[13px] font-semibold text-brand hover:underline">
            Roles and access
          </Link>
        </div>
        <ul className="divide-y divide-line">
          {team.members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar initials={initialsOf(m.name)} size={36} />
              <div className="min-w-0 flex-[1_1_180px]">
                <div className="truncate text-[14px] font-semibold">
                  {m.name} {m.isYou && <span className="font-normal text-muted">(you)</span>}
                </div>
                <div className="truncate text-[12.5px] text-muted">{m.email ?? "No profile yet"}</div>
              </div>
              {manager && m.role !== "owner" && !m.isYou ? (
                <AccessSelect userId={m.userId} name={m.name} value={m.role === "admin" ? "admin" : (m.roleId ?? defaultRole)} options={options} />
              ) : (
                <Pill tone={m.role === "owner" ? "blue" : "neutral"}>{m.access}</Pill>
              )}
              {owner && !m.isYou && (
                <ActionForm action={removeMember}>
                  <input type="hidden" name="user_id" value={m.userId} />
                  <IconSubmit icon="trash" label={`Remove ${m.name}`} className="text-faint hover:bg-bad-bg hover:text-bad" />
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      </section>

      {team.invites.length > 0 && (
        <section className="card p-5 sm:p-6">
          <h2 className="mb-2 text-[16px] font-semibold">Waiting to join</h2>
          <ul className="divide-y divide-line">
            {team.invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-line-strong text-[12px] font-semibold text-faint">?</span>
                <div className="min-w-0 flex-[1_1_170px]">
                  <div className="truncate text-[14px] font-medium">{i.email}</div>
                  <div className="text-[12.5px] text-muted">
                    Invited {timeAgo(i.createdAt).toLowerCase()} · {i.access}
                    {i.expired && <span className="text-bad"> · Expired, send again</span>}
                  </div>
                </div>
                {manager && <CopyInviteLink id={i.id} />}
                {manager && (
                  <ActionForm action={resendInvite} className="flex flex-wrap items-center justify-end gap-2">
                    <input type="hidden" name="id" value={i.id} />
                    <SubmitButton variant="ghost" icon="send" pendingText="Sending…">
                      Send again
                    </SubmitButton>
                  </ActionForm>
                )}
                {manager && (
                  <ActionForm action={cancelInvite}>
                    <input type="hidden" name="id" value={i.id} />
                    <IconSubmit icon="x" label="Cancel invite" className="text-faint hover:bg-surface hover:text-navy" />
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
