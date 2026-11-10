"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function signedIn() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, user: data.user };
}

/** Moves a contact's opportunity to another stage and logs it on their timeline. */
export async function moveStage(form: FormData) {
  const contactId = String(form.get("contact_id"));
  const stageId = String(form.get("stage_id"));
  const { supabase, user } = await signedIn();

  const { data: opp } = await supabase.from("opportunities").select("id, account_id, stage_id").eq("contact_id", contactId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!opp || opp.stage_id === stageId) return;

  const { data: stage } = await supabase.from("pipeline_stages").select("name").eq("id", stageId).maybeSingle();
  const { error } = await supabase.from("opportunities").update({ stage_id: stageId }).eq("id", opp.id);
  if (error) throw new Error(`Couldn't move the stage: ${error.message}`);

  await supabase.from("activity").insert({
    account_id: opp.account_id,
    contact_id: contactId,
    opportunity_id: opp.id,
    type: "stage.changed",
    summary: `Moved to ${stage?.name ?? "a new stage"} by ${user.email ?? "a team member"}`,
  });
  refresh();
}

/** Adds a note to a contact's timeline. */
export async function addNote(form: FormData) {
  const contactId = String(form.get("contact_id"));
  const note = String(form.get("note") ?? "").trim();
  if (!note) return;
  const { supabase, user } = await signedIn();

  const { data: contact } = await supabase.from("contacts").select("account_id").eq("id", contactId).maybeSingle();
  if (!contact) return;

  await supabase.from("activity").insert({
    account_id: contact.account_id,
    contact_id: contactId,
    type: "note",
    summary: note.slice(0, 2000),
    detail: { author: user.email },
  });
  refresh();
}
