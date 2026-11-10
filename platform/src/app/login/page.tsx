import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Log in to your Scalency OS workspace.">
      <LoginForm />
    </AuthShell>
  );
}
