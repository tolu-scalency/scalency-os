"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Icon } from "@/components/icon";
import { notify } from "@/components/toast";

export type QrTarget = { group: string; label: string; url: string };

const COLOURS = [
  ["#0b1b3a", "Navy"],
  ["#000000", "Black"],
  ["#0a5fe3", "Blue"],
  ["#14532d", "Green"],
] as const;

/** Adds the "came from a QR code" tags, so scans show up as their own source. */
function withTags(url: string, tag: boolean, campaign: string) {
  if (!tag) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", "qr");
    u.searchParams.set("utm_medium", "print");
    if (campaign.trim()) u.searchParams.set("utm_campaign", campaign.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60));
    return u.toString();
  } catch {
    return url;
  }
}

export function QrMaker({ targets }: { targets: QrTarget[] }) {
  const [pick, setPick] = useState(targets[0]?.url ?? "custom");
  const [custom, setCustom] = useState("");
  const [tag, setTag] = useState(true);
  const [campaign, setCampaign] = useState("");
  const [colour, setColour] = useState<string>(COLOURS[0][0]);
  const [png, setPng] = useState("");
  const [svg, setSvg] = useState("");

  const raw = pick === "custom" ? custom.trim() : pick;
  const valid = /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(raw);
  const url = useMemo(() => (valid ? withTags(raw, tag, campaign) : ""), [raw, valid, tag, campaign]);
  const name = (pick === "custom" ? "qr-code" : (targets.find((t) => t.url === pick)?.label ?? "qr-code")).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "qr-code";

  useEffect(() => {
    let live = true;
    if (!url) return;
    const opts = { errorCorrectionLevel: "M" as const, margin: 2, color: { dark: colour, light: "#ffffff" } };
    Promise.all([QRCode.toDataURL(url, { ...opts, width: 1024 }), QRCode.toString(url, { ...opts, type: "svg" })])
      .then(([p, s]) => {
        if (!live) return;
        setPng(p);
        setSvg(s);
      })
      .catch(() => live && notify("That address is too long for a QR code.", "bad"));
    return () => {
      live = false;
    };
  }, [url, colour]);

  // Only show a code for the address that's chosen now.
  const ready = Boolean(url && png);
  const download = (href: string, ext: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = `${name}.${ext}`;
    a.click();
  };
  const groups = [...new Set(targets.map((t) => t.group))];
  const field = "field h-10 w-full text-[13.5px]";
  const label = "flex flex-col gap-1.5 text-[12.5px] font-semibold text-navy";

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <section className="card flex flex-col gap-4 p-5">
        <label className={label}>
          Where the code goes
          <select value={pick} onChange={(e) => setPick(e.target.value)} className={field}>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {targets
                  .filter((t) => t.group === g)
                  .map((t) => (
                    <option key={t.url} value={t.url}>
                      {t.label}
                    </option>
                  ))}
              </optgroup>
            ))}
            <option value="custom">Another web address…</option>
          </select>
          {!targets.length && <span className="text-[11.5px] font-normal text-muted">Publish a page or form to pick it here, or use another web address.</span>}
        </label>
        {pick === "custom" && (
          <label className={label}>
            Web address
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="https://www.yourbusiness.co.uk/offer" className={field} maxLength={1000} />
            {custom && !valid && <span className="text-[11.5px] font-normal text-bad">Start with https:// and include the full address.</span>}
          </label>
        )}
        <label className="flex items-start gap-2 text-[13.5px]">
          <input type="checkbox" checked={tag} onChange={(e) => setTag(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]" />
          <span>
            Tag scans as coming from a QR code
            <span className="block text-[12px] text-muted">Leads who scan it show source &quot;qr&quot; on their contact, and page visits count it separately.</span>
          </span>
        </label>
        {tag && (
          <label className={label}>
            Where it&apos;s printed (optional)
            <input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Spring flyer" className={field} maxLength={60} />
            <span className="text-[11.5px] font-normal text-muted">Different names for different flyers let you see which one works.</span>
          </label>
        )}
        <div className={label}>
          Colour
          <div className="flex flex-wrap gap-2">
            {COLOURS.map(([c, n]) => (
              <button key={c} type="button" onClick={() => setColour(c)} aria-pressed={colour === c} className={`inline-flex min-h-9 items-center gap-2 rounded-xl px-3 text-[13px] font-medium ring-1 ${colour === c ? "bg-chip ring-brand" : "bg-white ring-line"}`}>
                <span className="h-4 w-4 rounded" style={{ background: c }} /> {n}
              </button>
            ))}
          </div>
        </div>
        {url && (
          <div className="rounded-xl bg-surface px-3 py-2 text-[12px] text-muted">
            <span className="font-semibold text-navy">Scans open: </span>
            <span className="break-all">{url}</span>
          </div>
        )}
      </section>
      <aside className="card flex flex-col items-center gap-4 p-5">
        {ready ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={png} alt="QR code preview" className="h-64 w-64 rounded-xl ring-1 ring-line" />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center rounded-xl border border-dashed border-line-strong p-6 text-center text-[13px] text-muted">Pick where it goes to see the code.</div>
        )}
        <div className="flex w-full flex-col gap-2">
          <button type="button" disabled={!ready} onClick={() => download(png, "png")} className="btn-primary inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-50">
            <Icon name="download" size={14} /> Download PNG (for screens and print)
          </button>
          <button
            type="button"
            disabled={!ready || !svg}
            onClick={() => download(URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })), "svg")}
            className="btn-ghost inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-50"
          >
            <Icon name="download" size={14} /> Download SVG (for designers, any size)
          </button>
          <button
            type="button"
            disabled={!url}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                notify("Link copied", "ok");
              } catch {
                window.prompt("Copy the link:", url);
              }
            }}
            className="btn-ghost inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-50"
          >
            <Icon name="copy" size={14} /> Copy the link
          </button>
        </div>
        <p className="text-center text-[11.5px] text-muted">Test it with your phone camera before printing. Print it at least 2 cm wide.</p>
      </aside>
    </div>
  );
}
