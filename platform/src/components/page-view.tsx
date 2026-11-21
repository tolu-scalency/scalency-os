"use client";

// Draws a page: the same component shows it in Page Studio and on the live link,
// so what you build is exactly what visitors see. Layouts respond to the width of
// the page area (container queries), so the builder's mobile view is accurate.

import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  FONTS,
  safeLink,
  textTone,
  videoEmbed,
  type PBlock,
  type PageDefinition,
  type PageTheme,
  type Row,
  type Section,
} from "@/lib/page-builder";

// ---------------------------------------------------------------- text
/** **bold**, *italic*, [link](https://...) and line breaks. Built as React elements, never raw HTML. */
export function RichText({ text, accent }: { text: string; accent?: string }) {
  const paras = text.split(/\n{2,}/);
  return (
    <>
      {paras.map((p, i) => (
        <p key={i} style={{ margin: i === paras.length - 1 ? 0 : "0 0 0.9em" }}>
          {p.split("\n").map((line, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {inline(line, accent)}
            </Fragment>
          ))}
        </p>
      ))}
    </>
  );
}

function inline(s: string, accent?: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]{1,200})\]\(([^)\s]{1,500})\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[1]) out.push(<strong key={k++}>{m[1]}</strong>);
    else if (m[2]) out.push(<em key={k++}>{m[2]}</em>);
    else {
      const href = safeLink(m[4]);
      out.push(
        <a key={k++} href={href} style={{ color: accent ?? "inherit", textDecoration: "underline" }} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {m[3]}
        </a>,
      );
    }
    last = re.lastIndex;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

// ---------------------------------------------------------------- helpers
const PAD = { none: 0, s: 24, m: 56, l: 88, xl: 112 } as const;
const HEADING = { s: "clamp(18px,2.2cqi,22px)", m: "clamp(22px,3cqi,30px)", l: "clamp(28px,4.4cqi,44px)", xl: "clamp(34px,6cqi,64px)" } as const;

function bgOf(s: Section, theme: PageTheme) {
  return s.style.background === "accent" ? theme.accent : s.style.background;
}

