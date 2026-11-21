"use client";

import { useState, useTransition } from "react";
import { ActionForm, SubmitButton, type ActionResult } from "@/components/action-form";
import { Icon } from "@/components/icon";
import { notify } from "@/components/toast";
import type { DnsRecord, Sender } from "@/lib/senders";
import { addDomain, addMailbox, checkDomain, removeSender, sendTestEmail, setDefaultSender, setReplyReading, updateSender } from "./actions";

// Kept here as well as in lib/senders (server only), so the browser bundle stays small.
const PRESETS = [
  { key: "google", label: "Google", host: "smtp.gmail.com", port: 465, security: "ssl", help: "Use an app password: Google Account, Security, 2-Step Verification, App passwords. Your normal password won't work." },
  { key: "outlook", label: "Microsoft 365", host: "smtp.office365.com", port: 587, security: "starttls", help: "Your Microsoft admin may need to turn on \"Authenticated SMTP\" for this mailbox first." },
  { key: "zoho", label: "Zoho", host: "smtp.zoho.eu", port: 465, security: "ssl", help: "Use smtp.zoho.com if your Zoho account is in the US. An app-specific password works best." },
  { key: "other", label: "Other", host: "", port: 587, security: "starttls", help: "Find the SMTP settings in your email host's help pages, often under \"email client setup\"." },
] as const;

function useRun() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      notify(r.error ?? r.ok ?? "Done", r.error ? "bad" : "ok");
    });
  return { pending, run };
}

function Pill({ tone, children }: { tone: "ok" | "warn" | "bad" | "info"; children: React.ReactNode }) {
  const cls = { ok: "bg-ok-bg text-ok", warn: "bg-[#FFF4E0] text-[#8A5300]", bad: "bg-bad-bg text-bad", info: "bg-chip text-brand" }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${cls}`}>{children}</span>;
}

export function ScalencyCard({ active, address, ready, workspace, manager }: { active: boolean; address: string; ready: boolean; workspace: string; manager: boolean }) {
  const { pending, run } = useRun();
  return (
    <div className={`rounded-2xl border p-4 ${active ? "border-brand/40 bg-chip/40" : "border-line"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-brand ring-1 ring-line">
          <Icon name="logoArrow" size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold">Scalency&apos;s address</div>
          <div className="truncate text-[12.5px] text-muted">
            {ready ? `“${workspace}” <${address}>` : "Not set up yet (RESEND_API_KEY and EMAIL_FROM in Netlify)"}
          </div>
        </div>
        {active ? <Pill tone="info">In use</Pill> : manager && (
          <button type="button" disabled={pending} onClick={() => run(() => setDefaultSender(null))} className="btn-ghost min-h-9 rounded-lg px-3 text-[13px] font-semibold">
            Use this instead
          </button>
        )}
      </div>
    </div>
  );
}

function Copy({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
      className="inline-flex h-7 flex-none items-center gap-1 rounded-md px-2 text-[11.5px] font-semibold text-brand hover:bg-chip"
      aria-label="Copy"
    >
      <Icon name={done ? "check" : "copy"} size={12} /> {done ? "Copied" : "Copy"}
    </button>
  );
}

