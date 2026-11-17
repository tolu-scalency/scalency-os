import "server-only";
import { after } from "next/server";
import { deliverPending } from "@/lib/deliver";

type Client = Parameters<typeof deliverPending>[0];

/**
 * Runs any workflow steps that are now due and sends their messages, AFTER the
 * response has gone back to the browser. The person sees their change straight
 * away instead of waiting for emails and texts to send. If this is ever cut
 * short, the every-minute clock picks the steps up anyway.
 */
export function runWorkflowsSoon(client: Client, accountId: string) {
  after(async () => {
    try {
      await client.rpc("run_due_workflows", { target_account: accountId });
      await deliverPending(client, accountId);
    } catch (e) {
      console.error("Background workflow run failed", e);
    }
  });
}
