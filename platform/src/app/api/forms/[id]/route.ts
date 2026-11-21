import { createHash, randomBytes } from "node:crypto";
import { adminClient } from "@/lib/admin";
import { allFields, answerText, cleanDefinition, isVisible, scoreOf, type Answers, type FieldBlock } from "@/lib/form-builder";
import { parseFieldValue } from "@/lib/field-types";
import { normalisePhone } from "@/lib/forms";
import { runWorkflowsSoon } from "@/lib/run-soon";
import { formAlerts } from "@/lib/form-alerts";

// Someone fills in a published form. No login: the form id is public, so this
// checks everything itself.
//
// partial: true   saves people who stop part way (once there's an email or phone):
//                 the contact is created and a "started" submission kept, with a
//                 private resume code the browser sends back on the final submit.
// otherwise       the final submit: contact updated, tags added, optional deal,
//                 score worked out (qualified or not), submission completed, which
//                 starts any "Form submitted" workflows.

export const dynamic = "force-dynamic";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const json = (status: number, data: unknown) => Response.json(data, { status });

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json(404, { ok: false, error: "This form doesn't exist." });
  const admin = adminClient();
  if (!admin) return json(503, { ok: false, error: "Forms aren't set up yet." });

  const raw = await request.text();
  if (raw.length > 60_000) return json(413, { ok: false, error: "That's too much text." });
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return json(400, { ok: false, error: "Something went wrong. Please try again." });
  }
  const partial = body.partial === true;
  const answersIn = (body.answers && typeof body.answers === "object" ? body.answers : {}) as Record<string, unknown>;

  // Spam protection. Bots get a normal "thank you" so they don't learn what gave them away.
  // 1. A hidden field people never see. Bots fill it in.
  if (typeof body.website === "string" && body.website.trim()) return json(200, { ok: true });
  // 2. Sent less than 2 seconds after the form appeared: no person types that fast.
  const ms = Number(body.t);
  if (!partial && Number.isFinite(ms) && ms > 0 && ms < 2000) return json(200, { ok: true });
  // 3. Answers stuffed with links.
  const linkCount = Object.values(answersIn).reduce<number>((n, v) => n + (typeof v === "string" ? (v.match(/https?:\/\/|www\./gi)?.length ?? 0) : 0), 0);
  if (linkCount > 3) return json(200, { ok: true });

  const { data: form } = await admin.from("forms").select("id, account_id, name, status, definition, tags, stage_id, redirect_url").eq("id", id).maybeSingle();
  if (!form || form.status !== "live") return json(404, { ok: false, error: "This form isn't taking replies right now." });
  const account = form.account_id as string;
  const def = cleanDefinition(form.definition);
  const fields = allFields(def);
  const FILE_KINDS = new Set(["file", "signature"]);

  // Answers, cleaned to what each question allows.
  const answers: Answers = {};
  for (const f of fields) {
    const v = answersIn[f.id];
    if (f.kind === "checkboxes") {
      if (Array.isArray(v)) answers[f.id] = v.map((x) => String(x).slice(0, 120)).filter((x) => (f.options ?? []).includes(x)).slice(0, 40);
    } else if (f.kind === "checkbox") {
      if (v === true) answers[f.id] = true;
    } else if (typeof v === "string" || typeof v === "number") {
      answers[f.id] = String(v).trim().slice(0, f.kind === "textarea" ? 5000 : 500);
    }
  }
  const consented = answersIn.__consent === true;

  // At most 5 new submissions per person per form every 10 minutes.
  const ip = (request.headers.get("x-nf-client-connection-ip") ?? request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const who = createHash("sha256").update(`${ip}|${id}`).digest("hex").slice(0, 32);
  const wa = createHash("sha256").update(`${ip}|${account}`).digest("hex").slice(0, 32);
  const resumeIn = typeof body.resume === "string" && /^[a-f0-9]{32}$/.test(body.resume) ? body.resume : "";
  let existing: { id: string; contact_id: string } | null = null;
  if (resumeIn) {
    const { data } = await admin.from("form_submissions").select("id, contact_id").eq("form_id", id).eq("status", "started").eq("tracking->>resume", resumeIn).maybeSingle();
    existing = (data as { id: string; contact_id: string } | null) ?? null;
  }
  if (!existing) {
    const { count } = await admin
      .from("form_submissions")
      .select("id", { count: "exact", head: true })
      .eq("form_id", id)
      .eq("tracking->>who", who)
      .gte("started_at", new Date(Date.now() - 10 * 60_000).toISOString());
    if ((count ?? 0) >= 5) return json(429, { ok: false, error: "You've sent this a few times already. Please wait a few minutes." });
    // And at most 20 across all of this workspace's forms, so one sender can't flood every form.
    const { count: all } = await admin
      .from("form_submissions")
      .select("id", { count: "exact", head: true })
      .eq("account_id", account)
      .eq("tracking->>wa", wa)
      .gte("started_at", new Date(Date.now() - 10 * 60_000).toISOString());
    if ((all ?? 0) >= 20) return json(429, { ok: false, error: "We've had a lot of messages from you. Please wait a few minutes." });
  }

  // Check each question that's showing.
  const { data: cfs } = await admin.from("custom_fields").select("key, label, type, options").eq("account_id", account).eq("object", "contact");
  const cfByKey = new Map((cfs ?? []).map((f) => [f.key as string, f]));
  const errors: Record<string, string> = {};
  const saved: { id: string; label: string; value: string; file?: string }[] = [];
  let first = "", last = "", email: string | null = null, phone: string | null = null;
  const custom: Record<string, unknown> = {};
  // Files and signatures: the answer is the id of an upload made to this form.
  const fileIds = fields.filter((f) => FILE_KINDS.has(f.kind)).map((f) => answerText(answers[f.id])).filter((v) => /^[0-9a-f-]{36}$/i.test(v));
  const uploads = new Map<string, string>();
  if (fileIds.length) {
    const { data: ups } = await admin.from("form_uploads").select("id, name").eq("form_id", id).in("id", fileIds);
    for (const u of ups ?? []) uploads.set(u.id as string, u.name as string);
  }

  const visible = (f: FieldBlock) => isVisible(f, answers, def);
  for (const f of fields) {
    if (!visible(f)) continue;
    const text = answerText(answers[f.id]).trim();
    if (!text) {
      if (f.required && !partial && f.kind !== "hidden") errors[f.id] = f.kind === "checkbox" ? "Please tick this box." : "Please fill this in.";
      continue;
    }
    switch (f.kind) {
      case "first_name":
        first = text.slice(0, 80);
        break;
      case "last_name":
        last = text.slice(0, 80);
        break;
      case "full_name":
        [first, last] = [text.split(/\s+/)[0].slice(0, 80), text.split(/\s+/).slice(1).join(" ").slice(0, 80)];
        break;
      case "email":
        if (!EMAIL.test(text)) errors[f.id] = "Please enter a valid email address.";
        else email = text.toLowerCase().slice(0, 200);
        break;
      case "phone": {
        const p = normalisePhone(text);
        if (p === "invalid") errors[f.id] = "Please enter a mobile like 07700 900123, or add your country code.";
        else phone = p;
        break;
      }
      case "number":
      case "money": {
        const n = Number(text.replace(/[£$€,\s]/g, ""));
        if (!Number.isFinite(n)) errors[f.id] = "Please enter a number.";
        else if (f.min !== undefined && n < f.min) errors[f.id] = `Please enter ${f.kind === "money" ? "£" : ""}${f.min} or more.`;
        else if (f.max !== undefined && n > f.max) errors[f.id] = `Please enter ${f.kind === "money" ? "£" : ""}${f.max} or less.`;
        break;
      }
      case "textarea":
        if (f.max !== undefined && text.length > f.max) errors[f.id] = `Please keep this under ${f.max} characters.`;
        else if (f.min !== undefined && text.length < f.min) errors[f.id] = `Please write at least ${f.min} characters.`;
        break;
      case "date":
      case "date_of_birth":
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) errors[f.id] = "Please choose a date.";
        else if (f.kind === "date_of_birth") custom.date_of_birth = text;
        break;
      case "company":
      case "website":
      case "address":
      case "city":
      case "state":
      case "postcode":
      case "country":
        custom[f.kind] = text.slice(0, 200);
        break;
      case "file":
      case "signature":
        if (!uploads.has(text)) {
          errors[f.id] = "Please upload that again.";
          continue;
        }
        saved.push({ id: f.id, label: f.label, value: uploads.get(text)!, file: text });
        continue;
      case "select":
      case "radio":
      case "yes_no":
        if (f.options?.length && !f.options.includes(text)) errors[f.id] = "Please choose one of the options.";
        break;
      case "custom": {
        const cf = f.key ? cfByKey.get(f.key) : undefined;
        if (!cf) break;
        const v = answers[f.id];
        const parsed = parseFieldValue(cf.type as string, Array.isArray(cf.options) ? (cf.options as string[]) : [], Array.isArray(v) ? v : text, f.label);
        if ("error" in parsed) errors[f.id] = parsed.error;
        else if (parsed.value !== null) custom[f.key!] = parsed.value;
        break;
      }
    }
    saved.push({ id: f.id, label: f.label, value: text.slice(0, 2000) });
  }
  if (!partial && def.consent.enabled && def.consent.required && !consented) errors.__consent = "Please tick this box to continue.";
  if (!email && !phone) {
    if (partial) return json(200, { ok: true });
    errors.__any = "Please give us an email address or phone number so we can reply.";
  }
  if (Object.keys(errors).length) return json(422, { ok: false, errors, error: errors.__any });

  // Find or create the contact.
  let contactId: string | null = existing?.contact_id ?? null;
  if (!contactId && email) {
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
    const { data, error } = await admin.from("contacts").insert({ account_id: account, first_name: first || null, last_name: last || null, email, phone, source, custom, ...consent }).select("id").single();
    if (error || !data) return json(500, { ok: false, error: "We couldn't save your details. Please try again." });
    contactId = data.id as string;
    await admin.from("activity").insert({ account_id: account, contact_id: contactId, type: "contact.created", summary: `Added by the form "${form.name}"` });
  }

  const tracking: Record<string, string> = { who, wa };
  for (const k of ["page", "referrer", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"]) {
    const v = body[k];
    if (typeof v === "string" && v.trim()) tracking[k] = v.trim().slice(0, 300);
  }

  // Someone part way through: keep what we have and hand back a resume code.
  if (partial) {
    const resume = resumeIn && existing ? resumeIn : randomBytes(16).toString("hex");
    const record = { answers: { fields: saved, consent: consented }, tracking: { ...tracking, resume } };
    if (existing) await admin.from("form_submissions").update(record).eq("id", existing.id);
    else await admin.from("form_submissions").insert({ account_id: account, form_id: id, contact_id: contactId, status: "started", ...record });
    return json(200, { ok: true, resume });
  }

  // Score and outcome.
  const score = scoreOf(def, answers);
  const q = def.qualify;
  const qualified = q.enabled ? score >= q.min : null;
  const outcome = qualified === null ? null : qualified ? q.qualified : q.unqualified;

  const tagNames = [...((form.tags as string[] | null) ?? []), ...(outcome?.tag ? [outcome.tag] : [])].slice(0, 12);
  for (const name of tagNames) {
    let { data: tag } = await admin.from("tags").select("id").eq("account_id", account).ilike("name", name.replace(/[%_\\]/g, "\\$&")).maybeSingle();
    if (!tag) ({ data: tag } = await admin.from("tags").insert({ account_id: account, name }).select("id").single());
    if (tag) await admin.from("contact_tags").upsert({ account_id: account, contact_id: contactId, tag_id: tag.id }, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
  }

  // Optional deal in the chosen stage, unless they already have an open one in that pipeline.
  let opportunityId: string | null = null;
  if (form.stage_id) {
    const { data: st } = await admin.from("pipeline_stages").select("id, pipeline_id").eq("id", form.stage_id).maybeSingle();
    if (st) {
      const { data: open } = await admin.from("opportunities").select("id").eq("contact_id", contactId).eq("pipeline_id", st.pipeline_id).eq("status", "open").limit(1).maybeSingle();
      if (open) opportunityId = open.id as string;
      else {
        const name = [first, last].filter(Boolean).join(" ") || email || phone || "New lead";
        const { data: opp } = await admin.from("opportunities").insert({ account_id: account, contact_id: contactId, pipeline_id: st.pipeline_id, stage_id: st.id, name: name.slice(0, 120), source }).select("id").single();
        opportunityId = (opp?.id as string) ?? null;
      }
    }
  }

  const status = qualified === null ? "submitted" : qualified ? "qualified" : "unqualified";
  const record = {
    status,
    opportunity_id: opportunityId,
    answers: { fields: saved, consent: consented, ...(q.enabled ? { score } : {}) },
    tracking,
    completed_at: now,
    disqualified_by: qualified === false ? `Scored ${score}, needed ${q.min}` : null,
  };
  const { error: subErr } = existing
    ? await admin.from("form_submissions").update(record).eq("id", existing.id)
    : await admin.from("form_submissions").insert({ account_id: account, form_id: id, contact_id: contactId, ...record });
  if (subErr) return json(500, { ok: false, error: "We couldn't save your details. Please try again." });
  await admin.from("activity").insert({
    account_id: account,
    contact_id: contactId,
    opportunity_id: opportunityId,
    type: "form.submitted",
    summary: `Filled in "${form.name}"${qualified === null ? "" : qualified ? ` (qualified, score ${score})` : ` (not a fit, score ${score})`}`,
  });

  formAlerts(admin, {
    accountId: account,
    contactId: contactId!,
    formName: form.name as string,
    def,
    answers: saved,
    person: { first, last, email, phone },
    outcome: qualified === null ? null : qualified ? "Good fit" : "Not a fit",
  });
  // Sent from a page: count it for that page or funnel step.
  if (typeof body.sp === "string" && /^[0-9a-f-]{36}$/i.test(body.sp)) {
    await admin.rpc("count_page_submit", { target_page: body.sp, target_account: account });
  }
  runWorkflowsSoon(admin, account);
  const redirect = outcome?.redirect || (form.redirect_url as string | null) || null;
  return json(200, { ok: true, redirect, message: outcome?.message || def.success });
}
