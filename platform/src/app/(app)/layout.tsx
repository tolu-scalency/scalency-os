import type { Metadata } from "next";
import { AppShell } from "@/components/shell/app-shell";
import { getWorkspace, initialsOf, leadsThisWeek, myPendingInvites } from "@/lib/data";

// Signed-in screens are private, so keep them out of search engines.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Every signed-in screen shares the sidebar and top bar. The page is built on the server
// with its data before it's shown, so screens arrive complete rather than as empty outlines.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ws = await getWorkspace();
  const [leads, invites] = await Promise.all([leadsThisWeek(ws.account.id), myPendingInvites()]);
  const name = ws.fullName ?? ws.firstName;
  return (
    <AppShell
      user={{
        name,
        email: ws.userEmail,
        initials: initialsOf(name),
        workspace: ws.account.name,
        workspaceId: ws.account.id,
        role: ws.account.role,
        leadsThisWeek: leads,
        workspaces: ws.workspaces,
        invites,
      }}
    >
      {children}
    </AppShell>
  );
}
