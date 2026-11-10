"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/data";
import { text, type ActionResult } from "@/lib/forms";

/** Posts a message in a channel and returns it, so it shows straight away. */
export async function postMessage(channelId: string, body: string) {
  const trimmed = body.trim().slice(0, 4000);
  if (!trimmed) return { error: "Write a message first." };
  const ws = await getWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ account_id: ws.account.id, channel_id: channelId, author_id: ws.userId, body: trimmed })
    .select("id, created_at")
    .single();
  if (error || !data) return { error: "We couldn't send that." };
  return { id: data.id as number, createdAt: data.created_at as string };
}

/** Creates a channel like #sales. */
export async function createChannel(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const name = text(fd, "name", 40).toLowerCase().replace(/^#/, "").replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!name) return { error: "Name the channel." };
  const ws = await getWorkspace();
  const supabase = await createClient();
  const { error } = await supabase.from("chat_channels").insert({ account_id: ws.account.id, name, created_by: ws.userId });
  if (error) return { error: error.code === "23505" ? "That channel already exists." : "We couldn't create it." };
  refresh();
  return { ok: `#${name} created.` };
}
