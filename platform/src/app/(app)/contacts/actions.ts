"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/data";
import { EMAIL, PHONE_HELP, normalisePhone, parsePounds, text, type ActionResult } from "@/lib/forms";

function readContact(fd: FormData) {
  const first = text(fd, "first_name", 80);
  const last = text(fd, "last_name", 80);
  const email = text(fd, "email", 200).toLowerCase() || null;
  const phone = normalisePhone(text(fd, "phone", 30));
  if (!first) return { error: "Add a first name." } as const;
  if (!email && !phone) return { error: "Add an email or a phone number." } as const;
  if (email && !EMAIL.test(email)) return { error: "That email doesn't look right." } as const;
  if (phone === "invalid") return { error: PHONE_HELP } as const;
  return { first, last: last || null, email, phone } as const;
}

/** Adds a contact, and puts them in the pipeline if a stage was chosen. */
export async function addContact(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const c = readContact(fd);
  if ("error" in c) return { error: c.error };
  const value = parsePounds(text(fd, "value", 20));
  if (value === -1) return { error: "Enter the deal value as a number, like 1500." };
  const stageId = text(fd, "stage_id", 40);

  const ws = await getWorkspace();
  const supabase = await createClient();

  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({ account_id: ws.account.id, first_name: c.first, last_name: c.last, email: c.email, phone: c.phone, source: "manual" })
    .select("id")
    .single();
  if (error || !contact) {
    if (error?.code === "23505") return { error: "You already have a contact with this email." };
    return { error: "We couldn't save the contact. Please try again." };
  }

  if (stageId) {
    const { data: stage } = await supabase.from("pipeline_stages").select("id, pipeline_id").eq("id", stageId).eq("account_id", ws.account.id).maybeSingle();
    if (stage) {
      await supabase.from("opportunities").insert({
        account_id: ws.account.id,
        contact_id: contact.id,
        pipeline_id: stage.pipeline_id,
        stage_id: stage.id,
        name: [c.first, c.last].filter(Boolean).join(" "),
        value_pence: value,
        source: "manual",
      });
    }
  }

  await supabase.from("activity").insert({
    account_id: ws.account.id,
    contact_id: contact.id,
    type: "contact.created",
    summary: `Added by ${ws.fullName ?? ws.userEmail}`,
  });

  // Run any workflow steps this contact just triggered, so follow-ups start straight away.
  await supabase.rpc("run_due_workflows", { target_account: ws.account.id });
  redirect(`/contacts/${contact.id}`);
}

/** Saves changes to a contact's name, email and phone. */
export async function updateContact(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = text(fd, "id", 40);
  const c = readContact(fd);
  if ("error" in c) return { error: c.error };
  const ws = await getWorkspace();
  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({ first_name: c.first, last_name: c.last, email: c.email, phone: c.phone })
    .eq("id", id)
    .eq("account_id", ws.account.id);
  if (error) return { error: error.code === "23505" ? "Another contact already has this email." : "We couldn't save the changes." };
  await supabase.from("opportunities").update({ name: [c.first, c.last].filter(Boolean).join(" ") }).eq("contact_id", id);
  refresh();
  return { ok: "Saved." };
}

/** Deletes a contact and everything linked to them. */
export async function deleteContact(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const id = text(fd, "id", 40);
  const ws = await getWorkspace();
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id).eq("account_id", ws.account.id);
  if (error) return { error: "We couldn't delete this contact." };
  redirect("/contacts");
}
