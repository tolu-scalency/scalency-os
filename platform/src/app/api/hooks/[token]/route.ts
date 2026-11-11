import { adminClient } from "@/lib/admin";
import { deliverPending } from "@/lib/deliver";

// Inbound webhook: other apps (a website form, Zapier, Make, Typeform, ad platforms) send leads here.
// Each "When a webhook is received" workflow has its own secret address: /api/hooks/<token>.
// The contact is created or updated, tagged, then the workflow runs straight away.

export const dynamic = "force-dynamic";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^\+[1-9][0-9]{6,14}$/;

function pick(body: Record<string, unknown>, ...keys: string[]) {
  for (const k of keys) {
    const v = body[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return "";
}

function phoneFrom(raw: string) {
  const p = raw.replace(/[\s().-]/g, "");
  if (!p) return null;
  let out = p;
  if (/^07\d{9}$/.test(p)) out = "+44" + p.slice(1);
  else if (/^00\d+$/.test(p)) out = "+" + p.slice(2);
  return PHONE.test(out) ? out : null;
}

const json = (status: number, data: unknown) => Response.json(data, { status });

export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return json(404, { ok: false, error: "Unknown address." });
  const admin = adminClient();
  if (!admin) return json(503, { ok: false, error: "Not set up yet." });

  const raw = await request.text();
  if (raw.length > 20_000) return json(413, { ok: false, error: "Too much data." });
  let body: Record<string, unknown> = {};
  try {
    body = (request.headers.get("content-type") ?? "").includes("application/json")
      ? (JSON.parse(raw || "{}") as Record<string, unknown>)
      : Object.fromEntries(new URLSearchParams(raw));
  } catch {
    return json(400, { ok: false, error: "Send JSON or a normal form post." });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return json(400, { ok: false, error: "Send one lead as a JSON object." });

  const { data: wf } = await admin
    .from("workflows")
    .select("id, account_id, status")
    .eq("trigger->>type", "webhook")
    .eq("trigger->>token", token)
    .maybeSingle();
  if (!wf) return json(404, { ok: false, error: "Unknown address." });
  if (wf.status !== "active") return json(409, { ok: false, error: "This workflow isn't turned on yet." });

  let first = pick(body, "first_name", "firstName", "first name", "First Name");
  let last = pick(body, "last_name", "lastName", "last name", "Last Name");
  const full = pick(body, "name", "full_name", "fullName", "Name");
  if (!first && full) [first, last] = [full.split(" ")[0], full.split(" ").slice(1).join(" ")];
  const emailRaw = pick(body, "email", "Email", "email_address").toLowerCase();
  const email = EMAIL.test(emailRaw) ? emailRaw.slice(0, 200) : null;
  const phone = phoneFrom(pick(body, "phone", "Phone", "phone_number", "mobile"));
  if (!email && !phone) return json(422, { ok: false, error: "Include an email or a phone number (with the country code)." });
  const source = pick(body, "source", "utm_source", "Source").slice(0, 60) || "webhook";

  const account = wf.account_id as string;
  let contactId: string | null = null;
  if (email) {
    const { data } = await admin.from("contacts").select("id").eq("account_id", account).ilike("email", email.replace(/[%_\\]/g, "\\$&")).maybeSingle();
    contactId = data?.id ?? null;
  }
  if (!contactId && phone) {
    const { data } = await admin.from("contacts").select("id").eq("account_id", account).eq("phone", phone).order("created_at", { ascending: false }).limit(1).maybeSingle();
    contactId = data?.id ?? null;
  }

  if (contactId) {
    const { data: c } = await admin.from("contacts").select("first_name, last_name, email, phone").eq("id", contactId).single();
    const patch: Record<string, string> = {};
    if (!c?.first_name && first) patch.first_name = first.slice(0, 80);
    if (!c?.last_name && last) patch.last_name = last.slice(0, 80);
    if (!c?.email && email) patch.email = email;
    if (!c?.phone && phone) patch.phone = phone;
    if (Object.keys(patch).length) await admin.from("contacts").update(patch).eq("id", contactId);
  } else {
    const { data, error } = await admin
      .from("contacts")
      .insert({ account_id: account, first_name: first.slice(0, 80) || null, last_name: last.slice(0, 80) || null, email, phone, source })
      .select("id")
      .single();
    if (error || !data) return json(500, { ok: false, error: "Couldn't save the contact." });
    contactId = data.id as string;
    await admin.from("activity").insert({ account_id: account, contact_id: contactId, type: "contact.created", summary: `Added by webhook (${source})` });
  }

  // Optional tags: ["Hot", "Facebook"] or "Hot, Facebook".
  const rawTags = Array.isArray(body.tags) ? body.tags.map(String) : typeof body.tags === "string" ? body.tags.split(",") : [];
  for (const name of rawTags.map((t) => t.trim().slice(0, 40)).filter(Boolean).slice(0, 10)) {
    let { data: tag } = await admin.from("tags").select("id").eq("account_id", account).ilike("name", name.replace(/[%_\\]/g, "\\$&")).maybeSingle();
    if (!tag) ({ data: tag } = await admin.from("tags").insert({ account_id: account, name }).select("id").single());
    if (tag) await admin.from("contact_tags").upsert({ account_id: account, contact_id: contactId, tag_id: tag.id }, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
  }

  await admin.rpc("enroll_contact", { target_workflow: wf.id, target_contact: contactId });
  await admin.rpc("run_due_workflows", { target_account: account });
  await deliverPending(admin, account);
  return json(200, { ok: true, contact_id: contactId });
}

export function GET() {
  return Response.json({ ok: true, message: "This address accepts leads by POST." });
}
