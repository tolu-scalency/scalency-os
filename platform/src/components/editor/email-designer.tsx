"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import type { MergeField } from "@/lib/merge-fields";
import { FieldPicker, MergeText } from "./field-picker";

export type EmailMode = "text" | "design" | "code";
export type EmailValue = { subject: string; body: string; html: string; mode: EmailMode };

const FONTS = ["Arial", "Helvetica", "Georgia", "Times New Roman", "Verdana", "Trebuchet MS", "Tahoma", "Courier New"];
const SIZES: { label: string; value: string }[] = [
  { label: "Small", value: "2" },
  { label: "Normal", value: "3" },
  { label: "Large", value: "4" },
  { label: "Larger", value: "5" },
  { label: "Huge", value: "6" },
];

const LAYOUTS: { name: string; html: string }[] = [
  {
    name: "Simple letter",
    html: `<p>Hi {{first_name}},</p><p>Thanks for getting in touch with {{workspace}}. We'd love to help.</p><p>Best wishes,<br>{{owner_first_name}}</p>`,
  },
  {
    name: "Book a call",
    html: `<h2 style="margin:0 0 12px;font-family:Arial;color:#0B2447;">Let's find a time, {{first_name}}</h2><p>Pick a slot that suits you and we'll take it from there.</p><p style="text-align:center;margin:24px 0;"><a href="{{custom_values.booking_link}}" style="display:inline-block;background:#0A5FE3;color:#ffffff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-family:Arial;">Book my call</a></p><p>Speak soon,<br>{{workspace}}</p>`,
  },
  {
    name: "Announcement",
    html: `<p style="text-align:center;margin:0 0 8px;color:#29B0F8;font-family:Arial;font-size:12px;letter-spacing:2px;">NEWS FROM {{workspace}}</p><h1 style="text-align:center;margin:0 0 16px;font-family:Georgia;color:#0B2447;">Something new for you</h1><p>Hi {{first_name}}, here's what's new and why it matters to you.</p><hr style="border:none;border-top:1px solid #E3E9F2;margin:24px 0;"><p style="font-size:13px;color:#6B7C93;">You're receiving this because you enquired with {{workspace}}.</p>`,
  },
];

/** Strips tags for the plain-text copy that's sent alongside the designed email. */
function textFrom(html: string) {
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|h[1-6]|div|li)>/gi, "$&\n"), "text/html");
  return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * The email step: write in plain text, design it with fonts, colours, buttons and images,
 * or paste your own HTML. Fields like {{first_name}} work in all three.
 */
