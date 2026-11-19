import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminClient } from "@/lib/admin";
import { cleanDefinition } from "@/lib/form-builder";
import { LeadForm } from "@/components/lead-form";

// The public page for a form: os.scalency.us/f/<id>. Add ?embed=1 inside an iframe
// for a see-through background that fits the page around it.

export const dynamic = "force-dynamic";

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const admin = adminClient();
  if (!admin) return null;
  const { data } = await admin.from("forms").select("id, name, status, definition").eq("id", id).maybeSingle();
  if (!data || data.status !== "live") return null;
  return { id: data.id as string, name: data.name as string, def: cleanDefinition(data.definition) };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const form = await load((await params).id);
  return { title: form?.def.title || form?.name || "Form", robots: { index: false } };
}

export default async function PublicForm({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ embed?: string }> }) {
  const [{ id }, { embed }] = await Promise.all([params, searchParams]);
  const form = await load(id);
  if (!form) notFound();
  const embedded = embed === "1";
  const dark = form.def.theme.dark;

  if (embedded)
    return (
      <main style={{ background: "transparent", padding: 2 }}>
        <style>{"html,body{background:transparent!important}"}</style>
        <LeadForm formId={form.id} def={form.def} embed />
      </main>
    );

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "32px 16px", background: dark ? "#0b1220" : "#f3f6fb" }}>
      <div style={{ width: "100%", maxWidth: 560, background: dark ? "#111c33" : "#ffffff", borderRadius: 20, padding: "28px 24px", boxShadow: "0 20px 50px -20px rgba(11,27,58,0.25)" }}>
        <LeadForm formId={form.id} def={form.def} />
      </div>
    </main>
  );
}
