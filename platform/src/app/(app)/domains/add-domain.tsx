"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { notify } from "@/components/toast";
import { addDomain } from "../funnels/domain-actions";

/** Connect a domain to one of the workspace's websites, funnels or pages. */
export function AddDomain({ sites }: { sites: { id: string; name: string; kind: string }[] }) {
  const router = useRouter();
  const [site, setSite] = useState(sites[0]?.id ?? "");
  const [domain, setDomain] = useState("");
  const [pending, start] = useTransition();
  if (!sites.length)
    return (
      <p className="rounded-xl bg-chip px-4 py-3 text-[13px] text-brand">
        Make a website, funnel or page first (Sites, Funnels and pages). Then connect your domain to it here.
      </p>
    );
  return (
    <form
      className="card flex flex-wrap items-end gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!domain.trim() || !site) return;
        start(async () => {
          const r = await addDomain(site, domain.trim());
          notify(r.error ?? r.ok ?? "Added", r.error ? "bad" : "ok");
          if (!r.error) {
            setDomain("");
            router.refresh();
          }
        });
      }}
    >
      <label className="flex min-w-[220px] flex-1 flex-col gap-1.5 text-[12.5px] font-semibold text-navy">
        Domain
        <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="www.yourbusiness.co.uk" className="field h-10 text-[13.5px]" maxLength={253} />
      </label>
      <label className="flex min-w-[220px] flex-1 flex-col gap-1.5 text-[12.5px] font-semibold text-navy">
        Shows
        <select value={site} onChange={(e) => setSite(e.target.value)} className="field h-10 text-[13.5px]">
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.kind})
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending || !domain.trim()} className="btn-primary inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-50">
        <Icon name="plus" size={14} /> {pending ? "Adding…" : "Add domain"}
      </button>
    </form>
  );
}
