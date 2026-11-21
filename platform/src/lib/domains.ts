import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// A client's own domain for a page, funnel or website, like www.theirbusiness.co.uk.
//
// 1. They add two records at their domain provider (we show them which):
//    - TXT  _scalency.<domain>   proves they own it, so nobody else can claim it
//    - CNAME (for www. and other subdomains) or A (for the bare domain) pointing at Netlify
// 2. We add the domain to the Netlify site (NETLIFY_AUTH_TOKEN), which sets up HTTPS.
// 3. "Check" looks the records up (public DNS over HTTPS) and switches the domain on.

export type DnsRow = { type: "TXT" | "CNAME" | "A"; host: string; value: string; why: string; ok?: boolean };
export type DomainCheck = { owned: boolean; pointing: boolean; rows: DnsRow[]; error?: string };

export const NETLIFY_IP = "75.2.60.5";
const NETLIFY_APEX = "apex-loadbalancer.netlify.com";
const HOST = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
// Endings where the domain someone buys has three parts, like theirbusiness.co.uk.
const TWO_PART = new Set(["co.uk", "org.uk", "me.uk", "ltd.uk", "plc.uk", "ac.uk", "com.au", "net.au", "org.au", "co.nz", "co.za", "com.ng", "org.ng", "co.ke", "com.gh", "co.in", "com.br", "com.mx", "co.jp", "com.sg", "com.my", "co.il", "com.tr", "com.cn", "com.hk"]);

/** Netlify's address for this site, for CNAME records. */
export function cnameTarget() {
  const set = process.env.PAGES_CNAME_TARGET?.trim();
  if (set) return set.replace(/\.$/, "");
  const name = process.env.NETLIFY_SITE_NAME?.trim();
  return name ? `${name}.netlify.app` : NETLIFY_APEX;
}

/** "https://www.TheirBusiness.co.uk/about" becomes "www.theirbusiness.co.uk", or an error in plain English. */
export function normaliseDomain(input: string): { domain: string } | { error: string } {
  const d = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
  if (!d) return { error: "Type the domain, like www.yourbusiness.co.uk." };
  if (!HOST.test(d) || d.length > 253) return { error: "That doesn't look like a domain. Type it like www.yourbusiness.co.uk." };
  const app = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_APP_URL || "https://os.scalency.us").hostname;
    } catch {
      return "os.scalency.us";
    }
  })();
  if (d === app || d.endsWith(".netlify.app") || d === "scalency.us" || d.endsWith(".scalency.us") || d === "localhost") return { error: "Use a domain your business owns." };
  return { domain: d };
}

/** The part of the domain they bought: theirbusiness.co.uk for www.theirbusiness.co.uk. */
export function apexOf(domain: string) {
  const parts = domain.split(".");
  const two = parts.slice(-2).join(".");
  return TWO_PART.has(two) && parts.length >= 3 ? parts.slice(-3).join(".") : two;
}

/** The records to add, with the "Host" written the way most providers (Namecheap, GoDaddy, 123 Reg) want it. */
export function recordsFor(domain: string, token: string): DnsRow[] {
  const apex = apexOf(domain);
  const sub = domain === apex ? "" : domain.slice(0, -(apex.length + 1));
  return [
    { type: "TXT", host: sub ? `_scalency.${sub}` : "_scalency", value: `scalency-verify=${token}`, why: "Proves the domain is yours." },
    sub
      ? { type: "CNAME", host: sub, value: cnameTarget(), why: "Points the address at your page." }
      : { type: "A", host: "@", value: NETLIFY_IP, why: "Points the address at your page." },
  ];
}

async function lookup(name: string, type: "TXT" | "CNAME" | "A"): Promise<string[]> {
  const urls = [
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { accept: "application/dns-json" }, cache: "no-store", signal: AbortSignal.timeout(6000) });
      if (!r.ok) continue;
      const j = (await r.json()) as { Answer?: { type: number; data: string }[] };
      const code = { A: 1, CNAME: 5, TXT: 16 }[type];
      return (j.Answer ?? []).filter((a) => a.type === code).map((a) => a.data.replace(/^"|"$/g, "").replace(/"\s*"/g, "").replace(/\.$/, "").toLowerCase());
    } catch {
      // Try the next resolver.
    }
  }
  throw new Error("dns");
}

