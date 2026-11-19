import "server-only";
import { permissionsFor, type Permission } from "@/lib/permissions";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// The data access layer: every screen reads the database through these functions.
// They run as the signed-in person, so row-level security limits them to their own workspace.

export type Role = "owner" | "admin" | "member";

export type WorkspaceSummary = { id: string; name: string; role: Role };

export type Workspace = {
  userId: string;
  userEmail: string;
  fullName: string | null;
  firstName: string;
  account: { id: string; name: string; testMode: boolean; role: Role; roleName: string; permissions: Permission[] };
  workspaces: WorkspaceSummary[];
};

/** The cookie that remembers which workspace someone is in. */
export const WORKSPACE_COOKIE = "scalency_ws";

export type ContactRow = {
  id: string;
  name: string;
  initials: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  createdAt: string;
  stage: string | null;
  valuePence: number | null;
};

export type Activity = { id: number; type: string; summary: string; createdAt: string; contactId: string | null };

export type TaskRow = {
  id: string;
  title: string;
  dueOn: string | null;
  doneAt: string | null;
  contactId: string | null;
  contactName: string | null;
  createdAt: string;
};

export function fullName(first: string | null, last: string | null, fallback = "Unnamed contact") {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || fallback;
}

export function initialsOf(name: string) {
  return (
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function formatPence(pence: number | null) {
  if (pence == null) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(pence / 100);
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Today's date in London as YYYY-MM-DD. */
export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
}

/** "Today", "Tomorrow", "Overdue · 3 Nov" or "12 Nov". */
export function dueLabel(dueOn: string | null) {
  if (!dueOn) return null;
  const today = todayISO();
  const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date(Date.now() + 86400000));
  const pretty = new Date(dueOn + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (dueOn === today) return { text: "Today", tone: "amber" as const };
  if (dueOn === tomorrow) return { text: "Tomorrow", tone: "blue" as const };
  if (dueOn < today) return { text: `Overdue · ${pretty}`, tone: "red" as const };
  return { text: pretty, tone: "neutral" as const };
}

/** The signed-in person, once per request. Uses the signed token, so it's fast. */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { supabase, userId: claims.sub as string, email: (claims.email as string | undefined) ?? "" };
});

/**
 * The signed-in person and the workspace they work in, once per request.
 * Sends them to /login if they aren't signed in, or to /welcome if they have no workspace yet.
 */
export const getWorkspace = cache(async (): Promise<Workspace> => {
  const session = await getSession();
  if (!session) redirect("/login");
  const { supabase, userId, email } = session;

  const [memberships, profile, jar] = await Promise.all([
    supabase
      .from("account_members")
      .select("role, permissions, created_at, accounts(id, name, test_mode), account_roles(name, permissions)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase.from("profiles").select("full_name").eq("user_id", userId).maybeSingle(),
    cookies(),
  ]);

  const rows = (memberships.data ?? [])
    .map((m) => ({
      role: m.role as Role,
      acc: m.accounts as unknown as { id: string; name: string; test_mode: boolean } | null,
      custom: m.account_roles as unknown as { name: string; permissions: string[] } | null,
      own: (m.permissions as string[] | null) ?? null,
    }))
    .filter(
      (m): m is { role: Role; acc: { id: string; name: string; test_mode: boolean }; custom: { name: string; permissions: string[] } | null; own: string[] | null } => Boolean(m.acc),
    );
  if (!rows.length) redirect("/welcome");

  // Use the workspace they picked last; otherwise the first one they joined.
  const chosen = jar.get(WORKSPACE_COOKIE)?.value;
  const current = rows.find((r) => r.acc.id === chosen) ?? rows[0];

  const name = profile.data?.full_name ?? null;
  const first = name?.split(/\s+/)[0] || email.split("@")[0] || "there";
  return {
    userId,
    userEmail: email,
    fullName: name,
    firstName: first.charAt(0).toUpperCase() + first.slice(1),
    account: {
      id: current.acc.id,
      name: current.acc.name,
      testMode: current.acc.test_mode,
      role: current.role,
      roleName: current.role === "owner" ? "Owner" : current.role === "admin" ? "Admin" : current.own ? "Custom access" : (current.custom?.name ?? "Team member"),
      permissions: permissionsFor(current.role, current.custom?.permissions, current.own),
    },
    workspaces: rows.map((r) => ({ id: r.acc.id, name: r.acc.name, role: r.role })),
  };
});

/** Whether the signed-in person can do something in their current workspace. */
export function can(ws: Workspace, perm: Permission) {
  return ws.account.permissions.includes(perm);
}

export type AccessRole = { id: string; name: string; description: string | null; permissions: Permission[] };

/** The workspace's roles, for the team and roles pages. */
export async function listRoles(accountId: string): Promise<AccessRole[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("account_roles").select("id, name, description, permissions").eq("account_id", accountId).order("created_at");
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, description: r.description, permissions: permissionsFor("member", r.permissions as string[]) }));
}

/** Strip characters that would break a PostgREST "or" filter. */
function searchTerm(q: string) {
  return q.replace(/[%,()*\\]/g, " ").trim().slice(0, 60);
}

/** Contacts with their current pipeline stage, newest first. Optional search on name, email or phone. */
export type ContactFilters = { tag?: string; owner?: string; source?: string; from?: string; to?: string; has?: string };

