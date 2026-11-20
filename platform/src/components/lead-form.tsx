"use client";

// A published form, as visitors see it. Form Studio also uses FieldView and
// ContentView to draw its canvas, so the builder looks exactly like the result.
// Preview mode never sends anything.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  FONTS,
  answerText,
  isVisible,
  stepFields,
  type Answers,
  type Block,
  type ContentBlock,
  type FieldBlock,
  type FormDefinition,
  type Theme,
} from "@/lib/form-builder";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// ---------------------------------------------------------------------------
// Look and feel
// ---------------------------------------------------------------------------

export function palette(t: Theme) {
  const dark = t.dark;
  return {
    fg: dark ? "#f1f5f9" : "#0b1b3a",
    muted: dark ? "#94a3b8" : "#5b6b85",
    line: dark ? "#2a3a5c" : "#d7deea",
    field: t.fieldStyle === "filled" ? (dark ? "#16233f" : "#eef2f8") : t.fieldStyle === "underline" ? "transparent" : dark ? "#0f1b33" : "#ffffff",
    card: dark ? "#111c33" : "#ffffff",
    tint: dark ? "rgba(255,255,255,0.06)" : "rgba(10,95,227,0.06)",
    error: "#dc2626",
  };
}

export function inputStyle(t: Theme, bad = false): CSSProperties {
  const p = palette(t);
  const base: CSSProperties = { width: "100%", minHeight: 46, padding: "10px 14px", color: p.fg, fontSize: 15, outline: "none", fontFamily: "inherit", background: p.field };
  if (t.fieldStyle === "underline") return { ...base, padding: "10px 2px", borderRadius: 0, border: 0, borderBottom: `2px solid ${bad ? p.error : p.line}` };
  if (t.fieldStyle === "filled") return { ...base, borderRadius: t.radius, border: `1.5px solid ${bad ? p.error : "transparent"}` };
  return { ...base, borderRadius: t.radius, border: `1.5px solid ${bad ? p.error : p.line}` };
}

