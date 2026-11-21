// Runs every minute on Netlify and asks the app to run due workflow steps and send messages.
// Every 5 minutes it also asks the app to read email replies from connected mailboxes.
// Scheduled functions only run on the live (production) site.

async function clock() {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) return new Response("Missing URL or CRON_SECRET", { status: 500 });
  const headers = { authorization: `Bearer ${secret}` };
  const jobs = [fetch(`${base}/api/cron`, { headers })];
  if (new Date().getMinutes() % 5 === 0) jobs.push(fetch(`${base}/api/cron/mail`, { headers }));
  const [main, ...rest] = await Promise.allSettled(jobs);
  for (const r of rest) if (r.status === "rejected") console.error("Reading replies failed", r.reason);
  if (main.status === "rejected") return new Response(String(main.reason), { status: 502 });
  return new Response(await main.value.text(), { status: main.value.status });
}

export default clock;

export const config = { schedule: "* * * * *" };