export async function listContacts(accountId: string, q = "", limit = 200, f: ContactFilters = {}): Promise<ContactRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, source, created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (f.tag) {
    const { data: tagged } = await supabase.from("contact_tags").select("contact_id, tags!inner(name)").eq("account_id", accountId).ilike("tags.name", searchTerm(f.tag)).limit(5000);
    const ids = (tagged ?? []).map((r) => r.contact_id as string);
    if (!ids.length) return [];
    query = query.in("id", ids.slice(0, 1000));
  }
  if (f.owner === "none") query = query.is("owner_id", null);
  else if (f.owner && /^[0-9a-f-]{36}$/i.test(f.owner)) query = query.eq("owner_id", f.owner);
  if (f.source) query = query.ilike("source", searchTerm(f.source));
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) query = query.gte("created_at", f.from);
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) query = query.lt("created_at", new Date(new Date(f.to).getTime() + 86400000).toISOString());
  if (f.has === "email") query = query.not("email", "is", null);
  if (f.has === "phone") query = query.not("phone", "is", null);
  if (f.has === "no_email") query = query.is("email", null);
  if (f.has === "no_phone") query = query.is("phone", null);
  const term = searchTerm(q);
  if (term) {
    query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  }
  const { data: contacts, error } = await query;
  if (error) throw new Error(`Couldn't load contacts: ${error.message}`);
  if (!contacts?.length) return [];

  const { data: opps } = await supabase
    .from("opportunities")
    .select("contact_id, stage_id, value_pence, updated_at, pipeline_stages(name)")
    .in("contact_id", contacts.map((c) => c.id))
    .order("updated_at", { ascending: false });

  const latest = new Map<string, { stage: string | null; value: number | null }>();
  for (const o of opps ?? []) {
    if (latest.has(o.contact_id)) continue;
    const stage = o.pipeline_stages as unknown as { name: string } | null;
    latest.set(o.contact_id, { stage: stage?.name ?? null, value: o.value_pence });
  }

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
      createdAt: c.created_at,
      stage: opp?.stage ?? null,
      valuePence: opp?.value ?? null,
    };
  });
}

export type Stage = { id: string; name: string; position: number; pipelineId?: string };

/** The workspace's pipeline and its stages, or null if it hasn't been set up yet. */
export type PipelineSummary = { id: string; name: string; position: number };

/** Every pipeline in the workspace, in order. */
export async function listPipelines(accountId: string): Promise<PipelineSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("pipelines").select("id, name, position, created_at").eq("account_id", accountId).order("position").order("created_at");
  return (data ?? []).map((p) => ({ id: p.id as string, name: p.name as string, position: (p.position as number) ?? 0 }));
}

/** One pipeline with its stages: the one asked for, or the first. Null if there are none. */
export async function getPipeline(accountId: string, pipelineId?: string | null): Promise<{ id: string; name: string; stages: Stage[] } | null> {
  const supabase = await createClient();
  let q = supabase.from("pipelines").select("id, name").eq("account_id", accountId);
  q = pipelineId && /^[0-9a-f-]{36}$/i.test(pipelineId) ? q.eq("id", pipelineId) : q.order("position").order("created_at").limit(1);
  const { data: pipeline } = await q.maybeSingle();
  if (!pipeline) return pipelineId ? getPipeline(accountId) : null;
  const { data: stages } = await supabase.from("pipeline_stages").select("id, name, position").eq("pipeline_id", pipeline.id).order("position");
  return { id: pipeline.id as string, name: pipeline.name as string, stages: (stages ?? []) as Stage[] };
}

/** Every stage of every pipeline, labelled "Pipeline: Stage" when there's more than one pipeline. For workflow triggers and steps. */
export async function listAllStages(accountId: string): Promise<{ id: string; name: string; pipelineId: string }[]> {
  const supabase = await createClient();
  const [pipes, stages] = await Promise.all([
    supabase.from("pipelines").select("id, name, position").eq("account_id", accountId).order("position"),
    supabase.from("pipeline_stages").select("id, name, position, pipeline_id").eq("account_id", accountId).order("position"),
  ]);
  const many = (pipes.data ?? []).length > 1;
  const order = new Map((pipes.data ?? []).map((p, i) => [p.id as string, { i, name: p.name as string }]));
  return (stages.data ?? [])
    .filter((st) => order.has(st.pipeline_id as string))
    .sort((a, b) => order.get(a.pipeline_id as string)!.i - order.get(b.pipeline_id as string)!.i || (a.position as number) - (b.position as number))
    .map((st) => ({ id: st.id as string, pipelineId: st.pipeline_id as string, name: many ? `${order.get(st.pipeline_id as string)!.name}: ${st.name}` : (st.name as string) }));
}

