import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";
import { Page, PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Guardrails log" };

type Row = { id: string; body: string; created_at: string; account_id: string; setter_threads: { contact_name: string | null } | null };

function since(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

const KINDS: { key: string; label: string; icon: IconName; tone: string; test: (b: string) => boolean }[] = [
  { key: "complication", label: "Complications", icon: "warning", tone: "bg-bad-bg text-bad", test: (b) => /complication/i.test(b) },
  { key: "age", label: "Under 18", icon: "shield", tone: "bg-warn-bg text-warn", test: (b) => /under 18/i.test(b) },
  { key: "medicine", label: "Medicine names removed", icon: "shield", tone: "bg-chip text-brand", test: (b) => /named .*rewritten|medicine/i.test(b) },
  { key: "consent", label: "No consent", icon: "lock", tone: "bg-surface text-navy", test: (b) => /consent/i.test(b) },
  { key: "words", label: "Alert words", icon: "bell", tone: "bg-warn-bg text-warn", test: (b) => /^said "/i.test(b) },
  { key: "optout", label: "Opt-outs", icon: "stop", tone: "bg-surface text-muted", test: (b) => /opted out/i.test(b) },
];

/** The guardrails audit log (Platform Spec O): every time a safety rule stepped in, across your clinics. */
export default async function GuardrailsPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const [ws, sp] = await Promise.all([getWorkspace(), searchParams]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("setter_turns")
    .select("id, body, created_at, account_id, setter_threads(contact_name)")
    .eq("account_id", ws.account.id)
    .eq("role", "event")
    .gte("created_at", since(90))
    .or("body.ilike.Guardrail*,body.ilike.Said*,body.ilike.Opted out*,body.ilike.*marketing consent*")
    .order("created_at", { ascending: false })
    .limit(500);
  const rows = (data ?? []) as unknown as Row[];
  const kindOf = (b: string) => KINDS.find((k) => k.test(b)) ?? KINDS[2];
  const shown = sp.kind ? rows.filter((r) => kindOf(r.body).key === sp.kind) : rows;
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  return (
    <Page>
      <PageHeader eyebrow="Guardrails" title="Guardrails log" subtitle="Every time a safety rule stepped in over the last 90 days: complications passed to a clinician, under-18s, medicine names kept out of marketing, consent and opt-outs." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {KINDS.map((k) => {
          const n = rows.filter((r) => kindOf(r.body).key === k.key).length;
          return (
            <Link key={k.key} href={sp.kind === k.key ? "/guardrails" : `/guardrails?kind=${k.key}`} className={`card flex items-center gap-3 p-4 ${sp.kind === k.key ? "ring-2 ring-brand" : ""}`}>
              <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl ${k.tone}`}>
                <Icon name={k.icon} size={15} />
              </span>
              <span>
                <span className="block font-mono text-[20px] font-semibold leading-none text-navy">{n}</span>
                <span className="mt-1 block text-[11.5px] text-muted">{k.label}</span>
              </span>
            </Link>
          );
        })}
      </div>
      <section className="card divide-y divide-line">
        {shown.length === 0 && <div className="p-8 text-center text-[13px] text-muted">Nothing here. When a guardrail steps in, it&apos;s recorded here with who and when.</div>}
        {shown.map((r) => {
          const k = kindOf(r.body);
          return (
            <div key={r.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
              <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg ${k.tone}`}>
                <Icon name={k.icon} size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] text-navy">{r.body}</span>
                <span className="block text-[12px] text-muted">
                  {r.setter_threads?.contact_name || "A lead"}
                  
                </span>
              </span>
              <span className="font-mono text-[12px] text-faint">{fmt(r.created_at)}</span>
            </div>
          );
        })}
      </section>
    </Page>
  );
}
