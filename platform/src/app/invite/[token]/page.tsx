import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/server";
import { switchAccountForInvite } from "./actions";
import { CreateAccountForm, JoinButton } from "./forms";

export const metadata: Metadata = { title: "Join a workspace", robots: { index: false } };

type Invite = { email: string; workspace: string; invited_by: string; access: string; status: "open" | "used" | "expired"; has_login: boolean };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const valid = /^[a-f0-9]{32,80}$/.test(token);
  const [{ data: rows }, { data: claims }] = await Promise.all([
    valid ? supabase.rpc("invite_details", { invite_token: token }) : Promise.resolve({ data: null }),
    supabase.auth.getClaims(),
  ]);
  const invite = (rows as Invite[] | null)?.[0];
  const signedInEmail = (claims?.claims?.email as string | undefined)?.toLowerCase() ?? null;
  const loginHref = invite ? `/login?next=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(invite.email)}` : "/login";

  if (!invite)
    return (
      <AuthShell title="This link isn't valid" subtitle="It may have been cancelled. Ask whoever invited you to send a new invite.">
        <Link href="/login" className="btn-ghost flex min-h-[50px] items-center justify-center rounded-xl text-[15px] font-semibold">
          Go to log in
        </Link>
      </AuthShell>
    );

  if (invite.status === "expired")
    return (
      <AuthShell title="This invite has expired" subtitle={`Ask ${invite.invited_by} to send it again from Settings, Members.`}>
        <Link href="/login" className="btn-ghost flex min-h-[50px] items-center justify-center rounded-xl text-[15px] font-semibold">
          Go to log in
        </Link>
      </AuthShell>
    );

  if (invite.status === "used")
    return (
      <AuthShell title="You've already joined" subtitle={`This invite to ${invite.workspace} has been accepted. Log in to open it.`}>
        <Link href={signedInEmail ? "/dashboard" : loginHref} className="btn-primary flex min-h-[50px] items-center justify-center rounded-xl text-[15px] font-semibold">
          {signedInEmail ? "Open dashboard" : "Log in"}
        </Link>
      </AuthShell>
    );

  const subtitle = (
    <>
      {invite.invited_by} invited you to join <strong className="text-navy">{invite.workspace}</strong> as <strong className="text-navy">{invite.access}</strong>.
    </>
  );

  if (signedInEmail && signedInEmail !== invite.email.toLowerCase())
    return (
      <AuthShell title={`Join ${invite.workspace}`} subtitle={subtitle}>
        <p className="rounded-xl bg-surface p-4 text-[14px] text-muted">
          You&apos;re signed in as <strong className="text-navy">{signedInEmail}</strong>, but this invite is for <strong className="text-navy">{invite.email}</strong>.
        </p>
        <form action={switchAccountForInvite}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="btn-primary flex min-h-[50px] w-full items-center justify-center rounded-xl text-[15px] font-semibold">
            Sign out and continue
          </button>
        </form>
      </AuthShell>
    );

  if (signedInEmail)
    return (
      <AuthShell title={`Join ${invite.workspace}`} subtitle={subtitle}>
        <JoinButton token={token} workspace={invite.workspace} />
      </AuthShell>
    );

  if (invite.has_login)
    return (
      <AuthShell title={`Join ${invite.workspace}`} subtitle={subtitle}>
        <p className="text-[14px] text-muted">
          You already have a Scalency login with <strong className="text-navy">{invite.email}</strong>. Log in and you&apos;ll join straight away.
        </p>
        <Link href={loginHref} className="btn-primary flex min-h-[50px] items-center justify-center rounded-xl text-[15px] font-semibold">
          Log in to accept
        </Link>
      </AuthShell>
    );

  return (
    <AuthShell title={`Join ${invite.workspace}`} subtitle={subtitle}>
      <CreateAccountForm token={token} email={invite.email} workspace={invite.workspace} />
    </AuthShell>
  );
}