/** One contact with everything shown on their record. Returns null if it doesn't exist or isn't theirs. */
export async function getContactDetail(id: string, accountId: string) {
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("contacts")
    .select("id, account_id, first_name, last_name, email, phone, source, created_at, custom, owner_id, email_unsubscribed_at, sms_unsubscribed_at")
    .eq("id", id)
    .eq("account_id", accountId)
    .maybeSingle();
  if (!c) return null;

  const [opps, submissions, activity, tasks, pipeline, tagRows] = await Promise.all([
    supabase.from("opportunities").select("id, pipeline_id, stage_id, status, value_pence, custom, updated_at").eq("contact_id", id).order("updated_at", { ascending: false }).limit(1),
    supabase.from("form_submissions").select("answers").eq("contact_id", id).order("started_at", { ascending: false }).limit(1),
    supabase.from("activity").select("id, type, summary, created_at, contact_id").eq("contact_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("tasks").select("id, title, due_on, done_at, contact_id, created_at").eq("contact_id", id).order("done_at", { ascending: true, nullsFirst: true }).order("due_on", { ascending: true, nullsFirst: false }),
    getPipeline(accountId),
    supabase.from("contact_tags").select("tags(id, name)").eq("contact_id", id),
  ]);

  const opp = opps.data?.[0] ?? null;
  const name = fullName(c.first_name, c.last_name, c.email ?? c.phone ?? "Unnamed contact");
  const answers: Record<string, unknown> = { ...(submissions.data?.[0]?.answers ?? {}), ...((opp?.custom as Record<string, unknown>) ?? {}) };

  return {
    id: c.id as string,
    firstName: (c.first_name as string | null) ?? "",
    lastName: (c.last_name as string | null) ?? "",
    name,
    initials: initialsOf(name),
    email: c.email as string | null,
    phone: c.phone as string | null,
    source: c.source as string | null,
    createdAt: c.created_at as string,
    opportunity: opp ? { id: opp.id as string, status: opp.status as string, valuePence: opp.value_pence as number | null, stageId: opp.stage_id as string } : null,
    pipeline,
    ownerId: (c.owner_id as string | null) ?? null,
    custom: ((c.custom as Record<string, unknown>) ?? {}) as Record<string, unknown>,
    emailUnsubscribed: Boolean(c.email_unsubscribed_at),
    smsUnsubscribed: Boolean(c.sms_unsubscribed_at),
    tags: ((tagRows.data ?? []) as unknown as { tags: { id: string; name: string } | null }[])
      .map((r) => r.tags)
      .filter((t): t is { id: string; name: string } => Boolean(t))
      .sort((a, b) => a.name.localeCompare(b.name)),
    answers,
    activity: (activity.data ?? []).map((a) => ({ id: a.id, type: a.type, summary: a.summary, createdAt: a.created_at, contactId: a.contact_id })) as Activity[],
    tasks: (tasks.data ?? []).map((t) => ({ id: t.id, title: t.title, dueOn: t.due_on, doneAt: t.done_at, contactId: t.contact_id, contactName: name, createdAt: t.created_at })) as TaskRow[],
  };
}

export type BoardCard = {
  opportunityId: string;
  contactId: string;
  name: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  initials: string;
  valuePence: number | null;
  status: "open" | "won" | "lost" | "abandoned";
  stageId: string;
  ownerId: string | null;
  ownerName: string | null;
  source: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};
export type BoardColumn = { id: string; name: string; cards: BoardCard[] };

export type DealFilters = {
  q?: string;
  owner?: string; // a user id, "me" or "none"
  status?: string; // open (default), won, lost, abandoned, all
  source?: string;
  tag?: string;
  min?: string; // pounds
  max?: string;
  from?: string; // YYYY-MM-DD
  to?: string;
  sort?: string; // updated (default), created, value, name
};

/** The pipeline as columns of cards (or null if there's no pipeline yet), with filters. */
export async function getPipelineBoard(accountId: string, pipelineId?: string | null, f: DealFilters = {}) {
  const pipeline = await getPipeline(accountId, pipelineId);
  if (!pipeline) return null;
  const supabase = await createClient();

  let q = supabase
    .from("opportunities")
    .select("id, name, contact_id, stage_id, status, value_pence, source, assigned_to, created_at, updated_at, contacts(first_name, last_name, email, phone)")
    .eq("pipeline_id", pipeline.id)
    .limit(2000);
  const status = f.status && ["open", "won", "lost", "abandoned", "all"].includes(f.status) ? f.status : "open";
  if (status !== "all") q = q.eq("status", status);
  if (f.owner === "none") q = q.is("assigned_to", null);
  else if (f.owner && /^[0-9a-f-]{36}$/i.test(f.owner)) q = q.eq("assigned_to", f.owner);
  if (f.source) q = q.ilike("source", searchTerm(f.source));
  const min = Number(f.min);
  const max = Number(f.max);
  if (f.min && Number.isFinite(min)) q = q.gte("value_pence", Math.round(min * 100));
  if (f.max && Number.isFinite(max)) q = q.lte("value_pence", Math.round(max * 100));
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) q = q.gte("created_at", f.from);
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) q = q.lt("created_at", new Date(new Date(f.to).getTime() + 86400000).toISOString());
  const sort = f.sort ?? "updated";
  q = sort === "created" ? q.order("created_at", { ascending: false }) : sort === "value" ? q.order("value_pence", { ascending: false, nullsFirst: false }) : sort === "name" ? q.order("name") : q.order("updated_at", { ascending: false });

  const { data: rows } = await q;
  let opps = rows ?? [];

  const term = searchTerm(f.q ?? "").toLowerCase();
  if (term) {
    opps = opps.filter((o) => {
      const c = o.contacts as unknown as { first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null;
      return [o.name, c?.first_name, c?.last_name, c?.email, c?.phone].some((v) => (v ?? "").toLowerCase().includes(term));
    });
  }

  // Tags and owner names, in two quick lookups.
  const contactIds = [...new Set(opps.map((o) => o.contact_id as string))];
  const ownerIds = [...new Set(opps.map((o) => o.assigned_to as string | null).filter(Boolean) as string[])];
  const [tagRows, owners] = await Promise.all([
    contactIds.length ? supabase.from("contact_tags").select("contact_id, tags(name)").in("contact_id", contactIds.slice(0, 1000)) : Promise.resolve({ data: [] as { contact_id: string; tags: unknown }[] }),
    ownerIds.length ? memberNames(accountId) : Promise.resolve({} as Record<string, string>),
  ]);
  const tagsBy = new Map<string, string[]>();
  for (const r of (tagRows.data ?? []) as { contact_id: string; tags: unknown }[]) {
    const name = (r.tags as { name: string } | null)?.name;
    if (name) tagsBy.set(r.contact_id, [...(tagsBy.get(r.contact_id) ?? []), name]);
  }
  if (f.tag) {
    const want = f.tag.toLowerCase();
    opps = opps.filter((o) => (tagsBy.get(o.contact_id as string) ?? []).some((t) => t.toLowerCase() === want));
  }

  const columns: BoardColumn[] = pipeline.stages.map((s) => ({ id: s.id, name: s.name, cards: [] }));
  const colById = new Map(columns.map((c) => [c.id, c]));
  const cards: BoardCard[] = opps.map((o) => {
    const c = o.contacts as unknown as { first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null;
    const contactName = c ? fullName(c.first_name, c.last_name, c.email ?? c.phone ?? "Unnamed contact") : "Unknown contact";
    const name = (o.name as string) || contactName;
    return {
      opportunityId: o.id as string,
      contactId: o.contact_id as string,
      name,
      contactName,
      email: c?.email ?? null,
      phone: c?.phone ?? null,
      initials: initialsOf(contactName),
      valuePence: o.value_pence as number | null,
      status: o.status as BoardCard["status"],
      stageId: o.stage_id as string,
      ownerId: (o.assigned_to as string | null) ?? null,
      ownerName: o.assigned_to ? (owners[o.assigned_to as string] ?? null) : null,
      source: (o.source as string | null) ?? null,
      tags: tagsBy.get(o.contact_id as string) ?? [],
      createdAt: o.created_at as string,
      updatedAt: o.updated_at as string,
    };
  });
  for (const card of cards) colById.get(card.stageId)?.cards.push(card);

  const totalPence = cards.reduce((sum, o) => sum + (o.valuePence ?? 0), 0);
  return { pipeline, columns, cards, openCount: cards.length, totalPence, status };
}

/** Values used by the deal filters: sources and tags seen in this workspace. */
export async function dealFilterOptions(accountId: string) {
  const supabase = await createClient();
  const [sources, tags] = await Promise.all([
    supabase.from("opportunities").select("source").eq("account_id", accountId).not("source", "is", null).limit(1000),
    supabase.from("tags").select("name").eq("account_id", accountId).order("name"),
  ]);
  return {
    sources: [...new Set((sources.data ?? []).map((r) => (r.source as string).trim()).filter(Boolean))].sort().slice(0, 50),
    tags: (tags.data ?? []).map((t) => t.name as string),
  };
}

/** One deal with everything the deal panel edits. */
export async function getDeal(accountId: string, id: string) {
  const supabase = await createClient();
  const { data: o } = await supabase
    .from("opportunities")
    .select("id, name, contact_id, pipeline_id, stage_id, status, value_pence, source, assigned_to, custom, lost_reason, created_at, contacts(first_name, last_name, email, phone)")
    .eq("id", id)
    .eq("account_id", accountId)
    .maybeSingle();
  if (!o) return null;
  const c = o.contacts as unknown as { first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null;
  return {
    id: o.id as string,
    name: o.name as string,
    contactId: o.contact_id as string,
    contactName: c ? fullName(c.first_name, c.last_name, c.email ?? c.phone ?? "Unnamed contact") : "Unknown contact",
    email: c?.email ?? null,
    phone: c?.phone ?? null,
    pipelineId: o.pipeline_id as string,
    stageId: o.stage_id as string,
    status: o.status as BoardCard["status"],
    valuePence: o.value_pence as number | null,
    source: (o.source as string | null) ?? null,
    ownerId: (o.assigned_to as string | null) ?? null,
    custom: (o.custom ?? {}) as Record<string, unknown>,
    lostReason: (o.lost_reason as string | null) ?? null,
    createdAt: o.created_at as string,
  };
}
export type Deal = NonNullable<Awaited<ReturnType<typeof getDeal>>>;

/** Tasks for the workspace, open first, soonest due first. */
export async function listTasks(accountId: string, show: "open" | "done" = "open", limit = 200): Promise<TaskRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select("id, title, due_on, done_at, contact_id, created_at, contacts(first_name, last_name, email, phone)")
    .eq("account_id", accountId)
    .limit(limit);
  query = show === "open" ? query.is("done_at", null).order("due_on", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }) : query.not("done_at", "is", null).order("done_at", { ascending: false });
  const { data } = await query;
  return (data ?? []).map((t) => {
    const c = t.contacts as unknown as { first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null;
    return {
      id: t.id,
      title: t.title,
      dueOn: t.due_on,
      doneAt: t.done_at,
      contactId: t.contact_id,
      contactName: c ? fullName(c.first_name, c.last_name, c.email ?? c.phone ?? "Contact") : null,
      createdAt: t.created_at,
    };
  });
}

/** Contacts as simple options for pickers (e.g. linking a task). */
export async function contactOptions(accountId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("contacts").select("id, first_name, last_name, email, phone").eq("account_id", accountId).order("created_at", { ascending: false }).limit(500);
  return (data ?? []).map((c) => ({ id: c.id as string, name: fullName(c.first_name, c.last_name, c.email ?? c.phone ?? "Contact") }));
}

/** Everything on the home screen. */
export async function getDashboard(accountId: string) {
  const supabase = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const today = todayISO();

  const [contactsAll, contactsWeek, activity, board, tasksDue, members, invites, myTasks] = await Promise.all([
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("account_id", accountId),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("account_id", accountId).gte("created_at", weekAgo),
    supabase.from("activity").select("id, type, summary, created_at, contact_id").eq("account_id", accountId).order("created_at", { ascending: false }).limit(7),
    getPipelineBoard(accountId),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("account_id", accountId).is("done_at", null).lte("due_on", today),
    supabase.from("account_members").select("user_id", { count: "exact", head: true }).eq("account_id", accountId),
    supabase.from("account_invites").select("id", { count: "exact", head: true }).eq("account_id", accountId),
    listTasks(accountId, "open", 5),
  ]);

  return {
    totalContacts: contactsAll.count ?? 0,
    newContactsThisWeek: contactsWeek.count ?? 0,
    pipelineTotalPence: board?.totalPence ?? 0,
    openOpportunities: board?.openCount ?? 0,
    tasksDue: tasksDue.count ?? 0,
    stages: (board?.columns ?? []).map((c) => ({ id: c.id, name: c.name, count: c.cards.length })),
    activity: (activity.data ?? []).map((a) => ({ id: a.id, type: a.type, summary: a.summary, createdAt: a.created_at, contactId: a.contact_id })) as Activity[],
    myTasks,
    checklist: {
      pipeline: Boolean(board && board.columns.length),
      contact: (contactsAll.count ?? 0) > 0,
      team: (members.count ?? 0) > 1 || (invites.count ?? 0) > 0,
    },
  };
}

export type Member = { userId: string; role: Role; roleId: string | null; permissions: string[] | null; access: string; name: string; email: string | null; joinedAt: string; isYou: boolean };

/** Members of the workspace and open invites. */
export async function getTeam(accountId: string, userId: string) {
  const supabase = await createClient();
  const [members, invites] = await Promise.all([
    supabase.from("account_members").select("user_id, role, role_id, permissions, created_at, account_roles(name)").eq("account_id", accountId).order("created_at"),
    supabase
      .from("account_invites")
      .select("id, email, role, permissions, created_at, expires_at, account_roles(name)")
      .eq("account_id", accountId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ]);
  const ids = (members.data ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids) : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  return {
    members: (members.data ?? []).map((m) => {
      const p = byId.get(m.user_id);
      return {
        userId: m.user_id,
        role: m.role as Role,
        roleId: (m.role_id as string | null) ?? null,
        permissions: (m.permissions as string[] | null) ?? null,
        access:
          m.role === "owner"
            ? "Owner"
            : m.role === "admin"
              ? "Admin"
              : m.permissions
                ? "Custom access"
                : ((m.account_roles as unknown as { name: string } | null)?.name ?? "Team member"),
        name: p?.full_name ?? (m.user_id === userId ? "You" : "Teammate"),
        email: p?.email ?? null,
        joinedAt: m.created_at,
        isYou: m.user_id === userId,
      } satisfies Member;
    }),
    invites: (invites.data ?? []).map((i) => ({
      id: i.id as string,
      email: i.email as string,
      access: i.role === "admin" ? "Admin" : i.permissions ? "Custom access" : ((i.account_roles as unknown as { name: string } | null)?.name ?? "Team member"),
      createdAt: i.created_at as string,
      expired: new Date(i.expires_at as string).getTime() < Date.now(),
    })),
  };
}

/** The signed-in person's profile for the settings page. */
export async function getProfile(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("full_name, job_title, phone").eq("user_id", userId).maybeSingle();
  return { fullName: data?.full_name ?? "", jobTitle: data?.job_title ?? "", phone: data?.phone ?? "" };
}

export type NoteRow = { id: number; text: string; author: string | null; createdAt: string; contactId: string | null; contactName: string | null };

/** Every note written on a contact, newest first. Optional search. */
export async function listNotes(accountId: string, q = "", limit = 200): Promise<NoteRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("activity")
    .select("id, summary, detail, created_at, contact_id, contacts(first_name, last_name, email, phone)")
    .eq("account_id", accountId)
    .eq("type", "note")
    .order("created_at", { ascending: false })
    .limit(limit);
  const term = searchTerm(q);
  if (term) query = query.ilike("summary", `%${term}%`);
  const { data } = await query;
  return (data ?? []).map((n) => {
    const c = n.contacts as unknown as { first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null;
    const detail = (n.detail ?? {}) as { author?: string };
    return {
      id: n.id,
      text: n.summary,
      author: detail.author ?? null,
      createdAt: n.created_at,
      contactId: n.contact_id,
      contactName: c ? fullName(c.first_name, c.last_name, c.email ?? c.phone ?? "Contact") : null,
    };
  });
}

/** New contacts in the last 7 days, for the sidebar counter. */
export async function leadsThisWeek(accountId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Invitations, workflows, chat and inbox
// ---------------------------------------------------------------------------

export type PendingInvite = { id: string; workspace: string; role: string };

/** Invites waiting for the signed-in person. */
export async function myPendingInvites(): Promise<PendingInvite[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_pending_invites");
  return ((data ?? []) as { invite_id: string; account_name: string; role: string }[]).map((r) => ({ id: r.invite_id, workspace: r.account_name, role: r.role }));
}

export type WaitUnit = "minutes" | "hours" | "days";
export type ConditionField =
  | "has_tag" | "has_email" | "has_phone" | "replied" | "in_stage" | "deal_status" | "source_is" | "has_owner"
  | "contact_field" | "owner_is" | "deal_value" | "in_pipeline" | "day_of_week" | "time_of_day";
export type ConditionOp = "is" | "is_not" | "contains" | "not_contains" | "empty" | "not_empty" | "gt" | "lt";
export type Condition = { field: ConditionField; value?: string; negate?: boolean; op?: ConditionOp; key?: string };
export type CompiledRoute = { name: string; match: "all" | "any"; conditions: Condition[]; goto: string };

type StepBase = { id?: string; label?: string };
export type WorkflowStep = StepBase &
  (
    | { type: "wait"; amount: number; unit: WaitUnit }
    | { type: "wait_until"; hour: number; minute: number; weekdays_only: boolean }
    | { type: "wait_for_reply"; amount: number; unit: WaitUnit }
    | { type: "email"; subject: string; body: string; html?: string; mode?: "text" | "design" | "code" }
    | { type: "sms"; body: string }
    | { type: "task"; title: string; due_in_days: number }
    | { type: "move_stage"; stage_id: string }
    | { type: "set_status"; status: "open" | "won" | "lost" }
    | { type: "note"; text: string }
    | { type: "notify_team"; text: string }
    | { type: "add_tag"; tag?: string; tags?: string[] }
    | { type: "remove_tag"; tag?: string; tags?: string[] }
    | { type: "assign"; user_id: string }
    | { type: "if_else"; condition: Condition; else: string }
    | { type: "add_to_workflow"; workflow_id: string }
    | { type: "remove_from_workflow"; workflow_id: string }
    | { type: "webhook"; url: string }
    | { type: "update_field"; field: string; value: string }
    | { type: "email_team"; to: string; subject: string; body: string }
    | { type: "end" }
    | { type: "branch"; routes: CompiledRoute[]; otherwise_name: string; otherwise_goto: string }
    | { type: "goto"; target: string }
  );
export type StepType = WorkflowStep["type"];

export type WorkflowTrigger =
  | { type: "none" }
  | { type: "contact_created" }
  | { type: "stage_entered"; stage_id: string; pipeline_id?: string }
  | { type: "deal_created"; pipeline_id?: string }
  | { type: "form_submitted"; form_id?: string }
  | { type: "tag_added"; tag: string }
  | { type: "tag_removed"; tag: string }
  | { type: "deal_won"; pipeline_id?: string }
  | { type: "deal_lost"; pipeline_id?: string }
  | { type: "message_received"; channel: "any" | "sms" | "email" }
  | { type: "webhook"; token: string }
  | { type: "manual" };

export type WorkflowRow = {
  id: string;
  name: string;
  description: string | null;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  status: "draft" | "active" | "paused" | "archived";
  approvedBy: string | null;
  updatedAt: string;
  activeCount: number;
  totalCount: number;
};

export async function listWorkflows(accountId: string): Promise<WorkflowRow[]> {
  const supabase = await createClient();
  const [{ data }, { data: enr }] = await Promise.all([
    supabase.from("workflows").select("id, name, description, trigger, steps, status, client_approved_by, updated_at").eq("account_id", accountId).neq("status", "archived").order("updated_at", { ascending: false }),
    supabase.from("workflow_enrollments").select("workflow_id, status").eq("account_id", accountId).limit(5000),
  ]);
  return (data ?? []).map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    trigger: w.trigger as WorkflowTrigger,
    steps: (w.steps ?? []) as WorkflowStep[],
    status: w.status,
    approvedBy: w.client_approved_by,
    updatedAt: w.updated_at,
    activeCount: (enr ?? []).filter((e) => e.workflow_id === w.id && (e.status === "active" || e.status === "waiting")).length,
    totalCount: (enr ?? []).filter((e) => e.workflow_id === w.id).length,
  }));
}

