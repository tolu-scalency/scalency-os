// Runs every minute on Netlify and asks the app to run due workflow steps and send messages.
// Every 5 minutes it also asks the app to read email replies from connected mailboxes.
// Every minute it asks the AI setter (Supabase function ai-setter) to send first texts
// that waited for opening hours, and follow-ups that are due.
// Scheduled functions only run on the live (production) site.

async function clock() {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) return new Response("Missing URL or CRON_SECRET", { status: 500 });
  const headers = { authorization: `Bearer ${secret}` };
  const jobs = [fetch(`${base}/api/cron`, { headers })];
  if (new Date().getMinutes() % 5 === 0) jobs.push(fetch(`${base}/api/cron/mail`, { headers }));
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  if (supabase) jobs.push(fetch(`${supabase}/functions/v1/ai-setter?event=tick`, { method: "POST", headers: { apikey: publishable, "content-type": "application/json" }, body: "{}" }));
  const [main, ...rest] = await Promise.allSettled(jobs);
  for (const r of rest) if (r.status === "rejected") console.error("A clock job failed", r.reason);
  if (main.status === "rejected") return new Response(String(main.reason), { status: 502 });
  return new Response(await main.value.text(), { status: main.value.status });
}

export default clock;

export const config = { schedule: "* * * * *" };
