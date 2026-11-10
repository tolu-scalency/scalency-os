import { Suspense } from "react";
import { Page, PageHeader } from "@/components/ui";
import { SettingsTabs } from "./tabs";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Page>
      <PageHeader title="Settings" />
      <Suspense fallback={<div className="h-10" />}>
        <SettingsTabs />
      </Suspense>
      {children}
    </Page>
  );
}