export async function getWorkflow(id: string, accountId: string) {
  const supabase = await createClient();
  const { data: w } = await supabase.from("workflows").select("id, name, description, trigger, steps, graph, status, stop_on_reply, client_approved_by, client_approved_at, updated_at").eq("id", id).eq("account_id", accountId).maybeSingle();
  if (!w) return null;
  const { data: enr } = await supabase
    .from("workflow_enrollments")
    .select("id, status, current_step, next_run_at, entered_at, finished_at, exit_reason, contact_id, contacts(first_name, last_name, email, phone), workflow_step_runs(step_key, action, outcome, detail, ran_at)")
    .eq("workflow_id", id)
    .order("entered_at", { ascending: false })
    .limit(50);
  return {
    id: w.id as string,
    name: w.name as string,
    description: (w.description as string | null) ?? "",
    trigger: w.trigger as WorkflowTrigger,
    steps: (w.steps ?? []) as WorkflowStep[],
    graph: (w.graph ?? null) as unknown[] | null,
    status: w.status as WorkflowRow["status"],
    stopOnReply: w.stop_on_reply as boolean,
    approvedBy: w.client_approved_by as string | null,
    approvedAt: w.client_approved_at as string | null,
    enrollments: (enr ?? []).map((e) => {
      const c = e.contacts as unknown as { first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null;
      const runs = ((e.workflow_step_runs ?? []) as { step_key: string; action: string; outcome: string; detail: Record<string, unknown>; ran_at: string }[]).sort((a, b) => a.ran_at.localeCompare(b.ran_at));
      return {
        id: e.id as string,
        status: e.status as string,
        nextRunAt: e.next_run_at as string | null,
        enteredAt: e.entered_at as string,
        exitReason: e.exit_reason as string | null,
        contactId: e.contact_id as string,
        contactName: c ? fullName(c.first_name, c.last_name, c.email ?? c.phone ?? "Contact") : "Contact",
        runs,
      };
    }),
  };
}

export type Channel = { id: string; name: string; topic: string | null };
export type ChatMessage = { id: number; body: string; authorId: string | null; authorName: string; createdAt: string; contactId: string | null };

/** Chat channels, creating #general and #leads the first time. */
export async function listChannels(accountId: string): Promise<Channel[]> {
  const supabase = await createClient();
  let { data } = await supabase.from("chat_channels").select("id, name, topic").eq("account_id", accountId).order("created_at");
  if (!data?.length) {
    await supabase.from("chat_channels").insert([
      { account_id: accountId, name: "general", topic: "Anything and everything." },
      { account_id: accountId, name: "leads", topic: "New leads and bookings, posted automatically." },
    ]);
    ({ data } = await supabase.from("chat_channels").select("id, name, topic").eq("account_id", accountId).order("created_at"));
  }
  return (data ?? []) as Channel[];
}

/** Names for everyone in the workspace, by login id. */
export async function memberNames(accountId: string) {
  const supabase = await createClient();
  const { data: members } = await supabase.from("account_members").select("user_id").eq("account_id", accountId);
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids) : { data: [] };
  const map: Record<string, string> = {};
  for (const id of ids) map[id] = "Teammate";
  for (const p of profiles ?? []) map[p.user_id] = p.full_name ?? p.email ?? "Teammate";
  return map;
}

