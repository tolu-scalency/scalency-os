"use server";

import { cleanOptions, isFieldType, OPTION_TYPES } from "@/lib/field-types";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getPipeline, getWorkspace } from "@/lib/data";
import { EMAIL, PHONE_HELP, normalisePhone, text, type ActionResult } from "@/lib/forms";
import { cleanPermissions, NO_ACCESS, type Permission } from "@/lib/permissions";

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

type Ws = Awaited<ReturnType<typeof getWorkspace>>;
function canManage(ws: Ws, perm: Permission = "settings.manage") {
  return ws.account.permissions.includes(perm);
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
  if (!canManage(ws)) return { error: NO_ACCESS };
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
  const access = text(fd, "access", 60);
  if (!EMAIL.test(email)) return { error: "Enter a valid email address." };
  const ws = await getWorkspace();
  if (!canManage(ws, "team.manage")) return { error: NO_ACCESS };
  if (email === ws.userEmail.toLowerCase()) return { error: "That's you." };
  const role = access === "admin" ? "admin" : "member";
  const roleId = role === "member" && /^[0-9a-f-]{36}$/i.test(access) ? access : null;
  const supabase = await createClient();
  const { data: invite, error } = await supabase
    .from("account_invites")
    .insert({ account_id: ws.account.id, email, role, role_id: roleId, invited_by: ws.userId })
    .select("token")
    .single();
  if (error || !invite) return { error: error?.code === "23505" ? "That email is already invited. Use Send again below." : "We couldn't save the invite." };
  const accessName = role === "admin" ? "Admin" : roleId ? ((await supabase.from("account_roles").select("name").eq("id", roleId).maybeSingle()).data?.name ?? "Team member") : "Team member";
  const sent = await sendInviteEmail(email, invite.token as string, ws.account.name, ws.fullName ?? ws.userEmail, accessName);
  refresh();
  return sent.ok ? { ok: `Invite sent to ${email}.` } : { ok: `Invite saved, but the email couldn't be sent (${sent.reason}). Copy the invite link below and send it to them yourself.` };
}

/** Sends the invite email again and gives it another 7 days. The link stays the same. */
export async function resendInvite(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = text(fd, "id", 40);
  const ws = await getWorkspace();
  if (!canManage(ws, "team.manage")) return { error: NO_ACCESS };
  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("refresh_invite", { target_invite: id });
  if (error || !token) return { error: "That invite no longer exists." };
  const { data: invite } = await supabase.from("account_invites").select("email, role, account_roles(name)").eq("id", id).maybeSingle();
  if (!invite) return { error: "That invite no longer exists." };
  const accessName = invite.role === "admin" ? "Admin" : ((invite.account_roles as unknown as { name: string } | null)?.name ?? "Team member");
  const sent = await sendInviteEmail(invite.email as string, token as string, ws.account.name, ws.fullName ?? ws.userEmail, accessName);
  refresh();
  return sent.ok ? { ok: "Sent again." } : { error: `The email couldn't be sent (${sent.reason}).` };
}

/** The invite link for an invite, so it can be copied and sent another way. */
export async function inviteLink(id: string): Promise<{ url?: string; error?: string }> {
  const ws = await getWorkspace();
  if (!canManage(ws, "team.manage")) return { error: NO_ACCESS };
  const supabase = await createClient();
  const { data } = await supabase.from("account_invites").select("token").eq("id", id).eq("account_id", ws.account.id).maybeSingle();
  if (!data) return { error: "That invite no longer exists." };
  return { url: `${await siteOrigin()}/invite/${data.token}` };
}

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "os.scalency.us";
  return `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
}

/** Every invite goes out through Resend with a link to /invite/<token>. New people choose a password there; people with a login just log in. */
async function sendInviteEmail(email: string, token: string, workspace: string, inviter: string, access: string): Promise<{ ok: boolean; reason?: string }> {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return { ok: false, reason: "email sending isn't connected" };
  const url = `${await siteOrigin()}/invite/${token}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: `${workspace} <${process.env.EMAIL_FROM}>`,
      to: [email],
      subject: `${inviter} invited you to join ${workspace}`,
      text: `${inviter} has invited you to join ${workspace} as ${access}.\n\nAccept the invite: ${url}\n\nThe link works for 7 days.`,
      html: inviteHtml({ workspace, inviter, access, url }),
    }),
  }).catch(() => null);
  return res?.ok ? { ok: true } : { ok: false, reason: "Resend refused it" };
}

function inviteHtml({ workspace, inviter, access, url }: { workspace: string; inviter: string; access: string; url: string }) {
  const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  return `<!doctype html><html lang="en-GB"><body style="margin:0;padding:0;background:#F3F6FB;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#0B1B3A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F6FB;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:20px;">
<tr><td style="padding:36px 32px 8px;"><img src="https://os.scalency.us/brand/wordmark.png" width="140" alt="Scalency" style="display:block;width:140px;height:auto;border:0;"></td></tr>
<tr><td style="padding:16px 32px 0;"><h1 style="margin:0 0 12px;font-size:22px;line-height:30px;">Join ${esc(workspace)}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:26px;color:#3D5170;">${esc(inviter)} has invited you to join <strong>${esc(workspace)}</strong> as <strong>${esc(access)}</strong>.</p></td></tr>
<tr><td style="padding:0 32px;"><a href="${esc(url)}" style="display:inline-block;padding:15px 32px;font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:12px;background:#0B63E5;">Accept invite</a></td></tr>
<tr><td style="padding:24px 32px 36px;"><p style="margin:0;font-size:13px;line-height:20px;color:#6B7C93;">New here? You'll choose a password. Already have a login? You'll just sign in. The link works for 7 days.</p></td></tr>
</table>
<p style="margin:16px 0 0;font-size:12px;color:#6B7C93;">Sent by Scalency OS for ${esc(workspace)}.</p>
</td></tr></table></body></html>`;
}

