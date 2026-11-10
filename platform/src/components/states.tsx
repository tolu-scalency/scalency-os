import type { ReactNode } from "react";
import type { IconName } from "./icon";
import { Tile, type Tone } from "./ui";

/** Shown when a list has nothing in it yet. Short and friendly, with one clear next step. */
export function EmptyState({ icon, tone = "blue", title, children, action }: { icon: IconName; tone?: Tone; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="dots flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-white/60 px-6 py-14 text-center">
      <Tile icon={icon} tone={tone} size={46} />
      <h2 className="text-[17px] font-semibold tracking-[-0.02em]">{title}</h2>
      {children && <div className="max-w-[420px] text-[14px] leading-relaxed text-muted">{children}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/** Shimmering placeholder while a section loads. */
export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-9 w-56" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-16" />
      ))}
    </div>
  );
}
