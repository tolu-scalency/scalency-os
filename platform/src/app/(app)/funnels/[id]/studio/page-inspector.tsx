"use client";

// Page Studio's right panel: settings for whatever is selected (a block, columns or a
// section), or for the whole page when nothing is (style, search and sharing, tracking).

import { useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { notify } from "@/components/toast";
import {
  BACKGROUNDS,
  FEATURE_ICONS,
  blockInfo,
  slugify,
  type Item,
  type PBlock,
  type PageDefinition,
  type PageTheme,
  type Plan,
  type Row,
  type Section,
  type SectionStyle,
} from "@/lib/page-builder";
import { findBlock, findColumn, findRow, findSection } from "./page-tree";

type FormOption = { id: string; name: string };

export type InspectorProps = {
  def: PageDefinition;
  selected: string | null;
  readOnly: boolean;
  forms: FormOption[];
  link: string;
  slug: string;
  onSlug: (s: string) => Promise<{ error?: string }>;
  onBlock: (id: string, patch: Partial<PBlock>, key?: string) => void;
  onRow: (id: string, patch: Partial<Row>) => void;
  onCols: (id: string, n: number) => void;
  onSection: (id: string, patch: Partial<Section>, key?: string) => void;
  onPage: (patch: Partial<PageDefinition>, key?: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string | null) => void;
};

// ---------------------------------------------------------------- small parts
const label = "text-[12px] font-semibold text-navy";
const field = "field h-10 w-full text-[13px]";

function Group({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-2.5 border-b border-line px-4 py-4">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-faint">{title}</div>
      {hint && <p className="-mt-1 text-[11.5px] leading-relaxed text-muted">{hint}</p>}
      {children}
    </div>
  );
}

function Field({ name, children, hint }: { name: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={label}>{name}</span>
      {children}
      {hint && <span className="text-[11.5px] text-muted">{hint}</span>}
    </label>
  );
}

function Seg<T extends string | number>({ value, options, onChange, ariaLabel }: { value: T; options: { v: T; label: React.ReactNode; title?: string }[]; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex gap-0.5 rounded-xl bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          title={o.title}
          onClick={() => onChange(o.v)}
          className={`flex min-h-8 flex-1 items-center justify-center rounded-lg px-1.5 text-[12px] font-semibold ${value === o.v ? "bg-white text-brand shadow-sm" : "text-muted hover:text-navy"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const ALIGN = [
  { v: "left" as const, label: <Icon name="alignLeft" size={14} />, title: "Left" },
  { v: "center" as const, label: <Icon name="alignCenter" size={14} />, title: "Centre" },
  { v: "right" as const, label: <Icon name="alignRight" size={14} />, title: "Right" },
];

/** Upload a picture, or paste its address. */
function ImageInput({ value, onChange, readOnly }: { value: string; onChange: (url: string) => void; readOnly: boolean }) {
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  async function upload(f: File) {
    setBusy(true);
    const fd = new FormData();
    fd.set("file", f);
    const r = await fetch("/api/media", { method: "POST", body: fd }).catch(() => null);
    const body = (await r?.json().catch(() => ({}))) as { url?: string; error?: string };
    setBusy(false);
    if (!r?.ok || !body.url) return notify(body.error ?? "The upload failed. Please try again.", "bad");
    onChange(body.url);
    notify("Picture uploaded");
  }
  return (
    <div className="flex flex-col gap-1.5">
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="max-h-28 w-full rounded-lg bg-surface object-contain ring-1 ring-line" />
      )}
      <div className="flex gap-1.5">
        <button type="button" disabled={readOnly || busy} onClick={() => file.current?.click()} className="btn-ghost inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-semibold">
          <Icon name="upload" size={13} /> {busy ? "Uploading…" : value ? "Replace" : "Upload"}
        </button>
        {value && (
          <button type="button" disabled={readOnly} onClick={() => onChange("")} className="btn-ghost inline-flex min-h-9 items-center rounded-lg px-3 text-[12.5px] font-semibold text-bad">
            Remove
          </button>
        )}
      </div>
      <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <input value={value} disabled={readOnly} onChange={(e) => onChange(e.target.value.trim())} placeholder="…or paste an https:// image address" className={`${field} h-9 text-[12px]`} />
    </div>
  );
}

/** Where a button or link goes: a section on this page, a web address, phone or email. */
function LinkInput({ value, onChange, def, readOnly }: { value: string; onChange: (v: string) => void; def: PageDefinition; readOnly: boolean }) {
  const anchors = def.sections.filter((s) => s.anchor);
  const isAnchor = value.startsWith("#") && value !== "#";
  return (
    <div className="flex flex-col gap-1.5">
      <select
        value={isAnchor ? value : value.startsWith("tel:") ? "tel" : value.startsWith("mailto:") ? "mail" : "url"}
        disabled={readOnly}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "url") onChange("https://");
          else if (v === "tel") onChange("tel:");
          else if (v === "mail") onChange("mailto:");
          else onChange(v);
        }}
        className={field}
        aria-label="Link type"
      >
        <option value="url">A web address</option>
        {anchors.map((s) => (
          <option key={s.id} value={`#${s.anchor}`}>
            Scroll to: {s.name}
          </option>
        ))}
        <option value="tel">Call a phone number</option>
        <option value="mail">Send an email</option>
      </select>
      {!isAnchor && <input value={value} disabled={readOnly} onChange={(e) => onChange(e.target.value)} placeholder={value.startsWith("tel:") ? "tel:+44..." : value.startsWith("mailto:") ? "mailto:you@..." : "https://"} className={field} aria-label="Link" />}
      {!anchors.length && <span className="text-[11px] text-muted">Tip: give a section a link name (select it) to scroll to it from buttons and the menu.</span>}
    </div>
  );
}

