"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/data";
import { text, type ActionResult } from "@/lib/forms";

/** Adds a task, optionally due on a date and linked to a contact. */
export async function addTask(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const title = text(fd, "title", 200);
  const due = text(fd, "due_on", 10);
  const contactId = text(fd, "contact_id", 40);
  if (!title) return { error: "Give the task a title." };
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return { error: "Pick a valid date." };
  const ws = await getWorkspace();
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    account_id: ws.account.id,
    title,
    due_on: due || null,
    contact_id: contactId || null,
    created_by: ws.userId,
    assigned_to: ws.userId,
  });
  if (error) return { error: "We couldn't add the task." };
  refresh();
  return { ok: "Task added." };
}

/** Ticks a task off, or reopens it. */
export async function toggleTask(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = text(fd, "id", 40);
  const done = text(fd, "done", 5) === "1";
  const ws = await getWorkspace();
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ done_at: done ? new Date().toISOString() : null }).eq("id", id).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't update the task." };
  refresh();
  return {};
}

/** Deletes a task. */
export async function deleteTask(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = text(fd, "id", 40);
  const ws = await getWorkspace();
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't delete the task." };
  refresh();
  return {};
}
