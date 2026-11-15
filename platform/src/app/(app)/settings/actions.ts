"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { adminClient } from "@/lib/admin";
import { emailHtml } from "@/lib/deliver";
import { createClient } from "@/lib/supabase/server";
import { getPipeline, getWorkspace } from "@/lib/data";
import { EMAIL, PHONE_HELP, normalisePhone, text, type ActionResult } from "@/lib/forms";

/** Saves the signed-in person's name, role and mobile. */
export async function updateProfile(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const fullName = text(fd, "full_name", 120);
  const jobTitle = text(fd, "job_title", 80);
  const phone = normalisePhone(text(fd, "phone", 30));
  if (!fullName) return { error: "Add your name." };
  if (phone === "invalid") return { error: PHONE_HELP };
  const ws = await getWorkspace();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").upsert({ user_id: ws.userId, full_name: fullName, job_title: jobTitle || null, phone, email: ws.userEmail });
  if (error) return { error: "We couldn't save your profile." };
  refresh();
  return { ok: "Profile saved." };
}

function canManage(role: string) {
  return role === "owner" || role === "admin";
}

/** Renames the workspace and switches test mode on or off. Owners and admins only. */
export async function updateWorkspace(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const name = text(fd, "name", 80);
  const testMode = fd.get("test_mode") === "on";
  const testEmail = text(fd, "test_email", 200).toLowerCase() || null;
  const testPhone = normalisePhone(text(fd, "test_phone", 30));
  if (name.length < 2) return { error: "The workspace name needs at least 2 characters." };
  if (testEmail && !EMAIL.test(testEmail)) return { error: "The test email doesn't look right." };
  if (testPhone === "invalid") return { error: PHONE_HELP };
  const timezone = text(fd, "timezone", 60) || "Europe/London";
  const from = text(fd, "sms_window_start", 5);
  const until = text(fd, "sms_window_end", 5);
  const timeOk = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  if (!timeOk(from) || !timeOk(until) || from >= until) return { error: "Texting hours need a start time before the end time." };
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone });
  } catch {
    return { error: "Choose a time zone." };
  }
  const ws = await getWorkspace();
  if (!canManage(ws.account.role)) return { error: "Only the owner or an admin can change workspace settings." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("accounts")
    .update({ name, test_mode: testMode, test_email: testEmail, test_phone: testPhone, timezone, sms_window_start: from, sms_window_end: until })
    .eq("id", ws.account.id);
  if (error) return { error: "We couldn't save the workspace." };
  refresh();
  return { ok: "Workspace saved." };
}

/** Renames a stage. */
export async function renameStage(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = text(fd, "id", 40);
  const name = text(fd, "name", 60);
  if (!name) return { error: "Stages need a name." };
  const ws = await getWorkspace();
  const supabase = await createClient();
  const { error } = await supabase.from("pipeline_stages").update({ name }).eq("id", id).eq("account_id", ws.account.id);
  if (error) return { error: error.code === "23505" ? "You already have a stage with that name." : "We couldn't rename the stage." };
  refresh();
  return {};
}

/** Moves a stage one place up or down. */
export async function reorderStage(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = text(fd, "id", 40);
  const dir = text(fd, "dir", 4);
  const ws = await getWorkspace();
  const pipeline = await getPipeline(ws.account.id);
  if (!pipeline) return {};
  const i = pipeline.stages.findIndex((s) => s.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= pipeline.stages.length) return {};
  const a = pipeline.stages[i];
  const b = pipeline.stages[j];
  const supabase = await createClient();
  await Promise.all([
    supabase.from("pipeline_stages").update({ position: b.position }).eq("id", a.id),
    supabase.from("pipeline_stages").update({ position: a.position }).eq("id", b.id),
  ]);
  refresh();
  return {};
}

/** Deletes a stage, if nobody is in it. */
export async function deleteStage(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = text(fd, "id", 40);
  const ws = await getWorkspace();
  const supabase = await createClient();
  const { count } = await supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("stage_id", id);
  if ((count ?? 0) > 0) return { error: `Move the ${count} contact${count === 1 ? "" : "s"} out of this stage first.` };
  const { error } = await supabase.from("pipeline_stages").delete().eq("id", id).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't delete the stage." };
  refresh();
  return {};
}

/** Invites someone by email. They join this workspace when they sign up or log in. */
export async function inviteMember(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const email = text(fd, "email", 200).toLowerCase();
  const role = text(fd, "role", 10) === "admin" ? "admin" : "member";
  if (!EMAIL.test(email)) return { error: "Enter a valid email address." };
  const ws = await getWorkspace();
  if (!canManage(ws.account.role)) return { error: "Only the owner or an admin can invite people." };
  if (email === ws.userEmail.toLowerCase()) return { error: "That's you." };
  const supabase = await createClient();
  const { error } = await supabase.from("account_invites").insert({ account_id: ws.account.id, email, role, invited_by: ws.userId });
  if (error) return { error: error.code === "23505" ? "That email is already invited." : "We couldn't save the invite." };
  const sent = await sendInviteEmail(email, ws.account.name, ws.fullName ?? ws.userEmail);
  refresh();
  return sent.ok ? { ok: `Invite sent to ${email}.` } : { ok: `Invite saved, but the email couldn't be sent (${sent.reason}). Ask ${email} to sign up at os.scalency.us with this email.` };
}

