import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/server";
import { CodeForm } from "./code-form";

export const metadata: Metadata = { title: "Check your email" };

function mask(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(6, name.length - 2)))}@${domain}`;
}

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = (data?.claims as { email?: string } | undefined)?.email;
  if (!email) redirect("/login");
  const { next } = await searchParams;
  return (
    <AuthShell title="Check your email" subtitle={<>We sent a 6-digit code to <b>{mask(email)}</b>. Enter it to finish signing in.</>}>
      <CodeForm next={next ?? ""} />
    </AuthShell>
  );
}