export async function listChatMessages(accountId: string, channelId: string, names: Record<string, string>, limit = 100): Promise<ChatMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("chat_messages").select("id, body, author_id, created_at, contact_id").eq("account_id", accountId).eq("channel_id", channelId).order("created_at", { ascending: false }).limit(limit);
  return (data ?? [])
    .reverse()
    .map((m) => ({ id: m.id, body: m.body, authorId: m.author_id, authorName: m.author_id ? (names[m.author_id] ?? "Teammate") : "Scalency", createdAt: m.created_at, contactId: m.contact_id }));
}

export type Thread = { contactId: string; name: string; initials: string; last: string; lastAt: string; channel: string; count: number };
export type InboxMessage = { id: string; channel: "email" | "sms"; direction: "outbound" | "inbound"; subject: string | null; body: string; status: string; toAddress: string; createdAt: string; sentAt: string | null; error: string | null };

/** Conversations grouped by contact, latest first. */
export async function listThreads(accountId: string): Promise<Thread[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("contact_id, channel, subject, body, created_at, contacts(first_name, last_name, email, phone)")
    .eq("account_id", accountId)
    .not("contact_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1000);
  const threads = new Map<string, Thread>();
  for (const m of data ?? []) {
    const t = threads.get(m.contact_id);
    if (t) {
      t.count += 1;
      continue;
    }
    const c = m.contacts as unknown as { first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null;
    const name = c ? fullName(c.first_name, c.last_name, c.email ?? c.phone ?? "Contact") : "Contact";
    threads.set(m.contact_id, { contactId: m.contact_id, name, initials: initialsOf(name), last: m.subject ?? m.body, lastAt: m.created_at, channel: m.channel, count: 1 });
  }
  return [...threads.values()];
}

export async function listThreadMessages(accountId: string, contactId: string): Promise<InboxMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, channel, direction, subject, body, status, to_address, created_at, sent_at, error")
    .eq("account_id", accountId)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: true })
    .limit(300);
  return (data ?? []).map((m) => ({ id: m.id, channel: m.channel, direction: m.direction, subject: m.subject, body: m.body, status: m.status, toAddress: m.to_address, createdAt: m.created_at, sentAt: m.sent_at, error: m.error }));
}

