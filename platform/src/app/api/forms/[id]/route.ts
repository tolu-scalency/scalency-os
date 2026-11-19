import { createHash } from "node:crypto";
import { adminClient } from "@/lib/admin";
import { cleanDefinition, type FormField } from "@/lib/form-builder";
import { parseFieldValue } from "@/lib/field-types";
import { normalisePhone } from "@/lib/forms";
import { runWorkflowsSoon } from "@/lib/run-soon";

// Someone fills in a published form. No login: the form's id is public, so this
// checks everything itself, creates or updates the contact, adds tags, optionally
// a deal, saves the submission (which starts "Form submitted" workflows) and
// replies with what to show next.

export const dynamic = "force-dynamic";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const json = (status: number, data: unknown) => Response.json(data, { status });

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json(404, { ok: false, error: "This form doesn't exist." });
  const admin = adminClient();
  if (!admin) return json(503, { ok: false, error: "Forms aren't set up yet." });

  const raw = await request.text();
  if (raw.length > 30_000) return json(413, { ok: false, error: "That's too much text." });
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return json(400, { ok: false, error: "Something went wrong. Please try again." });
  }
  const answers = (body.answers && typeof body.answers === "object" ? body.answers : {}) as Record<string, unknown>;

  // A hidden field people never see. Bots fill it in; pretend it worked.
  if (typeof body.website === "string" && body.website.trim()) return json(200, { ok: true });

  const { data: form } = await admin
    .from("forms")
    .select("id, account_id, name, status, definition, tags, stage_id, redirect_url")
    .eq("id", id)
    .maybeSingle();
  if (!form || form.status !== "live") return json(404, { ok: false, error: "This form isn't taking replies right now." });
  const account = form.account_id as string;
  const def = cleanDefinition(form.definition);

  // At most 5 submissions per person per form every 10 minutes.
  const ip = (request.headers.get("x-nf-client-connection-ip") ?? request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const who = createHash("sha256").update(`${ip}|${id}`).digest("hex").slice(0, 32);
  const { count } = await admin
    .from("form_submissions")
    .select("id", { count: "exact", head: true })
    .eq("form_id", id)
    .eq("tracking->>who", who)
    .gte("started_at", new Date(Date.now() - 10 * 60_000).toISOString());
  if ((count ?? 0) >= 5) return json(429, { ok: false, error: "You've sent this a few times already. Please wait a few minutes." });

  // Check each field.
  const { data: cfs } = await admin.from("custom_fields").select("key, label, type, options").eq("account_id", account).eq("object", "contact");
  const cfByKey = new Map((cfs ?? []).map((f) => [f.key as string, f]));
  const errors: Record<string, string> = {};
  const saved: { label: string; value: string }[] = [];
  let first = "", last = "", email: string | null = null, phone: string | null = null;
  const custom: Record<string, unknown> = {};

  const val = (f: FormField) => {
    const v = answers[f.id];
    if (typeof v === "boolean") return v ? "yes" : "";
    return typeof v === "string" ? v.trim().slice(0, f.kind === "textarea" ? 5000 : 500) : "";
  };
  for (const f of def.fields) {
    const v = val(f);
    if (!v) {
      if (f.required) errors[f.id] = f.kind === "checkbox" ? "Please tick this box." : "Please fill this in.";
      continue;
    }
    switch (f.kind) {
      case "first_name":
        first = v.slice(0, 80);
        break;
      case "last_name":
        last = v.slice(0, 80);
        break;
      case "full_name":
        [first, last] = [v.split(/\s+/)[0].slice(0, 80), v.split(/\s+/).slice(1).join(" ").slice(0, 80)];
        break;
      case "email":
        if (!EMAIL.test(v)) errors[f.id] = "Please enter a valid email address.";
        else email = v.toLowerCase().slice(0, 200);
        break;
      case "phone": {
        const p = normalisePhone(v);
        if (p === "invalid") errors[f.id] = "Please enter a mobile like 07700 900123, or add your country code.";
        else phone = p;
        break;
      }
      case "custom": {
        const cf = f.key ? cfByKey.get(f.key) : undefined;
        if (!cf) break;
        const parsed = parseFieldValue(cf.type as string, Array.isArray(cf.options) ? (cf.options as string[]) : [], v, f.label);
        if ("error" in parsed) errors[f.id] = parsed.error;
        else if (parsed.value !== null) custom[f.key!] = parsed.value;
        break;
      }
      case "select":
        if (f.options?.length && !f.options.includes(v)) errors[f.id] = "Please choose one of the options.";
        break;
    }
    saved.push({ label: f.label, value: v });
  }
  const consented = answers.__consent === true;
  if (def.consent.enabled && def.consent.required && !consented) errors.__consent = "Please tick this box to continue.";
  if (!email && !phone && !errors.__any) errors.__any = "Please give us an email address or phone number so we can reply.";
  if (Object.keys(errors).length) return json(422, { ok: false, errors });

  // Find or create the contact.
  let contactId: string | null = null;
  if (email) {
    const { data } = await admin.from("contacts").select("id").eq("account_id", account).ilike("email", email.replace(/[%_\\]/g, "\\$&")).maybeSingle();
    contactId = data?.id ?? null;
  }
  if (!contactId && phone) {
    const { data } = await admin.from("contacts").select("id").eq("account_id", account).eq("phone", phone).order("created_at", { ascending: false }).limit(1).maybeSingle();
    contactId = data?.id ?? null;
  }
  const now = new Date().toISOString();
  const consent = consented ? { ...(email ? { email_consent_at: now } : {}), ...(phone ? { sms_consent_at: now } : {}) } : {};
  const source = String(body.utm_source ?? "").slice(0, 60).trim() || `Form: ${form.name}`.slice(0, 60);

  if (contactId) {
    const { data: c } = await admin.from("contacts").select("first_name, last_name, email, phone, custom").eq("id", contactId).single();
    const patch: Record<string, unknown> = { ...consent };
    if (!c?.first_name && first) patch.first_name = first;
    if (!c?.last_name && last) patch.last_name = last;
    if (!c?.email && email) patch.email = email;
    if (!c?.phone && phone) patch.phone = phone;
    if (Object.keys(custom).length) patch.custom = { ...((c?.custom as object) ?? {}), ...custom };
    if (Object.keys(patch).length) await admin.from("contacts").update(patch).eq("id", contactId);
  } else {
    const { data, error } = await admin
      .from("contacts")
      .insert({ account_id: account, first_name: first || null, last_name: last || null, email, phone, source, custom, ...consent })
      .select("id")
      .single();
    if (error || !data) return json(500, { ok: false, error: "We couldn't save your details. Please try again." });
    contactId = data.id as string;
    await admin.from("activity").insert({ account_id: account, contact_id: contactId, type: "contact.created", summary: `Added by the form "${form.name}"` });
  }

  // Tags from the form's settings.
  for (const name of ((form.tags as string[] | null) ?? []).slice(0, 10)) {
    let { data: tag } = await admin.from("tags").select("id").eq("account_id", account).ilike("name", name.replace(/[%_\\]/g, "\\$&")).maybeSingle();
    if (!tag) ({ data: tag } = await admin.from("tags").insert({ account_id: account, name }).select("id").single());
    if (tag) await admin.from("contact_tags").upsert({ account_id: account, contact_id: contactId, tag_id: tag.id }, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
  }

  // Optional deal in the chosen stage, unless they already have an open one in that pipeline.
  let opportunityId: string | null = null;
  if (form.stage_id) {
    const { data: st } = await admin.from("pipeline_stages").select("id, pipeline_id").eq("id", form.stage_id).maybeSingle();
    if (st) {
      const { data: existing } = await admin.from("opportunities").select("id").eq("contact_id", contactId).eq("pipeline_id", st.pipeline_id).eq("status", "open").limit(1).maybeSingle();
      if (existing) opportunityId = existing.id as string;
      else {
        const name = [first, last].filter(Boolean).join(" ") || email || phone || "New lead";
        const { data: opp } = await admin
          .from("opportunities")
          .insert({ account_id: account, contact_id: contactId, pipeline_id: st.pipeline_id, stage_id: st.id, name: name.slice(0, 120), source })
          .select("id")
          .single();
        opportunityId = (opp?.id as string) ?? null;
      }
    }
  }

  const tracking: Record<string, string> = { who };
  for (const k of ["page", "referrer", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"]) {
    const v = body[k];
    if (typeof v === "string" && v.trim()) tracking[k] = v.trim().slice(0, 300);
  }
  const { error: subErr } = await admin.from("form_submissions").insert({
    account_id: account,
    form_id: id,
    contact_id: contactId,
    opportunity_id: opportunityId,
    status: "submitted",
    answers: { fields: saved, consent: consented },
    tracking,
    completed_at: now,
  });
  if (subErr) return json(500, { ok: false, error: "We couldn't save your details. Please try again." });
  await admin.from("activity").insert({ account_id: account, contact_id: contactId, opportunity_id: opportunityId, type: "form.submitted", summary: `Filled in "${form.name}"` });

  runWorkflowsSoon(admin, account);
  return json(200, { ok: true, redirect: (form.redirect_url as string | null) ?? null, message: def.success });
}
