import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/server";
import { WelcomeForm } from "./welcome-form";

export const metadata: Metadata = { title: "Set up your workspace" };

export default function WelcomePage() {
  return (
    <main className="dots min-h-screen bg-surface px-4 py-10">
      <div className="mx-auto flex max-w-[640px] flex-col gap-6">
        <div className="inline-flex">
          <Logo height={28} />
        </div>
        <Suspense fallback={<div className="card h-[520px]" />}>
          <Welcome />
        </Suspense>
      </div>
    </main>
  );
}

async function Welcome() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/welcome");

  // Already set up? Go straight in.
  const { data: account } = await supabase.from("accounts").select("id").limit(1).maybeSingle();
  if (account) redirect("/dashboard");

  const name = typeof auth.user.user_metadata?.full_name === "string" ? auth.user.user_metadata.full_name : "";
  return <WelcomeForm defaultName={name} email={auth.user.email ?? ""} />;
}