/** Changes someone's access: Admin, or one of the workspace's roles. */
export async function setMemberAccess(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const userId = text(fd, "user_id", 40);
  const access = text(fd, "access", 60);
  const ws = await getWorkspace();
  if (!canManage(ws, "team.manage")) return { error: NO_ACCESS };
  const role = access === "admin" ? "admin" : "member";
  const roleId = role === "member" && /^[0-9a-f-]{36}$/i.test(access) ? access : null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_access", { target_account: ws.account.id, member: userId, new_role: role, new_role_id: roleId });
  if (error) return { error: error.message.includes("owner") ? "The owner's access can't be changed." : "We couldn't change their access." };
  refresh();
  return { ok: "Access updated." };
}

/** Creates or updates a role and its permissions. */
export async function saveRole(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = text(fd, "id", 40);
  const name = text(fd, "name", 40);
  const description = text(fd, "description", 200) || null;
  const permissions = cleanPermissions(fd.getAll("permissions").map(String));
  if (!name) return { error: "Give the role a name." };
  if (/^(owner|admin)$/i.test(name)) return { error: "Owner and Admin are built in. Choose another name." };
  const ws = await getWorkspace();
  if (!canManage(ws, "team.manage")) return { error: NO_ACCESS };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("account_roles").update({ name, description, permissions }).eq("id", id).eq("account_id", ws.account.id)
    : await supabase.from("account_roles").insert({ account_id: ws.account.id, name, description, permissions });
  if (error) return { error: error.code === "23505" ? "There's already a role with that name." : "We couldn't save the role." };
  refresh();
  return { ok: id ? "Role saved." : "Role added." };
}

/** Deletes a role. People with it go back to the default member access. */
export async function deleteRole(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = text(fd, "id", 40);
  const ws = await getWorkspace();
  if (!canManage(ws, "team.manage")) return { error: NO_ACCESS };
  const supabase = await createClient();
  const { count } = await supabase.from("account_members").select("user_id", { count: "exact", head: true }).eq("account_id", ws.account.id).eq("role_id", id);
  if (count) return { error: `${count} ${count === 1 ? "person has" : "people have"} this role. Give them another role first.` };
  const { error } = await supabase.from("account_roles").delete().eq("id", id).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't delete the role." };
  refresh();
  return {};
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
  const typeRaw = text(fd, "type", 20) || "text";
  if (!isFieldType(typeRaw)) return { error: "Choose a field type." };
  const options = OPTION_TYPES.includes(typeRaw) ? cleanOptions(String(fd.get("options") ?? "")) : [];
  if (OPTION_TYPES.includes(typeRaw) && options.length < 2) return { error: "Add at least two options, one per line." };
  const ws = await getWorkspace();
  if (!canManage(ws)) return { error: NO_ACCESS };
  const supabase = await createClient();
  const { count } = await supabase.from("custom_fields").select("id", { count: "exact", head: true }).eq("account_id", ws.account.id).eq("object", "contact");
  const { error } = await supabase.from("custom_fields").insert({ account_id: ws.account.id, object: "contact", key, label, type: typeRaw, options, position: count ?? 0 });
  if (error) return { error: error.code === "23505" ? "You already have a field with that name." : "We couldn't add the field." };
  refresh();
  return { ok: `Added. Use {{contact.${key}}} in messages.` };
}

/** Renames a field, or changes its dropdown options. The key (used in messages) stays the same. */
export async function updateCustomField(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = text(fd, "id", 40);
  const label = text(fd, "label", 60);
  if (!label) return { error: "Give the field a name." };
  const ws = await getWorkspace();
  if (!canManage(ws)) return { error: NO_ACCESS };
  const supabase = await createClient();
  const { data: field } = await supabase.from("custom_fields").select("type").eq("id", id).eq("account_id", ws.account.id).maybeSingle();
  if (!field) return { error: "That field no longer exists." };
  const patch: Record<string, unknown> = { label, updated_at: new Date().toISOString() };
  if ((OPTION_TYPES as string[]).includes(field.type)) {
    const options = cleanOptions(String(fd.get("options") ?? ""));
    if (options.length < 2) return { error: "Keep at least two options, one per line." };
    patch.options = options;
  }
  const { error } = await supabase.from("custom_fields").update(patch).eq("id", id).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't save the field." };
  refresh();
  return { ok: "Saved." };
}

export async function deleteCustomField(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = text(fd, "id", 40);
  const ws = await getWorkspace();
  if (!canManage(ws)) return { error: NO_ACCESS };
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
  if (!canManage(ws)) return { error: NO_ACCESS };
  const supabase = await createClient();
  const { error } = await supabase.from("custom_values").upsert({ account_id: ws.account.id, key, value, updated_at: new Date().toISOString() }, { onConflict: "account_id,key" });
  if (error) return { error: "We couldn't save it." };
  refresh();
  return { ok: `Saved. Use {{custom_values.${key}}} in messages.` };
}

export async function deleteCustomValue(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const key = text(fd, "key", 40);
  const ws = await getWorkspace();
  if (!canManage(ws)) return { error: NO_ACCESS };
  const supabase = await createClient();
  await supabase.from("custom_values").delete().eq("key", key).eq("account_id", ws.account.id);
  refresh();
  return {};
}