/** A list of items (features, reviews, FAQs...) with add, remove and reorder. */
function Items<T>({
  items,
  onChange,
  make,
  title,
  render,
  readOnly,
  max = 12,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  make: () => T;
  title: (it: T, i: number) => string;
  render: (it: T, set: (patch: Partial<T>) => void) => React.ReactNode;
  readOnly: boolean;
  max?: number;
}) {
  const [open, setOpen] = useState<number | null>(0);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    setOpen(j);
  };
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((it, i) => (
        <div key={i} className="rounded-xl ring-1 ring-line">
          <div className="flex items-center gap-1 px-2 py-1.5">
            <button type="button" onClick={() => setOpen(open === i ? null : i)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[12.5px] font-semibold">
              <Icon name={open === i ? "chevronDown" : "chevronRight"} size={13} className="flex-none text-faint" />
              <span className="truncate">{title(it, i) || `Item ${i + 1}`}</span>
            </button>
            {!readOnly && (
              <>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface disabled:opacity-30">
                  <Icon name="up" size={12} />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface disabled:opacity-30">
                  <Icon name="down" size={12} />
                </button>
                <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-bad hover:bg-bad-bg">
                  <Icon name="trash" size={12} />
                </button>
              </>
            )}
          </div>
          {open === i && <div className="flex flex-col gap-2 border-t border-line p-2.5">{render(it, (patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))))}</div>}
        </div>
      ))}
      {!readOnly && items.length < max && (
        <button
          type="button"
          onClick={() => {
            onChange([...items, make()]);
            setOpen(items.length);
          }}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong text-[12.5px] font-semibold text-brand hover:bg-chip"
        >
          <Icon name="plus" size={13} /> Add
        </button>
      )}
    </div>
  );
}

function Cols({ value, onChange, max = 4 }: { value: number; onChange: (n: 1 | 2 | 3 | 4) => void; max?: number }) {
  return <Seg ariaLabel="How many across" value={value} onChange={(v) => onChange(v as 1 | 2 | 3 | 4)} options={[1, 2, 3, 4].slice(0, max).map((n) => ({ v: n, label: String(n) }))} />;
}

