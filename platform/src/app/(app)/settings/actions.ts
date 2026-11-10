"use server";

import { refresh } from "next/cache";
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
  if (name.length < 2) return { error: "The workspace name needs at least 2 characters." };
  const ws = await getWorkspace();
  if (!canManage(ws.account.role)) return { error: "Only the owner or an admin can change workspace settings." };
  const supabase = await createClient();
  const { error } = await supabase.from("accounts").update({ name, test_mode: testMode }).eq("id", ws.account.id);
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
  refresh();
  return { ok: `Invite saved. Ask ${email} to sign up at os.scalency.us with this email.` };
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
