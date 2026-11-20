import "server-only";
import { adminClient } from "@/lib/admin";

// Checks the server can serve public forms: the secret key is the right kind,
// and the database changes for forms have been run. Never reveals the key.

export type FormsHealth = { ok: boolean; problem?: string; fix?: string };

function keyKind(key: string | undefined): "missing" | "secret" | "service_role" | "publishable" | "anon" | "other" {
  if (!key) return "missing";
  if (key.startsWith("sb_secret_")) return "secret";
  if (key.startsWith("sb_publishable_")) return "publishable";
  const parts = key.split(".");
  if (parts.length === 3) {
    try {
      const role = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"))?.role;
      if (role === "service_role") return "service_role";
      if (role === "anon") return "anon";
    } catch {}
  }
  return "other";
}

export async function formsHealth(): Promise<FormsHealth> {
  const kind = keyKind(process.env.SUPABASE_SECRET_KEY);
  const fixKey = "In Supabase open Project Settings, API Keys, and copy the Secret key (starts sb_secret_) or the legacy service_role key. In Netlify, set it as SUPABASE_SECRET_KEY, then redeploy.";
  if (kind === "missing") return { ok: false, problem: "Form links and embeds can't work yet: SUPABASE_SECRET_KEY isn't set in Netlify.", fix: fixKey };
  if (kind === "publishable" || kind === "anon") return { ok: false, problem: "Form links and embeds can't work yet: SUPABASE_SECRET_KEY in Netlify is the public key, not the secret one.", fix: fixKey };
  const admin = adminClient();
  if (!admin) return { ok: false, problem: "Form links can't work yet: the Supabase address isn't set.", fix: fixKey };
  const { error } = await admin.from("forms").select("id").limit(1);
  if (error) {
    const wrongKey = /jwt|api key|invalid|permission|unauthori/i.test(error.message);
    return wrongKey
      ? { ok: false, problem: "Form links and embeds can't work yet: Supabase doesn't accept the SUPABASE_SECRET_KEY in Netlify. It may be from a different Supabase project.", fix: fixKey }
      : { ok: false, problem: `Form links can't load forms (${error.message.slice(0, 120)}).`, fix: "Check the forms database changes have been run in the Supabase SQL Editor." };
  }
  const { error: colErr } = await admin.from("forms").select("tags, stage_id, redirect_url").limit(1);
  if (colErr) return { ok: false, problem: "Forms can't take replies yet: a database change hasn't been run.", fix: "Run supabase/migrations/20261123090000_forms.sql in the Supabase SQL Editor." };
  const { error: v2Err } = await admin.from("form_stats").select("form_id").limit(1);
  if (v2Err) return { ok: false, problem: "Some form features need a database change: views, uploads and team alerts.", fix: "Run supabase/migrations/20261125090000_forms_pro.sql in the Supabase SQL Editor." };
  return { ok: true };
}
