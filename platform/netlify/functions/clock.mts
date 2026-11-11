// Runs every minute on Netlify and asks the app to run due workflow steps and send messages.
// Scheduled functions only run on the live (production) site.

async function clock() {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) return new Response("Missing URL or CRON_SECRET", { status: 500 });
  const res = await fetch(`${base}/api/cron`, { headers: { authorization: `Bearer ${secret}` } });
  return new Response(await res.text(), { status: res.status });
}

export default clock;

export const config = { schedule: "* * * * *" };
