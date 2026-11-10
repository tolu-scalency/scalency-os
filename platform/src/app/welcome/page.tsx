import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/server";
import { WelcomeForm } from "./welcome-form";

export const metadata: Metadata = { title: "Set up your workspace", robots: { index: false } };

export default function WelcomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-canvas px-4 py-8 sm:py-12">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-[radial-gradient(closest-side,rgba(85,227,236,0.35),transparent)]" />
      <div className="pointer-events-none absolute -bottom-48 -right-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(10,95,227,0.18),transparent)]" />
      <div className="relative mx-auto flex max-w-[620px] flex-col gap-8">
        <div className="flex justify-center">
          <Logo height={30} />
        </div>
        <Suspense fallback={<div className="skeleton h-[560px] rounded-3xl" />}>
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
  const metaName = typeof auth.user.user_metadata?.full_name === "string" ? auth.user.user_metadata.full_name.trim() : "";

  // Invited by a team? Join them straight away.
  const { data: joined } = await supabase.rpc("accept_my_invites");
  if (joined) {
    const { data: existing } = await supabase.from("profiles").select("user_id").eq("user_id", auth.user.id).maybeSingle();
    if (!existing) {
      await supabase.from("profiles").insert({ user_id: auth.user.id, full_name: metaName || (auth.user.email ?? "Teammate").split("@")[0], email: auth.user.email });
    }
    redirect("/dashboard");
  }

  // Already set up? Go straight in.
  const { data: membership } = await supabase.from("account_members").select("account_id").eq("user_id", auth.user.id).limit(1).maybeSingle();
  if (membership) redirect("/dashboard");

  return <WelcomeForm defaultName={metaName} email={auth.user.email ?? ""} />;
}
