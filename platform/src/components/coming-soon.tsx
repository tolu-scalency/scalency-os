import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/icon";
import { Page, Tile } from "@/components/ui";
import { FEATURES } from "@/lib/features";

export function comingSoonMetadata(key: string): Metadata {
  return { title: FEATURES[key]?.title ?? "Coming soon" };
}

/** A preview of a feature on the roadmap: what it will do, and what to use in the meantime. */
export function ComingSoon({ feature: key, bare = false }: { feature: string; bare?: boolean }) {
  const f = FEATURES[key];
  if (!f) return null;
  const Wrap = bare ? Bare : Page;
  return (
    <Wrap>
      <section className="card relative overflow-hidden">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(85,227,236,0.35),transparent)]" />
        <div className="pointer-events-none absolute -bottom-28 right-40 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(10,95,227,0.14),transparent)]" />
        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-chip px-3 py-1 text-[12px] font-semibold text-brand">
              <span className="h-1.5 w-1.5 rounded-full bg-sky" /> Coming soon
            </span>
            <div className="mt-5 flex items-center gap-3">
              <Tile icon={f.icon} tone={f.tone} size={48} />
              <h1 className="text-[32px] font-semibold tracking-[-0.035em]">{f.title}</h1>
            </div>
            <p className="mt-3 max-w-[460px] text-[17px] leading-relaxed text-muted">{f.tagline}</p>
            {f.meanwhile && (
              <Link href={f.meanwhile.href} className="btn-ghost mt-6 inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-[13.5px] font-semibold">
                For now: {f.meanwhile.label} <Icon name="arrowRight" size={15} />
              </Link>
            )}
          </div>
          <Preview icon={f.icon} />
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {f.points.map((p, i) => (
          <div key={p.title} className="card p-5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-chip text-[12px] font-semibold text-brand">{i + 1}</span>
            <h2 className="mt-3 text-[15px] font-semibold">{p.title}</h2>
            <p className="mt-1 text-[13.5px] text-muted">{p.text}</p>
          </div>
        ))}
      </div>
    </Wrap>
  );
}

function Bare({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-6">{children}</div>;
}

/** A small abstract picture of an app window, in Scalency colours. */
function Preview({ icon }: { icon: Parameters<typeof Icon>[0]["name"] }) {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[420px]">
      <div className="rounded-2xl border border-line bg-white p-4 shadow-[var(--shadow-pop)]">
        <div className="mb-4 flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex flex-col gap-2.5">
          {[78, 62, 88, 54].map((w, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-surface p-3">
              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-white ${i === 0 ? "bg-[linear-gradient(135deg,#55e3ec,#0a5fe3)]" : "bg-line-strong"}`}>
                {i === 0 && <Icon name={icon} size={15} />}
              </span>
              <span className="flex flex-1 flex-col gap-1.5">
                <span className="h-2 rounded-full bg-line-strong" style={{ width: `${w}%` }} />
                <span className="h-2 rounded-full bg-line" style={{ width: `${w - 25}%` }} />
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-4 -left-4 rounded-xl border border-line bg-white px-3 py-2 text-[12px] font-semibold text-brand shadow-[var(--shadow-card)]">
        <span className="text-gradient">Scalency OS</span>
      </div>
    </div>
  );
}
