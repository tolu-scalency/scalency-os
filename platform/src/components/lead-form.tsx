"use client";

// A published lead form, as visitors see it. Also used for the live preview in the
// builder (preview mode never sends anything).

import { useEffect, useRef, useState } from "react";
import type { FormDefinition, FormField } from "@/lib/form-builder";

type Errors = Record<string, string>;

export function LeadForm({ formId, def, preview = false, embed = false }: { formId: string; def: FormDefinition; preview?: boolean; embed?: boolean }) {
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [message, setMessage] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const { accent, rounded, dark } = def.theme;

  // Inside an iframe, tell the page around it how tall we are, so there's no scroll bar.
  useEffect(() => {
    if (!embed || !box.current) return;
    const send = () => window.parent?.postMessage({ scalencyForm: formId, height: Math.ceil(document.documentElement.scrollHeight) }, "*");
    const ro = new ResizeObserver(send);
    ro.observe(box.current);
    send();
    return () => ro.disconnect();
  }, [embed, formId, state]);

  const set = (id: string, v: string | boolean) => {
    setAnswers((a) => ({ ...a, [id]: v }));
    if (errors[id]) setErrors((e) => ({ ...e, [id]: "" }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (preview) {
      setMessage("This is a preview. Publish the form and open its link to send a real submission.");
      return;
    }
    setState("busy");
    setErrors({});
    setMessage("");
    const params = new URLSearchParams(window.location.search);
    const page = embed ? document.referrer : window.location.href;
    const extra: Record<string, string> = { page, referrer: embed ? "" : document.referrer };
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"]) {
      const v = params.get(k);
      if (v) extra[k] = v;
    }
    const website = (document.getElementById(`hp-${formId}`) as HTMLInputElement | null)?.value ?? "";
    try {
      const r = await fetch(`/api/forms/${formId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers, website, ...extra }) });
      const data = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; errors?: Errors; redirect?: string | null; message?: string };
      if (data.ok) {
        if (data.redirect) {
          (embed ? window.top ?? window : window).location.href = data.redirect;
          return;
        }
        setMessage(data.message ?? def.success);
        setState("done");
        return;
      }
      setErrors(data.errors ?? {});
      setMessage(data.error ?? (data.errors?.__any || "Please check the highlighted fields."));
    } catch {
      setMessage("We couldn't send that. Check your connection and try again.");
    }
    setState("idle");
  }

  const radius = rounded ? "12px" : "4px";
  const fg = dark ? "#f8fafc" : "#0b1b3a";
  const muted = dark ? "#94a3b8" : "#5b6b85";
  const fieldBg = dark ? "#0f1b33" : "#ffffff";
  const border = dark ? "#26375a" : "#d7deea";
  const inputStyle = (bad: boolean): React.CSSProperties => ({
    width: "100%",
    minHeight: 46,
    padding: "10px 14px",
    borderRadius: radius,
    border: `1.5px solid ${bad ? "#dc2626" : border}`,
    background: fieldBg,
    color: fg,
    fontSize: 15,
    outline: "none",
  });

  if (state === "done")
    return (
      <div ref={box} style={{ color: fg, padding: embed ? 4 : 0 }}>
        <div style={{ borderRadius: radius, padding: 24, background: dark ? "#0f1b33" : "#f0f7ff", border: `1px solid ${border}`, textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 999, margin: "0 auto 12px", display: "grid", placeItems: "center", background: accent, color: "#fff", fontSize: 22, fontWeight: 700 }}>✓</div>
          <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{message}</p>
        </div>
      </div>
    );

  return (
    <div ref={box} style={{ color: fg, padding: embed ? 4 : 0 }}>
      {(def.title || def.intro) && (
        <div style={{ marginBottom: 18 }}>
          {def.title && <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>{def.title}</h1>}
          {def.intro && <p style={{ color: muted, fontSize: 15, margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{def.intro}</p>}
        </div>
      )}
      <form onSubmit={submit} noValidate style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        {/* Spam trap: hidden from people, filled in by bots. */}
        <input id={`hp-${formId}`} name="website" tabIndex={-1} autoComplete="off" aria-hidden style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} />
        {def.fields.map((f) => (
          <Field key={f.id} f={f} value={answers[f.id]} error={errors[f.id]} set={set} inputStyle={inputStyle} muted={muted} accent={accent} />
        ))}
        {def.consent.enabled && (
          <label style={{ flex: "1 1 100%", display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, color: muted, cursor: "pointer" }}>
            <input type="checkbox" checked={answers.__consent === true} onChange={(e) => set("__consent", e.target.checked)} style={{ width: 18, height: 18, marginTop: 1, accentColor: accent }} />
            <span>
              {def.consent.text}
              {errors.__consent && <span style={{ display: "block", color: "#dc2626", marginTop: 4 }}>{errors.__consent}</span>}
            </span>
          </label>
        )}
        {message && (
          <p role="alert" style={{ flex: "1 1 100%", margin: 0, fontSize: 14, color: preview ? muted : "#dc2626" }}>
            {message}
          </p>
        )}
        <button
          type="submit"
          disabled={state === "busy"}
          style={{ flex: "1 1 100%", minHeight: 50, borderRadius: radius, border: 0, background: accent, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", opacity: state === "busy" ? 0.7 : 1 }}
        >
          {state === "busy" ? "Sending…" : def.button}
        </button>
      </form>
    </div>
  );
}

function Field({
  f,
  value,
  error,
  set,
  inputStyle,
  muted,
  accent,
}: {
  f: FormField;
  value: string | boolean | undefined;
  error?: string;
  set: (id: string, v: string | boolean) => void;
  inputStyle: (bad: boolean) => React.CSSProperties;
  muted: string;
  accent: string;
}) {
  const v = typeof value === "string" ? value : "";
  const label = (
    <span style={{ fontSize: 13.5, fontWeight: 600 }}>
      {f.label}
      {f.required && <span style={{ color: "#dc2626" }}> *</span>}
    </span>
  );
  const err = error ? <span style={{ fontSize: 12.5, color: "#dc2626" }}>{error}</span> : null;
  const wrap: React.CSSProperties = { flex: f.half ? "1 1 200px" : "1 1 100%", display: "flex", flexDirection: "column", gap: 6, minWidth: 0 };

  if (f.kind === "checkbox")
    return (
      <label style={{ ...wrap, flexDirection: "row", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
        <input type="checkbox" checked={value === true} onChange={(e) => set(f.id, e.target.checked)} style={{ width: 18, height: 18, marginTop: 1, accentColor: accent }} />
        <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {label}
          {err}
        </span>
      </label>
    );

  const type = f.kind === "email" ? "email" : f.kind === "phone" ? "tel" : "text";
  const auto = { first_name: "given-name", last_name: "family-name", full_name: "name", email: "email", phone: "tel" }[f.kind as string];
  return (
    <label style={wrap}>
      {label}
      {f.kind === "textarea" ? (
        <textarea value={v} placeholder={f.placeholder} rows={4} onChange={(e) => set(f.id, e.target.value)} style={{ ...inputStyle(Boolean(error)), resize: "vertical" }} />
      ) : f.kind === "select" ? (
        <select value={v} onChange={(e) => set(f.id, e.target.value)} style={inputStyle(Boolean(error))}>
          <option value="">{f.placeholder || "Choose…"}</option>
          {(f.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input type={type} value={v} autoComplete={auto} placeholder={f.placeholder} onChange={(e) => set(f.id, e.target.value)} style={inputStyle(Boolean(error))} />
      )}
      {err}
      {!err && f.kind === "phone" && <span style={{ fontSize: 12, color: muted }}>Mobile like 07700 900123, or with your country code.</span>}
    </label>
  );
}
