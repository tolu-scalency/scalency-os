import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { getWorkspace, initialsOf } from "@/lib/data";

// Signed-in screens are private, so keep them out of search engines.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Every signed-in screen shares the sidebar and top bar. The workspace is loaded once per request.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const ws = await getWorkspace();
  const name = ws.fullName ?? ws.firstName;
  return (
    <AppShell user={{ name, email: ws.userEmail, initials: initialsOf(name), workspace: ws.account.name, role: ws.account.role }}>
      {children}
    </AppShell>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-screen bg-canvas">
      <div className="sidebar-blue hidden h-screen w-[248px] flex-none lg:block" />
      <div className="flex flex-1 flex-col">
        <div className="h-16 border-b border-line bg-white" />
        <div className="flex flex-col gap-4 p-6">
          <div className="skeleton h-9 w-64" />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="skeleton h-28" />
            <div className="skeleton h-28" />
            <div className="skeleton h-28" />
          </div>
          <div className="skeleton h-72" />
        </div>
      </div>
    </div>
  );
}
