import { adminClient } from "@/lib/admin";

// Counts one view of a published form (the browser sends this once per visit).

export const dynamic = "force-dynamic";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 204 });
  const admin = adminClient();
  if (admin) {
    const { error } = await admin.rpc("count_form_view", { target_form: id });
    if (error) console.error("Counting a form view failed", error.message);
  }
  return new Response(null, { status: 204 });
}
