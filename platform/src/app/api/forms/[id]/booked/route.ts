import { adminClient } from "@/lib/admin";
import { bookingBlock, cleanDefinition } from "@/lib/form-builder";
import { runWorkflowsSoon } from "@/lib/run-soon";

// Someone finished a form and then booked on its booking calendar step. The page
// sends back the private code it got from the final submit, so only that person's
// own submission can be marked. Scalency bookings already made the appointment
// (and moved the deal) through the booking page; Calendly bookings get the tag and
// pipeline stage set on the calendar block here.

export const dynamic = "force-dynamic";

const json = (status: number, data: unknown) => Response.json(data, { status });
const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return json(404, { ok: false });
  const admin = adminClient();
  if (!admin) return json(503, { ok: false });

  let body: Record<string, unknown> = {};
  try {
    const raw = await request.text();
    if (raw.length > 4000) return json(413, { ok: false });
    body = JSON.parse(raw || "{}");
  } catch {
    return json(400, { ok: false });
  }
  const resume = typeof body.resume === "string" && /^[a-f0-9]{32}$/.test(body.resume) ? body.resume : "";
  if (!resume) return json(400, { ok: false });
  const provider = body.provider === "calendly" ? "calendly" : "scalency";
  const ref = typeof body.ref === "string" ? body.ref.slice(0, 300) : "";
  const startMs = Date.parse(String(body.start ?? ""));

  const { data: sub } = await admin
    .from("form_submissions")
    .select("id, account_id, contact_id, opportunity_id, answers, status, completed_at")
    .eq("form_id", id)
    .eq("tracking->>resume", resume)
    .in("status", ["submitted", "qualified", "unqualified"])
    .maybeSingle();
  if (!sub) return json(404, { ok: false });
  const answers = (sub.answers ?? {}) as { fields?: { id: string; label: string; value: string }[]; booking?: unknown };
  if (answers.booking) return json(200, { ok: true });
  // Only soon after the form was sent.
  if (sub.completed_at && Date.now() - Date.parse(sub.completed_at as string) > 6 * 3600_000) return json(410, { ok: false });

  const { data: form } = await admin.from("forms").select("name, definition").eq("id", id).maybeSingle();
  if (!form) return json(404, { ok: false });
  const block = bookingBlock(cleanDefinition(form.definition));
  const account = sub.account_id as string;
  const contactId = sub.contact_id as string;

  const when = Number.isFinite(startMs)
    ? new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(startMs)) + " (UK time)"
    : "Yes";
  const fields = [...(answers.fields ?? []), { id: "booking", label: provider === "calendly" ? "Booked a call (Calendly)" : "Booked a call", value: when }];
  await admin
    .from("form_submissions")
    .update({ answers: { ...answers, fields, booking: { provider, ref, start: Number.isFinite(startMs) ? new Date(startMs).toISOString() : null, at: new Date().toISOString() } } })
    .eq("id", sub.id);

  let opportunityId = (sub.opportunity_id as string | null) ?? null;
  if (provider === "calendly" && block) {
    if (block.tag) {
      let { data: tag } = await admin.from("tags").select("id").eq("account_id", account).ilike("name", block.tag.replace(/[%_\\]/g, "\\$&")).maybeSingle();
      if (!tag) ({ data: tag } = await admin.from("tags").insert({ account_id: account, name: block.tag }).select("id").single());
      if (tag) await admin.from("contact_tags").upsert({ account_id: account, contact_id: contactId, tag_id: tag.id }, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
    }
    if (block.stageId) {
      const { data: st } = await admin.from("pipeline_stages").select("id, pipeline_id").eq("account_id", account).eq("id", block.stageId).maybeSingle();
      if (st) {
        const { data: open } = await admin.from("opportunities").select("id").eq("contact_id", contactId).eq("pipeline_id", st.pipeline_id).eq("status", "open").limit(1).maybeSingle();
        if (open) {
          opportunityId = open.id as string;
          await admin.from("opportunities").update({ stage_id: st.id }).eq("id", open.id);
        } else {
          const { data: c } = await admin.from("contacts").select("first_name, last_name, email, phone").eq("id", contactId).maybeSingle();
          const name = [c?.first_name, c?.last_name].filter(Boolean).join(" ") || c?.email || c?.phone || "New lead";
          const { data: opp } = await admin.from("opportunities").insert({ account_id: account, contact_id: contactId, pipeline_id: st.pipeline_id, stage_id: st.id, name: String(name).slice(0, 120), source: `Form: ${form.name}`.slice(0, 60) }).select("id").single();
          opportunityId = (opp?.id as string) ?? opportunityId;
        }
      }
    }
  }

  await admin.from("activity").insert({
    account_id: account,
    contact_id: contactId,
    opportunity_id: opportunityId,
    type: "form.booked",
    summary: `Booked a call from "${form.name}"${provider === "calendly" ? " through Calendly" : ""}${Number.isFinite(startMs) ? `, ${when}` : ""}`,
  });
  runWorkflowsSoon(admin, account);
  return json(200, { ok: true });
}
