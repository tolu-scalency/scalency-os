import "server-only";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { adminClient } from "@/lib/admin";
import { cleanDefinition, type FormDefinition } from "@/lib/form-builder";
import { LeadForm } from "@/components/lead-form";

// Shared by both public addresses of a form:
//   /f/<form id>                       (works for every form, used by embeds)
//   /f/<workspace>/<form link name>    (the address people share)
// No Scalency name or icon: the tab shows the form's own title and icon.

export type PublicForm = { id: string; name: string; workspace: string; def: FormDefinition };

const BLANK_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/%3E";

export async function loadById(id: string): Promise<PublicForm | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const admin = adminClient();
  if (!admin) return null;
  const { data, error } = await admin.from("forms").select("id, name, status, definition, accounts(name)").eq("id", id).maybeSingle();
  if (error) console.error("Loading a public form failed", error.message);
  return toForm(data);
}

export async function loadBySlug(workspace: string, slug: string): Promise<PublicForm | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(workspace) || !/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const admin = adminClient();
  if (!admin) return null;
  const { data: acc } = await admin.from("accounts").select("id").eq("slug", workspace).maybeSingle();
  if (!acc) return null;
  const { data, error } = await admin.from("forms").select("id, name, status, definition, accounts(name)").eq("account_id", acc.id).eq("slug", slug).maybeSingle();
  if (error) console.error("Loading a public form failed", error.message);
  return toForm(data);
}

function toForm(data: Record<string, unknown> | null): PublicForm | null {
  if (!data || data.status !== "live") return null;
  const acc = data.accounts as { name?: string } | { name?: string }[] | null;
  const workspace = (Array.isArray(acc) ? acc[0]?.name : acc?.name) ?? "";
  return { id: data.id as string, name: data.name as string, workspace, def: cleanDefinition(data.definition) };
}

export function formMetadata(form: PublicForm | null): Metadata {
  const icon = form?.def.page.icon || BLANK_ICON;
  return {
    title: { absolute: form ? form.def.page.title || form.name : "Form not found" },
    description: null,
    applicationName: form?.workspace || null,
    icons: { icon, apple: icon, shortcut: icon },
    robots: { index: false, follow: false },
  };
}

export function formViewport(form: PublicForm | null): Viewport {
  return { themeColor: form?.def.theme.accent ?? "#ffffff", width: "device-width", initialScale: 1 };
}

export function FormPage({ form, embedded }: { form: PublicForm; embedded: boolean }) {
  const { def } = form;
  const t = def.theme;
  const { fbPixel, googleTag } = def.tracking;
  const extras = (
    <>
      {def.page.css && <style>{def.page.css}</style>}
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
    </>
  );

  if (embedded)
    return (
      <main className="sf-page sf-embed" style={{ background: "transparent", padding: 2 }}>
        <style>{"html,body{background:transparent!important}"}</style>
        {extras}
        <div className="sf-form">
          <LeadForm formId={form.id} def={def} embed />
        </div>
      </main>
    );

  return (
    <main className="sf-page" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "32px 16px", background: t.background }}>
      {extras}
      <div
        className="sf-form"
        style={{
          width: "100%",
          maxWidth: t.width,
          ...(t.card ? { background: t.dark ? "#111c33" : "#ffffff", borderRadius: Math.max(t.radius + 6, 14), padding: "32px 28px", boxShadow: "0 24px 60px -24px rgba(11,27,58,0.28)" } : {}),
        }}
      >
        <LeadForm formId={form.id} def={def} />
      </div>
    </main>
  );
}
