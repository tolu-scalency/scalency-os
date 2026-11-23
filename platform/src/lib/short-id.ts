import "server-only";
import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

// Short links: /agents/f5991866 instead of /agents/f5991866-6aa6-43c5-b559-6174520b5308.
// The short form is the first 8 characters of the ID. Full IDs still work, so old links and
// bookmarks keep working.

export { shortId } from "@/lib/short-id-shared";

const FULL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT = /^[0-9a-f]{8}$/i;

type Table = "setter_agents" | "contacts" | "forms" | "sites" | "workflows";

/** The full ID for a link's ID (short or full), in this workspace. Shows "not found" if there's none. */
export async function fullId(table: Table, raw: string): Promise<string> {
  const v = decodeURIComponent(raw).trim().toLowerCase();
  if (FULL.test(v)) return v;
  if (!SHORT.test(v)) notFound();
  const ws = await getWorkspace();
  const supabase = await createClient();
  // IDs sort by their characters, so everything starting with these 8 sits in this range.
  const { data } = await supabase
    .from(table)
    .select("id")
    .eq("account_id", ws.account.id)
    .gte("id", `${v}-0000-0000-0000-000000000000`)
    .lte("id", `${v}-ffff-ffff-ffff-ffffffffffff`)
    .limit(2);
  // Two matches in one workspace is close to impossible; if it happens, ask for the full link.
  if (!data || data.length !== 1) notFound();
  return data[0].id as string;
}