/** Looks the records up. owned: the TXT record is there. pointing: the domain reaches Netlify. */
export async function checkDns(domain: string, token: string): Promise<DomainCheck> {
  const rows = recordsFor(domain, token);
  try {
    const txt = await lookup(`_scalency.${domain}`, "TXT");
    const owned = txt.includes(`scalency-verify=${token}`);
    rows[0].ok = owned;
    let pointing = false;
    const target = cnameTarget().toLowerCase();
    const cname = await lookup(domain, "CNAME");
    if (cname.some((c) => c === target || c === NETLIFY_APEX || c.endsWith(".netlify.app"))) pointing = true;
    if (!pointing) {
      const a = await lookup(domain, "A");
      if (a.includes(NETLIFY_IP)) pointing = true;
      else if (a.length) {
        // A flattened CNAME or ALIAS record shows Netlify's own addresses.
        const ours = new Set([...(await lookup(target, "A").catch(() => [])), ...(await lookup(NETLIFY_APEX, "A").catch(() => []))]);
        pointing = a.some((x) => ours.has(x));
      }
    }
    rows[1].ok = pointing;
    return { owned, pointing, rows };
  } catch {
    return { owned: false, pointing: false, rows, error: "We couldn't look the domain up just now. Try again in a minute." };
  }
}

// ---------------------------------------------------------------------------
// Netlify: the domain must be on the Netlify site for HTTPS to work.
// Needs NETLIFY_AUTH_TOKEN (a personal access token). The site ID comes from
// Netlify's own build settings, or NETLIFY_SITE_ID if set.
// ---------------------------------------------------------------------------

function netlify() {
  const token = process.env.NETLIFY_AUTH_TOKEN?.trim();
  const site = (process.env.NETLIFY_SITE_ID || process.env.NETLIFY_BUILD_SITE_ID || "").trim();
  return token && site ? { token, site } : null;
}

export const netlifyReady = () => Boolean(netlify());

async function aliases(n: { token: string; site: string }) {
  const r = await fetch(`https://api.netlify.com/api/v1/sites/${n.site}`, { headers: { authorization: `Bearer ${n.token}` }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`Netlify said ${r.status}`);
  const j = (await r.json()) as { domain_aliases?: string[] };
  return j.domain_aliases ?? [];
}

async function setAliases(n: { token: string; site: string }, list: string[]) {
  const r = await fetch(`https://api.netlify.com/api/v1/sites/${n.site}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${n.token}`, "content-type": "application/json" },
    body: JSON.stringify({ domain_aliases: list }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`Netlify said ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

/** Adds the domain to the Netlify site. "manual" means Netlify isn't connected, so it has to be added by hand. */
export async function addToNetlify(domain: string): Promise<{ hosting: "added" | "manual" | "failed"; error?: string }> {
  const n = netlify();
  if (!n) return { hosting: "manual" };
  try {
    const list = await aliases(n);
    if (!list.includes(domain)) {
      // Netlify recommends no more than 50 extra domains on one site.
      if (list.length >= 50) return { hosting: "failed", error: "Scalency has reached Netlify's limit of 50 own domains. Contact support." };
      await setAliases(n, [...list, domain]);
    }
    return { hosting: "added" };
  } catch (e) {
    return { hosting: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}

export async function removeFromNetlify(domain: string) {
  const n = netlify();
  if (!n) return;
  try {
    const list = await aliases(n);
    if (list.includes(domain)) await setAliases(n, list.filter((d) => d !== domain));
  } catch (e) {
    console.error("Removing a domain from Netlify failed", e);
  }
}

/** Checks a domain and saves the result. Switches it on once it's owned and pointing. */
export async function recheckDomain(admin: SupabaseClient, row: { id: string; domain: string; token: string; hosting: string }) {
  const r = await checkDns(row.domain, row.token);
  let hosting = row.hosting;
  let hostErr: string | undefined;
  if (r.owned && hosting !== "added") {
    const h = await addToNetlify(row.domain);
    hosting = h.hosting;
    hostErr = h.error;
  }
  const verified = r.owned && r.pointing;
  const last_error = r.error ?? hostErr ?? (!r.owned ? "The TXT record isn't showing yet." : !r.pointing ? `The ${r.rows[1].type} record isn't pointing at Scalency yet.` : null);
  await admin
    .from("site_domains")
    .update({ status: verified ? "verified" : "pending", hosting, last_error, checked_at: new Date().toISOString(), ...(verified ? { verified_at: new Date().toISOString() } : {}) })
    .eq("id", row.id);
  return { ...r, verified, hosting, last_error };
}

/** The clock re-checks new domains every 10 minutes for 3 days, so they switch on by themselves. */
export async function recheckPendingDomains(admin: SupabaseClient) {
  const { data } = await admin
    .from("site_domains")
    .select("id, domain, token, hosting")
    .eq("status", "pending")
    .gte("created_at", new Date(Date.now() - 3 * 86400_000).toISOString())
    .limit(20);
  for (const d of data ?? []) await recheckDomain(admin, d as { id: string; domain: string; token: string; hosting: string });
  return data?.length ?? 0;
}
