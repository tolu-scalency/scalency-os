"use server";

import { refresh } from "next/cache";
import { adminClient } from "@/lib/admin";
import { can, getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { addToNetlify, normaliseDomain, recheckDomain, removeFromNetlify } from "@/lib/domains";

// Own domains for pages, funnels and websites. Members can see them; only people who
// build pages can add, check or remove them. Changes go through the server, which also
// adds or removes the domain on Netlify.

const NO_ACCESS = "You don't have access to change domains. Ask the workspace owner.";

export async function addDomain(siteId: string, input: string): Promise<{ error?: string; ok?: string }> {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) return { error: NO_ACCESS };
  const n = normaliseDomain(input);
  if ("error" in n) return { error: n.error };
  const supabase = await createClient();
  const { data: site } = await supabase.from("sites").select("id").eq("id", siteId).eq("account_id", ws.account.id).maybeSingle();
  if (!site) return { error: "We couldn't find that page." };
  const admin = adminClient();
  if (!admin) return { error: "Domains aren't set up yet." };
  const { count } = await admin.from("site_domains").select("id", { count: "exact", head: true }).eq("site_id", siteId);
  if ((count ?? 0) >= 3) return { error: "One site can have up to 3 domains." };
  const { data: taken } = await admin.from("site_domains").select("account_id").eq("domain", n.domain).maybeSingle();
  if (taken) return { error: taken.account_id === ws.account.id ? "That domain is already connected to one of your pages. Remove it there first." : "That domain is already connected to another Scalency account." };
  const { data: row, error } = await admin.from("site_domains").insert({ account_id: ws.account.id, site_id: siteId, domain: n.domain }).select("id, domain, token, hosting").single();
  if (error || !row) return { error: "We couldn't add that domain. Try again." };
  // Add it to Netlify straight away, so HTTPS is ready by the time the DNS records are in.
  const h = await addToNetlify(n.domain);
  await admin.from("site_domains").update({ hosting: h.hosting, last_error: h.error ?? null }).eq("id", row.id);
  refresh();
  return { ok: "Domain added. Now add the two records below at your domain provider." };
}

export async function checkDomain(id: string): Promise<{ error?: string; ok?: string }> {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) return { error: NO_ACCESS };
  const admin = adminClient();
  if (!admin) return { error: "Domains aren't set up yet." };
  const { data: row } = await admin.from("site_domains").select("id, domain, token, hosting, account_id").eq("id", id).maybeSingle();
  if (!row || row.account_id !== ws.account.id) return { error: "We couldn't find that domain." };
  const r = await recheckDomain(admin, row as { id: string; domain: string; token: string; hosting: string });
  refresh();
  if (r.error) return { error: r.error };
  if (r.verified) return { ok: `${row.domain} is connected. It can take up to an hour for HTTPS to switch on.` };
  return { error: `${r.last_error ?? "Not ready yet."} Records can take up to a few hours to show. We'll keep checking every 10 minutes.` };
}

export async function removeDomain(id: string): Promise<{ error?: string; ok?: string }> {
  const ws = await getWorkspace();
  if (!can(ws, "sites.manage")) return { error: NO_ACCESS };
  const admin = adminClient();
  if (!admin) return { error: "Domains aren't set up yet." };
  const { data: row } = await admin.from("site_domains").select("id, domain, account_id").eq("id", id).maybeSingle();
  if (!row || row.account_id !== ws.account.id) return { error: "We couldn't find that domain." };
  await admin.from("site_domains").delete().eq("id", id);
  await removeFromNetlify(row.domain as string);
  refresh();
  return { ok: "Domain removed." };
}
