import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { Icon } from "@/components/icon";
import { getWorkspace, initialsOf, myPendingInvites, WORKSPACE_COOKIE, workspaceCards } from "@/lib/data";
import { acceptInvite } from "@/app/(app)/workspace-actions";
import { NewWorkspaceCard, WorkspaceGrid } from "./workspace-grid";

export const metadata: Metadata = { title: "Your workspaces", robots: { index: false } };

function greeting() {
  const h = Number(new Date().toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/**
 * The page above every workspace: shown after logging in when someone belongs
 * to more than one, and any time from "All workspaces" in the workspace menu.
 */
export default async function WorkspacesPage({ searchParams }: { searchParams: Promise<{ stay?: string }> }) {
  const { stay } = await searchParams;
  const ws = await getWorkspace();
  const invites = await myPendingInvites();
  if (ws.workspaces.length === 1 && invites.length === 0 && !stay) redirect("/dashboard");

  const cards = await workspaceCards(ws.workspaces);
  const jar = await cookies();
  const lastUsed = jar.get(WORKSPACE_COOKIE)?.value ?? ws.account.id;
  const canCreate = ws.workspaces.some((w) => w.role === "owner" || w.role === "admin");
  const name = ws.fullName ?? ws.firstName;
  const totals = cards.reduce((t, c) => ({ contacts: t.contacts + c.contacts, deals: t.deals + c.openDeals, leads: t.leads + c.newLeads }), { contacts: 0, deals: 0, leads: 0 });

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sidebar-blue relative overflow-hidden text-white">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-40 h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(85,227,236,0.35),transparent)]" />
        <div className="relative mx-auto flex max-w-[1180px] items-center justify-between px-5 py-5 sm:px-8">
          <Logo variant="white" height={24} />
          <div className="flex items-center gap-3">
            <span className="hidden text-right text-[13px] sm:block">
              <span className="block font-semibold">{name}</span>
              <span className="block text-white/70">{ws.userEmail}</span>
            </span>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-[13px] font-semibold ring-1 ring-white/25">{initialsOf(name)}</span>
            <form action="/auth/signout" method="post">
              <button type="submit" title="Sign out" aria-label="Sign out" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white">
                <Icon name="logout" size={17} />
              </button>
            </form>
          </div>
        </div>
        <div className="relative mx-auto max-w-[1180px] px-5 pb-20 pt-6 sm:px-8 sm:pt-10">
          <p className="text-[14px] text-white/75">{greeting()}, {ws.firstName}</p>
          <h1 className="page-in mt-1 text-[32px] font-semibold tracking-[-0.03em] sm:text-[40px]">Where are we working today?</h1>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {[
              { label: "Workspaces", value: cards.length },
              { label: "Contacts in total", value: totals.contacts },
              { label: "Open deals", value: totals.deals },
              { label: "New leads this week", value: totals.leads },
            ].map((s) => (
              <span key={s.label} className="rounded-2xl bg-white/10 px-4 py-2.5 ring-1 ring-white/15 backdrop-blur">
                <span className="block font-mono text-[20px] font-semibold tabular-nums">{s.value.toLocaleString("en-GB")}</span>
                <span className="block text-[12px] text-white/70">{s.label}</span>
              </span>
            ))}
          </div>
        </div>
      </header>

      <main className="relative mx-auto -mt-12 flex max-w-[1180px] flex-col gap-6 px-5 pb-16 sm:px-8">
        {invites.length > 0 && (
          <section className="card flex flex-col gap-3 p-5">
            <h2 className="text-[15px] font-semibold">Waiting for you</h2>
            <ul className="flex flex-col gap-2">
              {invites.map((i) => (
                <li key={i.id}>
                  <form action={acceptInvite} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface p-3">
                    <input type="hidden" name="id" value={i.id} />
                    <Icon name="mail" size={16} className="text-brand" />
                    <span className="min-w-0 flex-1 text-[14px]">
                      You&apos;re invited to <strong>{i.workspace}</strong>
                    </span>
                    <button type="submit" className="btn-primary inline-flex min-h-9 items-center rounded-lg px-4 text-[13px] font-semibold">
                      Join
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        <WorkspaceGrid cards={cards} lastUsed={lastUsed}>
          {canCreate && <NewWorkspaceCard />}
        </WorkspaceGrid>
      </main>
    </div>
  );
}
