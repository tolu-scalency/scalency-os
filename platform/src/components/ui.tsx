import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";

// Small building blocks shared by every screen.

export type Tone = "blue" | "violet" | "orange" | "green" | "pink" | "red" | "grey";

const tileTone: Record<Tone, string> = {
  blue: "",
  violet: "tile-violet",
  orange: "tile-orange",
  green: "tile-green",
  pink: "tile-pink",
  red: "tile-red",
  grey: "tile-grey",
};

/** A gradient square with an icon inside. */
export function Tile({ icon, tone = "blue", size = 36, iconSize }: { icon: IconName; tone?: Tone; size?: number; iconSize?: number }) {
  return (
    <span className={`tile ${tileTone[tone]}`} style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}>
      <Icon name={icon} size={iconSize ?? Math.round(size * 0.44)} />
    </span>
  );
}

export type PillTone = "blue" | "green" | "amber" | "red" | "neutral";

const pillTone: Record<PillTone, string> = {
  blue: "bg-chip text-brand",
  green: "bg-ok-bg text-ok",
  amber: "bg-warn-bg text-warn",
  red: "bg-bad-bg text-bad",
  neutral: "bg-surface text-muted border border-line",
};

export function Pill({ tone = "blue", mono = false, children }: { tone?: PillTone; mono?: boolean; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-medium ${pillTone[tone]} ${mono ? "font-mono text-[10.5px] tracking-wide" : ""}`}
    >
      {children}
    </span>
  );
}

const avatarTone: Record<Tone, string> = {
  blue: "from-sky to-brand",
  violet: "from-[#a5b4fc] to-[#4f46e5]",
  orange: "from-[#fdba74] to-[#ea580c]",
  green: "from-[#6ee7b7] to-[#059669]",
  pink: "from-[#f0abfc] to-[#c026d3]",
  red: "from-[#fca5a5] to-[#dc2626]",
  grey: "from-[#94a3b8] to-[#475569]",
};

export function Avatar({ initials, tone = "blue", size = 36 }: { initials: string; tone?: Tone; size?: number }) {
  return (
    <span
      className={`inline-flex flex-none items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ${avatarTone[tone]}`}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.34)) }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

type ButtonProps = {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary";
  icon?: IconName;
  iconRight?: IconName;
  size?: "sm" | "md";
  className?: string;
  label?: string;
};

/** A button, or a link styled as one when `href` is given. */
export function Button({ children, href, variant = "secondary", icon, iconRight, size = "md", className = "", label }: ButtonProps) {
  const base = `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold ${
    size === "sm" ? "min-h-9 px-3 text-[13px]" : "min-h-10 px-4 text-[13.5px]"
  }`;
  const look =
    variant === "primary"
      ? "btn-primary"
      : "btn-ghost";
  const content = (
    <>
      {icon && <Icon name={icon} size={15} />}
      {children}
      {iconRight && <Icon name={iconRight} size={15} />}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={`${base} ${look} ${className}`} aria-label={label}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={`${base} ${look} ${className}`} aria-label={label}>
      {content}
    </button>
  );
}

/** Title block at the top of each screen. */
export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.03em] sm:text-[28px]">{title}</h1>
        {subtitle && <div className="mt-1 text-[14px] text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** The padded column every page sits in. */
export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <main className={`fade-in mx-auto flex w-full flex-col gap-6 px-4 pb-14 pt-6 sm:px-7 sm:pt-8 ${wide ? "" : "max-w-[1240px]"}`}>{children}</main>;
}

/** Segmented control. Visual only for now. */
export function Segmented({ options, active, mono = false }: { options: string[]; active: string; mono?: boolean }) {
  return (
    <div className="inline-flex flex-wrap rounded-[11px] border border-line bg-surface p-[3px]" role="tablist">
      {options.map((o) => (
        <span
          key={o}
          role="tab"
          aria-selected={o === active}
          className={`rounded-lg px-3 py-1.5 ${mono ? "font-mono text-[11px]" : "text-[12.5px]"} ${
            o === active ? "border border-line-strong bg-white text-navy shadow-sm" : "border border-transparent text-muted"
          }`}
        >
          {o}
        </span>
      ))}
    </div>
  );
}

/** A tiny line chart for stat cards. `points` are y values from 0 (top) to 40 (bottom). */
export function Sparkline({ points }: { points: number[] }) {
  const step = 200 / (points.length - 1);
  const line = "M" + points.map((y, i) => `${Math.round(i * step)} ${y}`).join(" L");
  return (
    <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="h-9 w-full" aria-hidden>
      <path d={`${line} L200 40 L0 40 Z`} fill="rgba(47,168,235,0.12)" />
      <path d={line} fill="none" stroke="#2fa8eb" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A label shown on every sample number until real data is connected. */
export function SampleNote() {
  return <span className="font-mono text-[10.5px] tracking-wide text-muted">SAMPLE DATA</span>;
}
