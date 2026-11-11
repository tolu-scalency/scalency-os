import "server-only";
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
  account: { id: string; name: string; testMode: boolean; role: Role };
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
    supabase.from("account_members").select("role, created_at, accounts(id, name, test_mode)").eq("user_id", userId).order("created_at", { ascending: true }),
    supabase.from("profiles").select("full_name").eq("user_id", userId).maybeSingle(),
    cookies(),
  ]);

  const rows = (memberships.data ?? [])
    .map((m) => ({ role: m.role as Role, acc: m.accounts as unknown as { id: string; name: string; test_mode: boolean } | null }))
    .filter((m): m is { role: Role; acc: { id: string; name: string; test_mode: boolean } } => Boolean(m.acc));
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
    account: { id: current.acc.id, name: current.acc.name, testMode: current.acc.test_mode, role: current.role },
    workspaces: rows.map((r) => ({ id: r.acc.id, name: r.acc.name, role: r.role })),
  };
});

/** Strip characters that would break a PostgREST "or" filter. */
function searchTerm(q: string) {
  return q.replace(/[%,()*\\]/g, " ").trim().slice(0, 60);
}

/** Contacts with their current pipeline stage, newest first. Optional search on name, email or phone. */
export async function listContacts(accountId: string, q = "", limit = 200): Promise<ContactRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, source, created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);
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

export type Stage = { id: string; name: string; position: number };

/** The workspace's pipeline and its stages, or null if it hasn't been set up yet. */
export async function getPipeline(accountId: string) {
  const supabase = await createClient();
  const { data: pipeline } = await supabase.from("pipelines").select("id, name").eq("account_id", accountId).order("created_at").limit(1).maybeSingle();
  if (!pipeline) return null;
  const { data: stages } = await supabase.from("pipeline_stages").select("id, name, position").eq("pipeline_id", pipeline.id).order("position");
  return { id: pipeline.id as string, name: pipeline.name as string, stages: (stages ?? []) as Stage[] };
}

/** One contact with everything shown on their record. Returns null if it doesn't exist or isn't theirs. */
export async function getContactDetail(id: string, accountId: string) {
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("contacts")
    .select("id, account_id, first_name, last_name, email, phone, source, created_at, custom")
    .eq("id", id)
    .eq("account_id", accountId)
    .maybeSingle();
  if (!c) return null;

  const [opps, submissions, activity, tasks, pipeline] = await Promise.all([
    supabase.from("opportunities").select("id, pipeline_id, stage_id, status, value_pence, custom, updated_at").eq("contact_id", id).order("updated_at", { ascending: false }).limit(1),
    supabase.from("form_submissions").select("answers").eq("contact_id", id).order("started_at", { ascending: false }).limit(1),
    supabase.from("activity").select("id, type, summary, created_at, contact_id").eq("contact_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("tasks").select("id, title, due_on, done_at, contact_id, created_at").eq("contact_id", id).order("done_at", { ascending: true, nullsFirst: true }).order("due_on", { ascending: true, nullsFirst: false }),
    getPipeline(accountId),
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
    answers,
    activity: (activity.data ?? []).map((a) => ({ id: a.id, type: a.type, summary: a.summary, createdAt: a.created_at, contactId: a.contact_id })) as Activity[],
    tasks: (tasks.data ?? []).map((t) => ({ id: t.id, title: t.title, dueOn: t.due_on, doneAt: t.done_at, contactId: t.contact_id, contactName: name, createdAt: t.created_at })) as TaskRow[],
  };
}

export type BoardCard = { opportunityId: string; contactId: string; name: string; initials: string; valuePence: number | null; updatedAt: string };
export type BoardColumn = { id: string; name: string; cards: BoardCard[] };

/** The pipeline as columns of cards, or null if there's no pipeline yet. */
export async function getPipelineBoard(accountId: string) {
  const pipeline = await getPipeline(accountId);
  if (!pipeline) return null;
  const supabase = await createClient();

  const { data: opps } = await supabase
    .from("opportunities")
    .select("id, contact_id, stage_id, value_pence, updated_at, contacts(first_name, last_name, email, phone)")
    .eq("pipeline_id", pipeline.id)
    .eq("status", "open")
    .order("updated_at", { ascending: false })
    .limit(1000);

  const columns: BoardColumn[] = pipeline.stages.map((s) => ({ id: s.id, name: s.name, cards: [] }));
  const colById = new Map(columns.map((c) => [c.id, c]));
  for (const o of opps ?? []) {
    const c = o.contacts as unknown as { first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null;
    const name = c ? fullName(c.first_name, c.last_name, c.email ?? c.phone ?? "Unnamed contact") : "Unknown contact";
    colById.get(o.stage_id)?.cards.push({ opportunityId: o.id, contactId: o.contact_id, name, initials: initialsOf(name), valuePence: o.value_pence, updatedAt: o.updated_at });
  }

  const totalPence = (opps ?? []).reduce((sum, o) => sum + (o.value_pence ?? 0), 0);
  return { pipeline, columns, openCount: opps?.length ?? 0, totalPence };
}

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

export type Member = { userId: string; role: Role; name: string; email: string | null; joinedAt: string; isYou: boolean };

/** Members of the workspace and open invites. */
export async function getTeam(accountId: string, userId: string) {
  const supabase = await createClient();
  const [members, invites] = await Promise.all([
    supabase.from("account_members").select("user_id, role, created_at").eq("account_id", accountId).order("created_at"),
    supabase.from("account_invites").select("id, email, role, created_at").eq("account_id", accountId).is("accepted_at", null).order("created_at", { ascending: false }),
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
        name: p?.full_name ?? (m.user_id === userId ? "You" : "Teammate"),
        email: p?.email ?? null,
        joinedAt: m.created_at,
        isYou: m.user_id === userId,
      } satisfies Member;
    }),
    invites: (invites.data ?? []).map((i) => ({ id: i.id as string, email: i.email as string, role: i.role as string, createdAt: i.created_at as string })),
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

export type WorkflowStep =
  | { type: "wait"; amount: number; unit: "minutes" | "hours" | "days" }
  | { type: "email"; subject: string; body: string }
  | { type: "sms"; body: string }
  | { type: "task"; title: string; due_in_days: number }
  | { type: "move_stage"; stage_id: string }
  | { type: "note"; text: string }
  | { type: "notify_team"; text: string };

export type WorkflowTrigger = { type: "contact_created" } | { type: "stage_entered"; stage_id: string } | { type: "manual" };

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
  const { data: w } = await supabase.from("workflows").select("id, name, description, trigger, steps, status, client_approved_by, client_approved_at, updated_at").eq("id", id).eq("account_id", accountId).maybeSingle();
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
    status: w.status as WorkflowRow["status"],
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
