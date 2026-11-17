"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminClient } from "@/lib/admin";
import { WORKSPACE_COOKIE } from "@/lib/data";
import { text, type ActionResult } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const TOKEN = /^[a-f0-9]{32,80}$/;

async function joinAndGo(token: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invite_token", { invite_token: token });
  if (error || !data) return error?.message ?? "We couldn't accept the invite.";
  const jar = await cookies();
  jar.set(WORKSPACE_COOKIE, data as string, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 365 });
  redirect("/dashboard");
}

/** Signed in with the invited email: join the workspace and open it. */
export async function acceptInvite(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const token = text(fd, "token", 100);
  if (!TOKEN.test(token)) return { error: "This invite link isn't valid." };
  const problem = await joinAndGo(token);
  return { error: problem ?? undefined };
}

/** New to Scalency: create the login with a password, join, and open the workspace. */
export async function createAccountAndJoin(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const token = text(fd, "token", 100);
  const fullName = text(fd, "full_name", 120);
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (!TOKEN.test(token)) return { error: "This invite link isn't valid." };
  if (fullName.length < 2) return { error: "Add your name." };
  if (password.length < 8) return { error: "Use at least 8 characters for your password." };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const supabase = await createClient();
  const { data: rows } = await supabase.rpc("invite_details", { invite_token: token });
  const invite = (rows as { email: string; status: string; has_login: boolean }[] | null)?.[0];
  if (!invite) return { error: "This invite link isn't valid." };
  if (invite.status !== "open") return { error: invite.status === "expired" ? "This invite has expired. Ask for a new one." : "This invite has already been used." };
  if (invite.has_login) return { error: "You already have a login. Use Log in instead." };

  const admin = adminClient();
  if (!admin) return { error: "Sign-ups aren't set up yet. Ask the workspace owner." };
  // The invite link went to this inbox, which proves the email address, so it's confirmed straight away.
  const { error: createError } = await admin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError) {
    if (/password/i.test(createError.message)) return { error: "Choose a stronger password: mix letters, numbers and symbols." };
    return { error: /already/i.test(createError.message) ? "You already have a login. Use Log in instead." : "We couldn't create your login. Please try again." };
  }

  const { data: signedIn, error: signInError } = await supabase.auth.signInWithPassword({ email: invite.email, password });
  if (signInError || !signedIn.user) return { error: "Your login was created. Log in with your email and password to join." };
  await supabase.from("profiles").upsert({ user_id: signedIn.user.id, full_name: fullName, email: invite.email });

  const problem = await joinAndGo(token);
  return { error: problem ?? undefined };
}

/** Signed in as someone else: sign out and come back to the invite. */
export async function switchAccountForInvite(fd: FormData) {
  const token = text(fd, "token", 100);
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(TOKEN.test(token) ? `/invite/${token}` : "/login");
}
