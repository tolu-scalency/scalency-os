import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Log in to your Scalency OS workspace.">
      <Suspense fallback={<div className="h-[260px]" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
