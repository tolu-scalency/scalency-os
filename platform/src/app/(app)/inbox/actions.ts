"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/data";
import { text, type ActionResult } from "@/lib/forms";

/**
 * Sends an email or text to a contact. In test mode it goes to the workspace's test inbox.
 * Delivery starts once email (Resend) and SMS (Twilio) are connected; until then it's saved as queued.
 */
export async function sendMessage(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const contactId = text(fd, "contact_id", 40);
  const channel = text(fd, "channel", 5) === "sms" ? "sms" : "email";
  const subject = text(fd, "subject", 200);
  const body = text(fd, "body", channel === "sms" ? 640 : 5000);
  if (!body) return { error: "Write a message first." };
  if (channel === "email" && !subject) return { error: "Add a subject." };

  const ws = await getWorkspace();
  const supabase = await createClient();
  const [{ data: contact }, { data: account }] = await Promise.all([
    supabase.from("contacts").select("email, phone").eq("id", contactId).eq("account_id", ws.account.id).maybeSingle(),
    supabase.from("accounts").select("test_mode, test_email, test_phone").eq("id", ws.account.id).single(),
  ]);
  if (!contact) return { error: "That contact no longer exists." };
  const real = channel === "email" ? contact.email : contact.phone;
  if (!real) return { error: channel === "email" ? "This contact has no email." : "This contact has no phone number." };
  const to = account?.test_mode ? (channel === "email" ? account.test_email : account.test_phone) : real;
  if (!to) return { error: `Test mode is on but there's no test ${channel === "email" ? "email" : "phone"} set.` };

  const { error } = await supabase.from("messages").insert({
    account_id: ws.account.id,
    contact_id: contactId,
    direction: "outbound",
    channel,
    to_address: to,
    subject: channel === "email" ? subject : null,
    body,
    status: account?.test_mode ? "held_test_mode" : "queued",
  });
  if (error) return { error: "We couldn't save the message." };
  await supabase.from("activity").insert({
    account_id: ws.account.id,
    contact_id: contactId,
    type: `message.${channel}`,
    summary: `${channel === "email" ? `Email: ${subject}` : `Text: ${body.slice(0, 80)}`}${account?.test_mode ? " (test mode)" : ""}`,
  });
  refresh();
  return { ok: account?.test_mode ? "Saved in test mode." : "Queued." };
}
