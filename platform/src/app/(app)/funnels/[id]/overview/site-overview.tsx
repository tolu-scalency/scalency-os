"use client";

// The overview of a funnel or website: its steps or pages with views and sign-ups,
// reorder, add, copy and delete them, the shared header and footer, the link, and
// the site's own domains with the DNS records to add.

import { shortId } from "@/lib/short-id-shared";
import { ask } from "@/components/confirm";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
import { notify } from "@/components/toast";
import { Pill } from "@/components/ui";
import type { DnsRow } from "@/lib/domains";
import { KIND_LABEL, STEP_STARTERS, type SiteKind, type SitePageInfo } from "@/lib/site-builder";
import { addStep, deleteStep, duplicateStep, moveStep, renameSite, setSiteSlug, setSiteStatus, updateStep } from "../../actions";
import { addDomain, checkDomain, removeDomain } from "../../domain-actions";

export type StepStats = { views: number; submissions: number };
export type DomainView = {
  id: string;
  domain: string;
  status: "pending" | "verified" | "failed";
  hosting: "pending" | "added" | "manual" | "failed";
  lastError: string | null;
  checkedAt: string | null;
  records: DnsRow[];
  apex: string;
};
type Site = { id: string; name: string; slug: string; status: "draft" | "live" | "archived"; kind: SiteKind };

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          window.prompt(`Copy the ${label}:`, text);
        }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
      aria-label={`Copy the ${label}`}
      title={`Copy the ${label}`}
      className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-lg text-muted hover:bg-white hover:text-brand"
    >
      <Icon name={done ? "check" : "copy"} size={13} />
    </button>
  );
}

