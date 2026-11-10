"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WORKSPACE_COOKIE, getWorkspace } from "@/lib/data";
import { text, type ActionResult } from "@/lib/forms";

async function remember(accountId: string) {
  const jar = await cookies();
  jar.set(WORKSPACE_COOKIE, accountId, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 365 });
}

/** Switches to another workspace the person belongs to. */
export async function switchWorkspace(fd: FormData) {
  const id = text(fd, "id", 40);
  const ws = await getWorkspace();
  if (ws.workspaces.some((w) => w.id === id)) await remember(id);
  redirect("/dashboard");
}

/** Creates another workspace (a sub-account) and switches to it. */
export async function createWorkspace(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const name = text(fd, "name", 80);
  if (name.length < 2) return { error: "Name it with at least 2 characters." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_workspace", { workspace_name: name });
  if (error || !data) return { error: error?.message.includes("25 workspaces") ? "You can own up to 25 workspaces." : "We couldn't create the workspace." };
  await remember(data as string);
  redirect("/dashboard");
}

/** Accepts an invitation and opens that workspace. */
export async function acceptInvite(fd: FormData) {
  const id = text(fd, "id", 40);
  const supabase = await createClient();
  const { data } = await supabase.rpc("accept_invite", { target_invite: id });
  if (data) await remember(data as string);
  redirect("/dashboard");
}
