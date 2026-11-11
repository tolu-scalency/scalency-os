import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { getProfile, getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { providersReady } from "@/lib/deliver";
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
  const supabase = await createClient();
  const { data: acc } = await supabase.from("accounts").select("test_email, test_phone").eq("id", ws.account.id).single();
  const ready = providersReady();
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

      <Section title="Email and texts" text="Sending is set up once for the whole platform.">
        <ul className="flex flex-col gap-2">
          {[
            { name: "Email (Resend)", on: ready.email },
            { name: "Texts (Twilio)", on: ready.sms },
          ].map((p) => (
            <li key={p.name} className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-[14px]">
              <span className="font-medium">{p.name}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${p.on ? "bg-ok-bg text-ok" : "bg-surface text-muted"}`}>{p.on ? "Connected" : "Not connected"}</span>
            </li>
          ))}
        </ul>
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
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium">Test email</span>
                <input name="test_email" type="email" defaultValue={acc?.test_email ?? ""} placeholder="you@company.co.uk" className="field" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium">Test mobile</span>
                <input name="test_phone" type="tel" defaultValue={acc?.test_phone ?? ""} placeholder="07700 900123" className="field" />
              </label>
            </div>
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