function Btn({ b, theme, tone }: { b: PBlock; theme: PageTheme; tone: "light" | "dark" }) {
  const style = b.style ?? "primary";
  const pad = b.size === "s" ? "9px 16px" : b.size === "l" || b.size === "xl" ? "16px 30px" : "12px 22px";
  const fs = b.size === "s" ? 14 : b.size === "l" || b.size === "xl" ? 18 : 16;
  const radius = theme.buttonStyle === "pill" ? 999 : theme.radius;
  const fg = tone === "light" ? "#ffffff" : theme.text;
  const css: CSSProperties =
    style === "primary"
      ? theme.buttonStyle === "outline"
        ? { background: "transparent", color: theme.accent, border: `2px solid ${theme.accent}` }
        : { background: theme.accent, color: "#fff", border: `2px solid ${theme.accent}`, boxShadow: `0 10px 24px -12px ${theme.accent}` }
      : style === "secondary"
        ? { background: tone === "light" ? "#ffffff" : theme.text, color: tone === "light" ? theme.text : "#ffffff", border: "2px solid transparent" }
        : style === "outline"
          ? { background: "transparent", color: fg, border: `2px solid ${tone === "light" ? "rgba(255,255,255,.7)" : "rgba(15,23,42,.2)"}` }
          : { background: "transparent", color: tone === "light" ? "#fff" : theme.accent, border: "2px solid transparent", textDecoration: "underline", padding: "4px 0" };
  const href = b.link || "#";
  return (
    <div style={{ textAlign: b.full ? undefined : (b.align ?? "left") }}>
      <a
        href={href}
        className="pv-btn"
        {...(b.newTab && href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        style={{
          display: b.full ? "flex" : "inline-flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
          padding: pad,
          fontSize: fs,
          fontWeight: 700,
          borderRadius: radius,
          textDecoration: "none",
          lineHeight: 1.2,
          ...css,
        }}
      >
        {b.text || "Button"}
      </a>
    </div>
  );
}

function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const P: Record<string, string> = {
    zap: "M13 2 3 14h9l-1 8 10-12h-9l1-8z",
    check: "M20 6 9 17l-5-5",
    star: "m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z",
    clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
    phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z",
    mail: "M4 4h16v16H4zM22 6l-10 7L2 6",
    calendar: "M3 4h18v18H3zM16 2v4M8 2v4M3 10h18",
    users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z",
    chart: "M3 3v18h18M7 16l4-4 3 3 5-6",
    pound: "M18 7a4 4 0 0 0-7.5-2C9.7 6.4 10 9 10 11v3c0 2-1 4-3 5h11M6 13h8",
    home: "M3 10.5 12 3l9 7.5V21H3zM9 21v-7h6v7",
    globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20",
    spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
    thumbsUp: "M7 10v12M15 5.9 14 10h5.8a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 18.4 22H7V10l4-8a3 3 0 0 1 4 3.9z",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={P[name] ?? P.check} />
    </svg>
  );
}

function FormFrame({ formId, pageId }: { formId: string; pageId?: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(420);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source === ref.current?.contentWindow && e.data?.scalencyForm === formId && e.data.height) setH(Math.min(4000, Number(e.data.height) || 420));
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [formId]);
  const [query, setQuery] = useState("");
  // Pass the page's own ?utm_ and other tags through to the form, so leads show where they came from.
  useEffect(() => {
    const own = new URLSearchParams(window.location.search);
    own.delete("embed");
    own.set("page", window.location.origin + window.location.pathname);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(`&${own.toString()}`);
  }, []);
  return (
    <iframe
      ref={ref}
      title="Form"
      src={`/f/${formId}?embed=1${pageId ? `&sp=${pageId}` : ""}${query}`}
      style={{ width: "100%", height: h, border: 0, display: "block", background: "transparent" }}
      loading="lazy"
    />
  );
}

