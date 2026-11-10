import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";
import { Tile, type Tone } from "./ui";

/** Shown when a list has nothing in it yet. */
export function EmptyState({ icon, tone = "blue", title, children, action }: { icon: IconName; tone?: Tone; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="dots flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-line-strong px-6 py-14 text-center">
      <Tile icon={icon} tone={tone} size={48} />
      <h2 className="text-lg font-semibold tracking-[-0.02em]">{title}</h2>
      <div className="max-w-[460px] text-sm leading-relaxed text-muted">{children}</div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Shown on screens whose feature is designed but not connected yet. */
export function NotConnected({ icon, tone = "blue", title, step, children, points }: { icon: IconName; tone?: Tone; title: string; step: string; children: ReactNode; points: string[] }) {
  return (
    <main className="px-7 pb-10 pt-7">
      <div className="card dots relative mx-auto flex max-w-[760px] flex-col gap-5 overflow-hidden p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-80 bg-[radial-gradient(closest-side,rgba(47,168,235,0.18),transparent)]" />
        <div className="relative flex items-center gap-3.5">
          <Tile icon={icon} tone={tone} size={48} />
          <div>
            <div className="eyebrow">Not connected yet · {step}</div>
            <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.03em]">{title}</h1>
          </div>
        </div>
        <div className="relative text-[15px] leading-relaxed text-muted">{children}</div>
        <ul className="relative grid gap-2.5 sm:grid-cols-2">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2.5 rounded-xl border border-line bg-white px-3.5 py-3 text-[13.5px]">
              <Icon name="check" size={15} className="mt-0.5 text-brand" />
              {p}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

/** Shown when the signed-in person isn't a member of any account yet. */
export function NoAccount({ email }: { email: string }) {
  return (
    <div>
      <EmptyState icon="building" tone="orange" title="You're not in a workspace yet">
        You&apos;re signed in as <strong className="text-navy">{email}</strong>, but this login isn&apos;t linked to an account. The owner sets this up once
        in Supabase (see <code className="font-mono text-xs">docs/setup-dev.md</code>, step 4).
      </EmptyState>
    </div>
  );
}

/** Placeholder while a section loads from the database. */
export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-surface" />
      ))}
    </div>
  );
}
