import { redirect } from "next/navigation";
import { shortId } from "@/lib/short-id-shared";
import { getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

const TABS = ["knowledge", "journey", "showup", "retention", "voice", "reactivate", "test", "rules", "ghl"];

/** Menu shortcuts (Knowledge, Journeys, Rebooking, Voice AI…) open that tab of the clinic's AI setter. */
export default async function AiShortcut({ params }: { params: Promise<{ tab: string }> }) {
  const [{ tab }, ws] = await Promise.all([params, getWorkspace()]);
  const supabase = await createClient();
  const { data } = await supabase.from("setter_agents").select("id").eq("account_id", ws.account.id).order("created_at").limit(1);
  if (!data?.length) redirect("/agents");
  redirect(`/agents/${shortId(data[0].id as string)}${TABS.includes(tab) ? `?tab=${tab}` : ""}`);
}
