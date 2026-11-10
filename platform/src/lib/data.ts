import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// The data access layer: every screen reads the database through these functions.
// They run as the signed-in person, so row-level security limits them to their own accounts.

export type Workspace = {
  userEmail: string;
  account: { id: string; name: string; testMode: boolean } | null;
};

export type ContactRow = {
  id: string;
  name: string;
  initials: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  isTest: boolean;
  createdAt: string;
  stage: string | null;
  valuePence: number | null;
};

export type Activity = { id: number; type: string; summary: string; createdAt: string; contactId: string | null };

export function fullName(first: string | null, last: string | null, fallback = "Unnamed contact") {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || fallback;
}

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export function formatPence(pence: number | null) {
  if (pence == null) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(pence / 100);
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "JUST NOW";
  if (s < 3600) return `${Math.floor(s / 60)}M AGO`;
  if (s < 86400) return `${Math.floor(s / 3600)}H AGO`;
  if (s < 604800) return `${Math.floor(s / 86400)}D AGO`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }).toUpperCase();
}

/** How many rows were created in the last `days` days. */
export function countRecent(rows: { createdAt: string }[], days: number) {
  const since = Date.now() - days * 86400000;
  return rows.filter((r) => new Date(r.createdAt).getTime() > since).length;
}

/** The signed-in person and the account they work in. Sends them to /login if they aren't signed in. */
export async function getWorkspace(): Promise<Workspace> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  // Row-level security only returns accounts this person is a member of. For now the first one is used.
  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, test_mode")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    userEmail: auth.user.email ?? "",
    account: account ? { id: account.id, name: account.name, testMode: account.test_mode } : null,
  };
}

/** Contacts with their current pipeline stage, newest first. */
export async function listContacts(accountId: string, limit = 100): Promise<ContactRow[]> {
  const supabase = await createClient();
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, source, is_test, created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Couldn't load contacts: ${error.message}`);
  if (!contacts?.length) return [];

  const { data: opps } = await supabase
    .from("opportunities")
    .select("contact_id, stage_id, value_pence, updated_at")
    .in("contact_id", contacts.map((c) => c.id))
    .order("updated_at", { ascending: false });

  const stageIds = [...new Set((opps ?? []).map((o) => o.stage_id))];
  const { data: stages } = stageIds.length
    ? await supabase.from("pipeline_stages").select("id, name").in("id", stageIds)
    : { data: [] as { id: string; name: string }[] };
  const stageName = new Map((stages ?? []).map((s) => [s.id, s.name]));

  // A contact can have more than one opportunity; show the most recently updated.
  const latest = new Map<string, { stage_id: string; value_pence: number | null }>();
  for (const o of opps ?? []) if (!latest.has(o.contact_id)) latest.set(o.contact_id, o);

  return contacts.map((c) => {
    const name = fullName(c.first_name, c.last_name, c.email ?? c.phone ?? "Unnamed contact");
    const opp = latest.get(c.id);
    return {
      id: c.id,
      name,
      initials: initialsOf(name),
      email: c.email,
      phone: c.phone,
      source: c.source,
      isTest: c.is_test,
      createdAt: c.created_at,
      stage: opp ? stageName.get(opp.stage_id) ?? null : null,
      valuePence: opp?.value_pence ?? null,
    };
  });
}

