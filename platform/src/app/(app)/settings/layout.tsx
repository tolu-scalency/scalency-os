import { Page, PageHeader } from "@/components/ui";
import { SettingsTabs } from "./tabs";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Page>
      <PageHeader title="Settings" />
        <SettingsTabs />
      {children}
    </Page>
  );
}
