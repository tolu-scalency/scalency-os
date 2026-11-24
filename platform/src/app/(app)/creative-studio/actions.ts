"use server";

import { refresh } from "next/cache";
import { can, getWorkspace } from "@/lib/data";
import { checkCreative } from "@/lib/creative-rules";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string; ok?: string };
const NO = "You don't have access to the Creative studio in this workspace.";
const s = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

export type CreativeInput = { title: string; channel: string; headline: string; body: string; cta: string; image_idea: string; brief?: string };

function clean(i: CreativeInput) {
  const c = { title: s(i.title, 200) || s(i.headline, 200) || "Untitled", channel: s(i.channel, 40) || "Meta ad", headline: s(i.headline, 200), body: s(i.body, 2000), cta: s(i.cta, 80), image_idea: s(i.image_idea, 300), brief: s(i.brief, 1000) || null };
  return { ...c, compliance: checkCreative(`${c.headline} ${c.body} ${c.cta}`) };
}

export async function saveCreative(input: CreativeInput, id?: string): Promise<Result> {
  const ws = await getWorkspace();
  if (!can(ws, "marketing.manage") && !can(ws, "ai.manage")) return { error: NO };
  const supabase = await createClient();
  const row = { ...clean(input), updated_at: new Date().toISOString() };
  const { error } = id
    ? await supabase.from("creatives").update({ ...row, status: "draft" }).eq("id", id).eq("account_id", ws.account.id)
    : await supabase.from("creatives").insert({ ...row, account_id: ws.account.id });
  if (error) return { error: "We couldn't save that. Check the database update (SQL-15) has been run." };
  refresh();
  return { ok: "Saved" };
}

/** Draft → in review → approved or rejected. Approving needs settings access (the founder's sign-off). */
export async function setCreativeStatus(id: string, status: "draft" | "in_review" | "approved" | "rejected", note?: string): Promise<Result> {
  const ws = await getWorkspace();
  if (!can(ws, "marketing.manage") && !can(ws, "ai.manage")) return { error: NO };
  if ((status === "approved" || status === "rejected") && !can(ws, "settings.manage")) return { error: "Only someone with settings access can approve or reject." };
  const supabase = await createClient();
  if (status === "approved") {
    const { data } = await supabase.from("creatives").select("headline, body, cta").eq("id", id).eq("account_id", ws.account.id).maybeSingle();
    if (data && checkCreative(`${data.headline} ${data.body} ${data.cta}`).status === "block") return { error: "This breaks a UK ad rule (see the red flags). Edit it before approving." };
  }
  const { data: me } = await supabase.auth.getUser();
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "approved" || status === "rejected") Object.assign(patch, { reviewed_by: me.user?.id ?? null, reviewed_at: new Date().toISOString(), review_note: s(note, 1000) || null });
  const { error } = await supabase.from("creatives").update(patch).eq("id", id).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't change that." };
  refresh();
  return { ok: status === "in_review" ? "Sent for approval" : status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Moved back to drafts" };
}

export async function deleteCreative(id: string): Promise<Result> {
  const ws = await getWorkspace();
  if (!can(ws, "marketing.manage") && !can(ws, "ai.manage")) return { error: NO };
  const supabase = await createClient();
  const { error } = await supabase.from("creatives").delete().eq("id", id).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't delete that." };
  refresh();
  return { ok: "Deleted" };
}