// ---------------------------------------------------------------- block settings
function BlockSettings({ b, props }: { b: PBlock; props: InspectorProps }) {
  const { readOnly, def, forms } = props;
  const set = (patch: Partial<PBlock>, key?: string) => props.onBlock(b.id, patch, key);
  const ta = "field min-h-24 w-full resize-y py-2 text-[13px] leading-relaxed";
  function itemText(it: Item, s: (p: Partial<Item>) => void, key: keyof Item, name: string, multi = false) {
    return multi ? (
      <Field name={name}>
        <textarea value={(it[key] as string) ?? ""} disabled={readOnly} onChange={(e) => s({ [key]: e.target.value } as Partial<Item>)} className={`${ta} min-h-16`} />
      </Field>
    ) : (
      <Field name={name}>
        <input value={(it[key] as string) ?? ""} disabled={readOnly} onChange={(e) => s({ [key]: e.target.value } as Partial<Item>)} className={field} />
      </Field>
    );
  }

  let body: React.ReactNode = null;
  switch (b.kind) {
    case "heading":
      body = (
        <>
          <Field name="Text">
            <textarea value={b.text ?? ""} disabled={readOnly} onChange={(e) => set({ text: e.target.value }, `t-${b.id}`)} className={`${ta} min-h-16 font-semibold`} />
          </Field>
          <Field name="Size">
            <Seg ariaLabel="Size" value={b.size ?? "l"} onChange={(v) => set({ size: v })} options={[{ v: "s", label: "S" }, { v: "m", label: "M" }, { v: "l", label: "L" }, { v: "xl", label: "XL" }]} />
          </Field>
          <Field name="Level" hint="Use H1 once per page, for the main headline. Search engines read it.">
            <Seg ariaLabel="Level" value={b.level ?? 2} onChange={(v) => set({ level: v as 1 | 2 | 3 })} options={[{ v: 1, label: "H1" }, { v: 2, label: "H2" }, { v: 3, label: "H3" }]} />
          </Field>
          <Field name="Align">
            <Seg ariaLabel="Align" value={b.align ?? "left"} onChange={(v) => set({ align: v })} options={ALIGN} />
          </Field>
        </>
      );
      break;
    case "text":
      body = (
        <>
          <Field name="Text" hint="**bold**, *italic*, [link words](https://...). A blank line starts a new paragraph.">
            <textarea value={b.text ?? ""} disabled={readOnly} onChange={(e) => set({ text: e.target.value }, `t-${b.id}`)} className={`${ta} min-h-32`} />
          </Field>
          <Field name="Size">
            <Seg ariaLabel="Size" value={b.size ?? "m"} onChange={(v) => set({ size: v })} options={[{ v: "s", label: "Small" }, { v: "m", label: "Normal" }, { v: "l", label: "Large" }]} />
          </Field>
          <Field name="Align">
            <Seg ariaLabel="Align" value={b.align ?? "left"} onChange={(v) => set({ align: v })} options={ALIGN} />
          </Field>
        </>
      );
      break;
    case "button":
      body = (
        <>
          <Field name="Button words">
            <input value={b.text ?? ""} disabled={readOnly} onChange={(e) => set({ text: e.target.value }, `t-${b.id}`)} className={field} />
          </Field>
          <Field name="Goes to">
            <LinkInput value={b.link ?? "#"} onChange={(v) => set({ link: v }, `l-${b.id}`)} def={def} readOnly={readOnly} />
          </Field>
          <Field name="Style">
            <Seg ariaLabel="Style" value={b.style ?? "primary"} onChange={(v) => set({ style: v })} options={[{ v: "primary", label: "Main" }, { v: "secondary", label: "Second" }, { v: "outline", label: "Outline" }, { v: "text", label: "Link" }]} />
          </Field>
          <Field name="Size">
            <Seg ariaLabel="Size" value={b.size ?? "m"} onChange={(v) => set({ size: v })} options={[{ v: "s", label: "Small" }, { v: "m", label: "Normal" }, { v: "l", label: "Large" }]} />
          </Field>
          <Field name="Align">
            <Seg ariaLabel="Align" value={b.align ?? "left"} onChange={(v) => set({ align: v })} options={ALIGN} />
          </Field>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={Boolean(b.full)} disabled={readOnly} onChange={(e) => set({ full: e.target.checked })} className="h-4 w-4 accent-[var(--color-brand)]" /> Full width
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={Boolean(b.newTab)} disabled={readOnly} onChange={(e) => set({ newTab: e.target.checked })} className="h-4 w-4 accent-[var(--color-brand)]" /> Open in a new tab
          </label>
        </>
      );
      break;
    case "image":
      body = (
        <>
          <ImageInput value={b.src ?? ""} onChange={(v) => set({ src: v })} readOnly={readOnly} />
          <Field name="Description" hint="For people using screen readers, and for Google.">
            <input value={b.alt ?? ""} disabled={readOnly} onChange={(e) => set({ alt: e.target.value }, `a-${b.id}`)} className={field} />
          </Field>
          <Field name={`Width: ${b.width ?? 100}%`}>
            <input type="range" min={20} max={100} step={5} value={b.width ?? 100} disabled={readOnly} onChange={(e) => set({ width: Number(e.target.value) }, `w-${b.id}`)} />
          </Field>
          <Field name={`Rounded corners: ${b.radius ?? 12}px`}>
            <input type="range" min={0} max={48} value={b.radius ?? 12} disabled={readOnly} onChange={(e) => set({ radius: Number(e.target.value) }, `r-${b.id}`)} />
          </Field>
          <Field name="Align">
            <Seg ariaLabel="Align" value={b.align ?? "left"} onChange={(v) => set({ align: v })} options={ALIGN} />
          </Field>
          <Field name="Link (optional)">
            <LinkInput value={b.link ?? "#"} onChange={(v) => set({ link: v }, `l-${b.id}`)} def={def} readOnly={readOnly} />
          </Field>
        </>
      );
      break;
    case "video":
      body = (
        <Field name="Video link" hint="A YouTube, Vimeo or Loom link, or an https:// address ending in .mp4.">
          <input value={b.url ?? ""} disabled={readOnly} onChange={(e) => set({ url: e.target.value.trim() }, `u-${b.id}`)} placeholder="https://www.youtube.com/watch?v=..." className={field} />
        </Field>
      );
      break;
    case "form":
      body = (
        <>
          <Field name="Form" hint="Only published forms work on a live page. New leads land in Contacts, tagged with the form's tags.">
            <select value={b.formId ?? ""} disabled={readOnly} onChange={(e) => set({ formId: e.target.value })} className={field}>
              <option value="">{forms.length ? "Choose a form" : "No published forms yet"}</option>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <a href="/forms" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand">
            <Icon name="plus" size={12} /> Make a new form (opens in a new tab)
          </a>
        </>
      );
      break;
    case "list":
      body = (
        <>
          <Field name="Points" hint="One per line.">
            <textarea
              value={(b.items ?? []).map((i) => i.text ?? "").join("\n")}
              disabled={readOnly}
              onChange={(e) => set({ items: e.target.value.split("\n").slice(0, 20).map((t) => ({ text: t })) }, `i-${b.id}`)}
              className={`${ta} min-h-28`}
            />
          </Field>
          <Field name="How many across">
            <Cols value={b.cols ?? 1} onChange={(n) => set({ cols: n })} max={3} />
          </Field>
        </>
      );
      break;
    case "features":
      body = (
        <>
          <Items<Item>
            items={b.items ?? []}
            readOnly={readOnly}
            onChange={(items) => set({ items }, `i-${b.id}`)}
            make={() => ({ icon: "check", title: "New feature", text: "Describe it in a sentence." })}
            title={(it) => it.title ?? ""}
            render={(it, s) => (
              <>
                <div className="flex flex-wrap gap-1">
                  {FEATURE_ICONS.map((ic) => (
                    <button key={ic} type="button" onClick={() => s({ icon: ic })} aria-label={ic} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${it.icon === ic ? "bg-brand text-white" : "bg-surface text-muted hover:text-navy"}`}>
                      <Icon name={ic as IconName} size={14} />
                    </button>
                  ))}
                </div>
                {itemText(it, s, "title", "Title")}
                {itemText(it, s, "text", "Text", true)}
              </>
            )}
          />
          <Field name="How many across">
            <Cols value={b.cols ?? 3} onChange={(n) => set({ cols: n })} />
          </Field>
        </>
      );
      break;
    case "testimonials":
      body = (
        <>
          <Items<Item>
            items={b.items ?? []}
            readOnly={readOnly}
            onChange={(items) => set({ items }, `i-${b.id}`)}
            make={() => ({ text: "What they said.", name: "Name", role: "Town" })}
            title={(it) => it.name ?? ""}
            render={(it, s) => (
              <>
                {itemText(it, s, "text", "What they said", true)}
                {itemText(it, s, "name", "Name")}
                {itemText(it, s, "role", "Town or job")}
                <Field name="Photo (optional)">
                  <ImageInput value={it.image ?? ""} onChange={(v) => s({ image: v })} readOnly={readOnly} />
                </Field>
              </>
            )}
          />
          <Field name="How many across">
            <Cols value={b.cols ?? 3} onChange={(n) => set({ cols: n })} max={3} />
          </Field>
          <p className="text-[11.5px] text-muted">Only use real reviews from real customers.</p>
        </>
      );
      break;
    case "faq":
      body = (
        <Items<Item>
          items={b.items ?? []}
          readOnly={readOnly}
          max={20}
          onChange={(items) => set({ items }, `i-${b.id}`)}
          make={() => ({ title: "A question people ask", text: "The answer." })}
          title={(it) => it.title ?? ""}
          render={(it, s) => (
            <>
              {itemText(it, s, "title", "Question")}
              {itemText(it, s, "text", "Answer", true)}
            </>
          )}
        />
      );
      break;
    case "stats":
      body = (
        <>
          <Items<Item>
            items={b.items ?? []}
            readOnly={readOnly}
            max={4}
            onChange={(items) => set({ items }, `i-${b.id}`)}
            make={() => ({ value: "100+", text: "Label" })}
            title={(it) => `${it.value ?? ""} ${it.text ?? ""}`}
            render={(it, s) => (
              <>
                {itemText(it, s, "value", "Number")}
                {itemText(it, s, "text", "Label")}
              </>
            )}
          />
          <Field name="How many across">
            <Cols value={b.cols ?? 3} onChange={(n) => set({ cols: n })} />
          </Field>
        </>
      );
      break;
    case "logos":
      body = (
        <>
          <Items<Item>
            items={b.items ?? []}
            readOnly={readOnly}
            onChange={(items) => set({ items }, `i-${b.id}`)}
            make={() => ({ image: "", name: "" })}
            title={(it, i) => it.name || `Logo ${i + 1}`}
            render={(it, s) => (
              <>
                <ImageInput value={it.image ?? ""} onChange={(v) => s({ image: v })} readOnly={readOnly} />
                {itemText(it, s, "name", "Company name")}
              </>
            )}
          />
          <Field name="How many across">
            <Cols value={b.cols ?? 4} onChange={(n) => set({ cols: n })} />
          </Field>
        </>
      );
      break;
    case "pricing":
      body = (
        <Items<Plan>
          items={b.plans ?? []}
          readOnly={readOnly}
          max={4}
          onChange={(plans) => set({ plans }, `p-${b.id}`)}
          make={() => ({ name: "New plan", price: "£0", period: "per month", features: ["One thing"], button: "Choose", link: "#", highlight: false })}
          title={(p) => `${p.name} ${p.price}`}
          render={(p, s) => (
            <>
              <Field name="Name">
                <input value={p.name} disabled={readOnly} onChange={(e) => s({ name: e.target.value })} className={field} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field name="Price">
                  <input value={p.price} disabled={readOnly} onChange={(e) => s({ price: e.target.value })} className={field} />
                </Field>
                <Field name="Per">
                  <input value={p.period} disabled={readOnly} onChange={(e) => s({ period: e.target.value })} className={field} />
                </Field>
              </div>
              <Field name="What's included" hint="One per line.">
                <textarea value={p.features.join("\n")} disabled={readOnly} onChange={(e) => s({ features: e.target.value.split("\n").slice(0, 12) })} className={`${ta} min-h-20`} />
              </Field>
              <Field name="Button words">
                <input value={p.button} disabled={readOnly} onChange={(e) => s({ button: e.target.value })} className={field} />
              </Field>
              <Field name="Button goes to">
                <LinkInput value={p.link} onChange={(v) => s({ link: v })} def={def} readOnly={readOnly} />
              </Field>
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={p.highlight} disabled={readOnly} onChange={(e) => s({ highlight: e.target.checked })} className="h-4 w-4 accent-[var(--color-brand)]" /> Highlight as most popular
              </label>
            </>
          )}
        />
      );
      break;
    case "countdown":
      body = (
        <>
          <Field name="Counts down to" hint="In the visitor's own time zone.">
            <input type="datetime-local" value={b.until ?? ""} disabled={readOnly} onChange={(e) => set({ until: e.target.value })} className={field} />
          </Field>
          <Field name="When it ends, show">
            <input value={b.text ?? ""} disabled={readOnly} onChange={(e) => set({ text: e.target.value }, `t-${b.id}`)} className={field} />
          </Field>
        </>
      );
      break;
    case "menu":
      body = (
        <>
          <Field name="Business name">
            <input value={b.text ?? ""} disabled={readOnly} onChange={(e) => set({ text: e.target.value }, `t-${b.id}`)} className={field} />
          </Field>
          <Field name="Logo (shown instead of the name)">
            <ImageInput value={b.src ?? ""} onChange={(v) => set({ src: v })} readOnly={readOnly} />
          </Field>
          <div className={label}>Menu links</div>
          <Items<{ label: string; link: string }>
            items={b.nav ?? []}
            readOnly={readOnly}
            max={8}
            onChange={(nav) => set({ nav }, `n-${b.id}`)}
            make={() => ({ label: "Link", link: "#" })}
            title={(n) => n.label}
            render={(n, s) => (
              <>
                <Field name="Words">
                  <input value={n.label} disabled={readOnly} onChange={(e) => s({ label: e.target.value })} className={field} />
                </Field>
                <Field name="Goes to">
                  <LinkInput value={n.link} onChange={(v) => s({ link: v })} def={def} readOnly={readOnly} />
                </Field>
              </>
            )}
          />
          <Field name="Button words (leave blank for none)">
            <input value={b.alt ?? ""} disabled={readOnly} onChange={(e) => set({ alt: e.target.value }, `al-${b.id}`)} className={field} />
          </Field>
          {b.alt && (
            <Field name="Button goes to">
              <LinkInput value={b.link ?? "#"} onChange={(v) => set({ link: v }, `l-${b.id}`)} def={def} readOnly={readOnly} />
            </Field>
          )}
        </>
      );
      break;
    case "footer":
      body = (
        <>
          <Field name="Small print">
            <textarea value={b.text ?? ""} disabled={readOnly} onChange={(e) => set({ text: e.target.value }, `t-${b.id}`)} className={`${ta} min-h-16`} />
          </Field>
          <div className={label}>Links</div>
          <Items<{ label: string; link: string }>
            items={b.nav ?? []}
            readOnly={readOnly}
            max={8}
            onChange={(nav) => set({ nav }, `n-${b.id}`)}
            make={() => ({ label: "Link", link: "#" })}
            title={(n) => n.label}
            render={(n, s) => (
              <>
                <Field name="Words">
                  <input value={n.label} disabled={readOnly} onChange={(e) => s({ label: e.target.value })} className={field} />
                </Field>
                <Field name="Goes to">
                  <LinkInput value={n.link} onChange={(v) => s({ link: v })} def={def} readOnly={readOnly} />
                </Field>
              </>
            )}
          />
        </>
      );
      break;
    case "spacer":
      body = (
        <Field name={`Height: ${b.height ?? 40}px`}>
          <input type="range" min={8} max={240} step={4} value={b.height ?? 40} disabled={readOnly} onChange={(e) => set({ height: Number(e.target.value) }, `h-${b.id}`)} />
        </Field>
      );
      break;
    case "code":
      body = (
        <>
          <Field name="HTML" hint="For things like a booking widget or a map. It runs in a sealed box, so it can't affect the rest of the page or your account.">
            <textarea value={b.html ?? ""} disabled={readOnly} onChange={(e) => set({ html: e.target.value }, `c-${b.id}`)} spellCheck={false} className={`${ta} min-h-40 font-mono text-[12px]`} />
          </Field>
          <Field name={`Height: ${b.height ?? 200}px`}>
            <input type="range" min={40} max={1200} step={10} value={b.height ?? 200} disabled={readOnly} onChange={(e) => set({ height: Number(e.target.value) }, `h-${b.id}`)} />
          </Field>
        </>
      );
      break;
    case "divider":
      body = <p className="text-[12.5px] text-muted">A thin line. Nothing to set.</p>;
      break;
  }

  return (
    <>
      <Group title={blockInfo(b.kind).label}>{body}</Group>
      <Group title="Show on">
        <Seg ariaLabel="Show on" value={b.hideOn ?? "both"} onChange={(v) => set({ hideOn: v === "both" ? undefined : (v as "mobile" | "desktop") })} options={[{ v: "both", label: "Everywhere" }, { v: "desktop", label: "Phones only" }, { v: "mobile", label: "Desktop only" }]} />
      </Group>
      {!readOnly && <Actions id={b.id} props={props} />}
    </>
  );
}

function Actions({ id, props }: { id: string; props: InspectorProps }) {
  return (
    <div className="flex gap-2 px-4 py-4">
      <button type="button" onClick={() => props.onDuplicate(id)} className="btn-ghost inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-[12.5px] font-semibold">
        <Icon name="copy" size={13} /> Duplicate
      </button>
      <button type="button" onClick={() => props.onDelete(id)} className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-[12.5px] font-semibold text-bad hover:bg-bad-bg">
        <Icon name="trash" size={13} /> Delete
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- section settings
function Swatches({ value, onChange, accent, readOnly }: { value: string; onChange: (v: string) => void; accent: string; readOnly: boolean }) {
  const custom = /^#[0-9a-f]{6}$/i.test(value) && !BACKGROUNDS.some((b) => b.key === value);
  return (
    <div className="flex flex-wrap gap-1.5">
      {BACKGROUNDS.map((b) => (
        <button
          key={b.key}
          type="button"
          disabled={readOnly}
          title={b.label}
          aria-label={b.label}
          onClick={() => onChange(b.key)}
          className={`h-8 w-8 rounded-lg ring-1 ring-line ${value === b.key ? "outline-2 outline-offset-2 outline-brand" : ""}`}
          style={{ background: b.key === "accent" ? accent : b.key, outlineStyle: value === b.key ? "solid" : undefined }}
        />
      ))}
      <label title="Pick any colour" className={`relative h-8 w-8 cursor-pointer overflow-hidden rounded-lg ring-1 ring-line ${custom ? "outline-2 outline-offset-2 outline-brand" : ""}`} style={{ background: custom ? value : "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)", outlineStyle: custom ? "solid" : undefined }}>
        <input type="color" value={custom ? value : "#ffffff"} disabled={readOnly} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Custom colour" />
      </label>
    </div>
  );
}

function SectionSettings({ s, props }: { s: Section; props: InspectorProps }) {
  const { readOnly, def } = props;
  const set = (patch: Partial<Section>, key?: string) => props.onSection(s.id, patch, key);
  const st = (patch: Partial<SectionStyle>, key?: string) => props.onSection(s.id, { style: { ...s.style, ...patch } }, key);
  return (
    <>
      <Group title="Section">
        <Field name="Name" hint="Only you see this.">
          <input value={s.name} disabled={readOnly} onChange={(e) => set({ name: e.target.value.slice(0, 60) }, `sn-${s.id}`)} className={field} />
        </Field>
        <Field name="Link name" hint="Lets buttons and the menu scroll here, like #pricing.">
          <input
            value={s.anchor}
            disabled={readOnly}
            placeholder="e.g. pricing"
            onChange={(e) => {
              const v = slugify(e.target.value);
              if (v && def.sections.some((x) => x.id !== s.id && x.anchor === v)) return notify("Another section already uses that link name.", "bad");
              set({ anchor: v }, `sa-${s.id}`);
            }}
            className={field}
          />
        </Field>
      </Group>
      <Group title="Background">
        <Swatches value={s.style.background} onChange={(v) => st({ background: v })} accent={def.theme.accent} readOnly={readOnly} />
        <Field name="Background picture (optional)">
          <ImageInput value={s.style.image} onChange={(v) => st({ image: v })} readOnly={readOnly} />
        </Field>
        {s.style.image && (
          <Field name={`Darken the picture: ${s.style.overlay}%`} hint="Keeps text readable on busy photos.">
            <input type="range" min={0} max={80} step={5} value={s.style.overlay} disabled={readOnly} onChange={(e) => st({ overlay: Number(e.target.value) }, `so-${s.id}`)} />
          </Field>
        )}
        <Field name="Text colour">
          <Seg ariaLabel="Text colour" value={s.style.text} onChange={(v) => st({ text: v })} options={[{ v: "auto", label: "Automatic" }, { v: "dark", label: "Dark" }, { v: "light", label: "Light" }]} />
        </Field>
      </Group>
      <Group title="Layout">
        <Field name="Space above and below">
          <Seg ariaLabel="Spacing" value={s.style.padding} onChange={(v) => st({ padding: v })} options={[{ v: "none", label: "0" }, { v: "s", label: "S" }, { v: "m", label: "M" }, { v: "l", label: "L" }, { v: "xl", label: "XL" }]} />
        </Field>
        <Field name="Width">
          <Seg ariaLabel="Width" value={s.style.width} onChange={(v) => st({ width: v })} options={[{ v: "narrow", label: "Narrow" }, { v: "boxed", label: "Normal" }, { v: "wide", label: "Wide" }, { v: "full", label: "Full" }]} />
        </Field>
        <Field name="Text align">
          <Seg ariaLabel="Text align" value={s.style.align} onChange={(v) => st({ align: v === "center" ? "center" : "left" })} options={ALIGN.slice(0, 2)} />
        </Field>
        <Field name="Show on">
          <Seg ariaLabel="Show on" value={s.style.hideOn ?? "both"} onChange={(v) => st({ hideOn: v === "both" ? undefined : (v as "mobile" | "desktop") })} options={[{ v: "both", label: "Everywhere" }, { v: "desktop", label: "Phones only" }, { v: "mobile", label: "Desktop only" }]} />
        </Field>
      </Group>
      {!readOnly && <Actions id={s.id} props={props} />}
    </>
  );
}

function RowSettings({ r, props }: { r: Row; props: InspectorProps }) {
  return (
    <>
      <Group title="Columns" hint="On phones, columns stack one under another.">
        <Field name="How many">
          <Cols value={r.columns.length} onChange={(n) => props.onCols(r.id, n)} />
        </Field>
        <Field name="Line up">
          <Seg ariaLabel="Line up" value={r.valign ?? "top"} onChange={(v) => props.onRow(r.id, { valign: v === "center" ? "center" : undefined })} options={[{ v: "top", label: "Top" }, { v: "center", label: "Middle" }]} />
        </Field>
      </Group>
      {!props.readOnly && <Actions id={r.id} props={props} />}
    </>
  );
}

// ---------------------------------------------------------------- page settings
const FONTS_LIST: { v: PageTheme["font"]; label: string; css: string }[] = [
  { v: "modern", label: "Modern", css: "Inter, system-ui, sans-serif" },
  { v: "classic", label: "Classic", css: "Georgia, serif" },
  { v: "friendly", label: "Friendly", css: "'Trebuchet MS', sans-serif" },
  { v: "mono", label: "Mono", css: "Menlo, monospace" },
];

function PageSettings({ props }: { props: InspectorProps }) {
  const { def, readOnly } = props;
  const [tab, setTab] = useState<"style" | "seo" | "tracking" | "link">("style");
  const t = def.theme;
  const theme = (patch: Partial<PageTheme>, key?: string) => props.onPage({ theme: { ...t, ...patch } }, key);
  const seo = (patch: Partial<PageDefinition["seo"]>, key?: string) => props.onPage({ seo: { ...def.seo, ...patch } }, key);
  const tr = (patch: Partial<PageDefinition["tracking"]>, key?: string) => props.onPage({ tracking: { ...def.tracking, ...patch } }, key);
  const [slug, setSlug] = useState(props.slug);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <div className="flex flex-none gap-0.5 border-b border-line px-3 pt-2">
        {(
          [
            ["style", "Style"],
            ["seo", "Search"],
            ["tracking", "Tracking"],
            ["link", "Link"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`relative flex-1 pb-2 pt-1 text-[12.5px] font-semibold ${tab === k ? "text-navy" : "text-muted hover:text-navy"}`}>
            {l}
            {tab === k && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
          </button>
        ))}
      </div>
      {tab === "style" && (
        <>
          <Group title="Colours">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["accent", "Brand"],
                  ["text", "Text"],
                  ["background", "Page"],
                ] as const
              ).map(([k, l]) => (
                <label key={k} className="flex flex-col items-center gap-1 text-[11.5px] font-semibold text-muted">
                  <span className="relative h-10 w-full overflow-hidden rounded-xl ring-1 ring-line" style={{ background: t[k] }}>
                    <input type="color" value={t[k]} disabled={readOnly} onChange={(e) => theme({ [k]: e.target.value } as Partial<PageTheme>, `c-${k}`)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={`${l} colour`} />
                  </span>
                  {l}
                </label>
              ))}
            </div>
          </Group>
          <Group title="Fonts">
            <Field name="Text">
              <div className="grid grid-cols-2 gap-1.5">
                {FONTS_LIST.map((f) => (
                  <button key={f.v} type="button" disabled={readOnly} onClick={() => theme({ font: f.v })} className={`rounded-xl px-2 py-2 text-[13px] ring-1 ${t.font === f.v ? "bg-chip text-brand ring-brand/40" : "ring-line hover:ring-line-strong"}`} style={{ fontFamily: f.css }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field name="Headings">
              <select value={t.headingFont} disabled={readOnly} onChange={(e) => theme({ headingFont: e.target.value as PageTheme["headingFont"] })} className={field}>
                <option value="same">Same as the text</option>
                <option value="modern">Modern</option>
                <option value="classic">Classic (serif)</option>
                <option value="friendly">Friendly</option>
                <option value="bold">Bold</option>
              </select>
            </Field>
          </Group>
          <Group title="Shapes">
            <Field name={`Rounded corners: ${t.radius}px`}>
              <input type="range" min={0} max={32} value={t.radius} disabled={readOnly} onChange={(e) => theme({ radius: Number(e.target.value) }, "radius")} />
            </Field>
            <Field name="Buttons">
              <Seg ariaLabel="Buttons" value={t.buttonStyle} onChange={(v) => theme({ buttonStyle: v })} options={[{ v: "solid", label: "Solid" }, { v: "pill", label: "Pill" }, { v: "outline", label: "Outline" }]} />
            </Field>
            <Field name={`Content width: ${t.width}px`}>
              <input type="range" min={880} max={1360} step={40} value={t.width} disabled={readOnly} onChange={(e) => theme({ width: Number(e.target.value) }, "width")} />
            </Field>
          </Group>
        </>
      )}
      {tab === "seo" && (
        <Group title="Google and social sharing" hint="How the page shows in Google, on Facebook, WhatsApp and LinkedIn, and in the browser tab.">
          <Field name="Title" hint={`${def.seo.title.length}/60`}>
            <input value={def.seo.title} disabled={readOnly} maxLength={120} onChange={(e) => seo({ title: e.target.value }, "seo-t")} placeholder="Uses the page name if blank" className={field} />
          </Field>
          <Field name="Description" hint={`${def.seo.description.length}/155`}>
            <textarea value={def.seo.description} disabled={readOnly} maxLength={300} onChange={(e) => seo({ description: e.target.value }, "seo-d")} className="field min-h-20 w-full resize-y py-2 text-[13px]" />
          </Field>
          <Field name="Sharing picture" hint="1200 by 630 pixels works best.">
            <ImageInput value={def.seo.image} onChange={(v) => seo({ image: v })} readOnly={readOnly} />
          </Field>
          <Field name="Tab icon (favicon)" hint="A small square picture. Leave blank for none, never Scalency's.">
            <ImageInput value={def.seo.icon} onChange={(v) => seo({ icon: v })} readOnly={readOnly} />
          </Field>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={def.seo.noindex} disabled={readOnly} onChange={(e) => seo({ noindex: e.target.checked })} className="h-4 w-4 accent-[var(--color-brand)]" /> Hide from Google
          </label>
          <div className="rounded-xl bg-surface p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">Google preview</div>
            <div className="mt-1 truncate text-[15px] text-[#1a0dab]">{def.seo.title || "Your page title"}</div>
            <div className="truncate text-[12px] text-[#006621]">{props.link}</div>
            <div className="line-clamp-2 text-[12.5px] text-[#545454]">{def.seo.description || "Add a description so people know what the page is about."}</div>
          </div>
        </Group>
      )}
      {tab === "tracking" && (
        <Group title="Ad and analytics tags" hint="Page views are tracked on every visit, and leads from forms on this page as conversions.">
          <Field name="Facebook (Meta) Pixel ID" hint="Numbers only, from Events Manager.">
            <input value={def.tracking.fbPixel} disabled={readOnly} onChange={(e) => tr({ fbPixel: e.target.value.replace(/\D/g, "").slice(0, 20) }, "fb")} placeholder="e.g. 123456789012345" className={field} />
          </Field>
          <Field name="Google tag ID" hint="Starts with G- (Analytics) or AW- (Ads).">
            <input value={def.tracking.googleTag} disabled={readOnly} onChange={(e) => tr({ googleTag: e.target.value.trim().toUpperCase().slice(0, 24) }, "gt")} placeholder="e.g. G-ABC123XYZ" className={field} />
          </Field>
        </Group>
      )}
      {tab === "link" && (
        <Group title="Page link">
          <div className="break-all rounded-xl bg-surface px-3 py-2 font-mono text-[12px]">{props.link}</div>
          <Field name="Link name" hint="Small letters, numbers and dashes.">
            <input value={slug} disabled={readOnly} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 70))} className={field} />
          </Field>
          <button
            type="button"
            disabled={readOnly || busy || slug === props.slug || !slug}
            onClick={async () => {
              setBusy(true);
              const r = await props.onSlug(slug);
              setBusy(false);
              if (r.error) setSlug(props.slug);
            }}
            className="btn-primary min-h-9 rounded-xl text-[13px] font-semibold disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save link"}
          </button>
          <p className="text-[11.5px] text-muted">Changing it breaks the old link anywhere you&apos;ve already shared it.</p>
        </Group>
      )}
    </>
  );
}

// ---------------------------------------------------------------- the panel
export function PageInspector(props: InspectorProps) {
  const { def, selected } = props;
  const b = selected ? findBlock(def, selected) : null;
  const r = !b && selected ? findRow(def, selected) : null;
  const c = !b && !r && selected ? findColumn(def, selected) : null;
  const s = !b && !r && !c && selected ? findSection(def, selected) : null;
  const where = b?.section ?? r?.section ?? c?.section ?? s?.section;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {selected && (b || r || c || s) ? (
        <div className="flex flex-none flex-wrap items-center gap-1 border-b border-line px-3 py-2 text-[12px] font-semibold text-muted">
          <button type="button" onClick={() => props.onSelect(null)} className="rounded-md px-1.5 py-0.5 hover:bg-surface hover:text-navy">
            Page
          </button>
          {where && (
            <>
              <Icon name="chevronRight" size={11} />
              <button type="button" onClick={() => props.onSelect(where.id)} className={`rounded-md px-1.5 py-0.5 hover:bg-surface hover:text-navy ${s ? "text-navy" : ""}`}>
                {where.name || "Section"}
              </button>
            </>
          )}
          {(b || c) && (
            <>
              <Icon name="chevronRight" size={11} />
              <button type="button" onClick={() => props.onSelect((b?.row ?? c?.row)!.id)} className="rounded-md px-1.5 py-0.5 hover:bg-surface hover:text-navy">
                Columns
              </button>
            </>
          )}
          {r && (
            <>
              <Icon name="chevronRight" size={11} />
              <span className="px-1.5 text-navy">Columns</span>
            </>
          )}
          {b && (
            <>
              <Icon name="chevronRight" size={11} />
              <span className="px-1.5 text-navy">{blockInfo(b.block.kind).label}</span>
            </>
          )}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {b ? (
          <BlockSettings key={b.block.id} b={b.block} props={props} />
        ) : r ? (
          <RowSettings r={r.row} props={props} />
        ) : c ? (
          <RowSettings r={c.row} props={props} />
        ) : s ? (
          <SectionSettings key={s.section.id} s={s.section} props={props} />
        ) : (
          <PageSettings props={props} />
        )}
      </div>
    </div>
  );
}