/** One contact with everything shown on their record. Returns null if it doesn't exist or isn't theirs. */
export async function getContactDetail(id: string) {
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("contacts")
    .select("id, account_id, first_name, last_name, email, phone, source, timezone, is_test, created_at, email_consent_at, sms_consent_at, custom")
    .eq("id", id)
    .maybeSingle();
  if (!c) return null;

  const [opps, submissions, activity, tags] = await Promise.all([
    supabase.from("opportunities").select("id, pipeline_id, stage_id, status, value_pence, custom, updated_at").eq("contact_id", id).order("updated_at", { ascending: false }),
    supabase.from("form_submissions").select("status, answers, disqualified_by, started_at, completed_at").eq("contact_id", id).order("started_at", { ascending: false }).limit(1),
    supabase.from("activity").select("id, type, summary, created_at, contact_id").eq("contact_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("contact_tags").select("tag_id").eq("contact_id", id),
  ]);

  const opp = opps.data?.[0] ?? null;
  let stages: { id: string; name: string; position: number }[] = [];
  if (opp) {
    const { data } = await supabase.from("pipeline_stages").select("id, name, position").eq("pipeline_id", opp.pipeline_id).order("position");
    stages = data ?? [];
  }

  const tagIds = (tags.data ?? []).map((t) => t.tag_id);
  const { data: tagRows } = tagIds.length ? await supabase.from("tags").select("name").in("id", tagIds) : { data: [] as { name: string }[] };

  const name = fullName(c.first_name, c.last_name, c.email ?? c.phone ?? "Unnamed contact");
  const answers: Record<string, unknown> = { ...(submissions.data?.[0]?.answers ?? {}), ...((opp?.custom as Record<string, unknown>) ?? {}) };

  return {
    id: c.id,
    name,
    initials: initialsOf(name),
    email: c.email as string | null,
    phone: c.phone as string | null,
    source: c.source as string | null,
    timezone: (c.timezone as string | null) ?? "Europe/London",
    isTest: c.is_test as boolean,
    createdAt: c.created_at as string,
    consent: [c.email_consent_at ? "Email" : null, c.sms_consent_at ? "SMS" : null].filter(Boolean).join(", ") || "None recorded",
    opportunity: opp ? { status: opp.status as string, valuePence: opp.value_pence as number | null, stageId: opp.stage_id as string } : null,
    stages,
    answers,
    activity: (activity.data ?? []).map((a) => ({ id: a.id, type: a.type, summary: a.summary, createdAt: a.created_at, contactId: a.contact_id })) as Activity[],
    tags: (tagRows ?? []).map((t) => t.name as string),
  };
}

export type BoardColumn = {
  id: string;
  name: string;
  cards: { opportunityId: string; contactId: string; name: string; initials: string; source: string | null; valuePence: number | null; updatedAt: string }[];
};

/** The lead-gen pipeline as columns of cards. */
export async function getPipelineBoard(accountId: string) {
  const supabase = await createClient();
  const { data: pipeline } = await supabase.from("pipelines").select("id, name").eq("account_id", accountId).order("created_at").limit(1).maybeSingle();
  if (!pipeline) return null;

  const [{ data: stages }, { data: opps }] = await Promise.all([
    supabase.from("pipeline_stages").select("id, name, position").eq("pipeline_id", pipeline.id).order("position"),
    supabase.from("opportunities").select("id, contact_id, stage_id, value_pence, source, updated_at").eq("pipeline_id", pipeline.id).eq("status", "open").order("updated_at", { ascending: false }).limit(500),
  ]);

  const contactIds = [...new Set((opps ?? []).map((o) => o.contact_id))];
  const { data: contacts } = contactIds.length
    ? await supabase.from("contacts").select("id, first_name, last_name, email, phone").in("id", contactIds)
    : { data: [] as { id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null }[] };
  const byId = new Map((contacts ?? []).map((c) => [c.id, c]));

  const columns: BoardColumn[] = (stages ?? []).map((s) => ({ id: s.id, name: s.name, cards: [] }));
  const colById = new Map(columns.map((c) => [c.id, c]));
  for (const o of opps ?? []) {
    const c = byId.get(o.contact_id);
    const name = c ? fullName(c.first_name, c.last_name, c.email ?? c.phone ?? "Unnamed contact") : "Unknown contact";
    colById.get(o.stage_id)?.cards.push({
      opportunityId: o.id,
      contactId: o.contact_id,
      name,
      initials: initialsOf(name),
      source: o.source,
      valuePence: o.value_pence,
      updatedAt: o.updated_at,
    });
  }

  const totalPence = (opps ?? []).reduce((sum, o) => sum + (o.value_pence ?? 0), 0);
  return { pipeline, columns, openCount: opps?.length ?? 0, totalPence };
}

/** Numbers and recent activity for the dashboard. */
export async function getDashboard(accountId: string) {
  const supabase = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [contactsWeek, contactsAll, submissions, activity, board] = await Promise.all([
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("account_id", accountId).gte("created_at", weekAgo),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("account_id", accountId),
    supabase.from("form_submissions").select("status").eq("account_id", accountId).gte("started_at", weekAgo),
    supabase.from("activity").select("id, type, summary, created_at, contact_id").eq("account_id", accountId).order("created_at", { ascending: false }).limit(8),
    getPipelineBoard(accountId),
  ]);

  const subs = submissions.data ?? [];
  return {
    newContactsThisWeek: contactsWeek.count ?? 0,
    totalContacts: contactsAll.count ?? 0,
    applicationsStarted: subs.length,
    qualified: subs.filter((s) => s.status === "qualified").length,
    pipelineTotalPence: board?.totalPence ?? 0,
    openOpportunities: board?.openCount ?? 0,
    stages: (board?.columns ?? []).map((c) => ({ name: c.name, count: c.cards.length })),
    activity: (activity.data ?? []).map((a) => ({ id: a.id, type: a.type, summary: a.summary, createdAt: a.created_at, contactId: a.contact_id })) as Activity[],
  };
}