/** Every tag name in the workspace, for pickers. */
export async function listTags(accountId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("tags").select("name").eq("account_id", accountId).order("name").limit(500);
  return (data ?? []).map((t) => t.name as string);
}

export type CustomField = { id: string; key: string; label: string; type: import("@/lib/field-types").FieldType; options: string[] };
export type CustomValue = { key: string; value: string };

/** The workspace's own contact fields (like GoHighLevel custom fields). */
export async function listCustomFields(accountId: string, object: "contact" | "opportunity" = "contact"): Promise<CustomField[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("custom_fields").select("id, key, label, type, options").eq("account_id", accountId).eq("object", object).order("position").order("created_at");
  return (data ?? []).map((f) => ({ ...f, options: Array.isArray(f.options) ? (f.options as string[]) : [] })) as CustomField[];
}

/** Reusable values for messages, like a booking link (like GoHighLevel custom values). */
export async function listCustomValues(accountId: string): Promise<CustomValue[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("custom_values").select("key, value").eq("account_id", accountId).order("key");
  return (data ?? []) as CustomValue[];
}

export type WorkspaceCard = { id: string; name: string; role: string; contacts: number; openDeals: number; newLeads: number };

/** Quick numbers for each workspace on the "All workspaces" page. */
export async function workspaceCards(list: { id: string; name: string; role: string }[]): Promise<WorkspaceCard[]> {
  const supabase = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  return Promise.all(
    list.slice(0, 30).map(async (w) => {
      const [contacts, deals, leads] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }).eq("account_id", w.id),
        supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("account_id", w.id).eq("status", "open"),
        supabase.from("contacts").select("id", { count: "exact", head: true }).eq("account_id", w.id).gte("created_at", weekAgo),
      ]);
      return { ...w, contacts: contacts.count ?? 0, openDeals: deals.count ?? 0, newLeads: leads.count ?? 0 };
    }),
  );
}

