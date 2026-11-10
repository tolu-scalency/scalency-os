import type { Metadata } from "next";
import { ActionForm, IconSubmit, SubmitButton } from "@/components/action-form";
import { Avatar, Pill } from "@/components/ui";
import { getTeam, getWorkspace, initialsOf, timeAgo } from "@/lib/data";
import { cancelInvite, inviteMember, removeMember } from "../actions";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return (
      <Team />
  );
}

async function Team() {
  const ws = await getWorkspace();
  const team = await getTeam(ws.account.id, ws.userId);
  const manager = ws.account.role === "owner" || ws.account.role === "admin";
  const owner = ws.account.role === "owner";

  return (
    <div className="flex flex-col gap-4">
      {manager && (
        <section className="card p-5 sm:p-6">
          <h2 className="text-[16px] font-semibold">Invite someone</h2>
          <p className="mt-1 text-[13.5px] text-muted">They join {ws.account.name} as soon as they sign up or log in with this email.</p>
          <ActionForm action={inviteMember} resetOnOk className="mt-4 flex flex-wrap gap-2">
            <input name="email" type="email" required placeholder="colleague@company.com" className="field min-w-0 flex-[2_1_240px]" />
            <select name="role" defaultValue="member" aria-label="Role" className="field w-auto flex-[0_1_140px]">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <SubmitButton icon="plus" pendingText="Inviting…">Invite</SubmitButton>
          </ActionForm>
        </section>
      )}

      <section className="card p-5 sm:p-6">
        <h2 className="mb-2 text-[16px] font-semibold">Members</h2>
        <ul className="divide-y divide-line">
          {team.members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar initials={initialsOf(m.name)} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">
                  {m.name} {m.isYou && <span className="font-normal text-muted">(you)</span>}
                </div>
                <div className="truncate text-[12.5px] text-muted">{m.email ?? "No profile yet"}</div>
              </div>
              <Pill tone={m.role === "owner" ? "blue" : "neutral"}>
                <span className="capitalize">{m.role}</span>
              </Pill>
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
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium">{i.email}</div>
                  <div className="text-[12.5px] text-muted">Invited {timeAgo(i.createdAt).toLowerCase()} · <span className="capitalize">{i.role}</span></div>
                </div>
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
