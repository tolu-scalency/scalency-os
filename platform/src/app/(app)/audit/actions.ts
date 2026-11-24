"use server";

import { refresh } from "next/cache";
import { can, getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export async function saveAudit(input: { business: string; website: string; answers: Record<string, unknown>; report: Record<string, unknown>; monthly: number }): Promise<{ error?: string; ok?: string; id?: string }> {
  const ws = await getWorkspace();
  if (!can(ws, "ai.manage") && !can(ws, "marketing.manage")) return { error: "You don't have access to save audits." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audits")
    .insert({ account_id: ws.account.id, business_name: String(input.business || "Audit").slice(0, 200), website: String(input.website || "").slice(0, 300) || null, answers: input.answers, report: input.report, monthly_total: Math.max(0, Number(input.monthly) || 0) })
    .select("id")
    .single();
  if (error) return { error: "We couldn't save it. Check the database update (SQL-16) has been run." };
  refresh();
  return { ok: "Saved", id: data.id as string };
}

export async function deleteAudit(id: string): Promise<{ error?: string; ok?: string }> {
  const ws = await getWorkspace();
  if (!can(ws, "ai.manage") && !can(ws, "marketing.manage")) return { error: "You don't have access." };
  const supabase = await createClient();
  const { error } = await supabase.from("audits").delete().eq("id", id).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't delete it." };
  refresh();
  return { ok: "Deleted" };
}
