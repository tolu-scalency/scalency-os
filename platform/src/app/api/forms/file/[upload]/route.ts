import { adminClient } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

// Opens a file someone uploaded to a form. Only team members of that workspace
// can (row-level security decides whether they can see the upload), and the
// link they're sent to works for five minutes.

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ upload: string }> }) {
  const { upload } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(upload)) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return new Response("Please sign in", { status: 401 });
  const { data: row } = await supabase.from("form_uploads").select("path").eq("id", upload).maybeSingle();
  if (!row) return new Response("Not found", { status: 404 });
  const admin = adminClient();
  if (!admin) return new Response("Not set up", { status: 503 });
  const { data, error } = await admin.storage.from("form-uploads").createSignedUrl(row.path as string, 300);
  if (error || !data) return new Response("Not found", { status: 404 });
  return Response.redirect(data.signedUrl, 302);
}