function DnsTable({ records, domain }: { records: DnsRecord[]; domain: string }) {
  return (
    <div className="mt-3 rounded-xl border border-line">
      <div className="border-b border-line bg-surface px-3 py-2 text-[12.5px] text-muted">
        Add these at the company that manages the domain&apos;s DNS (for example Namecheap: Domain List, Manage, Advanced DNS). The <b>Host</b> is the part before {domain}.
      </div>
      <ul className="divide-y divide-line">
        {records.map((r, i) => (
          <li key={i} className="grid gap-1.5 px-3 py-2.5 text-[12.5px] sm:grid-cols-[70px_1fr_auto] sm:items-center">
            <span className="flex items-center gap-1.5">
              <b>{r.type}</b>
              {r.status === "verified" ? <Icon name="checkCircle" size={13} className="text-ok" /> : null}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1">
                <span className="text-faint">Host</span> <code className="truncate font-mono text-navy">{r.name}</code> <Copy value={r.name} />
              </span>
              <span className="flex items-center gap-1">
                <span className="text-faint">Value</span> <code className="truncate font-mono text-navy">{r.value}</code> <Copy value={r.value.replace(/^"|"$/g, "")} />
              </span>
            </span>
            <span className="text-faint">{r.priority != null ? `Priority ${r.priority}` : r.record}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SenderCard({ s, manager }: { s: Sender; manager: boolean }) {
  const { pending, run } = useRun();
  const [editing, setEditing] = useState(false);
  const verified = s.status === "verified";
  return (
    <div className={`rounded-2xl border p-4 ${s.is_default && verified ? "border-brand/40 bg-chip/40" : "border-line"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-brand ring-1 ring-line">
          <Icon name={s.kind === "smtp" ? "mail" : "globe"} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[14px] font-semibold">
            <span className="truncate">{s.from_email}</span>
            {s.is_default && verified && <Pill tone="info">In use</Pill>}
            {verified ? <Pill tone="ok">Verified</Pill> : s.status === "failed" ? <Pill tone="bad">Records not found</Pill> : <Pill tone="warn">Waiting for DNS</Pill>}
          </div>
          <div className="truncate text-[12.5px] text-muted">
            {s.kind === "smtp" ? `Your mailbox · ${s.smtp_host}:${s.smtp_port}` : `Your domain · ${s.domain}`} · shows as “{s.from_name}”
            {s.reply_to ? ` · replies to ${s.reply_to}` : ""}
          </div>
        </div>
      </div>

      {s.last_error && <p className="mt-2 rounded-lg bg-bad-bg px-3 py-2 text-[12.5px] text-bad">{s.last_error}</p>}
      {s.kind === "smtp" && verified && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-surface px-3 py-2 text-[12.5px]">
          <Icon name="inbox" size={13} />
          <span className="min-w-0 flex-1">
            {s.imap_enabled === false
              ? "Replies aren't read from this mailbox."
              : s.imap_error
                ? <span className="text-bad">{s.imap_error}</span>
                : s.imap_checked_at
                  ? `Replies show in Scalency. Inbox last checked ${new Date(s.imap_checked_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.`
                  : "Replies will show in Scalency. The first check is within 5 minutes."}
          </span>
          {manager && (
            <button type="button" disabled={pending} onClick={() => run(() => setReplyReading(s.id, s.imap_enabled === false))} className="font-semibold text-brand">
              {s.imap_enabled === false ? "Turn on" : "Turn off"}
            </button>
          )}
        </div>
      )}
      {s.kind === "domain" && !verified && s.dns_records?.length > 0 && <DnsTable records={s.dns_records} domain={s.domain ?? ""} />}

      {manager && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {s.kind === "domain" && !verified && (
            <button type="button" disabled={pending} onClick={() => run(() => checkDomain(s.id))} className="btn-primary inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold">
              <Icon name="refresh" size={13} /> {pending ? "Checking…" : "Check"}
            </button>
          )}
          {verified && !s.is_default && (
            <button type="button" disabled={pending} onClick={() => run(() => setDefaultSender(s.id))} className="btn-primary min-h-9 rounded-lg px-3 text-[13px] font-semibold">
              Send from this
            </button>
          )}
          {verified && (
            <button type="button" disabled={pending} onClick={() => run(() => sendTestEmail(s.id))} className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold">
              <Icon name="send" size={13} /> Send a test
            </button>
          )}
          <button type="button" onClick={() => setEditing((e) => !e)} className="btn-ghost inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold">
            <Icon name="edit" size={13} /> Edit
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm(`Disconnect ${s.from_email}? Emails will go out from Scalency's address unless another one is in use.`)) run(() => removeSender(s.id));
            }}
            className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-bad hover:bg-bad-bg"
          >
            <Icon name="trash" size={13} /> Disconnect
          </button>
        </div>
      )}

      {editing && (
        <ActionForm action={updateSender} className="mt-3 grid gap-2 rounded-xl bg-surface p-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={s.id} />
          <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
            Name people see
            <input name="from_name" defaultValue={s.from_name} maxLength={80} className="field h-10" />
          </label>
          <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
            Replies go to (optional)
            <input name="reply_to" type="email" defaultValue={s.reply_to ?? ""} placeholder="e.g. team@theirbusiness.co.uk" className="field h-10" />
          </label>
          {s.kind === "domain" && (
            <label className="flex flex-col gap-1 text-[12.5px] font-semibold sm:col-span-2">
              Send from
              <span className="flex items-center gap-1.5">
                <input name="local" defaultValue={s.from_email.split("@")[0]} maxLength={64} className="field h-10 w-40" />
                <span className="text-[13px] text-muted">@{s.domain}</span>
              </span>
            </label>
          )}
          <div className="sm:col-span-2">
            <SubmitButton>Save</SubmitButton>
          </div>
        </ActionForm>
      )}
    </div>
  );
}

export function AddSender({ workspace, userEmail }: { workspace: string; userEmail: string }) {
  const [mode, setMode] = useState<"none" | "smtp" | "domain">("none");
  const [preset, setPreset] = useState<(typeof PRESETS)[number]>(PRESETS[0]);
  const [showServer, setShowServer] = useState(false);

  if (mode === "none")
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => setMode("smtp")} className="rounded-2xl border border-dashed border-line-strong p-4 text-left transition hover:border-brand/50 hover:bg-chip/30">
          <span className="flex items-center gap-2 text-[14px] font-semibold"><Icon name="mail" size={15} /> Connect your mailbox</span>
          <span className="mt-1 block text-[12.5px] leading-relaxed text-muted">Google, Microsoft 365, Zoho or your host. Emails come from your real mailbox. Free, ready in a minute.</span>
        </button>
        <button type="button" onClick={() => setMode("domain")} className="rounded-2xl border border-dashed border-line-strong p-4 text-left transition hover:border-brand/50 hover:bg-chip/30">
          <span className="flex items-center gap-2 text-[14px] font-semibold"><Icon name="globe" size={15} /> Use your own domain</span>
          <span className="mt-1 block text-[12.5px] leading-relaxed text-muted">Like hello@yourbusiness.co.uk. Best for bigger sends. You add a few DNS records once.</span>
        </button>
      </div>
    );

  if (mode === "domain")
    return (
      <div className="rounded-2xl border border-line p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[14px] font-semibold">Use your own domain</span>
          <button type="button" onClick={() => setMode("none")} className="ml-auto text-[13px] font-semibold text-muted hover:text-navy">Cancel</button>
        </div>
        <ActionForm action={addDomain} className="grid gap-2.5 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[12.5px] font-semibold sm:col-span-2">
            Domain
            <input name="domain" required placeholder="yourbusiness.co.uk" className="field h-10" autoFocus />
            <span className="font-normal text-faint">Tip: a subdomain like mail.yourbusiness.co.uk keeps this separate from your normal email.</span>
          </label>
          <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
            Send from
            <span className="flex items-center gap-1.5">
              <input name="local" defaultValue="hello" maxLength={64} className="field h-10 w-32" />
              <span className="text-[13px] font-normal text-muted">@ your domain</span>
            </span>
          </label>
          <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
            Name people see
            <input name="from_name" defaultValue={workspace} maxLength={80} className="field h-10" />
          </label>
          <label className="flex flex-col gap-1 text-[12.5px] font-semibold sm:col-span-2">
            Replies go to (optional)
            <input name="reply_to" type="email" placeholder="The mailbox you read, e.g. you@yourbusiness.co.uk" className="field h-10" />
          </label>
          <div className="sm:col-span-2">
            <SubmitButton pendingText="Adding…">Add domain</SubmitButton>
          </div>
        </ActionForm>
      </div>
    );

  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[14px] font-semibold">Connect your mailbox</span>
        <button type="button" onClick={() => setMode("none")} className="ml-auto text-[13px] font-semibold text-muted hover:text-navy">Cancel</button>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Email provider">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => {
              setPreset(p);
              if (p.key === "other") setShowServer(true);
            }}
            className={`min-h-9 rounded-full px-3.5 text-[13px] font-semibold ${preset.key === p.key ? "bg-navy text-white" : "bg-surface text-muted hover:text-navy"}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="mb-3 rounded-xl bg-surface px-3 py-2.5 text-[12.5px] leading-relaxed text-muted">{preset.help}</p>
      <ActionForm key={preset.key} action={addMailbox} className="grid gap-2.5 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
          Email address (login)
          <input name="user" type="email" required autoComplete="off" placeholder={userEmail} className="field h-10" />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
          {preset.key === "google" || preset.key === "zoho" ? "App password" : "Password"}
          <input name="password" type="password" required autoComplete="new-password" className="field h-10" />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
          Name people see
          <input name="from_name" defaultValue={workspace} maxLength={80} className="field h-10" />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
          Send from (optional)
          <input name="from_email" type="email" placeholder="Same as the login" className="field h-10" />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] font-semibold sm:col-span-2">
          Replies go to (optional)
          <input name="reply_to" type="email" placeholder="Leave blank to get replies in this mailbox" className="field h-10" />
        </label>

        <div className="sm:col-span-2">
          <button type="button" onClick={() => setShowServer((v) => !v)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-muted hover:text-navy">
            <Icon name={showServer ? "chevronDown" : "chevronRight"} size={13} /> Server settings
          </button>
        </div>
        <div className={`grid gap-2.5 sm:col-span-2 sm:grid-cols-3 ${showServer ? "" : "hidden"}`}>
          <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
            Mail server (SMTP)
            <input name="host" defaultValue={preset.host} required placeholder="smtp.yourhost.com" className="field h-10" />
          </label>
          <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
            Port
            <select name="port" defaultValue={String(preset.port)} className="field h-10">
              <option value="465">465</option>
              <option value="587">587</option>
              <option value="2525">2525</option>
              <option value="25">25</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
            Security
            <select name="security" defaultValue={preset.security} className="field h-10">
              <option value="ssl">SSL (usually 465)</option>
              <option value="starttls">STARTTLS (usually 587)</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
          <input type="checkbox" name="make_default" defaultChecked className="h-4 w-4 accent-[var(--color-brand)]" /> Send this workspace&apos;s emails from this mailbox
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <SubmitButton pendingText="Connecting and sending a test…">Connect and send a test</SubmitButton>
          <span className="text-[12px] text-faint">We log in, send a test email to {userEmail}, then save. Your password is stored encrypted.</span>
        </div>
      </ActionForm>
    </div>
  );
}