function Countdown({ until, ended, tone, theme }: { until: string; ended: string; tone: "light" | "dark"; theme: PageTheme }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const end = until ? new Date(until).getTime() : 0;
  const left = now == null ? null : Math.max(0, end - now);
  if (left === 0) return <p style={{ textAlign: "center", fontWeight: 600 }}>{ended || "This offer has ended."}</p>;
  const parts = left == null ? ["--", "--", "--", "--"] : [86400_000, 3600_000, 60_000, 1000].map((u, i, a) => String(Math.floor((i ? left % a[i - 1] : left) / u)).padStart(2, "0"));
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
      {["Days", "Hours", "Minutes", "Seconds"].map((label, i) => (
        <div key={label} style={{ minWidth: 76, padding: "14px 10px", borderRadius: theme.radius, textAlign: "center", background: tone === "light" ? "rgba(255,255,255,.12)" : "rgba(15,23,42,.05)" }}>
          <div style={{ fontSize: 34, fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{parts[i]}</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6, textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- blocks
export function BlockView({ b, theme, tone, pageId, editing, sample }: { b: PBlock; theme: PageTheme; tone: "light" | "dark"; pageId?: string; editing?: boolean; sample?: boolean }) {
  const muted = tone === "light" ? "rgba(255,255,255,.78)" : "rgba(15,23,42,.68)";
  const card: CSSProperties = { background: tone === "light" ? "rgba(255,255,255,.08)" : "#ffffff", border: `1px solid ${tone === "light" ? "rgba(255,255,255,.14)" : "rgba(15,23,42,.08)"}`, borderRadius: theme.radius + 4, padding: 24 };
  const headingFont = theme.headingFont === "same" ? undefined : FONTS[theme.headingFont];
  const grid = (cols = 3): CSSProperties => ({ display: "grid", gap: 20, gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` });

  switch (b.kind) {
    case "heading": {
      const Tag = (`h${b.level ?? 2}`) as "h1" | "h2" | "h3";
      return (
        <Tag style={{ margin: 0, fontSize: HEADING[b.size ?? "l"], lineHeight: 1.12, fontWeight: 800, letterSpacing: "-0.02em", textAlign: b.align ?? "left", fontFamily: headingFont, textWrap: "balance" }}>
          {b.text}
        </Tag>
      );
    }
    case "text":
      return (
        <div style={{ fontSize: b.size === "l" ? 20 : b.size === "s" ? 14 : 17, lineHeight: 1.65, color: muted, textAlign: b.align ?? "left", textWrap: "pretty" }}>
          <RichText text={b.text ?? ""} accent={tone === "light" ? "#fff" : theme.accent} />
        </div>
      );
    case "button":
      return <Btn b={b} theme={theme} tone={tone} />;
    case "image": {
      if (!b.src) return editing ? <Placeholder label="Upload a picture in the panel" tone={tone} h={180} /> : null;
      // eslint-disable-next-line @next/next/no-img-element
      const img = <img src={b.src} alt={b.alt ?? ""} loading="lazy" style={{ display: "block", width: `${b.width ?? 100}%`, height: "auto", borderRadius: b.radius ?? 12, margin: b.align === "center" ? "0 auto" : b.align === "right" ? "0 0 0 auto" : undefined }} />;
      return b.link && b.link !== "#" && !editing ? <a href={b.link}>{img}</a> : img;
    }
    case "video": {
      const v = videoEmbed(b.url ?? "");
      if (!v) return editing ? <Placeholder label="Paste a YouTube, Vimeo or Loom link in the panel" tone={tone} h={220} /> : null;
      return (
        <div style={{ position: "relative", aspectRatio: "16 / 9", borderRadius: theme.radius + 4, overflow: "hidden", background: "#000" }}>
          {v.kind === "iframe" ? (
            <iframe src={v.src} title="Video" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, pointerEvents: editing ? "none" : undefined }} />
          ) : (
            <video src={v.src} controls playsInline preload="metadata" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
          )}
        </div>
      );
    }
    case "form":
      if (!b.formId) return editing ? <Placeholder label="Choose a form in the panel" tone={tone} h={260} /> : sample ? <SampleForm theme={theme} /> : null;
      return (
        <div style={{ ...card, padding: 8, background: "#ffffff", pointerEvents: editing ? "none" : undefined }}>
          <FormFrame formId={b.formId} pageId={pageId} />
        </div>
      );
    case "list":
      return (
        <ul style={{ ...grid(b.cols ?? 1), gap: 12, listStyle: "none", margin: 0, padding: 0 }} className="pv-grid">
          {(b.items ?? []).map((it, i) => (
            <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 17, lineHeight: 1.5 }}>
              <span style={{ flex: "none", marginTop: 2, width: 22, height: 22, borderRadius: 999, display: "grid", placeItems: "center", background: theme.accent, color: "#fff" }}>
                <Icon name="check" size={14} />
              </span>
              <span>{it.text}</span>
            </li>
          ))}
        </ul>
      );
    case "features":
      return (
        <div style={grid(b.cols ?? 3)} className="pv-grid">
          {(b.items ?? []).map((it, i) => (
            <div key={i} style={card}>
              <span style={{ display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: theme.radius, background: `${theme.accent}1a`, color: tone === "light" ? "#fff" : theme.accent, marginBottom: 14 }}>
                <Icon name={it.icon ?? "check"} />
              </span>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6, fontFamily: headingFont }}>{it.title}</div>
              <div style={{ color: muted, lineHeight: 1.6 }}>{it.text}</div>
            </div>
          ))}
        </div>
      );
    case "testimonials":
      return (
        <div style={grid(b.cols ?? 3)} className="pv-grid">
          {(b.items ?? []).map((it, i) => (
            <figure key={i} style={{ ...card, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ color: "#f5b301", letterSpacing: 2 }} aria-label="5 stars">★★★★★</div>
              <blockquote style={{ margin: 0, fontSize: 16.5, lineHeight: 1.6 }}>&ldquo;{it.text}&rdquo;</blockquote>
              <figcaption style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "auto" }}>
                {it.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image} alt="" style={{ width: 40, height: 40, borderRadius: 999, objectFit: "cover" }} />
                ) : (
                  <span style={{ width: 40, height: 40, borderRadius: 999, display: "grid", placeItems: "center", background: `${theme.accent}22`, color: theme.accent, fontWeight: 700 }}>{(it.name ?? "?").slice(0, 1)}</span>
                )}
                <span>
                  <span style={{ display: "block", fontWeight: 700 }}>{it.name}</span>
                  {it.role && <span style={{ display: "block", fontSize: 13, color: muted }}>{it.role}</span>}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      );
    case "pricing":
      return (
        <div style={{ ...grid(Math.min(4, Math.max(1, b.plans?.length ?? 3))), alignItems: "stretch" }} className="pv-grid">
          {(b.plans ?? []).map((p, i) => (
            <div key={i} style={{ ...card, display: "flex", flexDirection: "column", gap: 14, position: "relative", ...(p.highlight ? { border: `2px solid ${theme.accent}`, boxShadow: `0 24px 50px -28px ${theme.accent}` } : {}) }}>
              {p.highlight && <span style={{ position: "absolute", top: -12, left: 24, background: theme.accent, color: "#fff", fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999 }}>Most popular</span>}
              <div style={{ fontWeight: 700, fontSize: 18 }}>{p.name}</div>
              <div>
                <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em" }}>{p.price}</span> <span style={{ color: muted }}>{p.period}</span>
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                {p.features.map((f, j) => (
                  <li key={j} style={{ display: "flex", gap: 8 }}>
                    <span style={{ color: theme.accent, flex: "none" }}>
                      <Icon name="check" size={18} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: "auto" }}>
                <Btn b={{ id: "x", kind: "button", text: p.button, link: p.link, style: p.highlight ? "primary" : "outline", full: true }} theme={theme} tone={tone === "light" ? "light" : "dark"} />
              </div>
            </div>
          ))}
        </div>
      );
    case "faq":
      return (
        <div style={{ display: "grid", gap: 10 }}>
          {(b.items ?? []).map((it, i) => (
            <details key={i} className="pv-faq" style={{ ...card, padding: "16px 20px" }} open={editing && i === 0}>
              <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 17, listStyle: "none", display: "flex", justifyContent: "space-between", gap: 12 }}>
                {it.title}
                <span aria-hidden className="pv-faq-plus" style={{ color: theme.accent, fontSize: 22, lineHeight: 1 }}>+</span>
              </summary>
              <div style={{ marginTop: 10, color: muted, lineHeight: 1.6 }}>
                <RichText text={it.text ?? ""} accent={theme.accent} />
              </div>
            </details>
          ))}
        </div>
      );
    case "stats":
      return (
        <div style={grid(b.cols ?? 3)} className="pv-grid">
          {(b.items ?? []).map((it, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "clamp(32px,4.4cqi,48px)", fontWeight: 800, letterSpacing: "-0.02em", color: tone === "light" ? "#fff" : theme.accent }}>{it.value}</div>
              <div style={{ color: muted, marginTop: 4 }}>{it.text}</div>
            </div>
          ))}
        </div>
      );
    case "countdown":
      return <Countdown until={b.until ?? ""} ended={b.text ?? ""} tone={tone} theme={theme} />;
    case "logos":
      if (!b.items?.length) return editing ? <Placeholder label="Add logo images in the panel" tone={tone} h={80} /> : null;
      return (
        <div style={{ ...grid(b.cols ?? 4), alignItems: "center", gap: 28 }} className="pv-grid">
          {b.items.map((it, i) =>
            it.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={it.image} alt={it.name ?? "Logo"} loading="lazy" style={{ maxHeight: 44, maxWidth: "100%", margin: "0 auto", objectFit: "contain", filter: tone === "light" ? "brightness(0) invert(1)" : "grayscale(1)", opacity: 0.8 }} />
            ) : null,
          )}
        </div>
      );
    case "menu":
      return (
        <nav style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }} className="pv-menu">
          <a href="#" style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 20, textDecoration: "none", color: "inherit", marginRight: "auto", fontFamily: headingFont }}>
            {b.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.src} alt={b.text ?? "Logo"} style={{ height: 36, width: "auto" }} />
            ) : (
              b.text
            )}
          </a>
          <span className="pv-menu-links" style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
            {(b.nav ?? []).map((n, i) => (
              <a key={i} href={n.link} style={{ color: "inherit", textDecoration: "none", fontWeight: 600, opacity: 0.85 }}>
                {n.label}
              </a>
            ))}
          </span>
          {b.alt && <Btn b={{ id: "m", kind: "button", text: b.alt, link: b.link, size: "s", style: "primary" }} theme={theme} tone={tone} />}
        </nav>
      );
    case "footer":
      return (
        <footer style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between", fontSize: 14, color: muted }}>
          <span>{b.text}</span>
          <span style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            {(b.nav ?? []).map((n, i) => (
              <a key={i} href={n.link} style={{ color: "inherit" }}>
                {n.label}
              </a>
            ))}
          </span>
        </footer>
      );
    case "divider":
      return <hr style={{ border: 0, borderTop: `1px solid ${tone === "light" ? "rgba(255,255,255,.2)" : "rgba(15,23,42,.12)"}`, margin: "8px 0" }} />;
    case "spacer":
      return <div style={{ height: b.height ?? 40 }} aria-hidden />;
    case "code":
      if (!b.html) return editing ? <Placeholder label="Paste HTML in the panel. It runs in a sealed box." tone={tone} h={120} /> : null;
      return (
        <iframe
          title="Embedded content"
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          srcDoc={b.html}
          style={{ width: "100%", height: b.height ?? 200, border: 0, display: "block", pointerEvents: editing ? "none" : undefined }}
          loading="lazy"
        />
      );
  }
}

/** A pretend form, shown in template previews before a real form is chosen. */
function SampleForm({ theme }: { theme: PageTheme }) {
  const input: CSSProperties = { height: 46, borderRadius: Math.min(theme.radius, 12), border: "1px solid #dbe2ec", background: "#fff", padding: "0 14px", display: "flex", alignItems: "center", color: "#94a3b8", fontSize: 15 };
  return (
    <div aria-hidden style={{ background: "#ffffff", borderRadius: theme.radius + 6, padding: 24, color: "#0f172a", boxShadow: "0 24px 60px -28px rgba(11,27,58,.45)", display: "grid", gap: 12, textAlign: "left" }}>
      <div style={{ fontWeight: 800, fontSize: 19 }}>Tell us about you</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={input}>First name</div>
        <div style={input}>Last name</div>
      </div>
      <div style={input}>Email</div>
      <div style={input}>Phone</div>
      <div style={{ height: 50, borderRadius: theme.buttonStyle === "pill" ? 999 : theme.radius, background: theme.accent, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 }}>Send</div>
    </div>
  );
}

function Placeholder({ label, tone, h }: { label: string; tone: "light" | "dark"; h: number }) {
  return (
    <div style={{ height: h, display: "grid", placeItems: "center", borderRadius: 12, border: `2px dashed ${tone === "light" ? "rgba(255,255,255,.3)" : "rgba(15,23,42,.15)"}`, fontSize: 14, opacity: 0.7, padding: 12, textAlign: "center" }}>{label}</div>
  );
}

// ---------------------------------------------------------------- layout
export const PAGE_CSS = `
.pv-root{container-type:inline-size;-webkit-font-smoothing:antialiased}
.pv-root *{box-sizing:border-box}
.pv-root a.pv-btn{transition:transform .15s ease,filter .15s ease}
.pv-root a.pv-btn:hover{transform:translateY(-1px);filter:brightness(1.06)}
.pv-row{display:grid;gap:32px}
.pv-col{display:flex;flex-direction:column;gap:20px;min-width:0}
.pv-faq summary::-webkit-details-marker{display:none}
.pv-faq[open] .pv-faq-plus{transform:rotate(45deg)}
.pv-faq-plus{transition:transform .2s}
.pv-hide-desktop{display:none}
@container (max-width: 720px){
  .pv-row{grid-template-columns:1fr !important;gap:24px}
  .pv-grid{grid-template-columns:1fr !important}
  .pv-hide-mobile{display:none !important}
  .pv-hide-desktop{display:block}
  .pv-menu-links{display:none !important}
}
@media (prefers-reduced-motion: reduce){.pv-root *{transition:none !important;scroll-behavior:auto !important}}
`;

export function SectionShell({ s, theme, children, editing }: { s: Section; theme: PageTheme; children: ReactNode; editing?: boolean }) {
  const tone = textTone(s.style, theme);
  const maxW = s.style.width === "narrow" ? 760 : s.style.width === "wide" ? Math.max(theme.width, 1280) : s.style.width === "full" ? "100%" : theme.width;
  const bg = bgOf(s, theme);
  const pad = PAD[s.style.padding];
  return (
    <section
      id={s.anchor || undefined}
      className={s.style.hideOn && !editing ? `pv-hide-${s.style.hideOn}` : undefined}
      style={{
        position: "relative",
        ...(editing && s.style.hideOn ? { opacity: 0.55 } : {}),
        background: s.style.image ? `${bg.startsWith("linear") ? "" : bg} center / cover no-repeat url("${s.style.image}")` : bg,
        color: tone === "light" ? "#ffffff" : theme.text,
        padding: `${pad}px ${s.style.width === "full" ? 0 : 20}px`,
        textAlign: s.style.align,
        scrollMarginTop: 72,
        ...(editing ? { minHeight: 64 } : {}),
      }}
    >
      {s.style.image && <div aria-hidden style={{ position: "absolute", inset: 0, background: `rgba(5,12,30,${s.style.overlay / 100})` }} />}
      <div style={{ position: "relative", maxWidth: maxW, margin: "0 auto", padding: s.style.width === "full" ? "0 20px" : undefined }}>{children}</div>
    </section>
  );
}

export function RowShell({ r, children }: { r: Row; children: ReactNode }) {
  return (
    <div className="pv-row" style={{ gridTemplateColumns: `repeat(${r.columns.length}, minmax(0,1fr))`, alignItems: r.valign === "center" ? "center" : "start", marginTop: 0 }}>
      {children}
    </div>
  );
}

/** The whole page, for visitors. */
export function PageView({ def, pageId, sample }: { def: PageDefinition; pageId?: string; sample?: boolean }) {
  const theme = def.theme;
  return (
    <div className="pv-root" style={{ fontFamily: FONTS[theme.font], color: theme.text, background: theme.background, minHeight: "100vh" }}>
      <style>{PAGE_CSS}</style>
      {def.sections.map((s) => {
        const tone = textTone(s.style, theme);
        return (
          <SectionShell key={s.id} s={s} theme={theme}>
            <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
              {s.rows.map((r) => (
                <RowShell key={r.id} r={r}>
                  {r.columns.map((c) => (
                    <div key={c.id} className="pv-col">
                      {c.blocks.map((b) => (
                        <div key={b.id} className={b.hideOn ? `pv-hide-${b.hideOn}` : undefined}>
                          <BlockView b={b} theme={theme} tone={tone} pageId={pageId} sample={sample} />
                        </div>
                      ))}
                    </div>
                  ))}
                </RowShell>
              ))}
            </div>
          </SectionShell>
        );
      })}
    </div>
  );
}
