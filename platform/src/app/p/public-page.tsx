import "server-only";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { after } from "next/server";
import { adminClient } from "@/lib/admin";
import { cleanPage, type PageDefinition, type Section } from "@/lib/page-builder";
import { cleanSiteSettings, siteLinks, type SiteLinks, type SitePageInfo } from "@/lib/site-builder";
import { PageView } from "@/components/page-view";

// A live page by its workspace, site and page link names:
//   /p/<workspace>/<site>            the site's first page
//   /p/<workspace>/<site>/<page>     another page of a funnel or website
// or on the site's own domain (the proxy sends those to /d/<domain>/...):
//   https://www.theirbusiness.co.uk/          the first page
//   https://www.theirbusiness.co.uk/<page>    another page
// No Scalency name or icon: the tab shows the page's own title and icon.

export type PublicPage = {
  id: string;
  name: string;
  site: string;
  workspace: string;
  def: PageDefinition;
  links: SiteLinks | null;
  header: Section[];
  footer: Section[];
};

const BLANK_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/%3E";
const SLUG = /^[a-z0-9-]{1,80}$/;
const HOST = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
type Admin = NonNullable<ReturnType<typeof adminClient>>;
type SiteRow = { id: string; name: string; kind: string; status: string; settings: unknown; account_id: string };

/** One page of a live site. base is where the site's pages live: "/p/<workspace>/<site>" or "" on its own domain. */
async function sitePage(admin: Admin, s: SiteRow, workspace: string, page: string, base: string): Promise<PublicPage | null> {
  if (s.status !== "live") return null;
  const { data: rows, error } = await admin.from("site_pages").select("id, name, slug, position, in_menu").eq("site_id", s.id).order("position");
  if (error) console.error("Loading a public page failed", error.message);
  const pages = (rows ?? []) as SitePageInfo[];
  const p = page ? pages.find((x) => x.slug === page) : pages[0];
  if (!p) return null;
  const { data: full } = await admin.from("site_pages").select("definition").eq("id", p.id).single();
  const parts = s.kind === "website" ? cleanSiteSettings(s.settings) : { header: [], footer: [] };
  return {
    id: p.id,
    name: p.name,
    site: s.name,
    workspace,
    def: cleanPage(full?.definition),
    links: s.kind === "page" && pages.length < 2 ? null : siteLinks(pages, p.id, base),
    ...parts,
  };
}

export async function loadPage(workspace: string, site: string, page = ""): Promise<PublicPage | null> {
  if (!SLUG.test(workspace) || !SLUG.test(site) || (page && !SLUG.test(page))) return null;
  const admin = adminClient();
  if (!admin) return null;
  const { data: acc } = await admin.from("accounts").select("id, name").eq("slug", workspace).maybeSingle();
  if (!acc) return null;
  const { data: s } = await admin.from("sites").select("id, name, kind, status, settings, account_id").eq("account_id", acc.id).eq("slug", site).maybeSingle();
  if (!s) return null;
  return sitePage(admin, s as SiteRow, acc.name as string, page, `/p/${workspace}/${site}`);
}

/** A page on a site's own domain, like www.theirbusiness.co.uk/about. */
export async function loadDomainPage(host: string, page = ""): Promise<PublicPage | null> {
  const domain = host.toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  if (!HOST.test(domain) || (page && !SLUG.test(page))) return null;
  const admin = adminClient();
  if (!admin) return null;
  const other = domain.startsWith("www.") ? domain.slice(4) : `www.${domain}`;
  const { data: ds } = await admin.from("site_domains").select("domain, site_id").in("domain", [domain, other]).eq("status", "verified");
  const d = ds?.find((x) => x.domain === domain) ?? ds?.[0];
  if (!d) return null;
  const { data: s } = await admin.from("sites").select("id, name, kind, status, settings, account_id").eq("id", d.site_id).maybeSingle();
  if (!s) return null;
  const { data: acc } = await admin.from("accounts").select("name").eq("id", s.account_id).maybeSingle();
  return sitePage(admin, s as SiteRow, (acc?.name as string) ?? "", page, "");
}

export function pageMetadata(p: PublicPage | null): Metadata {
  if (!p) return { title: { absolute: "Page not found" }, robots: { index: false, follow: false } };
  const icon = p.def.seo.icon || BLANK_ICON;
  const title = p.def.seo.title || p.site;
  return {
    title: { absolute: title },
    description: p.def.seo.description || null,
    applicationName: p.workspace || null,
    icons: { icon, apple: icon, shortcut: icon },
    robots: p.def.seo.noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { title, description: p.def.seo.description || undefined, images: p.def.seo.image ? [p.def.seo.image] : undefined, type: "website" },
    twitter: { card: p.def.seo.image ? "summary_large_image" : "summary", title, description: p.def.seo.description || undefined, images: p.def.seo.image ? [p.def.seo.image] : undefined },
  };
}

export function pageViewport(p: PublicPage | null): Viewport {
  return { themeColor: p?.def.theme.accent ?? "#ffffff", width: "device-width", initialScale: 1 };
}

export function LivePage({ page }: { page: PublicPage }) {
  const admin = adminClient();
  if (admin) after(async () => {
    await admin.rpc("count_page_view", { target_page: page.id });
  });
  const { fbPixel, googleTag } = page.def.tracking;
  return (
    <>
      <style>{"html{scroll-behavior:smooth}body{margin:0}"}</style>
      {fbPixel && (
        <Script id="fb-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${fbPixel}');fbq('track','PageView');`}
        </Script>
      )}
      {googleTag && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${googleTag}`} strategy="afterInteractive" />
          <Script id="gtag" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${googleTag}');`}
          </Script>
        </>
      )}
      <PageView def={page.def} pageId={page.id} links={page.links} header={page.header} footer={page.footer} />
    </>
  );
}
