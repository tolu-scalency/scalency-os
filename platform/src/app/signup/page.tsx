import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create your account" };

export default function SignupPage() {
  return (
    <AuthShell title="Create your account" subtitle="Set up your Scalency OS workspace in a few minutes.">
      <SignupForm />
    </AuthShell>
  );
}
