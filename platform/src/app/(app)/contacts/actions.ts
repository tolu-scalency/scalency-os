"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AddContactState = { error?: string };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^\+[1-9][0-9]{6,14}$/;

// Turns "07700 900123" into "+447700900123". Anything else must already start with + and the country code.
function normalisePhone(raw: string) {
  const p = raw.replace(/[\s().-]/g, "");
  if (!p) return null;
  if (/^07\d{9}$/.test(p)) return "+44" + p.slice(1);
  if (/^00\d+$/.test(p)) return "+" + p.slice(2);
  return p;
}

/** Adds a contact by hand and puts them in the first stage of the pipeline. Runs as the signed-in person. */
export async function addContact(_prev: AddContactState, form: FormData): Promise<AddContactState> {
  const first = String(form.get("first_name") ?? "").trim();
  const last = String(form.get("last_name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase() || null;
  const phone = normalisePhone(String(form.get("phone") ?? ""));
  const isTest = form.get("is_test") === "on";

  if (!first) return { error: "Add a first name." };
  if (!email && !phone) return { error: "Add an email or a phone number." };
  if (email && !EMAIL.test(email)) return { error: "That email doesn't look right." };
  if (phone && !PHONE.test(phone)) return { error: "Phone numbers need the country code, e.g. +44 7700 900123." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: account } = await supabase.from("accounts").select("id").order("created_at").limit(1).maybeSingle();
  if (!account) return { error: "Your login isn't linked to an account yet." };

  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({ account_id: account.id, first_name: first, last_name: last || null, email, phone, source: "manual", is_test: isTest })
    .select("id")
    .single();
  if (error || !contact) {
    if (error?.code === "23505") return { error: "A contact with this email already exists." };
    return { error: `Couldn't save the contact: ${error?.message ?? "unknown error"}` };
  }

  // Put them in the first stage of the account's pipeline, if there is one.
  const { data: pipeline } = await supabase.from("pipelines").select("id").eq("account_id", account.id).order("created_at").limit(1).maybeSingle();
  if (pipeline) {
    const { data: stage } = await supabase.from("pipeline_stages").select("id").eq("pipeline_id", pipeline.id).order("position").limit(1).maybeSingle();
    if (stage) {
      await supabase.from("opportunities").insert({
        account_id: account.id,
        contact_id: contact.id,
        pipeline_id: pipeline.id,
        stage_id: stage.id,
        name: [first, last].filter(Boolean).join(" "),
        source: "manual",
      });
    }
  }

  await supabase.from("activity").insert({
    account_id: account.id,
    contact_id: contact.id,
    type: "contact.created",
    summary: `Added by hand by ${auth.user.email ?? "a team member"}`,
  });

  redirect(`/contacts/${contact.id}`);
}
