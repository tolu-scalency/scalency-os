import { Suspense } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

// Every signed-in screen shares the blue sidebar and the top bar.
// Both read the current address, so they sit behind <Suspense> for pages with ids in the address (e.g. a contact).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-wrap bg-white">
      <div className="flex-[1_1_256px] lg:max-w-[256px]">
        <Suspense fallback={<div className="sidebar-blue min-h-screen" />}>
          <Sidebar />
        </Suspense>
      </div>
      <div className="flex min-w-0 flex-[999_1_640px] flex-col">
        <Suspense fallback={<div className="min-h-[68px] border-b border-line" />}>
          <Topbar />
        </Suspense>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
