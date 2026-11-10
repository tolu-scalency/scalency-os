import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Avatar, Pill } from "@/components/ui";
import { EmptyState, Loading, NoAccount } from "@/components/states";
import { formatPence, getPipelineBoard, getWorkspace, timeAgo } from "@/lib/data";

export const metadata: Metadata = { title: "Pipeline" };

// A colour per column position, from turquoise through to green.
const colours = ["#64e7ef", "#2fa8eb", "#077ddc", "#6d8bff", "#a78bfa", "#fbbf24", "#f97316", "#94a3b8", "#34d399", "#cbd5e1"];

export default function PipelinePage() {
  return (
    <main className="dots flex min-h-full flex-col gap-[18px] px-7 pb-8 pt-7">
      <Suspense fallback={<Loading rows={4} />}>
        <Board />
      </Suspense>
    </main>
  );
}

async function Board() {
  const ws = await getWorkspace();
  if (!ws.account) return <NoAccount email={ws.userEmail} />;
  const board = await getPipelineBoard(ws.account.id);

  if (!board) {
    return (
      <EmptyState icon="pipeline" title="No pipeline yet">
        The lead-gen pipeline is created when the account is set up (see <code className="font-mono text-xs">docs/setup-dev.md</code>, step 4).
      </EmptyState>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">{board.pipeline.name} pipeline · {board.openCount} open</div>
          <div className="mt-2.5 flex flex-wrap items-baseline gap-3.5">
            <h1 className="text-[30px] font-semibold tracking-[-0.035em]">{formatPence(board.totalPence)}</h1>
            <span className="text-sm text-muted">potential monthly value</span>
          </div>
        </div>
        <Link href="/contacts" className="btn-primary inline-flex min-h-10 items-center rounded-[11px] px-4 text-[13.5px] font-medium">Add a contact</Link>
      </div>

      <div className="overflow-x-auto pb-1.5">
        <div className="flex min-w-min items-start gap-3">
          {board.columns.map((col, i) => (
            <section key={col.id} aria-label={col.name} className="flex min-h-[560px] w-[272px] flex-none flex-col gap-2.5 rounded-[18px] border border-line bg-white/85 p-3 backdrop-blur-sm">
              <span className="h-[3px] rounded-[3px]" style={{ background: colours[i % colours.length] }} />
              <div className="flex items-center gap-2 px-1 pt-0.5">
                <h2 className="flex-1 text-[13.5px] font-semibold">{col.name}</h2>
                <span className="rounded-md border border-line-strong px-1.5 py-px font-mono text-[11px] text-muted">{col.cards.length}</span>
              </div>
              {col.cards.length === 0 && <p className="px-1 py-2 text-xs text-muted">Nobody here yet.</p>}
              {col.cards.map((card) => (
                <Link key={card.opportunityId} href={`/contacts/${card.contactId}`} className="block rounded-[14px] border border-line-strong bg-white p-[13px] shadow-[0_10px_24px_-16px_rgba(11,36,71,0.35)] hover:border-sky">
                  <div className="flex items-center gap-2.5">
                    <Avatar initials={card.initials} size={30} />
                    <div className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{card.name}</div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
                    <span className="font-mono text-[12.5px] font-semibold">{formatPence(card.valuePence)}</span>
                    <span className="flex items-center gap-2">
                      {card.source && <Pill>{card.source}</Pill>}
                      <span className="font-mono text-[10.5px] text-muted">{timeAgo(card.updatedAt)}</span>
                    </span>
                  </div>
                </Link>
              ))}
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
