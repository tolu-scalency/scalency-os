import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deliverPending } from "@/lib/deliver";
import type { FormDefinition } from "@/lib/form-builder";

// After someone sends a form: tell the team (team chat and/or email) and, if
// switched on, email the person a confirmation. Runs after the reply has gone
// back to the browser, so the visitor never waits for it.
//
// Test mode: the confirmation goes to the workspace's test inbox instead of the
// person, exactly like workflow emails. Team alerts go to the team as normal.

type Input = {
  accountId: string;
  contactId: string;
  formName: string;
  def: FormDefinition;
  answers: { label: string; value: string; file?: string }[];
  person: { first: string; last: string; email: string | null; phone: string | null };
  outcome: string | null;
};

/** {{first_name}}, {{last_name}}, {{name}}, {{email}}, {{phone}} and {{form_name}}. */
export function fillMergeTags(text: string, x: Pick<Input, "person" | "formName">) {
  const name = [x.person.first, x.person.last].filter(Boolean).join(" ");
  const values: Record<string, string> = {
    first_name: x.person.first || "there",
    last_name: x.person.last,
    name: name || "there",
    email: x.person.email ?? "",
    phone: x.person.phone ?? "",
    form_name: x.formName,
  };
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k: string) => (k in values ? values[k] : m));
}

export function formAlerts(admin: SupabaseClient, x: Input) {
  const { def } = x;
  const wantsChat = def.notify.chat;
  const wantsEmail = def.notify.emails.length > 0;
  const wantsConfirm = def.confirm.enabled && Boolean(x.person.email);
  if (!wantsChat && !wantsEmail && !wantsConfirm) return;

  after(async () => {
    try {
      const who = [x.person.first, x.person.last].filter(Boolean).join(" ") || x.person.email || x.person.phone || "Someone";
      const lines = x.answers.map((a) => `${a.label}: ${a.file ? `${a.value} (file, open the contact to see it)` : a.value}`);
      const head = `${who} filled in "${x.formName}"${x.outcome ? ` (${x.outcome})` : ""}.`;

      if (wantsChat) {
        const short = [head, ...lines.slice(0, 8)].join("\n");
        const { error } = await admin.rpc("form_post_to_chat", { target_account: x.accountId, target_contact: x.contactId, message: short });
        if (error) console.error("Form chat alert failed", error.message);
      }

      const rows: Record<string, unknown>[] = [];
      if (wantsEmail) {
        const body = [head, "", ...lines, "", "Open your workspace to see the contact and reply."].join("\n");
        for (const to of def.notify.emails)
          rows.push({ account_id: x.accountId, contact_id: x.contactId, direction: "outbound", channel: "email", to_address: to, subject: `New form submission: ${x.formName}`.slice(0, 200), body, status: "queued" });
      }
      if (wantsConfirm) {
        const [{ data: acc }, { data: c }] = await Promise.all([
          admin.from("accounts").select("test_mode, test_email").eq("id", x.accountId).single(),
          admin.from("contacts").select("email_unsubscribed_at").eq("id", x.contactId).single(),
        ]);
        const to = acc?.test_mode ? (acc.test_email as string | null) : x.person.email;
        if (to && !c?.email_unsubscribed_at)
          rows.push({
            account_id: x.accountId,
            contact_id: x.contactId,
            direction: "outbound",
            channel: "email",
            to_address: to,
            subject: fillMergeTags(def.confirm.subject, x).slice(0, 200),
            body: fillMergeTags(def.confirm.body, x),
            status: acc?.test_mode ? "held_test_mode" : "queued",
          });
      }
      if (rows.length) {
        const { error } = await admin.from("messages").insert(rows);
        if (error) console.error("Queueing form emails failed", error.message);
        else await deliverPending(admin, x.accountId);
      }
    } catch (e) {
      console.error("Form alerts failed", e);
    }
  });
}
