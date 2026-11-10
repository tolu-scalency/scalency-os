import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { getProfile, getWorkspace } from "@/lib/data";
import { updateProfile, updateWorkspace } from "./actions";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
      <General />
  );
}

function Section({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="card grid gap-5 p-5 sm:p-6 md:grid-cols-[260px_1fr]">
      <div>
        <h2 className="text-[16px] font-semibold">{title}</h2>
        <p className="mt-1 text-[13.5px] text-muted">{text}</p>
      </div>
      {children}
    </section>
  );
}

async function General() {
  const ws = await getWorkspace();
  const profile = await getProfile(ws.userId);
  const manager = ws.account.role === "owner" || ws.account.role === "admin";

  return (
    <div className="flex flex-col gap-4">
      <Section title="Your profile" text="How you appear to your team.">
        <ActionForm action={updateProfile} className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Full name</span>
            <input name="full_name" required defaultValue={profile.fullName} className="field" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Role</span>
            <input name="job_title" defaultValue={profile.jobTitle} placeholder="Founder" className="field" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Mobile</span>
            <input name="phone" type="tel" defaultValue={profile.phone} placeholder="07700 900123" className="field" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Email</span>
            <input value={ws.userEmail} disabled className="field bg-surface text-muted" />
          </label>
          <div className="flex justify-end sm:col-span-2">
            <SubmitButton>Save profile</SubmitButton>
          </div>
        </ActionForm>
      </Section>

      <Section title="Workspace" text={manager ? "Your business name and safety settings." : "Only the owner or an admin can change these."}>
        <ActionForm action={updateWorkspace} className="flex flex-col gap-4">
          <fieldset disabled={!manager} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">Workspace name</span>
              <input name="name" required defaultValue={ws.account.name} className="field" />
            </label>
            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-line p-4">
              <span>
                <span className="block text-[14px] font-semibold">Test mode</span>
                <span className="block text-[13px] text-muted">
                  When automated texts and emails arrive, they&apos;ll only go to you until this is off.
                </span>
              </span>
              <span className="relative mt-0.5 inline-flex flex-none">
                <input type="checkbox" name="test_mode" defaultChecked={ws.account.testMode} className="peer sr-only" />
                <span className="h-6 w-11 rounded-full bg-line-strong transition-colors peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-sky" />
                <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
              </span>
            </label>
          </fieldset>
          {manager && (
            <div className="flex justify-end">
              <SubmitButton>Save workspace</SubmitButton>
            </div>
          )}
        </ActionForm>
      </Section>
    </div>
  );
}
