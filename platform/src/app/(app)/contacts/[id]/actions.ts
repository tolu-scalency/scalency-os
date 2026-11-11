"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deliverPending } from "@/lib/deliver";
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
  await deliverPending(supabase, ws.account.id);
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

async function runNow(supabase: Awaited<ReturnType<typeof createClient>>, accountId: string) {
  await supabase.rpc("run_due_workflows", { target_account: accountId });
  await deliverPending(supabase, accountId);
}

/** Adds a tag to a contact, creating the tag if it's new. Tag workflows start straight away. */
export async function addTag(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const contactId = text(fd, "contact_id", 40);
  const name = text(fd, "tag", 40);
  if (!name) return { error: "Type a tag." };
  const ws = await getWorkspace();
  const supabase = await createClient();
  const { data: existing } = await supabase.from("tags").select("id, name").eq("account_id", ws.account.id).ilike("name", name.replace(/[%_\\]/g, "\\$&")).maybeSingle();
  let tagId = existing?.id as string | undefined;
  if (!tagId) {
    const { data, error } = await supabase.from("tags").insert({ account_id: ws.account.id, name }).select("id").single();
    if (error || !data) return { error: "We couldn't create that tag." };
    tagId = data.id;
  }
  const { error } = await supabase.from("contact_tags").upsert({ account_id: ws.account.id, contact_id: contactId, tag_id: tagId }, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
  if (error) return { error: "We couldn't add the tag." };
  await runNow(supabase, ws.account.id);
  refresh();
  return { ok: "Tag added." };
}

/** Removes a tag from a contact. */
export async function removeTag(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const contactId = text(fd, "contact_id", 40);
  const tagId = text(fd, "tag_id", 40);
  const ws = await getWorkspace();
  const supabase = await createClient();
  const { error } = await supabase.from("contact_tags").delete().eq("contact_id", contactId).eq("tag_id", tagId).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't remove the tag." };
  await runNow(supabase, ws.account.id);
  refresh();
  return {};
}

/** Sets who looks after a contact (and their open deal). */
export async function setOwner(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const contactId = text(fd, "contact_id", 40);
  const owner = text(fd, "owner_id", 40) || null;
  const ws = await getWorkspace();
  const supabase = await createClient();
  if (owner) {
    const { data: m } = await supabase.from("account_members").select("user_id").eq("account_id", ws.account.id).eq("user_id", owner).maybeSingle();
    if (!m) return { error: "That person isn't in this workspace." };
  }
  const { error } = await supabase.from("contacts").update({ owner_id: owner }).eq("id", contactId).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't save the owner." };
  await supabase.from("opportunities").update({ assigned_to: owner }).eq("contact_id", contactId).eq("account_id", ws.account.id).eq("status", "open");
  refresh();
  return { ok: "Saved." };
}

/** Marks the contact's deal won, lost or open again. Won and lost start matching workflows. */
export async function setDealStatus(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const oppId = text(fd, "opportunity_id", 40);
  const status = text(fd, "status", 10);
  if (!["open", "won", "lost"].includes(status)) return { error: "Choose won, lost or open." };
  const ws = await getWorkspace();
  const supabase = await createClient();
  const { data: opp, error } = await supabase.from("opportunities").update({ status }).eq("id", oppId).eq("account_id", ws.account.id).select("contact_id").maybeSingle();
  if (error || !opp) return { error: "We couldn't update the deal." };
  await supabase.from("activity").insert({ account_id: ws.account.id, contact_id: opp.contact_id, opportunity_id: oppId, type: "deal.status", summary: status === "open" ? "Deal reopened" : `Deal marked ${status}` });
  await runNow(supabase, ws.account.id);
  refresh();
  return {};
}

/** Saves the workspace's custom fields on a contact. */
export async function saveCustomFields(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const contactId = text(fd, "contact_id", 40);
  const ws = await getWorkspace();
  const supabase = await createClient();
  const [{ data: fields }, { data: contact }] = await Promise.all([
    supabase.from("custom_fields").select("key").eq("account_id", ws.account.id).eq("object", "contact"),
    supabase.from("contacts").select("custom").eq("id", contactId).eq("account_id", ws.account.id).maybeSingle(),
  ]);
  if (!contact) return { error: "That contact no longer exists." };
  const custom = { ...((contact.custom as Record<string, unknown>) ?? {}) };
  for (const f of fields ?? []) {
    const v = text(fd, `cf_${f.key}`, 500);
    if (v) custom[f.key] = v;
    else delete custom[f.key];
  }
  const { error } = await supabase.from("contacts").update({ custom }).eq("id", contactId).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't save the fields." };
  refresh();
  return { ok: "Saved." };
}
