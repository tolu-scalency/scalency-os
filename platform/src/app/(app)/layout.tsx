import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

// Every signed-in screen shares the blue sidebar and the top bar.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-wrap bg-white">
      <div className="flex-[1_1_256px] lg:max-w-[256px]">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-[999_1_640px] flex-col">
        <Topbar />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