/** Sends the invite email again. */
export async function resendInvite(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = text(fd, "id", 40);
  const ws = await getWorkspace();
  if (!canManage(ws.account.role)) return { error: "Only the owner or an admin can invite people." };
  const supabase = await createClient();
  const { data: invite } = await supabase.from("account_invites").select("email").eq("id", id).eq("account_id", ws.account.id).maybeSingle();
  if (!invite) return { error: "That invite no longer exists." };
  const sent = await sendInviteEmail(invite.email as string, ws.account.name, ws.fullName ?? ws.userEmail);
  return sent.ok ? { ok: "Sent again." } : { error: `The email couldn't be sent (${sent.reason}).` };
}

/**
 * New people get Supabase's invite email (our branded "Invite user" template), which signs them up.
 * People who already have a login get a Scalency email through Resend telling them to open the app and join.
 */
async function sendInviteEmail(email: string, workspace: string, inviter: string): Promise<{ ok: boolean; reason?: string }> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "os.scalency.us";
  const origin = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
  const admin = adminClient();
  if (!admin) return { ok: false, reason: "the server key isn't set" };

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/welcome`,
    data: { invited_to: workspace, invited_by: inviter },
  });
  if (!error) return { ok: true };
  if (!/already|registered|exists/i.test(error.message)) return { ok: false, reason: error.message };

  // They already have a login: email them through Resend instead.
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return { ok: false, reason: "email sending isn't connected" };
  const body = `${inviter} has invited you to join ${workspace} on Scalency OS.\n\nLog in, then open the workspace menu at the top left and click Join.\n\n${origin}/login?next=/dashboard`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: `Scalency <${process.env.EMAIL_FROM}>`,
      to: [email],
      subject: `You've been invited to ${workspace} on Scalency OS`,
      text: body,
      html: emailHtml(body, "Scalency OS", false),
    }),
  }).catch(() => null);
  return res?.ok ? { ok: true } : { ok: false, reason: "Resend refused it" };
}

/** Cancels an invite that hasn't been used yet. */
export async function cancelInvite(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = text(fd, "id", 40);
  const ws = await getWorkspace();
  const supabase = await createClient();
  await supabase.from("account_invites").delete().eq("id", id).eq("account_id", ws.account.id);
  refresh();
  return {};
}

/** Removes someone from the workspace. Owners only. */
export async function removeMember(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const userId = text(fd, "user_id", 40);
  const ws = await getWorkspace();
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_account_member", { target_account: ws.account.id, member: userId });
  if (error) return { error: error.message.includes("Only the workspace owner") ? "Only the owner can remove people." : "We couldn't remove them." };
  refresh();
  return {};
}

function keyFrom(label: string) {
  const k = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "f_$1").slice(0, 40);
  return /^[a-z]/.test(k) ? k : "";
}

/** Adds a contact field, like "Budget" or "Company size". */
export async function addCustomField(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const label = text(fd, "label", 60);
  const key = keyFrom(label);
  if (!label || !key) return { error: "Give the field a name that starts with a letter." };
  const ws = await getWorkspace();
  if (!canManage(ws.account.role)) return { error: "Only the owner or an admin can change fields." };
  const supabase = await createClient();
  const { count } = await supabase.from("custom_fields").select("id", { count: "exact", head: true }).eq("account_id", ws.account.id).eq("object", "contact");
  const { error } = await supabase.from("custom_fields").insert({ account_id: ws.account.id, object: "contact", key, label, type: "text", position: count ?? 0 });
  if (error) return { error: error.code === "23505" ? "You already have a field with that name." : "We couldn't add the field." };
  refresh();
  return { ok: `Added. Use {{contact.${key}}} in messages.` };
}

export async function deleteCustomField(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = text(fd, "id", 40);
  const ws = await getWorkspace();
  if (!canManage(ws.account.role)) return { error: "Only the owner or an admin can change fields." };
  const supabase = await createClient();
  await supabase.from("custom_fields").delete().eq("id", id).eq("account_id", ws.account.id);
  refresh();
  return {};
}

/** Adds or updates a custom value, like a booking link used in many messages. */
export async function saveCustomValue(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const name = text(fd, "name", 60);
  const key = text(fd, "key", 40) || keyFrom(name);
  const value = text(fd, "value", 1000);
  if (!key || !/^[a-z][a-z0-9_]*$/.test(key)) return { error: "Give it a name that starts with a letter." };
  if (!value) return { error: "Add the value." };
  const ws = await getWorkspace();
  if (!canManage(ws.account.role)) return { error: "Only the owner or an admin can change custom values." };
  const supabase = await createClient();
  const { error } = await supabase.from("custom_values").upsert({ account_id: ws.account.id, key, value, updated_at: new Date().toISOString() }, { onConflict: "account_id,key" });
  if (error) return { error: "We couldn't save it." };
  refresh();
  return { ok: `Saved. Use {{custom_values.${key}}} in messages.` };
}

export async function deleteCustomValue(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const key = text(fd, "key", 40);
  const ws = await getWorkspace();
  if (!canManage(ws.account.role)) return { error: "Only the owner or an admin can change custom values." };
  const supabase = await createClient();
  await supabase.from("custom_values").delete().eq("key", key).eq("account_id", ws.account.id);
  refresh();
  return {};
}