export function EmailDesigner({ value, onChange, fields }: { value: EmailValue; onChange: (v: Partial<EmailValue>) => void; fields: MergeField[] }) {
  const mode = value.mode;
  const editor = useRef<HTMLDivElement>(null);
  const saved = useRef<Range | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  // Load the HTML into the design surface when switching to it (not on every keystroke, so the cursor stays put).
  useEffect(() => {
    if (mode === "design" && editor.current && editor.current.innerHTML !== value.html) editor.current.innerHTML = value.html;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Remember where the cursor was in the design surface, so toolbar choices apply there.
  useEffect(() => {
    function track() {
      const sel = window.getSelection();
      if (sel && sel.rangeCount && editor.current?.contains(sel.anchorNode)) saved.current = sel.getRangeAt(0).cloneRange();
    }
    document.addEventListener("selectionchange", track);
    return () => document.removeEventListener("selectionchange", track);
  }, []);

  function sync() {
    const html = editor.current?.innerHTML ?? "";
    onChange({ html, body: textFrom(html) });
  }
  function restore() {
    editor.current?.focus();
    const sel = window.getSelection();
    if (saved.current && sel) {
      sel.removeAllRanges();
      sel.addRange(saved.current);
    }
  }
  function exec(cmd: string, arg?: string) {
    restore();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(cmd, false, arg);
    sync();
  }
  function insertHtml(html: string) {
    restore();
    document.execCommand("insertHTML", false, html);
    sync();
  }
  function link() {
    const url = window.prompt("Link address (https://…) or a field like {{custom_values.booking_link}}");
    if (url) exec("createLink", url);
  }
  function image() {
    const url = window.prompt("Image address (https://…). Upload the image somewhere public first, for example your website.");
    if (url && /^https:\/\//.test(url)) insertHtml(`<img src="${url.replace(/"/g, "")}" alt="" style="max-width:100%;height:auto;border-radius:8px;">`);
  }
  function button() {
    const label = window.prompt("Button text", "Book my call");
    if (!label) return;
    const url = window.prompt("Where it goes (https://… or a field like {{custom_values.booking_link}})", "https://");
    if (!url) return;
    const safe = (t: string) => t.replace(/[<>"]/g, "");
    insertHtml(
      `<p style="text-align:center;margin:20px 0;"><a href="${safe(url)}" style="display:inline-block;background:#0A5FE3;color:#ffffff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;">${safe(label)}</a></p><p></p>`,
    );
  }

  function switchTo(next: EmailMode) {
    if (next === mode) return;
    if (next === "design" && mode === "text") {
      const html = value.body
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`)
        .join("");
      onChange({ mode: next, html: value.html || html });
      return;
    }
    if (next === "text") {
      onChange({ mode: next, body: value.body || textFrom(value.html) });
      return;
    }
    onChange({ mode: next });
  }

  const tabs: { key: EmailMode; label: string; icon: IconName }[] = [
    { key: "text", label: "Plain text", icon: "type" },
    { key: "design", label: "Design", icon: "edit" },
    { key: "code", label: "HTML code", icon: "link" },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      <MergeText value={value.subject} onChange={(subject) => onChange({ subject })} fields={fields} maxLength={200} placeholder="Subject, e.g. Thanks {{first_name}}" label="Subject" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Email format" className="flex gap-1 rounded-xl bg-[#eaeff6] p-1 text-[12.5px] font-medium">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={mode === t.key}
              onClick={() => switchTo(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${mode === t.key ? "bg-white text-navy shadow-sm" : "text-muted hover:text-navy"}`}
            >
              <Icon name={t.icon} size={13} /> {t.label}
            </button>
          ))}
        </div>
        {mode === "design" && (
          <select
            aria-label="Start from a layout"
            value=""
            onChange={(e) => {
              const l = LAYOUTS.find((x) => x.name === e.target.value);
              if (!l) return;
              if (editor.current) editor.current.innerHTML = l.html;
              onChange({ html: l.html, body: textFrom(l.html) });
            }}
            className="field h-9 w-48 text-[12.5px]"
          >
            <option value="">Start from a layout…</option>
            {LAYOUTS.map((l) => (
              <option key={l.name} value={l.name}>{l.name}</option>
            ))}
          </select>
        )}
      </div>

      {mode === "text" && (
        <>
          <MergeText value={value.body} onChange={(body) => onChange({ body })} fields={fields} multiline rows={6} maxLength={5000} placeholder={"Hi {{first_name}},\n\n…"} label="Email message" />
          <span className="text-[12px] text-faint">Press Enter for a new line. Sent as a clean, branded email.</span>
        </>
      )}

      {mode === "design" && (
        <div className="overflow-hidden rounded-xl border border-line">
          <div className="flex flex-wrap items-center gap-1 border-b border-line bg-surface p-1.5" onMouseDown={(e) => (e.target as HTMLElement).tagName !== "SELECT" && e.preventDefault()}>
            <select aria-label="Font" defaultValue="" onChange={(e) => e.target.value && exec("fontName", e.target.value)} className="field h-8 w-36 text-[12.5px]">
              <option value="">Font</option>
              {FONTS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
              ))}
            </select>
            <select aria-label="Size" defaultValue="" onChange={(e) => e.target.value && exec("fontSize", e.target.value)} className="field h-8 w-28 text-[12.5px]">
              <option value="">Size</option>
              {SIZES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <Divider />
            <Tool label="Bold" onClick={() => exec("bold")}><b>B</b></Tool>
            <Tool label="Italic" onClick={() => exec("italic")}><i className="font-serif">I</i></Tool>
            <Tool label="Underline" onClick={() => exec("underline")}><u>U</u></Tool>
            <label title="Text colour" className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg hover:bg-white">
              <span className="text-[14px] font-bold text-navy underline decoration-[3px] decoration-brand">A</span>
              <input type="color" aria-label="Text colour" defaultValue="#0a5fe3" onChange={(e) => exec("foreColor", e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
            </label>
            <Divider />
            <Tool label="Heading" onClick={() => exec("formatBlock", "h2")}><span className="text-[12px] font-bold">H</span></Tool>
            <Tool label="Paragraph" onClick={() => exec("formatBlock", "p")}><span className="text-[12px]">¶</span></Tool>
            <Tool label="Align left" onClick={() => exec("justifyLeft")}><Lines align="left" /></Tool>
            <Tool label="Centre" onClick={() => exec("justifyCenter")}><Lines align="center" /></Tool>
            <Tool label="Align right" onClick={() => exec("justifyRight")}><Lines align="right" /></Tool>
            <Tool label="Bullet list" onClick={() => exec("insertUnorderedList")}><span className="text-[13px]">•≡</span></Tool>
            <Tool label="Numbered list" onClick={() => exec("insertOrderedList")}><span className="text-[11px] font-semibold">1.</span></Tool>
            <Divider />
            <Tool label="Link" onClick={link}><Icon name="link" size={14} /></Tool>
            <Tool label="Image" onClick={image}><Icon name="upload" size={14} /></Tool>
            <Tool label="Button" onClick={button}><span className="rounded bg-brand px-1 text-[10px] font-bold text-white">BTN</span></Tool>
            <Tool label="Divider line" onClick={() => insertHtml('<hr style="border:none;border-top:1px solid #E3E9F2;margin:20px 0;"><p></p>')}><span className="text-[13px]">―</span></Tool>
            <Tool label="Clear formatting" onClick={() => exec("removeFormat")}><Icon name="x" size={13} /></Tool>
            <span className="ml-auto">
              <FieldPicker fields={fields} onPick={(t) => insertHtml(t)} compact />
            </span>
          </div>
          <div
            ref={editor}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="Email design"
            onInput={sync}
            onBlur={sync}
            className="email-canvas min-h-[220px] bg-white px-6 py-5 text-[15px] leading-[1.6] text-[#1F2D45] outline-none [&_a]:text-brand [&_a]:underline [&_h1]:text-[26px] [&_h1]:font-bold [&_h2]:text-[20px] [&_h2]:font-bold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-3 [&_ul]:list-disc"
          />
        </div>
      )}

      {mode === "code" && (
        <div className="grid gap-2 lg:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <textarea
              value={value.html}
              onChange={(e) => onChange({ html: e.target.value.slice(0, 200000), body: textFrom(e.target.value) })}
              rows={14}
              spellCheck={false}
              placeholder={"<!DOCTYPE html>\n<html>…your own design…</html>"}
              aria-label="Email HTML"
              className="field resize-y py-2.5 font-mono text-[12px] leading-[1.5]"
            />
            <div className="flex items-center justify-between gap-2">
              <FieldPicker fields={fields} onPick={(t) => onChange({ html: value.html + t })} compact />
              <button type="button" onClick={() => setShowPreview((s) => !s)} className="text-[12px] font-semibold text-brand lg:hidden">
                {showPreview ? "Hide preview" : "Show preview"}
              </button>
            </div>
          </div>
          {showPreview && (
            <iframe title="Email preview" sandbox="" srcDoc={value.html || "<p style='font-family:Arial;color:#8592A6;padding:16px'>Your preview appears here.</p>"} className="min-h-[300px] w-full rounded-xl border border-line bg-white" />
          )}
          <p className="text-[12px] text-faint lg:col-span-2">
            Paste a full email design (from Stripo, Beefree, Mailchimp exports and so on). It&apos;s sent exactly as written. Scripts don&apos;t run in emails.
          </p>
        </div>
      )}
    </div>
  );
}

function Tool({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-navy hover:bg-white">
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-line-strong" />;
}

function Lines({ align }: { align: "left" | "center" | "right" }) {
  const pos = align === "left" ? "items-start" : align === "center" ? "items-center" : "items-end";
  return (
    <span className={`flex w-3.5 flex-col gap-[2px] ${pos}`}>
      <span className="h-[2px] w-3.5 rounded bg-current" />
      <span className="h-[2px] w-2.5 rounded bg-current" />
      <span className="h-[2px] w-3.5 rounded bg-current" />
    </span>
  );
}