export function SiteOverview({
  site,
  pages,
  stats,
  domains,
  base,
  workspaceSlug,
  canEdit,
  netlify,
}: {
  site: Site;
  pages: SitePageInfo[];
  stats: Record<string, StepStats>;
  domains: DomainView[];
  base: string;
  workspaceSlug: string;
  canEdit: boolean;
  netlify: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(site.name);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", slug: "" });
  const [adding, setAdding] = useState(false);
  const [starter, setStarter] = useState("blank");
  const [newName, setNewName] = useState("");
  const [slug, setSlug] = useState(site.slug);
  const [domain, setDomain] = useState("");
  const funnel = site.kind === "funnel";
  const website = site.kind === "website";
  const word = funnel ? "step" : "page";
  const siteBase = `/p/${workspaceSlug}/${site.slug}`;
  const live = site.status === "live";
  const verified = domains.find((d) => d.status === "verified");
  const publicUrl = (s: string) => (verified ? `https://${verified.domain}${s ? `/${s}` : ""}` : `${base}${siteBase}${s ? `/${s}` : ""}`);

  const run = (fn: () => Promise<{ error?: string; ok?: string }>, after?: () => void) =>
    start(async () => {
      const r: { error?: string; ok?: string } = await fn().catch(() => ({ error: "We couldn't reach the server. Try again." }));
      notify(r.error ?? r.ok ?? "Done", r.error ? "bad" : "ok");
      if (!r.error) after?.();
    });

  const first = stats[pages[0]?.id]?.views ?? 0;
  const lastStep = pages[pages.length - 1];
  const totalSignups = pages.reduce((n, p) => n + (stats[p.id]?.submissions ?? 0), 0);

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5 px-4 py-5 sm:px-8 sm:py-7">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/funnels" className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-white" aria-label="Back to funnels and pages">
          <Icon name="arrowLeft" size={17} />
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,#0a3fa6,#0a5fe3_60%,#29b0f8)] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white">
          <Icon name={funnel ? "zap" : website ? "layout" : "globe"} size={12} /> {KIND_LABEL[site.kind]}
        </span>
        <input
          value={name}
          disabled={!canEdit}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== site.name && run(() => renameSite(site.id, name))}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          maxLength={120}
          aria-label="Name"
          className="min-w-0 flex-[1_1_200px] rounded-lg bg-transparent px-2 py-1 text-[22px] font-semibold tracking-[-0.02em] outline-none hover:bg-white focus:bg-white focus:ring-2 focus:ring-sky/40"
        />
        <Pill tone={live ? "green" : "neutral"}>{live ? "Live" : site.status === "archived" ? "Archived" : "Draft"}</Pill>
        {live && (
          <a href={publicUrl("")} target="_blank" rel="noopener noreferrer" className="btn-ghost inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold">
            <Icon name="globe" size={15} /> Open
          </a>
        )}
        {canEdit &&
          (live ? (
            <button type="button" disabled={pending} onClick={() => run(() => setSiteStatus(site.id, "draft"), () => router.refresh())} className="btn-ghost inline-flex min-h-10 items-center rounded-xl px-3 text-[13px] font-semibold">
              Unpublish
            </button>
          ) : (
            <button type="button" disabled={pending} onClick={() => run(() => setSiteStatus(site.id, "live"), () => router.refresh())} className="btn-primary inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-semibold">
              <Icon name="globe" size={15} /> Publish
            </button>
          ))}
      </div>

      {/* Totals */}
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["eye", "Visitors", String(first), `to the first ${word}, last 30 days`],
            ["users", "Sign-ups", String(totalSignups), "forms sent from these pages"],
            funnel
              ? ["chart", "Reached the end", pct(stats[lastStep?.id]?.views ?? 0, first), `of visitors saw "${lastStep?.name ?? ""}"`]
              : ["file", "Pages", String(pages.length), `${pages.filter((p) => p.in_menu).length} in the menu`],
          ] as [IconName, string, string, string][]
        ).map(([icon, label, value, hint]) => (
          <div key={label} className="card flex items-center gap-3.5 p-4">
            <span className="tile" style={{ width: 40, height: 40, borderRadius: 12 }}>
              <Icon name={icon} size={18} />
            </span>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-muted">{label}</div>
              <div className="text-[22px] font-semibold leading-tight text-navy">{value}</div>
              <div className="truncate text-[11.5px] text-faint">{hint}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Steps or pages */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3.5">
          <div>
            <h2 className="text-[15px] font-semibold">{funnel ? "Steps" : "Pages"}</h2>
            <p className="text-[12.5px] text-muted">
              {funnel ? "People go through these in order. Views and sign-ups are for the last 30 days." : website ? "The first page is the home page. Tick which pages show in the menu." : "Views and sign-ups are for the last 30 days."}
            </p>
          </div>
          {canEdit && (
            <button type="button" onClick={() => setAdding((v) => !v)} className="btn-primary ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold">
              <Icon name="plus" size={14} /> Add a {word}
            </button>
          )}
        </div>

        {adding && (
          <div className="flex flex-col gap-3 border-b border-line bg-surface/60 px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {STEP_STARTERS.map((s) => (
                <button key={s.key} type="button" onClick={() => setStarter(s.key)} className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold ring-1 ${starter === s.key ? "bg-white text-brand ring-brand" : "bg-white text-muted ring-line hover:text-navy"}`}>
                  <Icon name={s.icon as IconName} size={14} /> {s.name}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={100} placeholder={`${funnel ? "Step" : "Page"} name, like ${funnel ? "Thank you" : "About us"}`} className="field h-10 min-w-0 flex-[1_1_240px] text-[13.5px]" />
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await addStep(site.id, starter, newName).catch(() => ({ error: "We couldn't reach the server." }) as { error?: string; id?: string });
                    if (r.error || !r.id) return void notify(r.error ?? "We couldn't add it.", "bad");
                    notify(`${funnel ? "Step" : "Page"} added`, "ok");
                    router.push(`/funnels/${shortId(site.id)}?page=${r.id}`);
                  })
                }
                className="btn-primary inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold"
              >
                {pending ? "Adding…" : `Add and open`}
              </button>
              <button type="button" onClick={() => setAdding(false)} className="btn-ghost inline-flex min-h-10 items-center rounded-xl px-3 text-[13px] font-semibold">
                Cancel
              </button>
            </div>
          </div>
        )}

        <ol className="divide-y divide-line">
          {pages.map((p, i) => {
            const st = stats[p.id] ?? { views: 0, submissions: 0 };
            const next = pages[i + 1];
            const on = next ? (stats[next.id]?.views ?? 0) : 0;
            const isEditing = editing === p.id;
            return (
              <li key={p.id} className="flex flex-col">
                <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface text-[12.5px] font-bold text-muted">{i + 1}</span>
                  <Link href={`/funnels/${shortId(site.id)}?page=${p.id}`} className="min-w-0 flex-[1_1_220px]">
                    <div className="truncate text-[14.5px] font-semibold hover:text-brand">
                      {p.name}
                      {i === 0 && website && <span className="ml-2 text-[11.5px] font-medium text-muted">Home</span>}
                    </div>
                    <div className="truncate font-mono text-[12px] text-muted">/{p.slug}</div>
                  </Link>
                  <div className="flex items-center gap-5 text-[12px] text-muted">
                    <div title="Views, last 30 days">
                      <div className="text-[15px] font-semibold text-navy">{st.views}</div>views
                    </div>
                    <div title="Forms sent from this page, last 30 days">
                      <div className="text-[15px] font-semibold text-navy">{st.submissions}</div>sign-ups
                    </div>
                    <div title="Sign-ups divided by views">
                      <div className="text-[15px] font-semibold text-navy">{pct(st.submissions, st.views)}</div>convert
                    </div>
                  </div>
                  {website && (
                    <label className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted" title="Show this page in the website's menu">
                      <input
                        type="checkbox"
                        checked={p.in_menu}
                        disabled={!canEdit || pending}
                        onChange={(e) => run(() => updateStep(site.id, p.id, { in_menu: e.target.checked }), () => router.refresh())}
                        className="h-4 w-4 accent-[var(--color-brand)]"
                      />
                      Menu
                    </label>
                  )}
                  <div className="ml-auto flex items-center gap-0.5">
                    <Link href={`/funnels/${shortId(site.id)}?page=${p.id}`} className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold">
                      <Icon name="edit" size={14} /> Edit
                    </Link>
                    {canEdit && (
                      <>
                        <IconBtn icon="up" label="Move up" disabled={pending || i === 0} onClick={() => run(() => moveStep(site.id, p.id, -1), () => router.refresh())} />
                        <IconBtn icon="down" label="Move down" disabled={pending || i === pages.length - 1} onClick={() => run(() => moveStep(site.id, p.id, 1), () => router.refresh())} />
                        <IconBtn
                          icon="settings"
                          label="Rename"
                          onClick={() => {
                            setEditing(isEditing ? null : p.id);
                            setDraft({ name: p.name, slug: p.slug });
                          }}
                        />
                        <IconBtn icon="copy" label="Duplicate" disabled={pending} onClick={() => run(async () => ({ ...(await duplicateStep(site.id, p.id)), ok: "Copied" }), () => router.refresh())} />
                        <IconBtn
                          icon="trash"
                          label="Delete"
                          disabled={pending || pages.length < 2}
                          onClick={async () => (await ask({ title: `Delete "${p.name}"?`, text: "This can't be undone." })) && run(() => deleteStep(site.id, p.id), () => router.refresh())}
                        />
                      </>
                    )}
                  </div>
                </div>
                {isEditing && (
                  <div className="flex flex-wrap items-end gap-2 border-t border-line bg-surface/60 px-5 py-3">
                    <label className="flex min-w-0 flex-[1_1_200px] flex-col gap-1 text-[12px] font-semibold">
                      Name
                      <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={120} className="field h-10 text-[13.5px]" />
                    </label>
                    {i > 0 && (
                      <label className="flex min-w-0 flex-[1_1_200px] flex-col gap-1 text-[12px] font-semibold">
                        Link name
                        <input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 70) })} className="field h-10 font-mono text-[13px]" />
                      </label>
                    )}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => updateStep(site.id, p.id, { name: draft.name, ...(i > 0 ? { slug: draft.slug } : {}) }), () => (setEditing(null), router.refresh()))}
                      className="btn-primary inline-flex min-h-10 items-center rounded-xl px-4 text-[13px] font-semibold"
                    >
                      Save
                    </button>
                    {i === 0 && <span className="pb-2.5 text-[12px] text-muted">The first {word} uses the main link, so it has no link name.</span>}
                  </div>
                )}
                {funnel && next && (
                  <div className="flex items-center gap-2 px-5 pb-2 pl-[60px] text-[11.5px] text-faint">
                    <Icon name="down" size={12} /> {pct(on, st.views)} went on to &quot;{next.name}&quot;
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {website && (
        <section className="card flex flex-wrap items-center gap-3 p-5">
          <div className="min-w-0 flex-[1_1_260px]">
            <h2 className="text-[15px] font-semibold">Shared header and footer</h2>
            <p className="text-[12.5px] text-muted">Shown on every page: your logo, menu, button and footer. Change them once and every page updates.</p>
          </div>
          <Link href={`/funnels/${shortId(site.id)}?part=header`} className="btn-ghost inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold">
            <Icon name="edit" size={14} /> Edit header
          </Link>
          <Link href={`/funnels/${shortId(site.id)}?part=footer`} className="btn-ghost inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold">
            <Icon name="edit" size={14} /> Edit footer
          </Link>
        </section>
      )}

      {/* Link */}
      <section className="card flex flex-col gap-3 p-5">
        <div>
          <h2 className="text-[15px] font-semibold">Link</h2>
          <p className="text-[12.5px] text-muted">{live ? "Share this link, or use your own domain below." : "Publish to switch the link on."}</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-surface py-1 pl-3 pr-1">
          <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-navy">{`${base}${siteBase}`}</code>
          <CopyButton text={`${base}${siteBase}`} label="link" />
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-0 flex-[1_1_220px] flex-col gap-1 text-[12px] font-semibold">
              Link name
              <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 70))} className="field h-10 font-mono text-[13px]" />
            </label>
            <button type="button" disabled={pending || !slug || slug === site.slug} onClick={() => run(() => setSiteSlug(site.id, slug), () => router.refresh())} className="btn-ghost inline-flex min-h-10 items-center rounded-xl px-4 text-[13px] font-semibold disabled:opacity-50">
              Save link
            </button>
          </div>
        )}
      </section>

      {/* Own domain */}
      <section className="card flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-[15px] font-semibold">Your own domain</h2>
          <p className="text-[12.5px] text-muted">
            Show this {KIND_LABEL[site.kind].toLowerCase()} at an address like www.yourbusiness.co.uk. We recommend a www. or other sub-address (like offer.yourbusiness.co.uk), which works with every domain provider.
          </p>
        </div>
        {canEdit && domains.length < 3 && (
          <div className="flex flex-wrap items-center gap-2">
            <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="www.yourbusiness.co.uk" className="field h-10 min-w-0 flex-[1_1_260px] text-[13.5px]" />
            <button type="button" disabled={pending || !domain.trim()} onClick={() => run(() => addDomain(site.id, domain), () => (setDomain(""), router.refresh()))} className="btn-primary inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-60">
              <Icon name="plus" size={14} /> Connect domain
            </button>
          </div>
        )}
        {domains.map((d) => (
          <div key={d.id} className="rounded-2xl border border-line p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[14px] font-semibold">{d.domain}</span>
              <Pill tone={d.status === "verified" ? "green" : "neutral"}>{d.status === "verified" ? "Connected" : "Waiting for DNS"}</Pill>
              {d.status === "verified" && (
                <a href={`https://${d.domain}`} target="_blank" rel="noopener noreferrer" className="text-[12.5px] font-semibold text-brand">
                  Open
                </a>
              )}
              {canEdit && (
                <div className="ml-auto flex items-center gap-1">
                  <button type="button" disabled={pending} onClick={() => run(() => checkDomain(d.id), () => router.refresh())} className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold">
                    <Icon name="refresh" size={14} /> Check now
                  </button>
                  <button type="button" disabled={pending} onClick={async () => (await ask({ title: `Remove ${d.domain}?`, text: "It stops showing this page straight away.", confirm: "Remove" })) && run(() => removeDomain(d.id), () => router.refresh())} className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-bad">
                    <Icon name="trash" size={14} /> Remove
                  </button>
                </div>
              )}
            </div>
            {d.status !== "verified" && (
              <>
                <p className="mt-3 text-[13px] text-navy">
                  At your domain provider (Namecheap, GoDaddy, 123 Reg and so on), open the DNS settings for <strong>{d.apex}</strong> and add these two records:
                </p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-[13px]">
                    <thead className="text-[11.5px] uppercase tracking-[0.08em] text-faint">
                      <tr>
                        <th className="py-2 pr-3 font-semibold">Type</th>
                        <th className="py-2 pr-3 font-semibold">Host</th>
                        <th className="py-2 pr-3 font-semibold">Value</th>
                        <th className="py-2 font-semibold" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {d.records.map((r) => (
                        <tr key={r.type}>
                          <td className="py-2 pr-3 font-semibold">{r.type}</td>
                          <td className="py-2 pr-3">
                            <span className="inline-flex items-center gap-1 rounded-lg bg-surface py-0.5 pl-2 font-mono text-[12.5px]">
                              {r.host}
                              <CopyButton text={r.host} label="host" />
                            </span>
                          </td>
                          <td className="py-2 pr-3">
                            <span className="inline-flex max-w-full items-center gap-1 rounded-lg bg-surface py-0.5 pl-2 font-mono text-[12.5px]">
                              <span className="truncate">{r.value}</span>
                              <CopyButton text={r.value} label="value" />
                            </span>
                          </td>
                          <td className="py-2 text-[12px] text-muted">{r.why}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[12px] text-muted">
                  Remove any other A or CNAME record with the same host first. New records can take from a few minutes to a few hours to show. We check every 10 minutes and switch the domain on by itself.
                  {d.lastError && d.checkedAt && <span className="mt-1 block text-warn">Last check: {d.lastError}</span>}
                </p>
              </>
            )}
            {d.status === "verified" && <p className="mt-2 text-[12.5px] text-muted">Working. HTTPS (the padlock) can take up to an hour to switch on after connecting.</p>}
            {(d.hosting === "manual" || d.hosting === "failed") && (
              <p className="mt-2 rounded-xl bg-warn-bg px-3 py-2 text-[12.5px] text-warn">
                {netlify ? "We couldn't add this domain to hosting automatically. " : "Hosting isn't connected yet. "}
                Your Scalency admin needs to add <strong>{d.domain}</strong> as a domain alias in Netlify (Domain management) so HTTPS works.
              </p>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

function IconBtn({ icon, label, onClick, disabled }: { icon: IconName; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-surface hover:text-navy disabled:opacity-30">
      <Icon name={icon} size={15} />
    </button>
  );
}
