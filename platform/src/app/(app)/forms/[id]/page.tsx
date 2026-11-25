import type { Metadata } from "next";
import { fullId } from "@/lib/short-id";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { can, getWorkspace, listAllStages, listCustomFields, listPipelines, listTags } from "@/lib/data";
import { cleanDefinition } from "@/lib/form-builder";
import { createClient } from "@/lib/supabase/server";
import { formsHealth } from "@/lib/forms-health";
import { FormEditor, type Submission } from "./form-editor";

export const metadata: Metadata = { title: "Form" };

/** Server-side date maths, kept out of the component body. */
function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

export default async function FormPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id: raw }, { tab }] = await Promise.all([params, searchParams]);
  const id = await fullId("forms", raw);
  const ws = await getWorkspace();
  const supabase = await createClient();
  const { data: form } = await supabase.from("forms").select("id, name, slug, status, definition, tags, stage_id, redirect_url").eq("id", id).eq("account_id", ws.account.id).maybeSingle();
  if (!form) notFound();

  const since = daysAgo(30).slice(0, 10);
  const [customFields, tags, stages, pipelines, { data: subs }, h, { data: acc }, { data: stats }] = await Promise.all([
    listCustomFields(ws.account.id),
    listTags(ws.account.id),
    listAllStages(ws.account.id),
    listPipelines(ws.account.id),
    supabase
      .from("form_submissions")
      .select("id, contact_id, status, answers, tracking, started_at, contacts(first_name, last_name, email, phone)")
      .eq("form_id", id)
      .order("started_at", { ascending: false })
      .limit(200),
    headers(),
    supabase.from("accounts").select("slug").eq("id", ws.account.id).single(),
    supabase.from("form_stats").select("views").eq("form_id", id).gte("day", since),
  ]);
  const health = await formsHealth();
  const views = (stats ?? []).reduce((n, r) => n + ((r.views as number) ?? 0), 0);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "os.scalency.us";
  const base = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
  // A separate forms address (NEXT_PUBLIC_FORMS_URL), if one is set up, otherwise this one.
  const formsBase = (process.env.NEXT_PUBLIC_FORMS_URL || base).replace(/\/+$/, "");

  const submissions: Submission[] = (subs ?? []).map((s) => {
    const c = (Array.isArray(s.contacts) ? s.contacts[0] : s.contacts) as { first_name?: string; last_name?: string; email?: string; phone?: string } | null;
    const a = (s.answers ?? {}) as { fields?: { label: string; value: string; file?: string }[]; score?: number };
    const t = (s.tracking ?? {}) as Record<string, string>;
    return {
      id: s.id as string,
      contactId: s.contact_id as string,
      name: [c?.first_name, c?.last_name].filter(Boolean).join(" ") || c?.email || c?.phone || "Contact",
      email: c?.email ?? "",
      phone: c?.phone ?? "",
      answers: Array.isArray(a.fields) ? a.fields : [],
      source: [t.utm_source, t.utm_campaign].filter(Boolean).join(" / ") || (t.page ? new URL(t.page, base).hostname : ""),
      at: s.started_at as string,
      status: (["started", "submitted", "qualified", "unqualified"].includes(s.status as string) ? s.status : "submitted") as Submission["status"],
      score: typeof a.score === "number" ? a.score : null,
    };
  });

  return (
    <main className="flex min-h-dvh w-full flex-col">
      <FormEditor
        form={{
          id: form.id as string,
          name: form.name as string,
          slug: form.slug as string,
          status: form.status as "live" | "draft" | "archived",
          definition: cleanDefinition(form.definition),
          tags: (form.tags as string[] | null) ?? [],
          stageId: (form.stage_id as string | null) ?? null,
          redirectUrl: (form.redirect_url as string | null) ?? "",
        }}
        base={formsBase}
        workspaceSlug={(acc?.slug as string) ?? ""}
        views={views}
        healthProblem={health.ok ? undefined : `${health.problem} ${health.fix ?? ""}`.trim()}
        canEdit={can(ws, "sites.manage")}
        customFields={customFields}
        allTags={tags}
        stages={stages.map((s, i) => ({ id: s.id, name: s.name, position: i + 1, pipelineId: s.pipelineId }))}
        pipelines={pipelines.map((p) => ({ id: p.id, name: p.name }))}
        submissions={submissions}
        initialTab={tab === "share" || tab === "settings" || tab === "submissions" ? tab : "design"}
      />
    </main>
  );
}
