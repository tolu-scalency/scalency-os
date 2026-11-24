"use server";

import { refresh } from "next/cache";
import { can, getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

/** Saves a month's ad spend for one lead source (replaces what was there). */
export async function saveSpend(month: string, source: string, amount: number): Promise<{ error?: string; ok?: string }> {
  const ws = await getWorkspace();
  if (!can(ws, "marketing.manage") && !can(ws, "reporting.view")) return { error: "You don't have access to add ad spend." };
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Choose a month." };
  const src = String(source ?? "").trim().slice(0, 80);
  if (!src) return { error: "Choose the lead source (as GHL names it, for example Facebook)." };
  if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000) return { error: "Enter the amount spent." };
  const supabase = await createClient();
  const { error } = await supabase.from("ad_spend").upsert({ account_id: ws.account.id, month: `${month}-01`, source: src, amount: Math.round(amount * 100) / 100 }, { onConflict: "account_id,month,source" });
  if (error) return { error: "We couldn't save that. Check the database update (SQL-15) has been run." };
  refresh();
  return { ok: "Saved" };
}

export async function deleteSpend(id: string): Promise<{ error?: string; ok?: string }> {
  const ws = await getWorkspace();
  if (!can(ws, "marketing.manage") && !can(ws, "reporting.view")) return { error: "You don't have access." };
  const supabase = await createClient();
  const { error } = await supabase.from("ad_spend").delete().eq("id", id).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't delete that." };
  refresh();
  return { ok: "Deleted" };
}
