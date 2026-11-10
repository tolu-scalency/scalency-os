"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/data";
import { parsePounds, text, type ActionResult } from "@/lib/forms";

/** Moves a contact to a stage. Adds them to the pipeline if they aren't in it yet. */
export async function setStage(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const contactId = text(fd, "contact_id", 40);
  const stageId = text(fd, "stage_id", 40);
  const ws = await getWorkspace();
  const supabase = await createClient();

  const [{ data: stage }, { data: contact }, { data: opp }] = await Promise.all([
    supabase.from("pipeline_stages").select("id, name, pipeline_id").eq("id", stageId).eq("account_id", ws.account.id).maybeSingle(),
    supabase.from("contacts").select("id, first_name, last_name, email").eq("id", contactId).eq("account_id", ws.account.id).maybeSingle(),
    supabase.from("opportunities").select("id, stage_id").eq("contact_id", contactId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!stage || !contact) return { error: "That stage or contact no longer exists." };
  if (opp?.stage_id === stage.id) return {};

  let oppId = opp?.id as string | undefined;
  if (opp) {
    const { error } = await supabase.from("opportunities").update({ stage_id: stage.id, pipeline_id: stage.pipeline_id }).eq("id", opp.id);
    if (error) return { error: "We couldn't move this contact." };
  } else {
    const { data, error } = await supabase
      .from("opportunities")
      .insert({
        account_id: ws.account.id,
        contact_id: contactId,
        pipeline_id: stage.pipeline_id,
        stage_id: stage.id,
        name: [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email || "Contact",
        source: "manual",
      })
      .select("id")
      .single();
    if (error) return { error: "We couldn't add this contact to the pipeline." };
    oppId = data.id;
  }

  await supabase.from("activity").insert({
    account_id: ws.account.id,
    contact_id: contactId,
    opportunity_id: oppId,
    type: "stage.changed",
    summary: `Moved to ${stage.name}`,
  });
  await supabase.rpc("run_due_workflows", { target_account: ws.account.id });
  refresh();
  return {};
}

/** Sets the deal value on a contact's opportunity. */
export async function setValue(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const oppId = text(fd, "opportunity_id", 40);
  const value = parsePounds(text(fd, "value", 20));
  if (value === -1) return { error: "Enter a number, like 1500." };
  const ws = await getWorkspace();
  const supabase = await createClient();
  const { error } = await supabase.from("opportunities").update({ value_pence: value }).eq("id", oppId).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't save the value." };
  refresh();
  return { ok: "Saved." };
}

/** Adds a note to a contact's timeline. */
export async function addNote(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const contactId = text(fd, "contact_id", 40);
  const note = text(fd, "note", 2000);
  if (!note) return { error: "Write something first." };
  const ws = await getWorkspace();
  const supabase = await createClient();
  const { error } = await supabase.from("activity").insert({
    account_id: ws.account.id,
    contact_id: contactId,
    type: "note",
    summary: note,
    detail: { author: ws.fullName ?? ws.userEmail },
  });
  if (error) return { error: "We couldn't save the note." };
  refresh();
  return { ok: "Note added." };
}