export function buttonStyle(t: Theme, ghost = false): CSSProperties {
  const outline = ghost || t.buttonStyle === "outline";
  return {
    minHeight: 50,
    padding: "0 26px",
    borderRadius: t.buttonStyle === "pill" ? 999 : t.radius,
    border: `2px solid ${ghost ? palette(t).line : t.accent}`,
    background: outline ? "transparent" : t.accent,
    color: outline ? (ghost ? palette(t).fg : t.accent) : "#fff",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

// ---------------------------------------------------------------------------
// One field
// ---------------------------------------------------------------------------

export function FieldView({
  f,
  value,
  onChange,
  error,
  theme,
  design = false,
}: {
  f: FieldBlock;
  value: Answers[string] | undefined;
  onChange: (v: Answers[string]) => void;
  error?: string;
  theme: Theme;
  /** In Form Studio: drawn but not typed into. */
  design?: boolean;
}) {
  const p = palette(theme);
  const t = theme;
  const s = typeof value === "string" ? value : "";
  const list = Array.isArray(value) ? value : [];
  const label = (
    <span style={{ fontSize: 14, fontWeight: 600, color: p.fg }}>
      {f.label}
      {f.required && <span style={{ color: p.error }}> *</span>}
    </span>
  );
  const help = f.help ? <span style={{ fontSize: 12.5, color: p.muted }}>{f.help}</span> : null;
  const err = error ? <span style={{ fontSize: 12.5, color: p.error }}>{error}</span> : null;
  const wrap: CSSProperties = { display: "flex", flexDirection: "column", gap: 7, minWidth: 0, pointerEvents: design ? "none" : undefined };
  const tile = (on: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "11px 14px",
    borderRadius: t.radius,
    border: `1.5px solid ${on ? t.accent : p.line}`,
    background: on ? `${t.accent}14` : t.fieldStyle === "filled" ? p.field : "transparent",
    color: p.fg,
    fontSize: 14.5,
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
    width: "100%",
  });
  const dot = (on: boolean, square: boolean): CSSProperties => ({
    width: 18,
    height: 18,
    flex: "none",
    borderRadius: square ? 5 : 999,
    border: `2px solid ${on ? t.accent : p.line}`,
    background: on ? t.accent : "transparent",
    boxShadow: on && !square ? `inset 0 0 0 3px ${p.card}` : undefined,
    display: "grid",
    placeItems: "center",
    color: "#fff",
    fontSize: 11,
    fontWeight: 800,
  });

  if (f.kind === "hidden")
    return design ? (
      <div style={{ ...wrap, padding: "10px 12px", borderRadius: t.radius, border: `1.5px dashed ${p.line}`, color: p.muted, fontSize: 13 }}>
        Hidden: {f.label} {f.key ? `(from ?${f.key}=…)` : ""}
      </div>
    ) : null;

  if (f.kind === "checkbox")
    return (
      <label style={{ ...wrap, flexDirection: "row", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2, accentColor: t.accent }} />
        <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {label}
          {help}
          {err}
        </span>
      </label>
    );

  if (f.kind === "radio" || f.kind === "yes_no" || f.kind === "checkboxes") {
    const multi = f.kind === "checkboxes";
    const opts = f.options ?? [];
    return (
      <div style={wrap} role={multi ? "group" : "radiogroup"} aria-label={f.label}>
        {label}
        {help}
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: f.kind === "yes_no" ? "1fr 1fr" : opts.length > 4 && !multi ? "repeat(auto-fill, minmax(180px, 1fr))" : "1fr" }}>
          {opts.map((o) => {
            const on = multi ? list.includes(o) : s === o;
            return (
              <button
                key={o}
                type="button"
                role={multi ? "checkbox" : "radio"}
                aria-checked={on}
                onClick={() => onChange(multi ? (on ? list.filter((x) => x !== o) : [...list, o]) : o)}
                style={tile(on)}
              >
                <span style={dot(on, multi)}>{multi && on ? "✓" : ""}</span>
                <span>{o}</span>
              </button>
            );
          })}
        </div>
        {err}
      </div>
    );
  }

  if (f.kind === "rating")
    return (
      <div style={wrap}>
        {label}
        {help}
        <div style={{ display: "flex", gap: 6 }}>
          {[1, 2, 3, 4, 5].map((n) => {
            const on = Number(s) >= n;
            return (
              <button
                key={n}
                type="button"
                aria-label={`${n} out of 5`}
                onClick={() => onChange(String(n))}
                style={{ width: 44, height: 44, borderRadius: t.radius, border: `1.5px solid ${on ? t.accent : p.line}`, background: on ? t.accent : "transparent", color: on ? "#fff" : p.muted, fontSize: 20, cursor: "pointer" }}
              >
                ★
              </button>
            );
          })}
        </div>
        {err}
      </div>
    );

  const type = { email: "email", phone: "tel", number: "number", date: "date", website: "url" }[f.kind as string] ?? "text";
  const auto = { first_name: "given-name", last_name: "family-name", full_name: "name", email: "email", phone: "tel", company: "organization", website: "url" }[f.kind as string];
  return (
    <label style={wrap}>
      {label}
      {f.kind === "textarea" ? (
        <textarea value={s} placeholder={f.placeholder} rows={4} readOnly={design} tabIndex={design ? -1 : undefined} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle(t, Boolean(error)), resize: "vertical" }} />
      ) : f.kind === "select" ? (
        <select value={s} disabled={design} onChange={(e) => onChange(e.target.value)} style={inputStyle(t, Boolean(error))}>
          <option value="">{f.placeholder || "Choose…"}</option>
          {(f.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input type={type} value={s} autoComplete={auto} placeholder={f.placeholder} readOnly={design} tabIndex={design ? -1 : undefined} onChange={(e) => onChange(e.target.value)} style={inputStyle(t, Boolean(error))} />
      )}
      {help}
      {err}
      {!err && !help && f.kind === "phone" && !design && <span style={{ fontSize: 12, color: p.muted }}>Mobile like 07700 900123, or with your country code.</span>}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Headings, text, images, dividers and spacers
// ---------------------------------------------------------------------------

export function ContentView({ b, theme, design = false }: { b: ContentBlock; theme: Theme; design?: boolean }) {
  const p = palette(theme);
  const align = b.align ?? "left";
  switch (b.kind) {
    case "heading": {
      const size = b.level === 3 ? 18 : b.level === 2 ? 21 : 26;
      return <div role="heading" aria-level={b.level ?? 1} style={{ fontSize: size, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2, color: p.fg, textAlign: align, whiteSpace: "pre-wrap" }}>{b.text || (design ? "Heading" : "")}</div>;
    }
    case "paragraph":
      return <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: p.muted, textAlign: align, whiteSpace: "pre-wrap" }}>{b.text || (design ? "Text" : "")}</p>;
    case "image":
      return b.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.src} alt={b.alt ?? ""} style={{ maxWidth: "100%", borderRadius: theme.radius, display: "block", margin: align === "center" ? "0 auto" : undefined }} />
      ) : design ? (
        <div style={{ height: 120, borderRadius: theme.radius, border: `1.5px dashed ${p.line}`, display: "grid", placeItems: "center", color: p.muted, fontSize: 13 }}>Add an image address in the panel on the right</div>
      ) : null;
    case "divider":
      return <hr style={{ border: 0, borderTop: `1px solid ${p.line}`, margin: "4px 0" }} />;
    case "spacer":
      return <div style={{ height: b.height ?? 24, ...(design ? { background: `repeating-linear-gradient(45deg, transparent, transparent 6px, ${p.tint} 6px, ${p.tint} 12px)`, borderRadius: 6 } : {}) }} />;
  }
}

