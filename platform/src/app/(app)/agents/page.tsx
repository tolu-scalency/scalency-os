import { shortId } from "@/lib/short-id-shared";
import type { Metadata } from "next";
import Link from "next/link";
import { can, getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/icon";
import { Page, PageHeader, Pill, Tile } from "@/components/ui";
import { createSetter } from "./actions";

export const metadata: Metadata = { title: "AI setter" };

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

const STATUS = { off: { label: "Off", tone: "neutral" }, test: { label: "Test mode", tone: "amber" }, live: { label: "Live", tone: "green" } } as const;

// AI setters: an AI that texts new leads straight away, answers their questions and
// books them into the calendar, following the agency's setter SOP.
export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [ws, { error }] = await Promise.all([getWorkspace(), searchParams]);
  const canEdit = can(ws, "ai.manage");
  const supabase = await createClient();
  const [{ data: agents }, { data: threads }] = await Promise.all([
    supabase.from("setter_agents").select("id, name, status, business, ghl_location_name, updated_at").eq("account_id", ws.account.id).order("created_at"),
    supabase.from("setter_threads").select("agent_id, state").eq("account_id", ws.account.id).gte("created_at", daysAgo(30)),
  ]);
  const count = (id: string, state?: string) => (threads ?? []).filter((t) => t.agent_id === id && (!state || t.state === state)).length;
  return (
    <Page>
      <PageHeader
        eyebrow="AI"
        title="AI setter"
        subtitle="Texts every new lead within a minute, answers their questions, books them into your calendar and follows up when they go quiet."
        actions={
          canEdit && agents?.length ? (
            <form action={createSetter}>
              <button type="submit" className="btn-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-[14px] font-semibold">
                <Icon name="plus" size={15} /> New AI setter
              </button>
            </form>
          ) : undefined
        }
      />
      {error && <p className="rounded-xl bg-bad-bg px-4 py-3 text-[13.5px] text-bad">{error === "access" ? "You don't have access to set up AI here." : "Something went wrong. Please try again."}</p>}
      {!agents?.length ? (
        <div className="card flex flex-col items-center gap-4 p-6 text-center">
          <Tile icon="spark" size={52} />
          <div>
            <h2 className="text-[19px] font-semibold">Your AI patient coordinator</h2>
            <p className="mx-auto mt-1.5 max-w-xl text-[14px] leading-relaxed text-muted">
              It follows the setter SOP: value first, a yes/no question, permission before explaining, one more yes, then two real times from your calendar. It hands over to your team when it should and never gives medical advice.
            </p>
          </div>
          <ul className="grid max-w-2xl gap-2 text-left text-[13.5px] sm:grid-cols-2">
            {["Texts new leads within a minute, in opening hours", "Answers pain, downtime, price and financing questions", "Books the consultation into your GHL calendar", "Follows up on day 1, 3, 5, 8, 12 and 16", "Creates tasks for calls, Instagram DMs and videos", "Stops at once when someone says no"].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <Icon name="check" size={15} /> {t}
              </li>
            ))}
          </ul>
          {canEdit && (
            <form action={createSetter}>
              <button type="submit" className="btn-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-[14px] font-semibold">
                <Icon name="plus" size={15} /> Set up an AI setter
              </button>
            </form>
          )}
          <p className="text-[12.5px] text-faint">It starts with a demo med spa you can test in the chat, then you put in the clinic&apos;s real details.</p>
        </div>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {agents.map((a) => {
            const s = STATUS[(a.status as keyof typeof STATUS) ?? "off"] ?? STATUS.off;
            const b = (a.business ?? {}) as { clinicName?: string };
            return (
              <Link key={a.id} href={`/agents/${shortId(a.id)}`} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-surface">
                <Tile icon="spark" tone={a.status === "live" ? "green" : "grey"} size={40} />
                <div className="min-w-0 flex-[1_1_240px]">
                  <div className="truncate text-[15px] font-semibold">{a.name}</div>
                  <div className="truncate text-[12.5px] text-muted">
                    {b.clinicName || "No business yet"}
                    {a.ghl_location_name ? ` · GHL: ${a.ghl_location_name}` : " · GHL not connected"}
                  </div>
                </div>
                <div className="flex gap-5 text-[12px] text-muted">
                  <div>
                    <div className="text-[15px] font-semibold text-navy">{count(a.id)}</div>leads (30 days)
                  </div>
                  <div>
                    <div className="text-[15px] font-semibold text-navy">{count(a.id, "booked")}</div>booked
                  </div>
                </div>
                <Pill tone={s.tone}>{s.label}</Pill>
              </Link>
            );
          })}
        </div>
      )}
    </Page>
  );
}
