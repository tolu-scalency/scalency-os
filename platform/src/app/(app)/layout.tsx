import type { Metadata } from "next";
import { AppShell } from "@/components/shell/app-shell";
import { getWorkspace, initialsOf, leadsThisWeek, myPendingInvites } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

// Signed-in screens are private, so keep them out of search engines. The browser tab
// carries the workspace's own business name; Scalency is only the platform's name.
export async function generateMetadata(): Promise<Metadata> {
  const ws = await getWorkspace();
  const name = ws.account.name.trim() || "Your workspace";
  return { title: { default: name, template: `%s · ${name}` }, applicationName: name, robots: { index: false, follow: false } };
}

// Every signed-in screen shares the sidebar and top bar. The page is built on the server
// with its data before it's shown, so screens arrive complete rather than as empty outlines.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ws = await getWorkspace();
  const [leads, invites, test] = await Promise.all([leadsThisWeek(ws.account.id), myPendingInvites(), testInbox(ws.account.id, ws.account.testMode)]);
  const name = ws.fullName ?? ws.firstName;
  return (
    <AppShell
      user={{
        name,
        email: ws.userEmail,
        initials: initialsOf(name),
        workspace: ws.account.name,
        workspaceId: ws.account.id,
        role: ws.account.roleName,
        leadsThisWeek: leads,
        workspaces: ws.workspaces,
        invites,
        canCreateWorkspace: ws.workspaces.some((w) => w.role === "owner" || w.role === "admin"),
        permissions: ws.account.permissions,
        testMode: test,
      }}
    >
      {children}
    </AppShell>
  );
}

/** Where lead messages go while the workspace is in test mode. */
async function testInbox(accountId: string, on: boolean) {
  if (!on) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("accounts").select("test_email, test_phone").eq("id", accountId).maybeSingle();
  return { email: (data?.test_email as string | null) ?? null, phone: (data?.test_phone as string | null) ?? null };
}