/** Sources seen on contacts, for the contacts filter. */
export async function contactSources(accountId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("contacts").select("source").eq("account_id", accountId).not("source", "is", null).limit(2000);
  return [...new Set((data ?? []).map((r) => (r.source as string).trim()).filter(Boolean))].sort().slice(0, 50);
}

/** Data for the home page widgets that aren't in getDashboard. Only what the layout uses is loaded. */
export async function getDashboardExtras(accountId: string, types: Set<string>, pipelineIds: string[]) {
  const supabase = await createClient();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const days = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

  const [won, closed, recent, open, boards] = await Promise.all([
    types.has("stat_won_month")
      ? supabase.from("opportunities").select("value_pence").eq("account_id", accountId).eq("status", "won").gte("updated_at", monthStart).limit(5000)
      : null,
    types.has("stat_win_rate")
      ? supabase.from("opportunities").select("status").eq("account_id", accountId).in("status", ["won", "lost"]).gte("updated_at", days(90)).limit(10000)
      : null,
    types.has("leads_chart") || types.has("leads_by_source")
      ? supabase.from("contacts").select("created_at, source").eq("account_id", accountId).gte("created_at", days(30)).order("created_at", { ascending: false }).limit(5000)
      : null,
    types.has("deals_by_owner") ? supabase.from("opportunities").select("assigned_to, value_pence").eq("account_id", accountId).eq("status", "open").limit(10000) : null,
    Promise.all([...new Set(pipelineIds)].map(async (id) => [id, await getPipelineBoard(accountId, id)] as const)),
  ]);

  const wonRows = won?.data ?? [];
  const closedRows = closed?.data ?? [];
  const wonCount = closedRows.filter((r) => r.status === "won").length;

  // Leads per day for the last 30 days (oldest first), in UK time.
  const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);
  const perDay = new Map<string, number>();
  for (let i = 29; i >= 0; i--) perDay.set(dayKey(new Date(Date.now() - i * 86400000)), 0);
  const bySource = new Map<string, number>();
  for (const c of recent?.data ?? []) {
    const k = dayKey(new Date(c.created_at as string));
    if (perDay.has(k)) perDay.set(k, (perDay.get(k) ?? 0) + 1);
    const src = ((c.source as string | null) ?? "").trim() || "Unknown";
    bySource.set(src, (bySource.get(src) ?? 0) + 1);
  }

  let owners: { name: string; count: number; valuePence: number }[] = [];
  if (open?.data) {
    const names = await memberNames(accountId);
    const m = new Map<string, { count: number; valuePence: number }>();
    for (const o of open.data) {
      const k = (o.assigned_to as string | null) ?? "";
      const cur = m.get(k) ?? { count: 0, valuePence: 0 };
      cur.count++;
      cur.valuePence += (o.value_pence as number | null) ?? 0;
      m.set(k, cur);
    }
    owners = [...m.entries()].map(([k, v]) => ({ name: k ? (names[k] ?? "Teammate") : "Nobody yet", ...v })).sort((a, b) => b.valuePence - a.valuePence || b.count - a.count);
  }

  return {
    wonMonth: { count: wonRows.length, valuePence: wonRows.reduce((n, r) => n + ((r.value_pence as number | null) ?? 0), 0) },
    winRate: closedRows.length ? { rate: Math.round((wonCount / closedRows.length) * 100), won: wonCount, closed: closedRows.length } : null,
    leadsPerDay: [...perDay.entries()].map(([day, count]) => ({ day, count })),
    leadsBySource: [...bySource.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
    owners,
    boards: Object.fromEntries(boards) as Record<string, Awaited<ReturnType<typeof getPipelineBoard>>>,
  };
}