// ---------------------------------------------------------------------------
// The whole form
// ---------------------------------------------------------------------------

type Result = { message: string; redirect?: string | null };

export function LeadForm({ formId, def, preview = false, embed = false }: { formId: string; def: FormDefinition; preview?: boolean; embed?: boolean }) {
  const t = def.theme;
  const p = palette(t);
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stepIx, setStepIx] = useState(0);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const resume = useRef<string>("");
  const box = useRef<HTMLDivElement>(null);
  const steps = def.steps;
  const step = steps[Math.min(stepIx, steps.length - 1)];
  const last = stepIx >= steps.length - 1;

  // Hidden values come from the web address, e.g. ?campaign=spring.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const found: Answers = {};
    for (const s of def.steps) for (const f of stepFields(s)) if (f.kind === "hidden" && f.key && params.get(f.key)) found[f.id] = params.get(f.key)!.slice(0, 300);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (Object.keys(found).length) setAnswers((a) => ({ ...found, ...a }));
  }, [def.steps]);

  // Inside an iframe, tell the page around it how tall we are.
  useEffect(() => {
    if (!embed || !box.current) return;
    const send = () => window.parent?.postMessage({ scalencyForm: formId, height: Math.ceil(document.documentElement.scrollHeight) }, "*");
    const ro = new ResizeObserver(send);
    ro.observe(box.current);
    send();
    return () => ro.disconnect();
  }, [embed, formId, state, stepIx]);

  const set = (id: string, v: Answers[string]) => {
    setAnswers((a) => ({ ...a, [id]: v }));
    if (errors[id]) setErrors((e) => ({ ...e, [id]: "" }));
  };

  function check(fields: FieldBlock[]): Record<string, string> {
    const errs: Record<string, string> = {};
    for (const f of fields) {
      if (!isVisible(f, answers, def) || f.kind === "hidden") continue;
      const v = answers[f.id];
      const text = answerText(v).trim();
      if (f.required && !text) errs[f.id] = f.kind === "checkbox" ? "Please tick this box." : Array.isArray(v) || f.kind === "radio" || f.kind === "yes_no" || f.kind === "select" ? "Please choose an answer." : "Please fill this in.";
      else if (text && f.kind === "email" && !EMAIL.test(text)) errs[f.id] = "Please enter a valid email address.";
      else if (text && f.kind === "phone" && !/^[+0-9 ()-]{7,25}$/.test(text)) errs[f.id] = "Please enter a valid phone number.";
    }
    return errs;
  }

  function tracking() {
    const params = new URLSearchParams(window.location.search);
    const out: Record<string, string> = { page: embed ? params.get("page") || document.referrer : window.location.href, referrer: embed ? "" : document.referrer };
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"]) {
      const v = params.get(k);
      if (v) out[k] = v;
    }
    return out;
  }

  async function send(partial: boolean) {
    const website = (document.getElementById(`hp-${formId}`) as HTMLInputElement | null)?.value ?? "";
    const r = await fetch(`/api/forms/${formId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers, partial, resume: resume.current, website, ...tracking() }),
    });
    return (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; errors?: Record<string, string>; redirect?: string | null; message?: string; resume?: string; step?: number };
  }

  async function next() {
    const errs = check(stepFields(step));
    setErrors(errs);
    if (Object.keys(errs).length) {
      setMessage("Please check the highlighted answers.");
      return;
    }
    setMessage("");
    // Save people who stop part way, once we know how to reach them.
    if (!preview && def.saveProgress) {
      const hasContact = Object.entries(answers).some(([id, v]) => {
        const f = def.steps.flatMap(stepFields).find((x) => x.id === id);
        return (f?.kind === "email" && EMAIL.test(answerText(v))) || (f?.kind === "phone" && answerText(v).length >= 7);
      });
      if (hasContact) send(true).then((d) => d.resume && (resume.current = d.resume)).catch(() => {});
    }
    setStepIx((i) => Math.min(i + 1, steps.length - 1));
    box.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!last) return next();
    const errs = check(def.steps.flatMap(stepFields));
    if (def.consent.enabled && def.consent.required && answers.__consent !== true) errs.__consent = "Please tick this box to continue.";
    setErrors(errs);
    if (Object.keys(errs).length) {
      const firstStep = def.steps.findIndex((s) => stepFields(s).some((f) => errs[f.id]));
      if (firstStep >= 0 && firstStep !== stepIx) setStepIx(firstStep);
      setMessage("Please check the highlighted answers.");
      return;
    }
    if (preview) {
      setMessage("This is a preview, so nothing was sent. Publish the form and open its link to test it for real.");
      return;
    }
    setState("busy");
    setMessage("");
    try {
      const d = await send(false);
      if (d.ok) {
        if (d.redirect) {
          (embed ? (window.top ?? window) : window).location.href = d.redirect;
          return;
        }
        setResult({ message: d.message ?? def.success });
        setState("done");
        return;
      }
      setErrors(d.errors ?? {});
      setMessage(d.error ?? d.errors?.__any ?? "Please check the highlighted answers.");
    } catch {
      setMessage("We couldn't send that. Check your connection and try again.");
    }
    setState("idle");
  }

  const font = FONTS[t.font]?.stack ?? FONTS.modern.stack;
  const shell: CSSProperties = { color: p.fg, fontFamily: font, padding: embed ? 4 : 0 };
  const progress = useMemo(() => (steps.length > 1 && def.progress !== "none" ? def.progress : null), [steps.length, def.progress]);

  if (state === "done" && result)
    return (
      <div ref={box} style={shell}>
        <div style={{ borderRadius: t.radius, padding: "32px 24px", background: p.tint, border: `1px solid ${p.line}`, textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 999, margin: "0 auto 14px", display: "grid", placeItems: "center", background: t.accent, color: "#fff", fontSize: 26, fontWeight: 700 }}>✓</div>
          <p style={{ fontSize: 17, fontWeight: 600, margin: 0, whiteSpace: "pre-wrap" }}>{result.message}</p>
        </div>
      </div>
    );

  return (
    <div ref={box} style={shell}>
      {progress === "bar" && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: p.muted, marginBottom: 6 }}>
            <span>{step.title}</span>
            <span>
              Step {stepIx + 1} of {steps.length}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: p.line, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${((stepIx + 1) / steps.length) * 100}%`, background: t.accent, borderRadius: 999, transition: "width .3s" }} />
          </div>
        </div>
      )}
      {progress === "steps" && (
        <ol style={{ display: "flex", gap: 8, listStyle: "none", padding: 0, margin: "0 0 22px", flexWrap: "wrap" }}>
          {steps.map((s, i) => (
            <li key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: i === stepIx ? p.fg : p.muted, fontWeight: i === stepIx ? 700 : 500 }}>
              <span style={{ width: 24, height: 24, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, background: i <= stepIx ? t.accent : "transparent", color: i <= stepIx ? "#fff" : p.muted, border: `1.5px solid ${i <= stepIx ? t.accent : p.line}` }}>
                {i < stepIx ? "✓" : i + 1}
              </span>
              {s.title}
              {i < steps.length - 1 && <span style={{ width: 18, height: 1.5, background: p.line }} />}
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <input id={`hp-${formId}`} name="website" tabIndex={-1} autoComplete="off" aria-hidden style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} />
        {step.rows.map((r) => {
          const cols = r.columns.map((c) => ({ ...c, blocks: c.blocks.filter((b) => isVisible(b, answers, def)) })).filter((c) => c.blocks.length);
          if (!cols.length) return null;
          return (
            <div key={r.id} style={{ display: "grid", gap: 14, gridTemplateColumns: `repeat(auto-fit, minmax(${cols.length > 1 ? 180 : 0}px, 1fr))` }}>
              {cols.map((c) => (
                <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
                  {c.blocks.map((b: Block) =>
                    b.type === "content" ? <ContentView key={b.id} b={b} theme={t} /> : <FieldView key={b.id} f={b} value={answers[b.id]} onChange={(v) => set(b.id, v)} error={errors[b.id]} theme={t} />,
                  )}
                </div>
              ))}
            </div>
          );
        })}

        {last && def.consent.enabled && (
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, color: p.muted, cursor: "pointer" }}>
            <input type="checkbox" checked={answers.__consent === true} onChange={(e) => set("__consent", e.target.checked)} style={{ width: 18, height: 18, marginTop: 1, accentColor: t.accent }} />
            <span>
              {def.consent.text}
              {errors.__consent && <span style={{ display: "block", color: p.error, marginTop: 4 }}>{errors.__consent}</span>}
            </span>
          </label>
        )}
        {message && (
          <p role="alert" style={{ margin: 0, fontSize: 14, color: preview && !Object.values(errors).some(Boolean) ? p.muted : p.error }}>
            {message}
          </p>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: t.buttonAlign === "center" ? "center" : "flex-start" }}>
          {stepIx > 0 && (
            <button type="button" onClick={() => setStepIx((i) => i - 1)} style={buttonStyle(t, true)}>
              {def.back}
            </button>
          )}
          <button type="submit" disabled={state === "busy"} style={{ ...buttonStyle(t), flex: t.buttonAlign === "full" ? 1 : undefined, opacity: state === "busy" ? 0.7 : 1 }}>
            {state === "busy" ? "Sending…" : last ? def.button : def.next}
          </button>
        </div>
      </form>
    </div>
  );
}
