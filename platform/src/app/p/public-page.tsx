import "server-only";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { after } from "next/server";
import { adminClient } from "@/lib/admin";
import { cleanPage, type PageDefinition } from "@/lib/page-builder";
import { PageView } from "@/components/page-view";

// A live page by its workspace, site and page link names:
//   /p/<workspace>/<site>            the site's first page
//   /p/<workspace>/<site>/<page>     another page of a funnel or website
// No Scalency name or icon: the tab shows the page's own title and icon.

export type PublicPage = { id: string; name: string; site: string; workspace: string; def: PageDefinition };

const BLANK_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/%3E";
const SLUG = /^[a-z0-9-]{1,80}$/;

export async function loadPage(workspace: string, site: string, page = ""): Promise<PublicPage | null> {
  if (!SLUG.test(workspace) || !SLUG.test(site) || (page && !SLUG.test(page))) return null;
  const admin = adminClient();
  if (!admin) return null;
  const { data: acc } = await admin.from("accounts").select("id, name").eq("slug", workspace).maybeSingle();
  if (!acc) return null;
  const { data: s } = await admin.from("sites").select("id, name, status").eq("account_id", acc.id).eq("slug", site).maybeSingle();
  if (!s || s.status !== "live") return null;
  let q = admin.from("site_pages").select("id, name, definition").eq("site_id", s.id);
  q = page ? q.eq("slug", page) : q.order("position").limit(1);
  const { data: rows, error } = await q;
  if (error) console.error("Loading a public page failed", error.message);
  const p = rows?.[0];
  if (!p) return null;
  return { id: p.id, name: p.name, site: s.name, workspace: acc.name, def: cleanPage(p.definition) };
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
      <PageView def={page.def} pageId={page.id} />
    </>
  );
}
